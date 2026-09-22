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

router.post(
  "/",
  inventoryController.createInventory
);

router.post(
  "/reserve",
  inventoryController.reserveInventory
);

router.post(
  "/confirm",
  inventoryController.confirmInventory
);

router.post(
  "/release",
  inventoryController.releaseInventory
);

router.get(
  "/:productId",
  inventoryController.getInventoryByProductId
);

export default router;