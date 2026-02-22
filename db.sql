CREATE TABLE warehouses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE inventory (
  warehouse_id INT,
  product_id INT,
  quantity INT,
  PRIMARY KEY (warehouse_id, product_id)
);

CREATE TABLE reservations (
  id UUID PRIMARY KEY,
  warehouse_id INT,
  product_id INT,
  quantity INT,
  expires_at TIMESTAMP
);

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  status TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_history (
  id SERIAL PRIMARY KEY,
  order_id UUID,
  status TEXT,
  timestamp TIMESTAMP DEFAULT NOW(),
  details TEXT
);

INSERT INTO warehouses (name) VALUES ('Warehouse-A');
INSERT INTO warehouses (name) VALUES ('Warehouse-B');
INSERT INTO products (name) VALUES ('Laptop');
INSERT INTO products (name) VALUES ('Monitor');
INSERT INTO inventory VALUES (1,1,10);
INSERT INTO inventory VALUES (1,2,25);
INSERT INTO inventory VALUES (2,1,5);
INSERT INTO inventory VALUES (2,2,15);
INSERT INTO users (username, password, role) VALUES ('admin', 'hashed_password_123', 'admin');
INSERT INTO users (username, password, role) VALUES ('user', 'hashed_password_456', 'user');
