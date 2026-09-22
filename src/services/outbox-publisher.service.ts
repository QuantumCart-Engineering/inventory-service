import { rabbitMQClient } from "../clients/rabbitmq.client";
import { env } from "../config/env";

import {
  OutboxRepository
} from "../repositories/outbox.repository";

export class OutboxPublisherService {
  private readonly batchSize = 10;

  private readonly pollingIntervalMs = 5000;

  private isRunning = false;

  constructor(
    private readonly outboxRepository: OutboxRepository
  ) {}

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    console.log(
      "Outbox Publisher started."
    );

    while (this.isRunning) {
      try {
        await this.publishPendingEvents();
      } catch (error) {
        console.error(
          "Outbox Publisher error:",
          error
        );
      }

      await this.sleep(
        this.pollingIntervalMs
      );
    }
  }

  stop(): void {
    this.isRunning = false;

    console.log(
      "Outbox Publisher stopped."
    );
  }

  private async publishPendingEvents(): Promise<void> {
    const events =
      await this.outboxRepository.findPendingEvents(
        this.batchSize
      );

    if (events.length === 0) {
      return;
    }

    const channel =
      rabbitMQClient.getChannel();

    for (const event of events) {
      try {
        const payload =
          typeof event.payload === "string"
            ? event.payload
            : JSON.stringify(event.payload);

        channel.publish(
          env.rabbitmq.exchange,
          event.event_type,
          Buffer.from(payload),
          {
            persistent: true,
            contentType: "application/json",
            messageId: event.id,
            type: event.event_type
          }
        );

        await channel.waitForConfirms();

        await this.outboxRepository.markAsPublished(
          event.id
        );

        console.log(
          `Outbox event published: ${event.event_type} (${event.id})`
        );
      } catch (error) {
        console.error(
          `Failed to publish outbox event ${event.id}:`,
          error
        );

        await this.outboxRepository.markAsFailed(
          event.id
        );
      }
    }
  }

  private sleep(
    milliseconds: number
  ): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}