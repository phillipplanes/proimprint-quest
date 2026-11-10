/* ============================================================
   db.js — Proimprint database, running fully in the browser
   via sql.js (SQLite compiled to WebAssembly).
   ============================================================ */

let SQL = null;      // sql.js module
let db = null;       // our SQLite database

export async function initDb() {
  if (db) return db;
  SQL = await initSqlJs({
    locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${f}`,
  });
  db = new SQL.Database();
  db.run(SEED_SQL);
  return db;
}

/* Run a SELECT and return { columns, rows } */
export function query(sqlText) {
  const stmt = db.prepare(sqlText);
  try {
    const columns = stmt.getColumnNames();
    const rows = [];
    while (stmt.step()) rows.push(stmt.get());
    return { columns, rows };
  } finally { stmt.free(); }
}

/* ============================================================
   SEED DATA — Proimprint, the dropship print shop.
   Proimprint takes orders, routes them to distributors who
   source from suppliers, and product is drop-shipped to the
   customer. Proimprint makes nothing and owns nothing except data.
   ============================================================ */
const SEED_SQL = `
CREATE TABLE customers (
  customer_id INTEGER PRIMARY KEY,
  name TEXT, city TEXT, signup_date TEXT
);
INSERT INTO customers VALUES
 (1,'Sunny Ortiz','Austin','2025-01-05'),
 (2,'Mila Chen','Seattle','2025-02-11'),
 (3,'Dev Patel','Austin','2025-03-02'),
 (4,'Rosa Gómez','Miami','2025-03-19'),
 (5,'Sam Whitfield','Denver','2025-04-01'),
 (6,'Anita Kaur','Seattle','2025-04-22'),
 (7,'Tom Okafor','Chicago','2025-05-09'),
 (8,'Sana Iqbal','Miami','2025-05-30');

CREATE TABLE products (
  product_id INTEGER PRIMARY KEY,
  product_name TEXT, category TEXT, base_price REAL
);
INSERT INTO products VALUES
 (101,'Logo Hoodie','Apparel',38.00),
 (102,'Sticker Pack','Stickers',6.50),
 (103,'Aloha Mug','Drinkware',14.00),
 (104,'Campus Tee','Apparel',18.00),
 (105,'Mega Poster','Prints',12.00),
 (106,'Holographic Sticker Sheet','Stickers',9.00),
 (107,'Neon Tote','Apparel',22.00),
 (108,'Enamel Pin','Pins',8.50),
 (109,'Metal Water Bottle','Drinkware',24.00),
 (110,'Canvas Art Print','Prints',45.00);

CREATE TABLE distributors (
  distributor_id INTEGER PRIMARY KEY, name TEXT, region TEXT
);
INSERT INTO distributors VALUES
 (1,'PrintPort','South'),
 (2,'NorthInk','Northwest'),
 (3,'GulfGoods','Southeast'),
 (4,'MetroPrint','Midwest');

CREATE TABLE suppliers (
  supplier_id INTEGER PRIMARY KEY, name TEXT, country TEXT
);
INSERT INTO suppliers VALUES
 (1,'ThreadWorks','USA'),
 (2,'PaperMoon','Canada'),
 (3,'VinylVerse','USA');

CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY,
  customer_id INTEGER, order_date TEXT, status TEXT
);
INSERT INTO orders VALUES
 (1001,1,'2025-09-01','completed'),
 (1002,2,'2025-09-03','completed'),
 (1003,3,'2025-09-05','pending'),
 (1004,4,'2025-09-06','completed'),
 (1005,1,'2025-09-09','completed'),
 (1006,5,'2025-09-10','cancelled'),
 (1007,6,'2025-09-12','completed'),
 (1008,7,'2025-09-14','pending'),
 (1009,8,'2025-09-15','completed'),
 (1010,2,'2025-09-17','completed'),
 (1011,4,'2025-09-19','pending'),
 (1012,3,'2025-09-21','completed');

CREATE TABLE order_items (
  order_id INTEGER, product_id INTEGER,
  distributor_id INTEGER, supplier_id INTEGER,
  qty INTEGER, unit_price REAL
);
INSERT INTO order_items VALUES
 (1001,104,1,1,3,18.00),
 (1001,108,1,3,10,8.50),
 (1002,110,2,2,2,45.00),
 (1003,102,1,3,25,6.50),
 (1004,103,3,1,4,14.00),
 (1005,107,1,1,2,22.00),
 (1005,106,1,3,15,9.00),
 (1006,104,4,1,1,18.00),
 (1007,109,2,1,6,24.00),
 (1008,105,2,2,8,12.00),
 (1009,101,3,1,3,38.00),
 (1009,108,3,3,20,8.50),
 (1010,110,2,2,1,45.00),
 (1011,106,3,3,30,9.00),
 (1012,101,1,1,5,38.00),
 (1012,109,1,1,2,24.00);
`;
