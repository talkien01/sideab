const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('sideab.db');
const fs = require('fs');
const path = require('path');

console.log('--- RESETEANDO BASE DE DATOS PARA PRUEBAS ---');

db.serialize(() => {
  // 1. Reset Beneficiaries status
  db.run("UPDATE beneficiaries SET deliveryStatus = 'PENDING'", (err) => {
    if (err) console.error('Error reseteando beneficiarios:', err);
    else console.log('✅ Beneficiarios reseteados a PENDING.');
  });

  // 2. Clear Deliveries table
  db.run("DELETE FROM deliveries", (err) => {
    if (err) console.error('Error limpiando entregas:', err);
    else console.log('✅ Tabla de entregas vaciada.');
  });

  // 3. Optional: Clear uploads folder
  const uploadsDir = path.join(__dirname, 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      if (file !== '.gitkeep') {
        fs.unlinkSync(path.join(uploadsDir, file));
      }
    }
    console.log('✅ Carpeta de evidencias (uploads) vaciada.');
  }

  db.close();
});
