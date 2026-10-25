import { Channel, ConsumeMessage } from "amqplib";
import { randomUUID } from "crypto";
import { rabbitMQClient } from "../clients/rabbitmq.client";
import { env } from "../config/env";
import { InventoryRepository } from "../repositories/inventory.repository";
import { OutboxRepository } from "../repositories/outbox.repository";

export const PRODUCT_EVENTS_QUEUE = "inventory-service.product-events";
export const PRODUCT_CREATED_ROUTING_KEY = "ProductCreated";

/**
 * Matches the payload written by Product Service in the same
 * transaction as product creation.
 */
export interface ProductCreatedPayload {
  eventType?: string;
  productId?: string;
  id?: string;
  aggregateId?: string;
  sku?: string;
  name?: string;
  slug?: string;
  stockQuantity?: number;
  initialQuantity?: number;
  payload?: {
    productId?: string;
    id?: string;
    stockQuantity?: number;
    initialQuantity?: number;
  };
}

export interface ParsedProductCreatedEvent {
  productId: string;
  initialQuantity: number;
}

const asNonNegativeInteger = (
  value: unknown
): number | null => {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
};

/**
 * Validates and normalises a ProductCreated event body. Throws for
 * malformed payloads so the message is not acknowledged and silently
 * dropped.
 */
export const parseProductCreatedEvent = (
  raw: string
): ParsedProductCreatedEvent => {
  let event: ProductCreatedPayload;

  try {
    event = JSON.parse(raw) as ProductCreatedPayload;
  } catch {
    throw new Error("ProductCreated payload is not valid JSON");
  }

  if (!event || typeof event !== "object") {
    throw new Error("ProductCreated payload must be an object");
  }

  if (
    event.eventType !== undefined &&
    event.eventType !== PRODUCT_CREATED_ROUTING_KEY
  ) {
    throw new Error(
      `Unexpected event type: ${String(event.eventType)}`
    );
  }

  const productId =
    event.productId ??
    event.aggregateId ??
    event.id ??
    event.payload?.productId ??
    event.payload?.id;

  if (typeof productId !== "string" || productId.trim() === "") {
    throw new Error("ProductCreated payload is missing productId");
  }

  const quantityCandidates = [
    event.initialQuantity,
    event.stockQuantity,
    event.payload?.initialQuantity,
    event.payload?.stockQuantity
  ];

  let initialQuantity = 0;
  for (const candidate of quantityCandidates) {
    if (candidate === undefined) {
      continue;
    }

    const parsed = asNonNegativeInteger(candidate);
    if (parsed === null) {
      throw new Error(
        "ProductCreated initial quantity must be a non-negative integer"
      );
    }

    initialQuantity = parsed;
    break;
  }

  return {
    productId: productId.trim(),
    initialQuantity
  };
};

export class ProductEventConsumer {
  private isConsuming = false;
  private channel: Channel | null = null;

  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly outboxRepository: OutboxRepository
  ) {}

  async start(): Promise<void> {
    if (this.isConsuming) {
      return;
    }
    this.isConsuming = true;

    try {
      const ch = rabbitMQClient.getChannel() as unknown as Channel;
      this.channel = ch;

      await ch.assertExchange(env.rabbitmq.exchange, "topic", {
        durable: true
      });
      await ch.assertQueue(PRODUCT_EVENTS_QUEUE, { durable: true });
      await ch.bindQueue(
        PRODUCT_EVENTS_QUEUE,
        env.rabbitmq.exchange,
        PRODUCT_CREATED_ROUTING_KEY
      );
      await ch.bindQueue(
        PRODUCT_EVENTS_QUEUE,
        env.rabbitmq.exchange,
        "product.created"
      );

      ch.prefetch(10);

      await ch.consume(
        PRODUCT_EVENTS_QUEUE,
        async (msg: ConsumeMessage | null) => {
          if (!msg) {
            return;
          }

          try {
            const publishedType = msg.fields?.routingKey;
            if (
              publishedType &&
              publishedType !== PRODUCT_CREATED_ROUTING_KEY &&
              publishedType !== "product.created"
            ) {
              throw new Error(
                `Unsupported routing key: ${publishedType}`
              );
            }

            await this.handleMessage(msg);
            ch.ack(msg);
          } catch (error) {
            console.error(
              "Error processing ProductCreated event:",
              error
            );
            /*
             * Do not requeue a poison message indefinitely. The
             * broker confirmation and inventory write happen before
             * ack, so nothing is acknowledged until it is persisted.
             */
            ch.nack(msg, false, false);
          }
        },
        { noAck: false }
      );

      console.log("Product event consumer started.");
    } catch (error) {
      console.error(
        "Failed to start product event consumer:",
        error
      );
      this.isConsuming = false;
      throw error;
    }
  }

  async handleMessage(msg: ConsumeMessage): Promise<void> {
    const { productId, initialQuantity } =
      parseProductCreatedEvent(msg.content.toString());

    /*
     * Safe for concurrent duplicate deliveries: the unique key on
     * inventory.product_id means only one insert can win, and the
     * ON DUPLICATE KEY UPDATE is a no-op that preserves all live
     * stock and reservation values.
     */
    await this.inventoryRepository.createIfMissing(
      randomUUID(),
      productId,
      initialQuantity
    );
  }
}
