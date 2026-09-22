import { Router } from "express";

import { InventoryController } from "../controllers/inventory.controller";
import { InventoryRepository } from "../repositories/inventory.repository";
import { InventoryService } from "../services/inventory.service";

const router = Router();

const inventoryRepository =
  new InventoryRepository();

const inventoryService =
  new InventoryService(inventoryRepository);

const inventoryController =
  new InventoryController(inventoryService);

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