const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('sideab.db');

console.log('--- REVISANDO ENTREGAS ---');
db.all('SELECT * FROM deliveries', [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(rows);

  console.log('\n--- REVISANDO BENEFICIARIOS ENTREGADOS ---');
  db.all("SELECT folio, fullName, deliveryStatus FROM beneficiaries WHERE deliveryStatus = 'DELIVERED'", [], (err, rows) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(rows);
    db.close();
  });
});
