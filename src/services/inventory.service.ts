import { randomUUID } from "crypto";

import {
  CreateInventoryRequest,
  ReserveInventoryRequest,
  ConfirmInventoryRequest,
  ReleaseInventoryRequest,
  ReserveInventoryResponse
} from "../dtos/inventory.dto";

import {
  InventoryRecord,
  InventoryRepository,
  InventoryReservationRecord
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

  async getInventoryByProductId(
    productId: string
  ): Promise<InventoryRecord> {
    this.validateProductId(productId);

    const inventory =
      await this.inventoryRepository.findByProductId(
        productId
      );

    if (!inventory) {
      throw new Error("Inventory not found");
    }

    return inventory;
  }

  async reserveInventory(
    data: ReserveInventoryRequest
  ): Promise<ReserveInventoryResponse> {
    this.validateReserveInventoryRequest(data);

    const reservationId = randomUUID();

    return this.inventoryRepository.reserveStock(
      reservationId,
      data.productId,
      data.orderId,
      data.quantity
    );
  }

  async confirmInventory(
    data: ConfirmInventoryRequest
  ): Promise<InventoryReservationRecord> {
    this.validateOrderId(data.orderId);

    return this.inventoryRepository.confirmReservation(
      data.orderId
    );
  }

  async releaseInventory(
    data: ReleaseInventoryRequest
  ): Promise<{
    reservation: InventoryReservationRecord;
    inventory: InventoryRecord;
  }> {
    this.validateOrderId(data.orderId);

    return this.inventoryRepository.releaseReservation(
      data.orderId
    );
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

  private validateReserveInventoryRequest(
    data: ReserveInventoryRequest
  ): void {
    this.validateProductId(data.productId);
    this.validateOrderId(data.orderId);

    if (
      typeof data.quantity !== "number" ||
      !Number.isInteger(data.quantity) ||
      data.quantity <= 0
    ) {
      throw new Error(
        "quantity must be a positive integer"
      );
    }
  }

  private validateProductId(
    productId: string
  ): void {
    if (
      !productId ||
      typeof productId !== "string" ||
      productId.trim() === ""
    ) {
      throw new Error("productId is required");
    }
  }

  private validateOrderId(
    orderId: string
  ): void {
    if (
      !orderId ||
      typeof orderId !== "string" ||
      orderId.trim() === ""
    ) {
      throw new Error("orderId is required");
    }
  }
}