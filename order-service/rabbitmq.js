const amqp = require("amqplib");

let channel;

async function connectRabbitMQ() {
  const connection = await amqp.connect("amqp://rabbitmq");
  channel = await connection.createChannel();
  await channel.assertExchange("order-events", "topic", { durable: true });
}

function publishEvent(key, payload) {
  channel.publish(
    "order-events",
    key,
    Buffer.from(JSON.stringify(payload))
  );
}

module.exports = { connectRabbitMQ, publishEvent };
