import { InventoryService } from "../../services/inventory.service";
import {
  InventoryRepository,
  InventoryRecord,
  InventoryReservationRecord
} from "../../repositories/inventory.repository";

describe("InventoryService", () => {
  let inventoryService: InventoryService;

  let mockInventoryRepository: {
    create: jest.Mock;
    findByProductId: jest.Mock;
    reserveStock: jest.Mock;
    confirmReservation: jest.Mock;
    releaseReservation: jest.Mock;
  };

  const inventory: InventoryRecord = {
    id: "inventory-1",
    product_id: "product-1",
    available_quantity: 100,
    reserved_quantity: 0,
    created_at: new Date(),
    updated_at: new Date()
  } as InventoryRecord;

  const reservation: InventoryReservationRecord = {
    id: "reservation-1",
    product_id: "product-1",
    order_id: "order-1",
    quantity: 10,
    status: "RESERVED"
  } as InventoryReservationRecord;

  beforeEach(() => {
    mockInventoryRepository = {
      create: jest.fn(),
      findByProductId: jest.fn(),
      reserveStock: jest.fn(),
      confirmReservation: jest.fn(),
      releaseReservation: jest.fn()
    };

    inventoryService =
      new InventoryService(
        mockInventoryRepository as unknown as InventoryRepository
      );
  });

  describe("createInventory", () => {
    it("should create inventory successfully", async () => {
      mockInventoryRepository.findByProductId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(inventory);

      mockInventoryRepository.create
        .mockResolvedValue(undefined);

      const result =
        await inventoryService.createInventory({
          productId: "product-1",
          initialQuantity: 100
        });

      expect(
        mockInventoryRepository.findByProductId
      ).toHaveBeenCalledWith("product-1");

      expect(
        mockInventoryRepository.create
      ).toHaveBeenCalledWith(
        expect.any(String),
        "product-1",
        100
      );

      expect(result).toEqual(inventory);
    });

    it("should reject when productId is missing", async () => {
      await expect(
        inventoryService.createInventory({
          productId: "",
          initialQuantity: 100
        })
      ).rejects.toThrow(
        "productId is required"
      );

      expect(
        mockInventoryRepository.findByProductId
      ).not.toHaveBeenCalled();

      expect(
        mockInventoryRepository.create
      ).not.toHaveBeenCalled();
    });

    it("should reject a negative initial quantity", async () => {
      await expect(
        inventoryService.createInventory({
          productId: "product-1",
          initialQuantity: -1
        })
      ).rejects.toThrow(
        "initialQuantity must be a non-negative integer"
      );

      expect(
        mockInventoryRepository.findByProductId
      ).not.toHaveBeenCalled();
    });

    it("should reject a decimal initial quantity", async () => {
      await expect(
        inventoryService.createInventory({
          productId: "product-1",
          initialQuantity: 10.5
        })
      ).rejects.toThrow(
        "initialQuantity must be a non-negative integer"
      );
    });

    it("should reject when inventory already exists", async () => {
      mockInventoryRepository.findByProductId
        .mockResolvedValue(inventory);

      await expect(
        inventoryService.createInventory({
          productId: "product-1",
          initialQuantity: 100
        })
      ).rejects.toThrow(
        "Inventory already exists for this product"
      );

      expect(
        mockInventoryRepository.create
      ).not.toHaveBeenCalled();
    });

    it("should reject when created inventory cannot be retrieved", async () => {
      mockInventoryRepository.findByProductId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockInventoryRepository.create
        .mockResolvedValue(undefined);

      await expect(
        inventoryService.createInventory({
          productId: "product-1",
          initialQuantity: 100
        })
      ).rejects.toThrow(
        "Inventory could not be created"
      );
    });
  });

  describe("getInventoryByProductId", () => {
    it("should return inventory successfully", async () => {
      mockInventoryRepository.findByProductId
        .mockResolvedValue(inventory);

      const result =
        await inventoryService.getInventoryByProductId(
          "product-1"
        );

      expect(
        mockInventoryRepository.findByProductId
      ).toHaveBeenCalledWith("product-1");

      expect(result).toEqual(inventory);
    });

    it("should reject when productId is missing", async () => {
      await expect(
        inventoryService.getInventoryByProductId("")
      ).rejects.toThrow(
        "productId is required"
      );

      expect(
        mockInventoryRepository.findByProductId
      ).not.toHaveBeenCalled();
    });

    it("should reject when inventory does not exist", async () => {
      mockInventoryRepository.findByProductId
        .mockResolvedValue(null);

      await expect(
        inventoryService.getInventoryByProductId(
          "product-1"
        )
      ).rejects.toThrow(
        "Inventory not found"
      );
    });
  });

  describe("reserveInventory", () => {
    it("should reserve inventory successfully", async () => {
      const response = {
        inventory,
        reservation
      };

      mockInventoryRepository.reserveStock
        .mockResolvedValue(response);

      const result =
        await inventoryService.reserveInventory({
          productId: "product-1",
          orderId: "order-1",
          quantity: 10
        });

      expect(
        mockInventoryRepository.reserveStock
      ).toHaveBeenCalledWith(
        expect.any(String),
        "product-1",
        "order-1",
        10
      );

      expect(result).toEqual(response);
    });

    it("should reject when productId is missing", async () => {
      await expect(
        inventoryService.reserveInventory({
          productId: "",
          orderId: "order-1",
          quantity: 10
        })
      ).rejects.toThrow(
        "productId is required"
      );

      expect(
        mockInventoryRepository.reserveStock
      ).not.toHaveBeenCalled();
    });

    it("should reject when orderId is missing", async () => {
      await expect(
        inventoryService.reserveInventory({
          productId: "product-1",
          orderId: "",
          quantity: 10
        })
      ).rejects.toThrow(
        "orderId is required"
      );

      expect(
        mockInventoryRepository.reserveStock
      ).not.toHaveBeenCalled();
    });

    it("should reject zero quantity", async () => {
      await expect(
        inventoryService.reserveInventory({
          productId: "product-1",
          orderId: "order-1",
          quantity: 0
        })
      ).rejects.toThrow(
        "quantity must be a positive integer"
      );
    });

    it("should reject negative quantity", async () => {
      await expect(
        inventoryService.reserveInventory({
          productId: "product-1",
          orderId: "order-1",
          quantity: -5
        })
      ).rejects.toThrow(
        "quantity must be a positive integer"
      );
    });

    it("should reject decimal quantity", async () => {
      await expect(
        inventoryService.reserveInventory({
          productId: "product-1",
          orderId: "order-1",
          quantity: 1.5
        })
      ).rejects.toThrow(
        "quantity must be a positive integer"
      );
    });

    it("should propagate repository errors", async () => {
      mockInventoryRepository.reserveStock
        .mockRejectedValue(
          new Error("Insufficient inventory")
        );

      await expect(
        inventoryService.reserveInventory({
          productId: "product-1",
          orderId: "order-1",
          quantity: 10
        })
      ).rejects.toThrow(
        "Insufficient inventory"
      );
    });
  });

  describe("confirmInventory", () => {
    it("should confirm inventory successfully", async () => {
      const confirmedReservation = {
        ...reservation,
        status: "CONFIRMED"
      } as InventoryReservationRecord;

      mockInventoryRepository.confirmReservation
        .mockResolvedValue(
          confirmedReservation
        );

      const result =
        await inventoryService.confirmInventory({
          orderId: "order-1"
        });

      expect(
        mockInventoryRepository.confirmReservation
      ).toHaveBeenCalledWith(
        "order-1"
      );

      expect(result).toEqual(
        confirmedReservation
      );
    });

    it("should reject when orderId is missing", async () => {
      await expect(
        inventoryService.confirmInventory({
          orderId: ""
        })
      ).rejects.toThrow(
        "orderId is required"
      );

      expect(
        mockInventoryRepository.confirmReservation
      ).not.toHaveBeenCalled();
    });

    it("should propagate repository errors", async () => {
      mockInventoryRepository.confirmReservation
        .mockRejectedValue(
          new Error(
            "Inventory reservation not found"
          )
        );

      await expect(
        inventoryService.confirmInventory({
          orderId: "order-1"
        })
      ).rejects.toThrow(
        "Inventory reservation not found"
      );
    });
  });

  describe("releaseInventory", () => {
    it("should release inventory successfully", async () => {
      const releasedReservation = {
        ...reservation,
        status: "RELEASED"
      } as InventoryReservationRecord;

      const response = {
        reservation: releasedReservation,
        inventory
      };

      mockInventoryRepository.releaseReservation
        .mockResolvedValue(response);

      const result =
        await inventoryService.releaseInventory({
          orderId: "order-1"
        });

      expect(
        mockInventoryRepository.releaseReservation
      ).toHaveBeenCalledWith(
        "order-1"
      );

      expect(result).toEqual(response);
    });

    it("should reject when orderId is missing", async () => {
      await expect(
        inventoryService.releaseInventory({
          orderId: ""
        })
      ).rejects.toThrow(
        "orderId is required"
      );

      expect(
        mockInventoryRepository.releaseReservation
      ).not.toHaveBeenCalled();
    });

    it("should propagate repository errors", async () => {
      mockInventoryRepository.releaseReservation
        .mockRejectedValue(
          new Error(
            "Confirmed inventory cannot be released"
          )
        );

      await expect(
        inventoryService.releaseInventory({
          orderId: "order-1"
        })
      ).rejects.toThrow(
        "Confirmed inventory cannot be released"
      );
    });
  });
});