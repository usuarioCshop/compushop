const xlsx = require('xlsx');

const input = 'D:/2026/aplicacion negocio/actualizarProductos.xlsx';
const wb = xlsx.readFile(input);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws);

// Planilla de importacion para el panel admin. Incluye todas las columnas
// cargables de la tabla products (ver 001_init.sql + 002_product_import_fields.sql).
const out = rows.map((r) => {
  const slug = (r['Codigo'] || '').toString().trim();
  const name = (r['Descripcion'] || '').toString().trim();

  return {
    slug,
    name,
    price: r['PrecioVenta'] ?? '',
    stock: r['Stock'] ?? '',
    brand: (r['Marca'] || '').toString().trim(),
    idCategory: '',
    CategoryName: (r['Rubro'] || '').toString().trim(),
    description: name,
    image: '',
    is_active: 'activo',
    estado: 'actualizado',
    specs: '',
    purchase_price: r['Precio Compra'] ?? '',
    min_stock: r['StockMinimo'] ?? '',
    vat_rate: r['AlicuotaIva'] ?? '',
    supplier_code: (r['CodigoProv'] || '').toString().trim(),
  };
});

const wbOut = xlsx.utils.book_new();
const wsOut = xlsx.utils.json_to_sheet(out);
xlsx.utils.book_append_sheet(wbOut, wsOut, 'Productos');

const instrucciones = [
  { columna: 'slug', obligatoria: 'si (clave)', origen: 'Codigo', detalle: 'Identifica el producto. Si existe, se actualiza; si no, se crea.' },
  { columna: 'name', obligatoria: 'si al crear', origen: 'Descripcion', detalle: 'Nombre visible del producto.' },
  { columna: 'price', obligatoria: 'si al crear', origen: 'PrecioVenta', detalle: 'Precio de venta. Acepta coma o punto decimal.' },
  { columna: 'stock', obligatoria: 'no', origen: 'Stock', detalle: 'Stock actual. Por defecto 0.' },
  { columna: 'brand', obligatoria: 'no', origen: 'Marca', detalle: 'Marca del producto.' },
  { columna: 'idCategory', obligatoria: 'no', origen: '(vacio)', detalle: 'ID de categorias. Tiene prioridad sobre CategoryName.' },
  { columna: 'CategoryName', obligatoria: 'no', origen: 'Rubro', detalle: 'Si idCategory no existe, se busca o crea esta categoria.' },
  { columna: 'description', obligatoria: 'no', origen: 'Descripcion', detalle: 'Descripcion larga.' },
  { columna: 'image', obligatoria: 'no', origen: '(vacio)', detalle: 'URL de la imagen del producto.' },
  { columna: 'is_active', obligatoria: 'no', origen: 'activo', detalle: 'activo / inactivo.' },
  { columna: 'estado', obligatoria: 'si al actualizar', origen: 'actualizado', detalle: 'Solo con "actualizado" se modifican productos existentes.' },
  { columna: 'specs', obligatoria: 'no', origen: '(vacio)', detalle: 'JSON con especificaciones tecnicas.' },
  { columna: 'purchase_price', obligatoria: 'no', origen: 'Precio Compra', detalle: 'Costo. Distinto del precio de venta.' },
  { columna: 'min_stock', obligatoria: 'no', origen: 'StockMinimo', detalle: 'Umbral de stock bajo.' },
  { columna: 'vat_rate', obligatoria: 'no', origen: 'AlicuotaIva', detalle: 'Porcentaje de IVA (0 a 100).' },
  { columna: 'supplier_code', obligatoria: 'no', origen: 'CodigoProv', detalle: 'Codigo del producto en el proveedor.' },
];
const wsInstr = xlsx.utils.json_to_sheet(instrucciones);
wsInstr['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 70 }];
xlsx.utils.book_append_sheet(wbOut, wsInstr, 'Instrucciones');

wsOut['!cols'] = Object.keys(out[0] || {}).map((k) => ({ wch: Math.max(12, k.length + 2) }));

const outPath = 'D:/2026/aplicacion negocio/actualizarProductos_ampliado.xlsx';
xlsx.writeFile(wbOut, outPath);

console.log('Generado:', outPath);
console.log('Filas:', out.length);
console.log('Columnas (' + Object.keys(out[0] || {}).length + '):', Object.keys(out[0] || {}).join(', '));
console.log('Primer fila:', JSON.stringify(out[0]));
