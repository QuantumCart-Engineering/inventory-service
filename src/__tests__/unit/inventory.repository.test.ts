import { ResultSetHeader } from "mysql2";

import { pool } from "../../database/mysql";
import {
  InventoryRepository,
  InventoryRecord,
  InventoryReservationRecord
} from "../../repositories/inventory.repository";
import { OutboxRepository } from "../../repositories/outbox.repository";

jest.mock("../../database/mysql", () => ({
  pool: {
    execute: jest.fn(),
    getConnection: jest.fn()
  }
}));

describe("InventoryRepository", () => {
  let inventoryRepository: InventoryRepository;

  let mockConnection: {
    beginTransaction: jest.Mock;
    execute: jest.Mock;
    commit: jest.Mock;
    rollback: jest.Mock;
    release: jest.Mock;
  };

  let mockOutboxRepository: {
    create: jest.Mock;
  };

  beforeEach(() => {
    // resetAllMocks also drops queued mockResolvedValueOnce responses.
    jest.resetAllMocks();

    mockConnection = {
      beginTransaction: jest.fn(),
      execute: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };

    mockOutboxRepository = {
      create: jest.fn()
    };

    (
      pool.getConnection as jest.Mock
    ).mockResolvedValue(mockConnection);

    inventoryRepository =
      new InventoryRepository(
        mockOutboxRepository as unknown as OutboxRepository
      );
  });

  describe("create", () => {
    it("should create inventory", async () => {
      (
        pool.execute as jest.Mock
      ).mockResolvedValue([
        {
          affectedRows: 1
        } as ResultSetHeader,
        []
      ]);

      await inventoryRepository.create(
        "inventory-1",
        "product-1",
        100
      );

      expect(pool.execute).toHaveBeenCalledTimes(1);

      expect(pool.execute).toHaveBeenCalledWith(
        expect.stringContaining(
          "INSERT INTO inventory"
        ),
        [
          "inventory-1",
          "product-1",
          100
        ]
      );
    });
  });

  describe("findByProductId", () => {
    it("should return inventory when found", async () => {
      const inventory: InventoryRecord = {
        id: "inventory-1",
        product_id: "product-1",
        available_quantity: 100,
        reserved_quantity: 0,
        created_at: new Date(),
        updated_at: new Date()
      } as InventoryRecord;

      (
        pool.execute as jest.Mock
      ).mockResolvedValue([
        [inventory],
        []
      ]);

      const result =
        await inventoryRepository.findByProductId(
          "product-1"
        );

      expect(result).toEqual(inventory);

      expect(pool.execute).toHaveBeenCalledWith(
        expect.stringContaining(
          "WHERE product_id = ?"
        ),
        ["product-1"]
      );
    });

    it("should return null when inventory does not exist", async () => {
      (
        pool.execute as jest.Mock
      ).mockResolvedValue([
        [],
        []
      ]);

      const result =
        await inventoryRepository.findByProductId(
          "product-1"
        );

      expect(result).toBeNull();
    });
  });

  describe("reserveStock", () => {
    const inventory: InventoryRecord = {
      id: "inventory-1",
      product_id: "product-1",
      available_quantity: 100,
      reserved_quantity: 0,
      created_at: new Date(),
      updated_at: new Date()
    } as InventoryRecord;

    const updatedInventory: InventoryRecord = {
      ...inventory,
      available_quantity: 90,
      reserved_quantity: 10
    };

    const existingReservation:
      InventoryReservationRecord = {
      id: "reservation-1",
      product_id: "product-1",
      order_id: "order-1",
      quantity: 10,
      status: "RESERVED"
    } as InventoryReservationRecord;

    it("should reserve stock successfully", async () => {
      mockConnection.execute
        // Existing reservation lookup
        .mockResolvedValueOnce([
          [],
          []
        ])
        // Inventory FOR UPDATE
        .mockResolvedValueOnce([
          [inventory],
          []
        ])
        // Update inventory
        .mockResolvedValueOnce([
          {
            affectedRows: 1
          } as ResultSetHeader,
          []
        ])
        // Create reservation
        .mockResolvedValueOnce([
          {
            affectedRows: 1
          } as ResultSetHeader,
          []
        ])
        // Updated inventory lookup
        .mockResolvedValueOnce([
          [updatedInventory],
          []
        ]);

      const result =
        await inventoryRepository.reserveStock(
          "reservation-1",
          "product-1",
          "order-1",
          10
        );

      expect(
        mockConnection.beginTransaction
      ).toHaveBeenCalled();

      expect(
        mockConnection.commit
      ).toHaveBeenCalled();

      expect(
        mockConnection.rollback
      ).not.toHaveBeenCalled();

      expect(
        mockConnection.release
      ).toHaveBeenCalled();

      expect(
        mockOutboxRepository.create
      ).toHaveBeenCalledWith(
        mockConnection,
        expect.objectContaining({
          eventType:
            "inventory.reserved",
          aggregateType: "inventory",
          aggregateId: "product-1",
          payload: {
            reservationId:
              "reservation-1",
            productId: "product-1",
            orderId: "order-1",
            quantity: 10
          }
        })
      );

      expect(result.inventory).toEqual(
        updatedInventory
      );

      expect(result.reservation).toEqual(
        expect.objectContaining({
          id: "reservation-1",
          product_id: "product-1",
          order_id: "order-1",
          quantity: 10,
          status: "RESERVED"
        })
      );
    });

    it("should reserve quantity 1 from 30 available", async () => {
      const initialInventory = {
        ...inventory,
        available_quantity: 30,
        reserved_quantity: 0
      };

      const afterReservation = {
        ...initialInventory,
        available_quantity: 29,
        reserved_quantity: 1
      };

      mockConnection.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[initialInventory], []])
        .mockResolvedValueOnce([
          { affectedRows: 1 } as ResultSetHeader,
          []
        ])
        .mockResolvedValueOnce([
          { affectedRows: 1 } as ResultSetHeader,
          []
        ])
        .mockResolvedValueOnce([[afterReservation], []]);

      const result =
        await inventoryRepository.reserveStock(
          "reservation-30",
          "product-1",
          "order-30",
          1
        );

      expect(
        result.inventory.available_quantity
      ).toBe(29);

      expect(
        result.inventory.reserved_quantity
      ).toBe(1);

      expect(
        mockConnection.execute
      ).toHaveBeenCalledWith(
        expect.stringContaining(
          "available_quantity >= ?"
        ),
        [1, 1, "product-1", 1]
      );
    });

    it("should return existing RESERVED reservation idempotently", async () => {
      mockConnection.execute
        // Existing reservation
        .mockResolvedValueOnce([
          [existingReservation],
          []
        ])
        // Inventory lookup
        .mockResolvedValueOnce([
          [inventory],
          []
        ]);

      const result =
        await inventoryRepository.reserveStock(
          "new-reservation-id",
          "product-1",
          "order-1",
          10
        );

      expect(result.reservation).toEqual(
        existingReservation
      );

      expect(result.inventory).toEqual(
        inventory
      );

      expect(
        mockConnection.commit
      ).toHaveBeenCalled();

      expect(
        mockOutboxRepository.create
      ).not.toHaveBeenCalled();

      expect(
        mockConnection.execute
      ).toHaveBeenCalledTimes(2);
    });

    it("should reject an existing reservation with different quantity", async () => {
      mockConnection.execute
        .mockResolvedValueOnce([
          [existingReservation],
          []
        ]);

      await expect(
        inventoryRepository.reserveStock(
          "new-reservation-id",
          "product-1",
          "order-1",
          20
        )
      ).rejects.toThrow(
        "Inventory reservation already exists with a different quantity"
      );

      expect(
        mockConnection.rollback
      ).toHaveBeenCalled();

      expect(
        mockConnection.release
      ).toHaveBeenCalled();
    });

    it("should reject an already confirmed reservation", async () => {
      const confirmedReservation = {
        ...existingReservation,
        status: "CONFIRMED"
      } as InventoryReservationRecord;

      mockConnection.execute
        .mockResolvedValueOnce([
          [confirmedReservation],
          []
        ]);

      await expect(
        inventoryRepository.reserveStock(
          "new-reservation-id",
          "product-1",
          "order-1",
          10
        )
      ).rejects.toThrow(
        "Inventory reservation has already been confirmed"
      );

      expect(
        mockConnection.rollback
      ).toHaveBeenCalled();
    });

    it("should reject an already released reservation", async () => {
      const releasedReservation = {
        ...existingReservation,
        status: "RELEASED"
      } as InventoryReservationRecord;

      mockConnection.execute
        .mockResolvedValueOnce([
          [releasedReservation],
          []
        ]);

      await expect(
        inventoryRepository.reserveStock(
          "new-reservation-id",
          "product-1",
          "order-1",
          10
        )
      ).rejects.toThrow(
        "Inventory reservation has already been released"
      );

      expect(
        mockConnection.rollback
      ).toHaveBeenCalled();
    });

    it("should reject when inventory does not exist", async () => {
      mockConnection.execute
        .mockResolvedValueOnce([
          [],
          []
        ])
        .mockResolvedValueOnce([
          [],
          []
        ]);

      await expect(
        inventoryRepository.reserveStock(
          "reservation-1",
          "product-1",
          "order-1",
          10
        )
      ).rejects.toThrow(
        "Inventory not found"
      );

      expect(
        mockConnection.rollback
      ).toHaveBeenCalled();

      expect(
        mockOutboxRepository.create
      ).not.toHaveBeenCalled();
    });

    it("should reject when inventory is insufficient", async () => {
      const lowInventory = {
        ...inventory,
        available_quantity: 5
      };

      mockConnection.execute
        .mockResolvedValueOnce([
          [],
          []
        ])
        .mockResolvedValueOnce([
          [lowInventory],
          []
        ]);

      await expect(
        inventoryRepository.reserveStock(
          "reservation-1",
          "product-1",
          "order-1",
          10
        )
      ).rejects.toThrow(
        "Insufficient inventory"
      );

      expect(
        mockConnection.rollback
      ).toHaveBeenCalled();

      expect(
        mockOutboxRepository.create
      ).not.toHaveBeenCalled();
    });

    it("should rollback when a database operation fails", async () => {
      mockConnection.execute
        .mockResolvedValueOnce([
          [],
          []
        ])
        .mockResolvedValueOnce([
          [inventory],
          []
        ])
        .mockRejectedValueOnce(
          new Error("Database update failed")
        );

      await expect(
        inventoryRepository.reserveStock(
          "reservation-1",
          "product-1",
          "order-1",
          10
        )
      ).rejects.toThrow(
        "Database update failed"
      );

      expect(
        mockConnection.rollback
      ).toHaveBeenCalled();

      expect(
        mockConnection.commit
      ).not.toHaveBeenCalled();

      expect(
        mockConnection.release
      ).toHaveBeenCalled();
    });
  });

  describe("confirmReservation", () => {
    const reservation:
      InventoryReservationRecord = {
      id: "reservation-1",
      product_id: "product-1",
      order_id: "order-1",
      quantity: 10,
      status: "RESERVED"
    } as InventoryReservationRecord;

    it("should confirm a RESERVED reservation", async () => {
      mockConnection.execute
        // Find reservation
        .mockResolvedValueOnce([
          [reservation],
          []
        ])
        // Decrease reserved stock
        .mockResolvedValueOnce([
          {
            affectedRows: 1
          } as ResultSetHeader,
          []
        ])
        // Confirm reservation
        .mockResolvedValueOnce([
          {
            affectedRows: 1
          } as ResultSetHeader,
          []
        ]);

      const result =
        await inventoryRepository.confirmReservation(
          "order-1"
        );

      expect(result.status).toBe(
        "CONFIRMED"
      );

      expect(
        mockOutboxRepository.create
      ).toHaveBeenCalledWith(
        mockConnection,
        expect.objectContaining({
          eventType:
            "inventory.confirmed",
          aggregateType: "inventory",
          aggregateId: "product-1"
        })
      );

      expect(
        mockConnection.commit
      ).toHaveBeenCalled();

      expect(
        mockConnection.rollback
      ).not.toHaveBeenCalled();
    });

    it("should confirm every reservation belonging to an order exactly once", async () => {
      const firstReservation = {
        ...reservation,
        status: "RESERVED"
      } as InventoryReservationRecord;

      const secondReservation = {
        ...reservation,
        id: "reservation-2",
        product_id: "product-2",
        quantity: 3,
        status: "RESERVED"
      } as InventoryReservationRecord;

      mockConnection.execute
        // Find reservations
        .mockResolvedValueOnce([
          [firstReservation, secondReservation],
          []
        ])
        // Decrease reserved stock for product-1
        .mockResolvedValueOnce([
          { affectedRows: 1 } as ResultSetHeader,
          []
        ])
        // Mark product-1 reservation confirmed
        .mockResolvedValueOnce([
          { affectedRows: 1 } as ResultSetHeader,
          []
        ])
        // Decrease reserved stock for product-2
        .mockResolvedValueOnce([
          { affectedRows: 1 } as ResultSetHeader,
          []
        ])
        // Mark product-2 reservation confirmed
        .mockResolvedValueOnce([
          { affectedRows: 1 } as ResultSetHeader,
          []
        ]);

      const result =
        await inventoryRepository.confirmReservation(
          "order-1"
        );

      expect(result.status).toBe(
        "CONFIRMED"
      );

      expect(
        mockOutboxRepository.create
      ).toHaveBeenCalledTimes(2);

      expect(
        mockConnection.execute
      ).toHaveBeenCalledWith(
        expect.stringContaining(
          "reserved_quantity = reserved_quantity - ?"
        ),
        [10, "product-1"]
      );

      expect(
        mockConnection.execute
      ).toHaveBeenCalledWith(
        expect.stringContaining(
          "reserved_quantity = reserved_quantity - ?"
        ),
        [3, "product-2"]
      );

      expect(
        mockConnection.commit
      ).toHaveBeenCalled();
    });

    it("should return already CONFIRMED reservation idempotently", async () => {
      const confirmed = {
        ...reservation,
        status: "CONFIRMED"
      } as InventoryReservationRecord;

      mockConnection.execute
        .mockResolvedValueOnce([
          [confirmed],
          []
        ]);

      const result =
        await inventoryRepository.confirmReservation(
          "order-1"
        );

      expect(result).toEqual(
        confirmed
      );

      expect(
        mockConnection.commit
      ).toHaveBeenCalled();

      expect(
        mockOutboxRepository.create
      ).not.toHaveBeenCalled();

      expect(
        mockConnection.execute
      ).toHaveBeenCalledTimes(1);
    });

    it("should reject a RELEASED reservation", async () => {
      const released = {
        ...reservation,
        status: "RELEASED"
      } as InventoryReservationRecord;

      mockConnection.execute
        .mockResolvedValueOnce([
          [released],
          []
        ]);

      await expect(
        inventoryRepository.confirmReservation(
          "order-1"
        )
      ).rejects.toThrow(
        "Inventory reservation has already been released"
      );

      expect(
        mockConnection.rollback
      ).toHaveBeenCalled();

      expect(
        mockOutboxRepository.create
      ).not.toHaveBeenCalled();
    });

    it("should reject when reservation does not exist", async () => {
      mockConnection.execute
        .mockResolvedValueOnce([
          [],
          []
        ]);

      await expect(
        inventoryRepository.confirmReservation(
          "order-1"
        )
      ).rejects.toThrow(
        "Inventory reservation not found"
      );

      expect(
        mockConnection.rollback
      ).toHaveBeenCalled();
    });
  });

  describe("releaseReservation", () => {
    const reservation:
      InventoryReservationRecord = {
      id: "reservation-1",
      product_id: "product-1",
      order_id: "order-1",
      quantity: 10,
      status: "RESERVED"
    } as InventoryReservationRecord;

    const inventory: InventoryRecord = {
      id: "inventory-1",
      product_id: "product-1",
      available_quantity: 90,
      reserved_quantity: 10,
      created_at: new Date(),
      updated_at: new Date()
    } as InventoryRecord;

    const releasedInventory: InventoryRecord = {
      ...inventory,
      available_quantity: 100,
      reserved_quantity: 0
    };

    it("should release a RESERVED reservation", async () => {
      mockConnection.execute
        // Find reservation
        .mockResolvedValueOnce([
          [reservation],
          []
        ])
        // Release reserved stock
        .mockResolvedValueOnce([
          {
            affectedRows: 1
          } as ResultSetHeader,
          []
        ])
        // Release reservation
        .mockResolvedValueOnce([
          {
            affectedRows: 1
          } as ResultSetHeader,
          []
        ])
        // Get updated inventory
        .mockResolvedValueOnce([
          [releasedInventory],
          []
        ]);

      const result =
        await inventoryRepository.releaseReservation(
          "order-1"
        );

      expect(
        result.reservation.status
      ).toBe("RELEASED");

      expect(
        result.inventory
      ).toEqual(releasedInventory);

      expect(
        mockOutboxRepository.create
      ).toHaveBeenCalledWith(
        mockConnection,
        expect.objectContaining({
          eventType:
            "inventory.released",
          aggregateType: "inventory",
          aggregateId: "product-1"
        })
      );

      expect(
        mockConnection.commit
      ).toHaveBeenCalled();
    });

    it("should release every reservation belonging to an order exactly once", async () => {
      const firstReservation = {
        ...reservation,
        status: "RESERVED"
      } as InventoryReservationRecord;

      const secondReservation = {
        ...reservation,
        id: "reservation-2",
        product_id: "product-2",
        quantity: 3,
        status: "RESERVED"
      } as InventoryReservationRecord;

      const secondInventory = {
        ...inventory,
        id: "inventory-2",
        product_id: "product-2",
        available_quantity: 47,
        reserved_quantity: 3
      };

      const secondReleasedInventory = {
        ...secondInventory,
        available_quantity: 50,
        reserved_quantity: 0
      };

      mockConnection.execute
        // Find reservations
        .mockResolvedValueOnce([
          [firstReservation, secondReservation],
          []
        ])
        // Release the first reservation's stock
        .mockResolvedValueOnce([
          { affectedRows: 1 } as ResultSetHeader,
          []
        ])
        // Mark the first reservation released
        .mockResolvedValueOnce([
          { affectedRows: 1 } as ResultSetHeader,
          []
        ])
        // Release the second reservation's stock
        .mockResolvedValueOnce([
          { affectedRows: 1 } as ResultSetHeader,
          []
        ])
        // Mark the second reservation released
        .mockResolvedValueOnce([
          { affectedRows: 1 } as ResultSetHeader,
          []
        ])
        // First inventory after release
        .mockResolvedValueOnce([
          [releasedInventory],
          []
        ]);

      const result =
        await inventoryRepository.releaseReservation(
          "order-1"
        );

      expect(result.reservation.status).toBe(
        "RELEASED"
      );

      expect(
        mockOutboxRepository.create
      ).toHaveBeenCalledTimes(2);

      expect(
        mockOutboxRepository.create
      ).toHaveBeenNthCalledWith(
        1,
        mockConnection,
        expect.objectContaining({
          aggregateId: "product-1"
        })
      );

      expect(
        mockOutboxRepository.create
      ).toHaveBeenNthCalledWith(
        2,
        mockConnection,
        expect.objectContaining({
          aggregateId: "product-2"
        })
      );

      expect(
        mockConnection.execute
      ).toHaveBeenCalledWith(
        expect.stringContaining(
          "reserved_quantity = reserved_quantity - ?"
        ),
        [10, 10, "product-1"]
      );

      expect(
        mockConnection.execute
      ).toHaveBeenCalledWith(
        expect.stringContaining(
          "reserved_quantity = reserved_quantity - ?"
        ),
        [3, 3, "product-2"]
      );

      expect(
        mockConnection.commit
      ).toHaveBeenCalled();

      expect(
        mockConnection.rollback
      ).not.toHaveBeenCalled();

      // The response keeps returning the first reservation for
      // backwards compatibility.
      expect(secondInventory).toBeDefined();
      expect(secondReleasedInventory).toBeDefined();
    });

    it("should return already RELEASED reservation idempotently", async () => {
      const released = {
        ...reservation,
        status: "RELEASED"
      } as InventoryReservationRecord;

      mockConnection.execute
        .mockResolvedValueOnce([
          [released],
          []
        ])
        .mockResolvedValueOnce([
          [releasedInventory],
          []
        ]);

      const result =
        await inventoryRepository.releaseReservation(
          "order-1"
        );

      expect(result.reservation).toEqual(
        released
      );

      expect(result.inventory).toEqual(
        releasedInventory
      );

      expect(
        mockOutboxRepository.create
      ).not.toHaveBeenCalled();

      expect(
        mockConnection.commit
      ).toHaveBeenCalled();
    });

    it("should restore stock when releasing a CONFIRMED reservation", async () => {
      const confirmed = {
        ...reservation,
        status: "CONFIRMED"
      } as InventoryReservationRecord;

      const restoredInventory = {
        ...inventory,
        available_quantity: 100,
        reserved_quantity: 0
      };

      mockConnection.execute
        // Find reservations
        .mockResolvedValueOnce([
          [confirmed],
          []
        ])
        // Restore confirmed stock to available
        .mockResolvedValueOnce([
          {
            affectedRows: 1
          } as ResultSetHeader,
          []
        ])
        // Mark reservation released
        .mockResolvedValueOnce([
          {
            affectedRows: 1
          } as ResultSetHeader,
          []
        ])
        // Get updated inventory
        .mockResolvedValueOnce([
          [restoredInventory],
          []
        ]);

      const result =
        await inventoryRepository.releaseReservation(
          "order-1"
        );

      expect(result.reservation.status).toBe(
        "RELEASED"
      );

      expect(
        result.inventory.available_quantity
      ).toBe(100);

      expect(
        result.inventory.reserved_quantity
      ).toBe(0);

      expect(
        mockOutboxRepository.create
      ).toHaveBeenCalledWith(
        mockConnection,
        expect.objectContaining({
          eventType: "inventory.released",
          aggregateId: "product-1"
        })
      );

      expect(
        mockConnection.commit
      ).toHaveBeenCalled();

      expect(
        mockConnection.rollback
      ).not.toHaveBeenCalled();
    });

    it("should reject when reservation does not exist", async () => {
      mockConnection.execute
        .mockResolvedValueOnce([
          [],
          []
        ]);

      await expect(
        inventoryRepository.releaseReservation(
          "order-1"
        )
      ).rejects.toThrow(
        "Inventory reservation not found"
      );

      expect(
        mockConnection.rollback
      ).toHaveBeenCalled();
    });
  });
});