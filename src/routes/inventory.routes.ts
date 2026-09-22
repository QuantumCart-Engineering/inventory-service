import { Router } from "express";

import { InventoryController } from "../controllers/inventory.controller";
import { OutboxRepository } from "../repositories/outbox.repository";
import { InventoryRepository } from "../repositories/inventory.repository";
import { InventoryService } from "../services/inventory.service";

const router = Router();

const outboxRepository =
  new OutboxRepository();

const inventoryRepository =
  new InventoryRepository(
    outboxRepository
  );

const inventoryService =
  new InventoryService(
    inventoryRepository
  );

const inventoryController =
  new InventoryController(
    inventoryService
  );

/**
 * @openapi
 * /api/v1/inventory:
 *   post:
 *     summary: Create inventory
 *     description: Creates an inventory record for a product.
 *     tags:
 *       - Inventory
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateInventoryRequest'
 *     responses:
 *       201:
 *         description: Inventory created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Inventory'
 *       400:
 *         description: Invalid request.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Inventory already exists for the product.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/",
  inventoryController.createInventory
);

/**
 * @openapi
 * /api/v1/inventory/{productId}:
 *   get:
 *     summary: Get inventory by product
 *     description: Returns the current inventory state for a product.
 *     tags:
 *       - Inventory
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         description: Unique product identifier.
 *         schema:
 *           type: string
 *         example: 11111111-1111-1111-1111-111111111111
 *     responses:
 *       200:
 *         description: Inventory returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Inventory'
 *       400:
 *         description: Invalid product ID.
 *       404:
 *         description: Inventory not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/:productId",
  inventoryController.getInventoryByProductId
);

/**
 * @openapi
 * /api/v1/inventory/reserve:
 *   post:
 *     summary: Reserve inventory
 *     description: Reserves available inventory for an order.
 *     tags:
 *       - Inventory
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReserveInventoryRequest'
 *     responses:
 *       200:
 *         description: Inventory reserved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReserveInventoryResponse'
 *       400:
 *         description: Invalid request.
 *       404:
 *         description: Inventory not found.
 *       409:
 *         description: Insufficient inventory or reservation conflict.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/reserve",
  inventoryController.reserveInventory
);

/**
 * @openapi
 * /api/v1/inventory/confirm:
 *   post:
 *     summary: Confirm inventory reservation
 *     description: Permanently confirms a previously reserved inventory quantity.
 *     tags:
 *       - Inventory
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConfirmInventoryRequest'
 *     responses:
 *       200:
 *         description: Inventory reservation confirmed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryReservation'
 *       400:
 *         description: Invalid order ID.
 *       404:
 *         description: Inventory reservation not found.
 *       409:
 *         description: Reservation cannot be confirmed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/confirm",
  inventoryController.confirmInventory
);

/**
 * @openapi
 * /api/v1/inventory/release:
 *   post:
 *     summary: Release inventory reservation
 *     description: Releases a previously reserved inventory quantity back to available stock.
 *     tags:
 *       - Inventory
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReleaseInventoryRequest'
 *     responses:
 *       200:
 *         description: Inventory reservation released successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reservation:
 *                   $ref: '#/components/schemas/InventoryReservation'
 *                 inventory:
 *                   $ref: '#/components/schemas/Inventory'
 *       400:
 *         description: Invalid order ID.
 *       404:
 *         description: Inventory reservation not found.
 *       409:
 *         description: Confirmed reservation cannot be released.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/release",
  inventoryController.releaseInventory
);

export default router;