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

export default router;