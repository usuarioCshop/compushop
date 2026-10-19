require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const db = require('./database');

console.log('🌱 Sembrando datos ficticios Compushop...');

(async () => {
  // Empezar desde una base limpia
  if (fs.existsSync(db.DB_PATH)) {
    fs.unlinkSync(db.DB_PATH);
  }
  await db.init();

  const adminPass = bcrypt.hashSync('admin123', 10);
  const clientPass = bcrypt.hashSync('cliente123', 10);
  const now = new Date().toISOString();

  // Users
  db.prepare(`INSERT INTO users (name, email, password, dni, role, phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('Administrador', 'admin@compushop.com', adminPass, '12345678', 'admin', '11-5555-0000', 'Av. Corrientes 1234, CABA', now, now);
  db.prepare(`INSERT INTO users (name, email, password, dni, role, phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run('Juan Pérez', 'juan@email.com', clientPass, '30123456', 'customer', '11-4444-3333', 'Calle Falsa 123, Buenos Aires', now, now);

  // Categories
  const cats = [
    { name: 'Notebooks', slug: 'notebooks', description: 'Laptops de todas las gamas' },
    { name: 'PCs de Escritorio', slug: 'pcs-escritorio', description: 'Computadoras de escritorio armadas y a medida' },
    { name: 'Componentes', slug: 'componentes', description: 'Procesadores, memorias, placas de video y más' },
    { name: 'Muebles de Oficina', slug: 'muebles-oficina', description: 'Escritorios, sillas ergonómicas y accesorios' },
    { name: 'Insumos', slug: 'insumos', description: 'Periféricos, cables, toners y consumibles' },
    { name: 'Monitores', slug: 'monitores', description: 'Pantallas de todas las resoluciones y tamaños' },
  ];
  cats.forEach((c) => {
    db.prepare('INSERT INTO categories (name, slug, description, created_at) VALUES (?, ?, ?, ?)')
      .run(c.name, c.slug, c.description, now);
  });

  // Products
  const products = [
    { name: 'Notebook Lenovo IdeaPad 3 15"', slug: 'notebook-lenovo-ideapad-3', description: 'Notebook ideal para estudio y trabajo. AMD Ryzen 5, 8GB RAM, 512GB SSD.', price: 689999, stock: 15, category_id: 1, brand: 'Lenovo', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500', specs: { processor: 'AMD Ryzen 5 5500U', ram: '8GB DDR4', storage: '512GB SSD', screen: '15.6" FHD' }, is_active: 1 },
    { name: 'Notebook HP Pavilion 14"', slug: 'notebook-hp-pavilion-14', description: 'Ultrabook liviana. Intel Core i5, 16GB RAM, 1TB SSD.', price: 899999, stock: 8, category_id: 1, brand: 'HP', image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=500', specs: { processor: 'Intel Core i5-1235U', ram: '16GB DDR4', storage: '1TB SSD', screen: '14" FHD IPS' }, is_active: 1 },
    { name: 'PC Gamer RTX 4060', slug: 'pc-gamer-rtx-4060', description: 'PC armada lista para jugar en 1080p/1440p. Incluye Windows 11.', price: 1250000, stock: 5, category_id: 2, brand: 'Compushop', image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=500', specs: { processor: 'Intel Core i5-13400F', ram: '16GB DDR5', gpu: 'RTX 4060 8GB', storage: '1TB NVMe' }, is_active: 1 },
    { name: 'PC Oficina Intel i3', slug: 'pc-oficina-intel-i3', description: 'PC confiable para tareas de oficina y facturación.', price: 459999, stock: 20, category_id: 2, brand: 'Compushop', image: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=500', specs: { processor: 'Intel Core i3-12100', ram: '8GB DDR4', storage: '480GB SSD' }, is_active: 1 },
    { name: 'Procesador AMD Ryzen 7 5700X', slug: 'procesador-amd-ryzen-7-5700x', description: '8 núcleos / 16 hilos. Excelente precio-rendimiento.', price: 289999, stock: 12, category_id: 3, brand: 'AMD', image: 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=500', specs: { cores: 8, threads: 16, socket: 'AM4' }, is_active: 1 },
    { name: 'Memoria RAM Kingston Fury 16GB DDR4', slug: 'ram-kingston-fury-16gb', description: 'Kit 16GB (2x8GB) DDR4 3200MHz CL16.', price: 89999, stock: 30, category_id: 3, brand: 'Kingston', image: 'https://images.unsplash.com/photo-1562976540-1502c912141b?w=500', specs: { capacity: '16GB', speed: '3200MHz', type: 'DDR4' }, is_active: 1 },
    { name: 'Escritorio Gamer RGB 140cm', slug: 'escritorio-gamer-rgb', description: 'Escritorio ergonómico con LED RGB y pasacables.', price: 189999, stock: 7, category_id: 4, brand: 'Compushop', image: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=500', specs: { width: '140cm', depth: '60cm', features: 'LED RGB' }, is_active: 1 },
    { name: 'Silla Ergonómica Office Pro', slug: 'silla-ergonomica-office-pro', description: 'Soporte lumbar, reposabrazos ajustables, reclinable 135°.', price: 249999, stock: 10, category_id: 4, brand: 'Compushop', image: 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=500', specs: { material: 'Mesh', max_weight: '120kg' }, is_active: 1 },
    { name: 'Teclado Mecánico Redragon Kumara', slug: 'teclado-redragon-kumara', description: 'TKL switches Outemu Blue, RGB.', price: 45999, stock: 25, category_id: 5, brand: 'Redragon', image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500', specs: { switches: 'Outemu Blue', layout: 'TKL' }, is_active: 1 },
    { name: 'Mouse Logitech G502 Hero', slug: 'mouse-logitech-g502', description: 'Sensor HERO 25K, 11 botones, peso ajustable.', price: 69999, stock: 18, category_id: 5, brand: 'Logitech', image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500', specs: { dpi: '25600', buttons: 11 }, is_active: 1 },
    { name: 'Monitor Samsung 27" 144Hz', slug: 'monitor-samsung-27-144hz', description: 'Curvo 27" FHD 144Hz 1ms FreeSync.', price: 329999, stock: 9, category_id: 6, brand: 'Samsung', image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500', specs: { size: '27"', resolution: '1920x1080', refresh: '144Hz' }, is_active: 1 },
    { name: 'Monitor LG UltraWide 34"', slug: 'monitor-lg-ultrawide-34', description: '34" WQHD IPS. Ideal productividad.', price: 689999, stock: 4, category_id: 6, brand: 'LG', image: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=500', specs: { size: '34"', resolution: '3440x1440', aspect: '21:9' }, is_active: 1 },
  ];
  products.forEach((p) => {
    db.prepare(`INSERT INTO products (name, slug, description, price, stock, category_id, brand, image, specs, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(p.name, p.slug, p.description, p.price, p.stock, p.category_id, p.brand, p.image, JSON.stringify(p.specs), p.is_active, now, now);
  });

  // Services
  const services = [
    { name: 'Armado de PC a medida', slug: 'armado-pc-medida', description: 'Armamos tu PC según necesidades y presupuesto. Incluye Windows y drivers.', price: 25000, duration: '24-48 hs', image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=500', is_active: 1 },
    { name: 'Servicio Técnico a Domicilio', slug: 'servicio-tecnico-domicilio', description: 'Diagnóstico y reparación en tu casa u oficina. CABA y GBA.', price: 15000, duration: '1-2 hs', image: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=500', is_active: 1 },
    { name: 'Limpieza y Mantenimiento Preventivo', slug: 'limpieza-mantenimiento', description: 'Limpieza interna, pasta térmica y optimización del sistema.', price: 12000, duration: '2-3 hs', image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500', is_active: 1 },
    { name: 'Instalación de Redes y WiFi', slug: 'instalacion-redes-wifi', description: 'Routers, puntos de acceso, cableado estructurado y redes empresariales.', price: 35000, duration: 'según proyecto', image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a2?w=500', is_active: 1 },
  ];
  services.forEach((s) => {
    db.prepare('INSERT INTO services (name, slug, description, price, duration, image, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(s.name, s.slug, s.description, s.price, s.duration, s.image, s.is_active, now, now);
  });

  // Settings
  const settings = {
    smtp_host: 'smtp.gmail.com',
    smtp_port: '587',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: 'Compushop <noreply@compushop.com>',
    contact_to: 'contacto@compushop.com',
    store_name: 'Compushop',
    store_phone: '11-5555-0000',
    store_address: 'Av. Corrientes 1234, CABA',
    store_email: 'info@compushop.com',
  };
  Object.entries(settings).forEach(([k, v]) => {
    db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(k, String(v), now);
  });

  db.persist();

  console.log('✅ Seed completado');
  console.log('👤 Admin:   admin@compushop.com / admin123');
  console.log('👤 Cliente: juan@email.com / cliente123');
  console.log(`📦 ${products.length} productos | 🛠️ ${services.length} servicios | 📂 ${cats.length} categorías`);
})().catch((e) => {
  console.error('Seed falló:', e);
  process.exit(1);
});