import amqp, {
  ChannelModel,
  ConfirmChannel
} from "amqplib";

import { env } from "../config/env";

class RabbitMQClient {
  private connection: ChannelModel | null = null;

  private channel: ConfirmChannel | null = null;

  async connect(): Promise<void> {
    if (this.connection && this.channel) {
      return;
    }

    const url = `amqp://${encodeURIComponent(
      env.rabbitmq.user
    )}:${encodeURIComponent(
      env.rabbitmq.password
    )}@${env.rabbitmq.host}:${env.rabbitmq.port}`;

    this.connection = await amqp.connect(url);

    this.channel =
      await this.connection.createConfirmChannel();

    await this.channel.assertExchange(
      env.rabbitmq.exchange,
      "topic",
      {
        durable: true
      }
    );

    console.log(
      "RabbitMQ connected successfully."
    );
  }

  getChannel(): ConfirmChannel {
    if (!this.channel) {
      throw new Error(
        "RabbitMQ channel is not initialized"
      );
    }

    return this.channel;
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();

    this.channel = null;
    this.connection = null;

    console.log(
      "RabbitMQ connection closed."
    );
  }
}

export const rabbitMQClient =
  new RabbitMQClient();