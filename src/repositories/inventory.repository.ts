import { randomUUID } from "crypto";

import {
  ResultSetHeader,
  RowDataPacket
} from "mysql2";

import { pool } from "../database/mysql";
import { inventoryQueries } from "../queries/inventory.queries";
import { OutboxRepository } from "./outbox.repository";

export interface InventoryRecord extends RowDataPacket {
  id: string;
  product_id: string;
  available_quantity: number;
  reserved_quantity: number;
  created_at: Date;
  updated_at: Date;
}

export interface InventoryReservationRecord
  extends RowDataPacket {
  id: string;
  product_id: string;
  order_id: string;
  quantity: number;
  status:
  | "RESERVED"
  | "CONFIRMED"
  | "RELEASED";
}

export class InventoryRepository {
  constructor(
    private readonly outboxRepository: OutboxRepository
  ) { }

  async create(
    id: string,
    productId: string,
    initialQuantity: number
  ): Promise<void> {
    await pool.execute<ResultSetHeader>(
      inventoryQueries.create,
      [id, productId, initialQuantity]
    );
  }

  async findByProductId(
    productId: string
  ): Promise<InventoryRecord | null> {
    const [rows] =
      await pool.execute<InventoryRecord[]>(
        inventoryQueries.findByProductId,
        [productId]
      );

    return rows[0] ?? null;
  }

  async reserveStock(
    reservationId: string,
    productId: string,
    orderId: string,
    quantity: number
  ): Promise<{
    inventory: InventoryRecord;
    reservation: InventoryReservationRecord;
  }> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [existingReservationRows] =
        await connection.execute<
          InventoryReservationRecord[]
        >(
          inventoryQueries.findReservationByOrderAndProductForUpdate,
          [orderId, productId]
        );

      const existingReservation =
        existingReservationRows[0];

      if (existingReservation) {
        if (
          existingReservation.status === "RESERVED"
        ) {
          if (
            existingReservation.quantity !== quantity
          ) {
            throw new Error(
              "Inventory reservation already exists with a different quantity"
            );
          }

          const [inventoryRows] =
            await connection.execute<InventoryRecord[]>(
              inventoryQueries.findByProductId,
              [productId]
            );

          const inventory = inventoryRows[0];

          if (!inventory) {
            throw new Error(
              "Inventory not found"
            );
          }

          await connection.commit();

          return {
            inventory,
            reservation: existingReservation
          };
        }

        if (
          existingReservation.status === "CONFIRMED"
        ) {
          throw new Error(
            "Inventory reservation has already been confirmed"
          );
        }

        if (
          existingReservation.status === "RELEASED"
        ) {
          throw new Error(
            "Inventory reservation has already been released"
          );
        }
      }

      const [inventoryRows] =
        await connection.execute<InventoryRecord[]>(
          inventoryQueries.findByProductIdForUpdate,
          [productId]
        );

      const inventory = inventoryRows[0];

      if (!inventory) {
        throw new Error(
          "Inventory not found"
        );
      }

      if (
        inventory.available_quantity < quantity
      ) {
        throw new Error(
          "Insufficient inventory"
        );
      }

      await connection.execute<ResultSetHeader>(
        inventoryQueries.updateReservedStock,
        [
          quantity,
          quantity,
          productId
        ]
      );

      await connection.execute<ResultSetHeader>(
        inventoryQueries.createReservation,
        [
          reservationId,
          productId,
          orderId,
          quantity
        ]
      );

      /*
       * Create the outbox event inside the same
       * database transaction.
       *
       * Inventory update, reservation creation,
       * and outbox event creation will either
       * all commit or all rollback together.
       */
      await this.outboxRepository.create(
        connection,
        {
          id: randomUUID(),
          eventType: "inventory.reserved",
          aggregateType: "inventory",
          aggregateId: productId,
          payload: {
            reservationId,
            productId,
            orderId,
            quantity
          }
        }
      );

      const [updatedInventoryRows] =
        await connection.execute<InventoryRecord[]>(
          inventoryQueries.findByProductId,
          [productId]
        );

      const updatedInventory =
        updatedInventoryRows[0];

      if (!updatedInventory) {
        throw new Error(
          "Inventory could not be retrieved after reservation"
        );
      }

