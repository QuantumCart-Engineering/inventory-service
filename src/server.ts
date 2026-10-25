import app from "./app";

import { env } from "./config/env";
import { rabbitMQClient } from "./clients/rabbitmq.client";
import { OutboxRepository } from "./repositories/outbox.repository";
import { OutboxPublisherService } from "./services/outbox-publisher.service";
import { InventoryRepository } from "./repositories/inventory.repository";
import { ProductEventConsumer } from "./consumers/product-consumer.service";

const outboxRepository = new OutboxRepository();
const inventoryRepository = new InventoryRepository(outboxRepository);
const outboxPublisherService = new OutboxPublisherService(outboxRepository);
const productEventConsumer = new ProductEventConsumer(
  inventoryRepository,
  outboxRepository
);

const startServer = async (): Promise<void> => {
  try {
    await rabbitMQClient.connect();

    app
      .listen(env.port, () => {
        console.log(`Inventory Service is running on port ${env.port}`);
      })
      .on("error", (error: NodeJS.ErrnoException) => {
        console.error("Inventory HTTP server error:", error.message);
        process.exitCode = 1;
      });

    void outboxPublisherService.start().catch((error) => {
      console.error("Outbox Publisher failed:", error);
    });

    try {
      await productEventConsumer.start();
    } catch (error) {
      console.error("Failed to start product event consumer:", error);
    }
  } catch (error) {
    console.error("Failed to start Inventory Service:", error);

    process.exit(1);
  }
};

const shutdown = async (): Promise<void> => {
  console.log("Shutting down Inventory Service...");

  outboxPublisherService.stop();

  await rabbitMQClient.close();

  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer();
