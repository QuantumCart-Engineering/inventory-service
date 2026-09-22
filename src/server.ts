import app from "./app";

import { env } from "./config/env";
import { rabbitMQClient } from "./clients/rabbitmq.client";
import { OutboxRepository } from "./repositories/outbox.repository";
import { OutboxPublisherService } from "./services/outbox-publisher.service";

const outboxRepository =
  new OutboxRepository();

const outboxPublisherService =
  new OutboxPublisherService(
    outboxRepository
  );

const startServer = async (): Promise<void> => {
  try {
    await rabbitMQClient.connect();

    app.listen(env.port, () => {
      console.log(
        `Inventory Service is running on port ${env.port}`
      );
    });

    await outboxPublisherService.start();
  } catch (error) {
    console.error(
      "Failed to start Inventory Service:",
      error
    );

    process.exit(1);
  }
};

const shutdown = async (): Promise<void> => {
  console.log(
    "Shutting down Inventory Service..."
  );

  outboxPublisherService.stop();

  await rabbitMQClient.close();

  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer();