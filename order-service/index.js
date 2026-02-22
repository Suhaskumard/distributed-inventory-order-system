const express = require("express");
const axios = require("axios");
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
  res.json({ status: "OK", service: "order-service", timestamp: new Date() });
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

/* CREATE ORDER */
app.post("/order", verifyToken, async (req, res) => {
  const orderId = uuid();
  const { warehouseId, productId, quantity } = req.body;

  try {
    const inventoryToken = req.headers.authorization;

    const r = await axios.post(
      "http://inventory-service:4001/reserve",
      { warehouseId, productId, quantity },
      { headers: { Authorization: inventoryToken } }
    );

    await db.query(`INSERT INTO orders VALUES ($1,'RESERVED',NOW())`, [orderId]);
    await db.query(
      `INSERT INTO order_history (order_id, status, details) VALUES ($1, $2, $3)`,
      [orderId, "RESERVED", `Reserved ${quantity} units of product ${productId}`]
    );

    publishEvent("order.created", { orderId });

    res.json({
      orderId,
      reservationId: r.data.reservationId,
      status: "RESERVED"
    });
  } catch (err) {
    res.status(400).json({ error: "Order failed", message: err.message });
  }
});

/* CONFIRM ORDER */
app.post("/order/:orderId/confirm", verifyToken, async (req, res) => {
  const { orderId } = req.params;

  try {
    await db.query(`UPDATE orders SET status='CONFIRMED' WHERE id=$1`, [orderId]);
    await db.query(
      `INSERT INTO order_history (order_id, status, details) VALUES ($1, $2, $3)`,
      [orderId, "CONFIRMED", "Order confirmed"]
    );

    publishEvent("order.confirmed", { orderId });

    res.json({ orderId, status: "CONFIRMED" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* CANCEL ORDER */
app.post("/order/:orderId/cancel", verifyToken, async (req, res) => {
  const { orderId } = req.params;
  const { reservationId } = req.body;

  try {
    const inventoryToken = req.headers.authorization;

    await axios.post(
      "http://inventory-service:4001/rollback",
      { reservationId },
      { headers: { Authorization: inventoryToken } }
    );

    await db.query(
      `UPDATE orders SET status='CANCELLED' WHERE id=$1`,
      [orderId]
    );

    await db.query(
      `INSERT INTO order_history (order_id, status, details) VALUES ($1, $2, $3)`,
      [orderId, "CANCELLED", "Order cancelled"]
    );

    publishEvent("order.cancelled", { orderId });

    res.json({ orderId, status: "CANCELLED" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET ORDER DETAILS */
app.get("/order/:orderId", verifyToken, async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await db.query(
      `SELECT * FROM orders WHERE id=$1`,
      [orderId]
    );

    if (order.rowCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const history = await db.query(
      `SELECT status, timestamp, details FROM order_history WHERE order_id=$1 ORDER BY timestamp DESC`,
      [orderId]
    );

    res.json({
      order: order.rows[0],
      history: history.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* LIST ALL ORDERS */
app.get("/orders", verifyToken, async (req, res) => {
  const { status } = req.query;

  try {
    let query = `SELECT id, status, created_at FROM orders`;
    let params = [];

    if (status) {
      query += ` WHERE status=$1`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await db.query(query, params);

    res.json({ total: result.rowCount, orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ORDER ANALYTICS */
app.get("/analytics/orders", verifyToken, async (req, res) => {
  try {
    const byStatus = await db.query(
      `SELECT status, COUNT(*) as count FROM orders GROUP BY status`
    );

    const recent = await db.query(
      `SELECT id, status, created_at FROM orders ORDER BY created_at DESC LIMIT 10`
    );

    res.json({
      statusDistribution: byStatus.rows,
      recentOrders: recent.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;

if (require.main === module) {
  app.listen(4000, () =>
    console.log("Order Service running on port 4000")
  );
}
