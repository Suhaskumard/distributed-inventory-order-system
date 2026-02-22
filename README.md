# Distributed Inventory and Order Management System

A microservices-based inventory and order management system with dashboard, built using Node.js, Docker, and RabbitMQ.

## Overview

This project implements a distributed system for managing inventory and orders with the following components:
- **Dashboard**: Web-based UI for monitoring and management
- **Inventory Service**: Manages product inventory
- **Order Service**: Handles order processing

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Dashboard  │────▶│ Inventory  │     │   Order    │
│   Service   │     │  Service   │     │  Service   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           └───────┬───────────┘
                                   │
                            ┌──────┴──────┐
                            │  RabbitMQ   │
                            └─────────────┘
```

## Tech Stack

- **Backend**: Node.js with Express
- **Database**: SQLite
- **Message Queue**: RabbitMQ
- **Containerization**: Docker
- **Authentication**: JWT-based auth

## Project Structure

```
inventory-platform/
├── dashboard/              # Dashboard frontend
│   ├── index.html
│   └── server.js
├── inventory-service/     # Inventory microservice
│   ├── index.js
│   ├── auth.js
│   ├── Dockerfile
│   ├── package.json
│   ├── rabbitmq.js
│   └── __tests__/
├── order-service/         # Order microservice
│   ├── index.js
│   ├── auth.js
│   ├── Dockerfile
│   ├── package.json
│   ├── rabbitmq.js
│   └── __tests__/
├── docker-compose.yml     # Docker orchestration
├── db.sql                 # Database schema
└── API_DOCUMENTATION.md   # API docs
```

## Getting Started

### Prerequisites

- Node.js 14+
- Docker and Docker Compose
- RabbitMQ (included in Docker Compose)

### Installation

1. Clone the repository:
```
bash
git clone https://github.com/Suhaskumard/distributed-inventory-order-system.git
cd distributed-inventory-order-system
```

2. Install dependencies for each service:
```
bash
cd inventory-service && npm install && cd ..
cd order-service && npm install && cd ..
```

### Running with Docker

```
bash
docker-compose up --build
```

This will start:
- Inventory Service on port 3000
- Order Service on port 3001
- Dashboard on port 3002
- RabbitMQ on port 5672

### Running Locally

1. Start RabbitMQ:
```
bash
docker run -d -p 5672:5672 rabbitmq
```

2. Start Inventory Service:
```
bash
cd inventory-service
npm start
```

3. Start Order Service:
```
bash
cd order-service
npm start
```

4. Start Dashboard:
```
bash
cd dashboard
node server.js
```

## API Endpoints

### Inventory Service (Port 3000)
- `GET /api/inventory` - Get all inventory items
- `GET /api/inventory/:id` - Get specific item
- `POST /api/inventory` - Create new item
- `PUT /api/inventory/:id` - Update item
- `DELETE /api/inventory/:id` - Delete item
- `GET /health` - Health check

### Order Service (Port 3001)
- `GET /api/orders` - Get all orders
- `GET /api/orders/:id` - Get specific order
- `POST /api/orders` - Create new order
- `PUT /api/orders/:id` - Update order status
- `GET /health` - Health check

### Dashboard (Port 3002)
- `GET /` - Dashboard home page
- `GET /api/stats` - Get system statistics

## Testing

Run tests for each service:

```
bash
cd inventory-service && npm test
cd order-service && npm test
```

## License

MIT
