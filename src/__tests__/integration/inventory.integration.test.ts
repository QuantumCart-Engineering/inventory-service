import request from "supertest";

import app from "../../app";

import {
  testDb,
  cleanDatabase,
  closeTestDatabase
} from "./test-db";

const productId =
  "11111111-1111-1111-1111-111111111111";

const orderId =
  "order-integration-001";

describe("Inventory Integration Tests", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe("POST /api/v1/inventory", () => {
    it("should create inventory", async () => {
      const response =
        await request(app)
          .post("/api/v1/inventory")
          .send({
            productId,
            initialQuantity: 100
          });

      expect(response.status).toBe(201);

      expect(
        response.body.success
      ).toBe(true);

      expect(
        response.body.data.product_id
      ).toBe(productId);

      expect(
        response.body.data.available_quantity
      ).toBe(100);

      expect(
        response.body.data.reserved_quantity
      ).toBe(0);

      const [rows] =
        await testDb.execute(
          `
            SELECT
              product_id,
              available_quantity,
              reserved_quantity
            FROM inventory
            WHERE product_id = ?
          `,
          [productId]
        );

      const inventoryRows =
        rows as Array<{
          product_id: string;
          available_quantity: number;
          reserved_quantity: number;
        }>;

      expect(
        inventoryRows
      ).toHaveLength(1);

      expect(
        inventoryRows[0].available_quantity
      ).toBe(100);

      expect(
        inventoryRows[0].reserved_quantity
      ).toBe(0);
    });

    it("should reject duplicate inventory", async () => {
      await request(app)
        .post("/api/v1/inventory")
        .send({
          productId,
          initialQuantity: 100
        });

      const response =
        await request(app)
          .post("/api/v1/inventory")
          .send({
            productId,
            initialQuantity: 200
          });

      expect(response.status).toBe(409);

      expect(
        response.body.success
      ).toBe(false);

      expect(
        response.body.message
      ).toBe(
        "Inventory already exists for this product"
      );
    });
  });

  describe("GET /api/v1/inventory/:productId", () => {
    it("should return inventory", async () => {
      await request(app)
        .post("/api/v1/inventory")
        .send({
          productId,
          initialQuantity: 100
        });

      const response =
        await request(app)
          .get(
            `/api/v1/inventory/${productId}`
          );

      expect(response.status).toBe(200);

      expect(
        response.body.success
      ).toBe(true);

      expect(
        response.body.data.product_id
      ).toBe(productId);

      expect(
        response.body.data.available_quantity
      ).toBe(100);
    });

    it("should return 404 when inventory does not exist", async () => {
      const response =
        await request(app)
          .get(
            `/api/v1/inventory/${productId}`
          );

      expect(response.status).toBe(404);

      expect(
        response.body.success
      ).toBe(false);

      expect(
        response.body.message
      ).toBe("Inventory not found");
    });
  });

  describe("POST /api/v1/inventory/reserve", () => {
    beforeEach(async () => {
      await request(app)
        .post("/api/v1/inventory")
        .send({
          productId,
          initialQuantity: 100
        });
    });

    it("should reserve inventory and create outbox event", async () => {
      const response =
        await request(app)
          .post(
            "/api/v1/inventory/reserve"
          )
          .send({
            productId,
            orderId,
            quantity: 10
          });

      expect(response.status).toBe(200);

      expect(
        response.body.success
      ).toBe(true);

      expect(
        response.body.data.inventory.available_quantity
      ).toBe(90);

      expect(
        response.body.data.inventory.reserved_quantity
      ).toBe(10);

      expect(
        response.body.data.reservation.status
      ).toBe("RESERVED");

      const [inventoryRows] =
        await testDb.execute(
          `
            SELECT
              available_quantity,
              reserved_quantity
            FROM inventory
            WHERE product_id = ?
          `,
          [productId]
        );

      const inventory =
        (
          inventoryRows as Array<{
            available_quantity: number;
            reserved_quantity: number;
          }>
        )[0];

      expect(
        inventory.available_quantity
      ).toBe(90);

      expect(
        inventory.reserved_quantity
      ).toBe(10);

      const [reservationRows] =
        await testDb.execute(
          `
            SELECT
              product_id,
              order_id,
              quantity,
              status
            FROM inventory_reservations
            WHERE order_id = ?
          `,
          [orderId]
        );

      const reservation =
        (
          reservationRows as Array<{
            product_id: string;
            order_id: string;
            quantity: number;
            status: string;
          }>
        )[0];

      expect(reservation).toEqual({
        product_id: productId,
        order_id: orderId,
        quantity: 10,
        status: "RESERVED"
      });

      const [outboxRows] =
        await testDb.execute(
          `
            SELECT
              event_type,
              aggregate_type,
              aggregate_id,
              status
            FROM outbox_events
            WHERE aggregate_id = ?
              AND event_type = ?
            ORDER BY created_at DESC
            LIMIT 1
          `,
          [
            productId,
            "inventory.reserved"
          ]
        );

      const outboxEvent =
        (
          outboxRows as Array<{
            event_type: string;
            aggregate_type: string;
            aggregate_id: string;
            status: string;
          }>
        )[0];

      expect(outboxEvent).toEqual({
        event_type:
          "inventory.reserved",
        aggregate_type: "inventory",
        aggregate_id: productId,
        status: "PENDING"
      });
    });

    it("should be idempotent for repeated reservation", async () => {
      const firstResponse =
        await request(app)
          .post(
            "/api/v1/inventory/reserve"
          )
          .send({
            productId,
            orderId,
            quantity: 10
          });

      const secondResponse =
        await request(app)
          .post(
            "/api/v1/inventory/reserve"
          )
          .send({
            productId,
            orderId,
            quantity: 10
          });

      expect(
        firstResponse.status
      ).toBe(200);

      expect(
        secondResponse.status
      ).toBe(200);

      expect(
        secondResponse.body.data.reservation.id
      ).toBe(
        firstResponse.body.data.reservation.id
      );

      const [inventoryRows] =
        await testDb.execute(
          `
            SELECT
              available_quantity,
              reserved_quantity
            FROM inventory
            WHERE product_id = ?
          `,
          [productId]
        );

      const inventory =
        (
          inventoryRows as Array<{
            available_quantity: number;
            reserved_quantity: number;
          }>
        )[0];

      expect(
        inventory.available_quantity
      ).toBe(90);

      expect(
        inventory.reserved_quantity
      ).toBe(10);

      const [outboxRows] =
        await testDb.execute(
          `
            SELECT COUNT(*) AS count
            FROM outbox_events
            WHERE event_type = ?
          `,
          ["inventory.reserved"]
        );

      expect(
        Number(
          (
            outboxRows as Array<{
              count: number;
            }>
          )[0].count
        )
      ).toBe(1);
    });

    it("should reject insufficient inventory", async () => {
      const response =
        await request(app)
          .post(
            "/api/v1/inventory/reserve"
          )
          .send({
            productId,
            orderId,
            quantity: 150
          });

      expect(response.status).toBe(409);

      expect(
        response.body.success
      ).toBe(false);

      expect(
        response.body.message
      ).toBe("Insufficient inventory");

      const [inventoryRows] =
        await testDb.execute(
          `
            SELECT
              available_quantity,
              reserved_quantity
            FROM inventory
            WHERE product_id = ?
          `,
          [productId]
        );

      const inventory =
        (
          inventoryRows as Array<{
            available_quantity: number;
            reserved_quantity: number;
          }>
        )[0];

      expect(
        inventory.available_quantity
      ).toBe(100);

      expect(
        inventory.reserved_quantity
      ).toBe(0);

      const [outboxRows] =
        await testDb.execute(
          `
            SELECT COUNT(*) AS count
            FROM outbox_events
          `
        );

      expect(
        Number(
          (
            outboxRows as Array<{
              count: number;
            }>
          )[0].count
        )
      ).toBe(0);
    });
  });

  describe("POST /api/v1/inventory/confirm", () => {
    beforeEach(async () => {
      await request(app)
        .post("/api/v1/inventory")
        .send({
          productId,
          initialQuantity: 100
        });

      await request(app)
        .post(
          "/api/v1/inventory/reserve"
        )
        .send({
          productId,
          orderId,
          quantity: 10
        });
    });

    it("should confirm reservation", async () => {
      const response =
        await request(app)
          .post(
            "/api/v1/inventory/confirm"
          )
          .send({
            orderId
          });

      expect(response.status).toBe(200);

      expect(
        response.body.success
      ).toBe(true);

      expect(
        response.body.data.status
      ).toBe("CONFIRMED");

      const [inventoryRows] =
        await testDb.execute(
          `
            SELECT
              available_quantity,
              reserved_quantity
            FROM inventory
            WHERE product_id = ?
          `,
          [productId]
        );

      const inventory =
        (
          inventoryRows as Array<{
            available_quantity: number;
            reserved_quantity: number;
          }>
        )[0];

      expect(
        inventory.available_quantity
      ).toBe(90);

      expect(
        inventory.reserved_quantity
      ).toBe(0);

      const [outboxRows] =
        await testDb.execute(
          `
            SELECT
              event_type
            FROM outbox_events
            WHERE event_type = ?
          `,
          ["inventory.confirmed"]
        );

      expect(
        outboxRows
      ).toHaveLength(1);
    });

    it("should be idempotent when confirming twice", async () => {
      const firstResponse =
        await request(app)
          .post(
            "/api/v1/inventory/confirm"
          )
          .send({
            orderId
          });

      const secondResponse =
        await request(app)
          .post(
            "/api/v1/inventory/confirm"
          )
          .send({
            orderId
          });

      expect(
        firstResponse.status
      ).toBe(200);

      expect(
        secondResponse.status
      ).toBe(200);

      expect(
        secondResponse.body.data.status
      ).toBe("CONFIRMED");

      const [outboxRows] =
        await testDb.execute(
          `
            SELECT COUNT(*) AS count
            FROM outbox_events
            WHERE event_type = ?
          `,
          ["inventory.confirmed"]
        );

      expect(
        Number(
          (
            outboxRows as Array<{
              count: number;
            }>
          )[0].count
        )
      ).toBe(1);
    });
  });

  describe("POST /api/v1/inventory/release", () => {
    beforeEach(async () => {
      await request(app)
        .post("/api/v1/inventory")
        .send({
          productId,
          initialQuantity: 100
        });

      await request(app)
        .post(
          "/api/v1/inventory/reserve"
        )
        .send({
          productId,
          orderId,
          quantity: 10
        });
    });

    it("should release reservation", async () => {
      const response =
        await request(app)
          .post(
            "/api/v1/inventory/release"
          )
          .send({
            orderId
          });

      expect(response.status).toBe(200);

      expect(
        response.body.success
      ).toBe(true);

      expect(
        response.body.data.reservation.status
      ).toBe("RELEASED");

      expect(
        response.body.data.inventory.available_quantity
      ).toBe(100);

      expect(
        response.body.data.inventory.reserved_quantity
      ).toBe(0);

      const [outboxRows] =
        await testDb.execute(
          `
            SELECT
              event_type
            FROM outbox_events
            WHERE event_type = ?
          `,
          ["inventory.released"]
        );

      expect(
        outboxRows
      ).toHaveLength(1);
    });

    it("should be idempotent when releasing twice", async () => {
      const firstResponse =
        await request(app)
          .post(
            "/api/v1/inventory/release"
          )
          .send({
            orderId
          });

      const secondResponse =
        await request(app)
          .post(
            "/api/v1/inventory/release"
          )
          .send({
            orderId
          });

      expect(
        firstResponse.status
      ).toBe(200);

      expect(
        secondResponse.status
      ).toBe(200);

      expect(
        secondResponse.body.data.reservation.status
      ).toBe("RELEASED");

      const [outboxRows] =
        await testDb.execute(
          `
            SELECT COUNT(*) AS count
            FROM outbox_events
            WHERE event_type = ?
          `,
          ["inventory.released"]
        );

      expect(
        Number(
          (
            outboxRows as Array<{
              count: number;
            }>
          )[0].count
        )
      ).toBe(1);
    });
  });
});