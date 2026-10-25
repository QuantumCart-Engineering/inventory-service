import { ConsumeMessage } from "amqplib";
import {
  parseProductCreatedEvent,
  ProductEventConsumer,
  PRODUCT_CREATED_ROUTING_KEY,
  PRODUCT_EVENTS_QUEUE
} from "../../../consumers/product-consumer.service";
import { InventoryRepository } from "../../../repositories/inventory.repository";
import { OutboxRepository } from "../../../repositories/outbox.repository";

jest.mock("../../../clients/rabbitmq.client", () => ({
  rabbitMQClient: {
    getChannel: jest.fn()
  }
}));

jest.mock("../../../config/env", () => ({
  env: {
    rabbitmq: {
      exchange: "quantumcart.events"
    }
  }
}));

const createMessage = (payload: object): ConsumeMessage =>
  ({
    content: Buffer.from(JSON.stringify(payload)),
    fields: {
      routingKey: PRODUCT_CREATED_ROUTING_KEY
    },
    properties: {},
    headers: {},
    deliveryTag: 1,
    redelivered: false,
    exchange: "quantumcart.events"
  }) as unknown as ConsumeMessage;

const createConsumer = () => {
  const inventoryRepository = {
    createIfMissing: jest.fn()
  } as unknown as InventoryRepository;

  const outboxRepository =
    {} as unknown as OutboxRepository;

  return {
    inventoryRepository,
    consumer: new ProductEventConsumer(
      inventoryRepository,
      outboxRepository
    )
  };
};

describe("ProductEventConsumer constants", () => {
  it("binds the routing key emitted by Product Service", () => {
    expect(PRODUCT_CREATED_ROUTING_KEY).toBe("ProductCreated");
    expect(PRODUCT_EVENTS_QUEUE).toBe(
      "inventory-service.product-events"
    );
  });
});

describe("parseProductCreatedEvent", () => {
  it("parses the outbox payload written by Product Service", () => {
    const parsed = parseProductCreatedEvent(
      JSON.stringify({
        eventType: "ProductCreated",
        productId: "3a4ad746-048a-4113-b44e-ef076a18ddff",
        id: "3a4ad746-048a-4113-b44e-ef076a18ddff",
        stockQuantity: 42,
        initialQuantity: 42
      })
    );

    expect(parsed).toEqual({
      productId: "3a4ad746-048a-4113-b44e-ef076a18ddff",
      initialQuantity: 42
    });
  });

  it("falls back to aggregateId and stockQuantity", () => {
    const parsed = parseProductCreatedEvent(
      JSON.stringify({
        aggregateId: "product-1",
        stockQuantity: 7
      })
    );

    expect(parsed).toEqual({
      productId: "product-1",
      initialQuantity: 7
    });
  });

  it("defaults missing quantity to zero", () => {
    const parsed = parseProductCreatedEvent(
      JSON.stringify({ productId: "product-1" })
    );

    expect(parsed.initialQuantity).toBe(0);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseProductCreatedEvent("{")).toThrow(
      "not valid JSON"
    );
  });

  it("rejects a missing productId", () => {
    expect(() =>
      parseProductCreatedEvent(
        JSON.stringify({ eventType: "ProductCreated" })
      )
    ).toThrow("missing productId");
  });

  it("rejects a negative or fractional quantity", () => {
    expect(() =>
      parseProductCreatedEvent(
        JSON.stringify({
          productId: "product-1",
          initialQuantity: -1
        })
      )
    ).toThrow("non-negative integer");

    expect(() =>
      parseProductCreatedEvent(
        JSON.stringify({
          productId: "product-1",
          initialQuantity: 1.5
        })
      )
    ).toThrow("non-negative integer");
  });

  it("rejects an unexpected event type", () => {
    expect(() =>
      parseProductCreatedEvent(
        JSON.stringify({
          eventType: "OrderCreated",
          productId: "product-1"
        })
      )
    ).toThrow("Unexpected event type");
  });
});

describe("ProductEventConsumer.handleMessage", () => {
  it("creates inventory with the initial quantity", async () => {
    const { consumer, inventoryRepository } =
      createConsumer();

    await consumer.handleMessage(
      createMessage({
        eventType: "ProductCreated",
        productId: "product-1",
        initialQuantity: 25
      })
    );

    expect(
      inventoryRepository.createIfMissing
    ).toHaveBeenCalledTimes(1);

    const [id, productId, quantity] = (
      inventoryRepository.createIfMissing as jest.Mock
    ).mock.calls[0];

    expect(typeof id).toBe("string");
    expect(id).not.toBe("product-1");
    expect(productId).toBe("product-1");
    expect(quantity).toBe(25);
  });

  it("is safe to deliver the same event twice", async () => {
    const { consumer, inventoryRepository } =
      createConsumer();

    (
      inventoryRepository.createIfMissing as jest.Mock
    ).mockResolvedValueOnce(true);
    (
      inventoryRepository.createIfMissing as jest.Mock
    ).mockResolvedValueOnce(false);

    const message = createMessage({
      productId: "product-1",
      initialQuantity: 25
    });

    await consumer.handleMessage(message);
    await consumer.handleMessage(message);

    expect(
      inventoryRepository.createIfMissing
    ).toHaveBeenCalledTimes(2);
  });

  it("throws for malformed events instead of acknowledging", async () => {
    const { consumer } = createConsumer();

    await expect(
      consumer.handleMessage(
        createMessage({ eventType: "ProductCreated" })
      )
    ).rejects.toThrow("missing productId");
  });
});
