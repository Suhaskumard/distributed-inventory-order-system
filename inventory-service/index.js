const express = require("express");
const { Pool } = require("pg");
const { v4: uuid } = require("uuid");
const { connectRabbitMQ, publishEvent } = require("./rabbitmq");
const { verifyToken, generateToken } = require("./auth");

const app = express();
app.use(express.json());
// Allow cross-origin requests from the browser for the dashboard
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const db = new Pool({
  host: "postgres",
  user: "admin",
  password: "admin",
  database: "inventory_db"
});

if (process.env.NODE_ENV !== 'test') {
  connectRabbitMQ();
}

/* HEALTH CHECK */
app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "inventory-service", timestamp: new Date() });
});

app.get("/ready", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
});

/* LOGIN - Generate JWT Token */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await db.query(
      "SELECT id, username, role FROM users WHERE username=$1",
      [username]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = result.rows[0];
    const token = generateToken(user);

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET INVENTORY - View all stock */
app.get("/inventory", verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT w.id as warehouse_id, w.name as warehouse_name, p.id as product_id, 
              p.name as product_name, i.quantity
       FROM inventory i
       JOIN warehouses w ON i.warehouse_id = w.id
       JOIN products p ON i.product_id = p.id
       ORDER BY w.id, p.id`
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET WAREHOUSE INVENTORY */
app.get("/inventory/:warehouseId", verifyToken, async (req, res) => {
  const { warehouseId } = req.params;

  try {
    const result = await db.query(
      `SELECT p.id, p.name, i.quantity
       FROM inventory i
       JOIN products p ON i.product_id = p.id
       WHERE i.warehouse_id=$1
       ORDER BY p.id`,
      [warehouseId]
    );

    res.json({ warehouseId, items: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* INVENTORY ANALYTICS */
app.get("/analytics/stock", verifyToken, async (req, res) => {
  try {
    const lowStock = await db.query(
      `SELECT w.name as warehouse, p.name as product, i.quantity
       FROM inventory i
       JOIN warehouses w ON i.warehouse_id = w.id
       JOIN products p ON i.product_id = p.id
       WHERE i.quantity < 10
       ORDER BY i.quantity ASC`
    );

    const totalValue = await db.query(
      `SELECT SUM(quantity) as total_units, COUNT(*) as total_items
       FROM inventory`
    );

    res.json({
      lowStockItems: lowStock.rows,
      totalInventory: totalValue.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* RESERVE INVENTORY */
app.post("/reserve", verifyToken, async (req, res) => {
  const { warehouseId, productId, quantity } = req.body;
  const reservationId = uuid();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const stock = await client.query(
      `SELECT quantity FROM inventory
       WHERE warehouse_id=$1 AND product_id=$2
       FOR UPDATE`,
      [warehouseId, productId]
    );

    if (stock.rowCount === 0 || stock.rows[0].quantity < quantity) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient stock" });
    }

    await client.query(
      `UPDATE inventory SET quantity = quantity - $1
       WHERE warehouse_id=$2 AND product_id=$3`,
      [quantity, warehouseId, productId]
    );

    await client.query(
      `INSERT INTO reservations VALUES ($1,$2,$3,$4,NOW()+INTERVAL '15 minutes')`,
      [reservationId, warehouseId, productId, quantity]
    );

    await client.query("COMMIT");

    publishEvent("inventory.reserved", { reservationId });
    res.json({ reservationId, status: "RESERVED" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ROLLBACK INVENTORY */
app.post("/rollback", verifyToken, async (req, res) => {
  const { reservationId } = req.body;
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const r = await client.query(
      `SELECT * FROM reservations WHERE id=$1 FOR UPDATE`,
      [reservationId]
    );

    if (r.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Reservation not found" });
    }

    const { warehouse_id, product_id, quantity } = r.rows[0];

    await client.query(
      `UPDATE inventory SET quantity = quantity + $1
       WHERE warehouse_id=$2 AND product_id=$3`,
      [quantity, warehouse_id, product_id]
    );

    await client.query(`DELETE FROM reservations WHERE id=$1`, [reservationId]);

    await client.query("COMMIT");

    publishEvent("inventory.rollback", { reservationId });
    res.json({ status: "ROLLED_BACK" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* TRANSFER INVENTORY BETWEEN WAREHOUSES */
app.post("/transfer", verifyToken, async (req, res) => {
  const { fromWarehouse, toWarehouse, productId, quantity } = req.body;
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const stock = await client.query(
      `SELECT quantity FROM inventory WHERE warehouse_id=$1 AND product_id=$2 FOR UPDATE`,
      [fromWarehouse, productId]
    );

    if (stock.rowCount === 0 || stock.rows[0].quantity < quantity) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient stock in source warehouse" });
    }

    await client.query(
      `UPDATE inventory SET quantity = quantity - $1 WHERE warehouse_id=$2 AND product_id=$3`,
      [quantity, fromWarehouse, productId]
    );

    await client.query(
      `UPDATE inventory SET quantity = quantity + $1 WHERE warehouse_id=$2 AND product_id=$3`,
      [quantity, toWarehouse, productId]
    );

    await client.query("COMMIT");

    publishEvent("inventory.transferred", { fromWarehouse, toWarehouse, productId, quantity });
    res.json({ status: "TRANSFERRED", fromWarehouse, toWarehouse, quantity });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = app;

if (require.main === module) {
  app.listen(4001, () =>
    console.log("Inventory Service running on port 4001")
  );
}
