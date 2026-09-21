import { Request, Response, NextFunction } from "express";

import { InventoryService } from "../services/inventory.service";

export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService
  ) {}

  createInventory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const inventory =
        await this.inventoryService.createInventory(
          req.body
        );

      res.status(201).json({
        success: true,
        message: "Inventory created successfully",
        data: inventory
      });
    } catch (error) {
      next(error);
    }
  };
}