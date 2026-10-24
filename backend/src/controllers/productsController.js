const db = require('../db/database');
const xlsx = require('xlsx');

function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

// Nota sobre el mapeo de filas: en Postgres, specs ya vuelve como objeto (la
// columna es jsonb) e is_active como booleano. Los JSON.parse/!! que hacía falta
// con SQLite desaparecieron.

// GET /api/products
async function getAll(req, res) {
  try {
    const { category, search, active, page = 1, limit = 20, promo_first } = req.query;
    const take = parseInt(limit);
    const pageNum = parseInt(page);

    // Para el listado de productos se priorizan los en promocion (is_promo).
    // Si se pide 20 y hay menos en promo, se completan con el resto al azar.
    if (promo_first === '1' || promo_first === 'true') {
      const conditions = ['1=1'];
      const params = [];

      if (active !== 'all') {
        conditions.push('p.is_active = true');
      }

      if (category) {
        params.push(category);
        conditions.push(`c.slug = $${params.length}`);
      }

      if (search) {
        params.push(`%${search}%`);
        conditions.push(
          `(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length} OR p.brand ILIKE $${params.length})`
        );
      }

      const from = `
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE ${conditions.join(' AND ')}
      `;

      const { total } = await db.prepare(`SELECT COUNT(*) as total ${from}`).get(...params);

      // Primero todos los productos en promocion, luego el resto aleatorizados.
      // Con LIMIT/OFFSET se aplican sobre el conjunto completo.
      const offset = (pageNum - 1) * take;
      params.push(take, offset);
      const products = await db.prepare(`
        SELECT p.*, c.name as category_name, c.slug as category_slug
        ${from}
        ORDER BY COALESCE(p.is_promo, false) DESC, RANDOM(), p.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `).all(...params);

      return res.json({
        products,
        pagination: {
          page: pageNum,
          limit: take,
          total,
          pages: Math.ceil(total / take),
        },
      });
    }

    const offset = (pageNum - 1) * take;

    // El WHERE se arma una vez y lo comparten la consulta de conteo y la de
    // listado. Antes se derivaba el conteo con un replace() por regex sobre el
    // SELECT, que se rompía con solo tocar la lista de columnas.
    const conditions = ['1=1'];
    const params = [];

    if (active !== 'all') {
      conditions.push('p.is_active = true');
    }

    if (category) {
      params.push(category);
      conditions.push(`c.slug = $${params.length}`);
    }

    if (search) {
      // ILIKE, no LIKE: en SQLite LIKE ignoraba mayúsculas, en Postgres no.
      // El mismo término se referencia tres veces con el mismo $n.
      params.push(`%${search}%`);
      conditions.push(
        `(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length} OR p.brand ILIKE $${params.length})`
      );
    }

    const from = `
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${conditions.join(' AND ')}
    `;

    const { total } = await db.prepare(`SELECT COUNT(*) as total ${from}`).get(...params);

    params.push(take, offset);
    const products = await db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      ${from}
      ORDER BY p.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `).all(...params);

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
}

// GET /api/products/:id or /api/products/slug/:slug
async function getOne(req, res) {
  try {
    const { id } = req.params;
    let product;

    const baseQuery = `
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `;

    // Buscar por slug primero, o por id si coincide con el id numérico.
    // Así funciona tanto con slugs numéricos (EAN) como con slugs alfanuméricos.
    product = await db.prepare(`${baseQuery} WHERE p.slug = $1 OR CAST(p.id AS TEXT) = $1`).get(id);

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ product });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
}

// POST /api/products (admin)
async function create(req, res) {
  try {
    const { name, description, price, stock, category_id, brand, image, specs, is_active = 1, is_promo = false } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
    }

    let slug = slugify(name);

    // Asegurar unicidad: si el slug ya existe, se agrega un sufijo.
    const existingSlug = await db.prepare('SELECT id FROM products WHERE slug = $1').get(slug);
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    // RETURNING * devuelve la fila creada en la misma sentencia: reemplaza al
    // INSERT + SELECT WHERE id = lastInsertRowid de sql.js.
    const inserted = await db.prepare(`
      INSERT INTO products (name, slug, description, price, stock, category_id, brand, image, specs, is_active, is_promo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `).run(
      name,
      slug,
      description || null,
      price,
      stock || 0,
      category_id || null,
      brand || null,
      image || null,
      specs || null,
      Boolean(is_active),
      Boolean(is_promo)
    );

    res.status(201).json({ message: 'Producto creado', product: inserted.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
}

// PUT /api/products/:id (admin)
async function update(req, res) {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT * FROM products WHERE id = $1').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const {
      name = existing.name,
      description = existing.description,
      price = existing.price,
      stock = existing.stock,
      category_id = existing.category_id,
      brand = existing.brand,
      image = existing.image,
      specs = existing.specs,
      is_active = existing.is_active,
      is_promo = existing.is_promo,
    } = req.body;

    let slug = existing.slug;
    if (name !== existing.name) {
      slug = slugify(name);
      const conflict = await db.prepare('SELECT id FROM products WHERE slug = $1 AND id != $2').get(slug, id);
      if (conflict) slug = `${slug}-${id}`;
    }

    // updated_at lo pone el trigger de la tabla, no la consulta.
    const updated = await db.prepare(`
      UPDATE products SET
        name = $1, slug = $2, description = $3, price = $4, stock = $5,
        category_id = $6, brand = $7, image = $8, specs = $9, is_active = $10, is_promo = $11
      WHERE id = $12
      RETURNING *
    `).run(
      name, slug, description, price, stock,
      category_id, brand, image,
      specs || null,
      Boolean(is_active),
      Boolean(is_promo),
      id
    );

    res.json({ message: 'Producto actualizado', product: updated.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
}

// DELETE /api/products/:id (admin)
async function remove(req, res) {
  try {
    const { id } = req.params;
    const existing = await db.prepare('SELECT id FROM products WHERE id = $1').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    await db.prepare('DELETE FROM products WHERE id = $1').run(id);
    res.json({ message: 'Producto eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
}

function normalizeHeader(h) {
  if (h === undefined || h === null) return '';
  return String(h).trim().toLowerCase().replace(/\s+/g, '');
}

function getCell(row, key) {
  if (!row) return undefined;
  // buscar por nombre exacto o normalizado
  if (row[key] !== undefined) return row[key];
  const nk = normalizeHeader(key);
  for (const k of Object.keys(row)) {
    if (normalizeHeader(k) === nk) return row[k];
  }
  return undefined;
}

// Devuelve el primer valor no vacío de una lista de encabezados alternativos.
// Sirve para aceptar tanto el nombre en la planilla ("Precio Compra") como el
// nombre de la columna en la base ("purchase_price").
function getCellAny(row, keys) {
  for (const key of keys) {
    const v = getCell(row, key);
    if (v !== undefined && String(v).trim() !== '') return v;
  }
  return undefined;
}

// Parseo tolerante de números. La version anterior borraba todos los puntos y
// despues cambiaba la coma por punto: "10.5" terminaba valiendo 105. Ahora se
// detecta cual es el separador decimal segun el formato:
//   "10,5"      -> 10.5     (coma decimal)
//   "10.5"      -> 10.5     (punto decimal)
//   "1.234,56"  -> 1234.56  (miles con punto, decimal con coma)
//   "1,234.56"  -> 1234.56  (miles con coma, decimal con punto)
function toNumber(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'number') return isNaN(v) ? undefined : v;

  // Se descartan simbolos de moneda, espacios y separadores de miles raros.
  let s = String(v).trim().replace(/[^\d.,-]/g, '');
  if (!s || s === '-' || s === '.' || s === ',') return undefined;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    // El ultimo separador que aparece es el decimal.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    const partes = s.split(',');
    // Una sola coma con 1 o 2 decimales es un decimal; el resto son miles.
    s = partes.length === 2 && partes[1].length <= 2
      ? `${partes[0]}.${partes[1]}`
      : s.replace(/,/g, '');
  } else if (hasDot) {
    // Solo puntos. "10.5" es decimal, pero "1.500" en formato es-AR son miles.
    // Se decide por la forma: agrupacion de a 3 digitos = separador de miles.
    const negativo = s.startsWith('-');
    const cuerpo = negativo ? s.slice(1) : s;
    if (/^\d{1,3}(\.\d{3})+$/.test(cuerpo)) {
      s = `${negativo ? '-' : ''}${cuerpo.replace(/\./g, '')}`;
    }
  }

  const n = Number(s);
  return isNaN(n) ? undefined : n;
}

function toBool(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['true','1','si','sí','yes','y','activo'].includes(s)) return true;
  if (['false','0','no','inactivo'].includes(s)) return false;
  return undefined;
}

function parseSpecs(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'object') return v;
  const s = String(v).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

// Encabezados aceptados para los campos que exporta el sistema de gestion
// externo. Se acepta el nombre de columna de la base y el nombre original.
const CAMPOS_EXPORT = {
  purchase_price: ['purchase_price', 'precio compra', 'preciocompra', 'precio_compra'],
  min_stock: ['min_stock', 'stockminimo', 'stock minimo', 'stock_minimo'],
  vat_rate: ['vat_rate', 'alicuotaiva', 'alicuota iva', 'alicuota_iva'],
  supplier_code: ['supplier_code', 'codigoprov', 'codigo prov', 'codigo_prov'],
};

function leerCamposExport(row) {
  return {
    purchase_price: toNumber(getCellAny(row, CAMPOS_EXPORT.purchase_price)),
    min_stock: toNumber(getCellAny(row, CAMPOS_EXPORT.min_stock)),
    vat_rate: toNumber(getCellAny(row, CAMPOS_EXPORT.vat_rate)),
    supplier_code: getCellAny(row, CAMPOS_EXPORT.supplier_code),
  };
}

async function importProducts(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Falta el archivo. Enviá un archivo .xlsx, .xls o .csv' });
    }

    const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return res.status(400).json({ error: 'El archivo no tiene hojas' });
    const ws = wb.Sheets[sheetName];
    // header:1 toma la primera fila como encabezados
    const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });

    if (!rows.length) {
      return res.status(400).json({ error: 'La planilla está vacía' });
    }

    const report = { creados: 0, actualizados: 0, errores: [] };
    const categories = await db.prepare('SELECT id, name FROM categories').all();

    const findCategoryById = (id) => {
      if (id === undefined || id === null || id === '') return undefined;
      const nid = Number(id);
      if (isNaN(nid)) return undefined;
      return categories.find((c) => Number(c.id) === nid);
    };

    await db.transaction(async (tx) => {
      const ensureCategory = async (idCategory, categoryName) => {
        let cat = findCategoryById(idCategory);
        if (cat) return cat;
        if (!categoryName || String(categoryName).trim() === '') return undefined;
        const name = String(categoryName).trim();
        const slugCat = slugify(name);
        // intentar crear si no existe (usar la conexion de la transaccion)
        const existing = await tx.prepare('SELECT id, name FROM categories WHERE slug = $1 OR LOWER(name) = LOWER($2)').get(slugCat, name);
        if (existing) {
          // actualizar cache local
          if (!categories.find((c) => Number(c.id) === Number(existing.id))) {
            categories.push({ id: existing.id, name: existing.name });
          }
          return existing;
        }
        const ins = await tx.prepare('INSERT INTO categories (name, slug) VALUES ($1, $2) RETURNING id, name').run(name, slugCat);
        const created = ins.rows[0];
        categories.push(created);
        return created;
      };
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const fila = i + 2; // +2 porque fila 1 = encabezados
        try {
          const slugPlanilla = getCell(row, 'slug');
          const slugKey = slugPlanilla !== undefined && String(slugPlanilla).trim() !== '' ? String(slugPlanilla).trim() : null;

          if (!slugKey) {
            report.errores.push({ fila, motivo: "Falta 'slug' para identificar el producto" });
            continue;
          }

          let product = await tx.prepare('SELECT * FROM products WHERE slug = $1').get(slugKey);

          const estado = getCell(row, 'estado') !== undefined ? String(getCell(row, 'estado')).trim().toLowerCase() : '';
          const isActualizar = estado === 'actualizado';

          if (!product) {
            // crear
            const name = getCell(row, 'name') !== undefined ? String(getCell(row, 'name')).trim() : '';
            if (!name) {
              report.errores.push({ fila, motivo: "Para crear el producto es obligatorio 'name'" });
              continue;
            }
            const price = toNumber(getCell(row, 'price'));
            if (price === undefined) {
              report.errores.push({ fila, motivo: "Para crear el producto es obligatorio 'price' numérico" });
              continue;
            }

            const idCategory = getCell(row, 'idCategory');
            const categoryName = getCell(row, 'CategoryName');
            let category_id = null;
            try {
              const cat = await ensureCategory(idCategory, categoryName);
              if (cat) category_id = Number(cat.id);
            } catch (e) {
              report.errores.push({ fila, motivo: `Error con categoría: ${e.message}` });
              continue;
            }

            let slug = slugify(name);
            if (slug !== slugKey) {
              // si viene slug distinto al generado, respetar el slug de la planilla para mantener coherencia con la clave
              slug = slugKey;
            }
            // asegurar unicidad por si acaso
            const conflict = await tx.prepare('SELECT id FROM products WHERE slug = $1').get(slug);
            if (conflict) {
              report.errores.push({ fila, motivo: `Slug '${slug}' ya existe en otro producto` });
              continue;
            }

            const description = getCell(row, 'description');
            const stock = toNumber(getCell(row, 'stock'));
            const brand = getCell(row, 'brand');
            const image = getCell(row, 'image');
            const specs = parseSpecs(getCell(row, 'specs'));
            const is_active = toBool(getCell(row, 'is_active'));
            const activeVal = is_active === undefined ? true : is_active;
            const extra = leerCamposExport(row);

            const inserted = await tx.prepare(`
              INSERT INTO products (
                name, slug, description, price, stock, category_id, brand, image, specs, is_active,
                purchase_price, min_stock, vat_rate, supplier_code
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
              RETURNING *
            `).run(
              name,
              slug,
              description !== undefined && description !== '' ? description : null,
              price,
              stock !== undefined ? stock : 0,
              category_id,
              brand !== undefined && brand !== '' ? brand : null,
              image !== undefined && image !== '' ? image : null,
              specs !== undefined ? specs : null,
              activeVal,
              extra.purchase_price !== undefined ? extra.purchase_price : null,
              extra.min_stock !== undefined ? extra.min_stock : 0,
              extra.vat_rate !== undefined ? extra.vat_rate : null,
              extra.supplier_code !== undefined ? extra.supplier_code : null
            );
            report.creados++;
            continue;
          }

          // actualizar: solo si estado === 'actualizado'
          if (!isActualizar) {
            report.errores.push({ fila, motivo: "Producto existe y el campo 'estado' no es 'actualizado'. No se modifica." });
            continue;
          }

          const updates = [];
          const params = [];
          const add = (field, val) => { params.push(val); updates.push(`${field} = $${params.length}`); };

          const nameUp = getCell(row, 'name');
          if (nameUp !== undefined && String(nameUp).trim() !== '') {
            const newName = String(nameUp).trim();
            add('name', newName);
            // si cambia nombre, mantener slug de planilla si viene, sino recalcular pero respetando unicidad
            if (slugKey) {
              const conflict = await tx.prepare('SELECT id FROM products WHERE slug = $1 AND id != $2').get(slugKey, product.id);
              if (conflict) {
                report.errores.push({ fila, motivo: `Slug '${slugKey}' ya pertenece a otro producto` });
                continue;
              }
              add('slug', slugKey);
            }
          } else if (slugKey && slugKey !== product.slug) {
            const conflict = await tx.prepare('SELECT id FROM products WHERE slug = $1 AND id != $2').get(slugKey, product.id);
            if (conflict) {
              report.errores.push({ fila, motivo: `Slug '${slugKey}' ya pertenece a otro producto` });
              continue;
            }
            add('slug', slugKey);
          }

          const descUp = getCell(row, 'description');
          if (descUp !== undefined) {
            add('description', descUp === '' ? null : descUp);
          }
          const priceUp = toNumber(getCell(row, 'price'));
          if (priceUp !== undefined) {
            if (priceUp < 0) { report.errores.push({ fila, motivo: 'price no puede ser negativo' }); continue; }
            add('price', priceUp);
          }
          const stockUp = toNumber(getCell(row, 'stock'));
          if (stockUp !== undefined) {
            if (stockUp < 0) { report.errores.push({ fila, motivo: 'stock no puede ser negativo' }); continue; }
            add('stock', stockUp);
          }
          const brandUp = getCell(row, 'brand');
          if (brandUp !== undefined) add('brand', brandUp === '' ? null : brandUp);
          const imageUp = getCell(row, 'image');
          if (imageUp !== undefined) add('image', imageUp === '' ? null : imageUp);

          const idCategoryUp = getCell(row, 'idCategory');
          const catNameUp = getCell(row, 'CategoryName');
          if (idCategoryUp !== undefined || catNameUp !== undefined) {
            try {
              const cat = await ensureCategory(idCategoryUp, catNameUp);
              if (cat) add('category_id', Number(cat.id));
              else if (idCategoryUp !== undefined && String(idCategoryUp).trim() !== '') {
                report.errores.push({ fila, motivo: `idCategory ${idCategoryUp} no existe y CategoryName vacío o no se pudo crear` });
                continue;
              } else if (catNameUp !== undefined && String(catNameUp).trim() === '') {
                add('category_id', null);
              } else if (idCategoryUp !== undefined && String(idCategoryUp).trim() === '') {
                add('category_id', null);
              }
            } catch (e) {
              report.errores.push({ fila, motivo: `Error con categoría: ${e.message}` });
              continue;
            }
          }

          const specsUp = getCell(row, 'specs');
          if (specsUp !== undefined) {
            const sp = parseSpecs(specsUp);
            if (specsUp !== '' && typeof specsUp === 'string' && sp === undefined) {
              // intentar parsear pero si falla y viene texto, no forzar error si es cadena simple? pero specs es jsonb
              // si parece json invalido, reportar
              const s = String(specsUp).trim();
              if (s.startsWith('{') || s.startsWith('[')) {
                report.errores.push({ fila, motivo: 'specs tiene JSON inválido' });
                continue;
              }
            }
            add('specs', sp === undefined && specsUp !== '' ? specsUp : sp);
          }

          const isActiveUp = toBool(getCell(row, 'is_active'));
          if (isActiveUp !== undefined) add('is_active', isActiveUp);

          // Campos que exporta el sistema de gestion externo. Solo se tocan si
          // la planilla trae la columna, para no pisar lo que ya habia.
          const extraUp = leerCamposExport(row);
          if (extraUp.purchase_price !== undefined) {
            if (extraUp.purchase_price < 0) { report.errores.push({ fila, motivo: 'purchase_price no puede ser negativo' }); continue; }
            add('purchase_price', extraUp.purchase_price);
          }
          if (extraUp.min_stock !== undefined) {
            if (extraUp.min_stock < 0) { report.errores.push({ fila, motivo: 'min_stock no puede ser negativo' }); continue; }
            add('min_stock', extraUp.min_stock);
          }
          if (extraUp.vat_rate !== undefined) {
            if (extraUp.vat_rate < 0 || extraUp.vat_rate > 100) { report.errores.push({ fila, motivo: 'vat_rate debe estar entre 0 y 100' }); continue; }
            add('vat_rate', extraUp.vat_rate);
          }
          if (extraUp.supplier_code !== undefined) add('supplier_code', extraUp.supplier_code);

          if (updates.length === 0) {
            report.errores.push({ fila, motivo: "estado es 'actualizado' pero no hay campos para actualizar" });
            continue;
          }

          params.push(product.id);
          await tx.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING id`).run(...params);
          report.actualizados++;
        } catch (e) {
          report.errores.push({ fila, motivo: e.message || 'Error inesperado' });
        }
      }
    });

    res.json({ message: 'Importación finalizada', reporte: report });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al importar productos' });
  }
}

module.exports = { getAll, getOne, create, update, remove, importProducts };
