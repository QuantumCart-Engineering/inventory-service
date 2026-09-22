import {
  Request,
  Response,
  NextFunction
} from "express";

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

  getInventoryByProductId = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { productId } = req.params;

      if (typeof productId !== "string") {
        res.status(400).json({
          success: false,
          message: "Invalid productId"
        });
        return;
      }

      const inventory =
        await this.inventoryService.getInventoryByProductId(
          productId
        );

      res.status(200).json({
        success: true,
        data: inventory
      });
    } catch (error) {
      next(error);
    }
  };

  reserveInventory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result =
        await this.inventoryService.reserveInventory(
          req.body
        );

      res.status(200).json({
        success: true,
        message: "Inventory reserved successfully",
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  confirmInventory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result =
        await this.inventoryService.confirmInventory(
          req.body
        );

      res.status(200).json({
        success: true,
        message: "Inventory confirmed successfully",
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  releaseInventory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result =
        await this.inventoryService.releaseInventory(
          req.body
        );

      res.status(200).json({
        success: true,
        message: "Inventory released successfully",
        data: result
      });
    } catch (error) {
      next(error);
    }
  };
}