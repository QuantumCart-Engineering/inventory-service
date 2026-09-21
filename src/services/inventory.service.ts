import { randomUUID } from "crypto";

import { CreateInventoryRequest } from "../dtos/inventory.dto";
import {
  InventoryRecord,
  InventoryRepository
} from "../repositories/inventory.repository";

export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository
  ) {}

  async createInventory(
    data: CreateInventoryRequest
  ): Promise<InventoryRecord> {
    this.validateCreateInventoryRequest(data);

    const existingInventory =
      await this.inventoryRepository.findByProductId(
        data.productId
      );

    if (existingInventory) {
      throw new Error(
        "Inventory already exists for this product"
      );
    }

    const inventoryId = randomUUID();

    await this.inventoryRepository.create(
      inventoryId,
      data.productId,
      data.initialQuantity
    );

    const inventory =
      await this.inventoryRepository.findByProductId(
        data.productId
      );

    if (!inventory) {
      throw new Error(
        "Inventory could not be created"
      );
    }

    return inventory;
  }

  private validateCreateInventoryRequest(
    data: CreateInventoryRequest
  ): void {
    if (
      !data.productId ||
      typeof data.productId !== "string"
    ) {
      throw new Error("productId is required");
    }

    if (
      typeof data.initialQuantity !== "number" ||
      !Number.isInteger(data.initialQuantity) ||
      data.initialQuantity < 0
    ) {
      throw new Error(
        "initialQuantity must be a non-negative integer"
      );
    }
  }
}