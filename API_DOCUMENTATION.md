# 📡 Inventory Platform - API Documentation

## 🔐 Authentication

### Login (Get JWT Token)
```bash
POST http://localhost:4001/login
Content-Type: application/json

{
  "username": "admin",
  "password": "hashed_password_123"
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

**Use the token in Authorization header for subsequent requests:**
```bash
Authorization: Bearer <your_token>
```

---

## 🏥 Service Health

### Inventory Service Health
```bash
GET http://localhost:4001/health
```

### Order Service Health
```bash
GET http://localhost:4000/health
```

### Readiness Check
```bash
GET http://localhost:4001/ready
GET http://localhost:4000/ready
```

---

## 📦 Order Service Endpoints

### Create Order
```bash
POST http://localhost:4000/order
Authorization: Bearer <token>
Content-Type: application/json

{
  "warehouseId": 1,
  "productId": 1,
  "quantity": 5
}
```

### Confirm Order
```bash
POST http://localhost:4000/order/{orderId}/confirm
Authorization: Bearer <token>
```

### Cancel Order
```bash
POST http://localhost:4000/order/{orderId}/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reservationId": "uuid-here"
}
```

### Get Order Details
```bash
GET http://localhost:4000/order/{orderId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "order": {
    "id": "uuid",
    "status": "RESERVED",
    "created_at": "2026-02-22T10:00:00"
  },
  "history": [
    {
      "status": "RESERVED",
      "timestamp": "2026-02-22T10:00:00",
      "details": "Reserved 5 units of product 1"
    }
  ]
}
```

### List All Orders
```bash
GET http://localhost:4000/orders?status=RESERVED
Authorization: Bearer <token>
```

### Order Analytics
```bash
GET http://localhost:4000/analytics/orders
Authorization: Bearer <token>
```

**Response:**
```json
{
  "statusDistribution": [
    {"status": "RESERVED", "count": 5},
    {"status": "CONFIRMED", "count": 3}
  ],
  "recentOrders": [...]
}
```

---

## 🏭 Inventory Service Endpoints

### Get All Inventory
```bash
GET http://localhost:4001/inventory
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "warehouse_id": 1,
    "warehouse_name": "Warehouse-A",
    "product_id": 1,
    "product_name": "Laptop",
    "quantity": 10
  }
]
```

### Get Warehouse Inventory
```bash
GET http://localhost:4001/inventory/{warehouseId}
Authorization: Bearer <token>
```

### Inventory Analytics
```bash
GET http://localhost:4001/analytics/stock
Authorization: Bearer <token>
```

**Response:**
```json
{
  "lowStockItems": [
    {"warehouse": "Warehouse-B", "product": "Laptop", "quantity": 5}
  ],
  "totalInventory": {
    "total_units": 55,
    "total_items": 4
  }
}
```

### Reserve Inventory
```bash
POST http://localhost:4001/reserve
Authorization: Bearer <token>
Content-Type: application/json

{
  "warehouseId": 1,
  "productId": 1,
  "quantity": 5
}
```

### Rollback Reservation
```bash
POST http://localhost:4001/rollback
Authorization: Bearer <token>
Content-Type: application/json

{
  "reservationId": "uuid-here"
}
```

### Transfer Inventory Between Warehouses
```bash
POST http://localhost:4001/transfer
Authorization: Bearer <token>
Content-Type: application/json

{
  "fromWarehouse": 1,
  "toWarehouse": 2,
  "productId": 1,
  "quantity": 5
}
```

---

## 📊 Test Data

**Default Users:**
- Username: `admin`, Password: `hashed_password_123` (role: admin)
- Username: `user`, Password: `hashed_password_456` (role: user)

**Warehouses:**
- Warehouse-A (ID: 1)
- Warehouse-B (ID: 2)

**Products:**
- Laptop (ID: 1)
- Monitor (ID: 2)

**Initial Stock:**
- Warehouse-A: Laptop (10), Monitor (25)
- Warehouse-B: Laptop (5), Monitor (15)

---

## 🧪 Complete Test Flow

```bash
# 1. Login
curl -X POST http://localhost:4001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"hashed_password_123"}'

# Save the token: TOKEN="eyJhbGc..."

# 2. Check inventory
curl -X GET http://localhost:4001/inventory \
  -H "Authorization: Bearer $TOKEN"

# 3. Create order
curl -X POST http://localhost:4000/order \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"warehouseId":1,"productId":1,"quantity":5}'

# 4. Check order details
curl -X GET http://localhost:4000/order/{orderId} \
  -H "Authorization: Bearer $TOKEN"

# 5. Get analytics
curl -X GET http://localhost:4000/analytics/orders \
  -H "Authorization: Bearer $TOKEN"

# 6. Transfer inventory
curl -X POST http://localhost:4001/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fromWarehouse":1,"toWarehouse":2,"productId":1,"quantity":3}'
```

---

## ⚡ Features Added

✅ **Health Checks** - Service readiness and liveness probes
✅ **JWT Authentication** - Token-based secure access  
✅ **Order History** - Track order state changes with timestamps
✅ **Order Management** - Create, confirm, cancel, and list orders
✅ **Inventory Analytics** - Low stock alerts and total inventory metrics
✅ **Warehouse Transfers** - Move inventory between locations
✅ **Order Analytics** - Track order statuses and distribution