      const reservation: InventoryReservationRecord =
        {
          id: reservationId,
          product_id: productId,
          order_id: orderId,
          quantity,
          status: "RESERVED"
        } as InventoryReservationRecord;

      await connection.commit();

      return {
        inventory: updatedInventory,
        reservation
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async confirmReservation(
    orderId: string
  ): Promise<InventoryReservationRecord> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [reservationRows] =
        await connection.execute<
          InventoryReservationRecord[]
        >(
          inventoryQueries.findReservationByOrderIdForUpdate,
          [orderId]
        );

      const reservation = reservationRows[0];

      if (!reservation) {
        throw new Error(
          "Inventory reservation not found"
        );
      }

      // Idempotent confirmation.
      // If already confirmed, return the existing
      // reservation without changing inventory again.
      if (reservation.status === "CONFIRMED") {
        await connection.commit();

        return reservation;
      }

      if (reservation.status === "RELEASED") {
        throw new Error(
          "Inventory reservation has already been released"
        );
      }

      // Reservation is currently RESERVED.
      // Remove it from currently reserved stock.
      await connection.execute<ResultSetHeader>(
        inventoryQueries.decreaseReservedStock,
        [
          reservation.quantity,
          reservation.product_id
        ]
      );

      // Mark reservation as permanently confirmed.
      await connection.execute<ResultSetHeader>(
        inventoryQueries.confirmReservation,
        [reservation.id]
      );

      reservation.status = "CONFIRMED";

      /*
       * Create the outbox event inside the same
       * database transaction.
       */
      await this.outboxRepository.create(
        connection,
        {
          id: randomUUID(),
          eventType: "inventory.confirmed",
          aggregateType: "inventory",
          aggregateId: reservation.product_id,
          payload: {
            reservationId: reservation.id,
            productId: reservation.product_id,
            orderId: reservation.order_id,
            quantity: reservation.quantity
          }
        }
      );

      await connection.commit();

      return reservation;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async releaseReservation(
    orderId: string
  ): Promise<{
    reservation: InventoryReservationRecord;
    inventory: InventoryRecord;
  }> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [reservationRows] =
        await connection.execute<
          InventoryReservationRecord[]
        >(
          inventoryQueries.findReservationByOrderIdForUpdate,
          [orderId]
        );

      const reservation = reservationRows[0];

      if (!reservation) {
        throw new Error(
          "Inventory reservation not found"
        );
      }

      // Idempotent release.
      // If already released, return the existing
      // reservation without modifying inventory again.
      if (reservation.status === "RELEASED") {
        const [inventoryRows] =
          await connection.execute<InventoryRecord[]>(
            inventoryQueries.findByProductId,
            [reservation.product_id]
          );

        const inventory = inventoryRows[0];

        if (!inventory) {
          throw new Error(
            "Inventory not found"
          );
        }

        await connection.commit();

        return {
          reservation,
          inventory
        };
      }

      if (reservation.status === "CONFIRMED") {
        throw new Error(
          "Confirmed inventory cannot be released"
        );
      }

      // Reservation is currently RESERVED.
      // Return reserved stock back to available stock.
      await connection.execute<ResultSetHeader>(
        inventoryQueries.releaseReservedStock,
        [
          reservation.quantity,
          reservation.quantity,
          reservation.product_id
        ]
      );

      // Mark reservation as released.
      await connection.execute<ResultSetHeader>(
        inventoryQueries.releaseReservation,
        [reservation.id]
      );

      reservation.status = "RELEASED";

      const [inventoryRows] =
        await connection.execute<InventoryRecord[]>(
          inventoryQueries.findByProductId,
          [reservation.product_id]
        );

      const inventory = inventoryRows[0];

      if (!inventory) {
        throw new Error(
          "Inventory could not be retrieved after release"
        );
      }

      /*
       * Create the outbox event inside the same
       * database transaction.
       */
      await this.outboxRepository.create(
        connection,
        {
          id: randomUUID(),
          eventType: "inventory.released",
          aggregateType: "inventory",
          aggregateId: reservation.product_id,
          payload: {
            reservationId: reservation.id,
            productId: reservation.product_id,
            orderId: reservation.order_id,
            quantity: reservation.quantity
          }
        }
      );

      await connection.commit();

      return {
        reservation,
        inventory
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}