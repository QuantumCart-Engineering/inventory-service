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

  /**
   * Creates inventory only when the product has no inventory row.
   *
   * `ON DUPLICATE KEY UPDATE id = id` makes concurrent duplicate
   * event deliveries safe: the unique key on product_id is preserved
   * and existing available/reserved quantities are never overwritten.
   *
   * Returns true when a new row was inserted, false when it already
   * existed.
   */
  async createIfMissing(
    id: string,
    productId: string,
    initialQuantity: number
  ): Promise<boolean> {
    const [result] =
      await pool.execute<ResultSetHeader>(
        inventoryQueries.createIfMissing,
        [id, productId, initialQuantity]
      );

    return result.affectedRows === 1;
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

      const [reserveUpdateResult] =
        await connection.execute<ResultSetHeader>(
          inventoryQueries.updateReservedStock,
          [
            quantity,
            quantity,
            productId,
            quantity
          ]
        );

      if (
        reserveUpdateResult.affectedRows !== 1
      ) {
        throw new Error(
          "Insufficient inventory"
        );
      }

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
          inventoryQueries.findReservationsByOrderIdForUpdate,
          [orderId]
        );

      const reservations = reservationRows;

      if (reservations.length === 0) {
        throw new Error(
          "Inventory reservation not found"
        );
      }

      if (
        reservations.some(
          (reservation) =>
            reservation.status === "RELEASED"
        )
      ) {
        throw new Error(
          "Inventory reservation has already been released"
        );
      }

      /*
       * Confirm every reservation belonging to the order, not just
       * one. Cart orders can reserve multiple products. Reservations
       * that are already CONFIRMED are skipped, which makes retries
       * idempotent and prevents a second decrement of reserved stock.
       */
      const reservationsToConfirm = reservations
        .filter(
          (reservation) =>
            reservation.status === "RESERVED"
        )
        .sort((left, right) =>
          left.product_id.localeCompare(
            right.product_id
          )
        );

      for (const reservation of reservationsToConfirm) {
        const [result] =
          await connection.execute<ResultSetHeader>(
            inventoryQueries.decreaseReservedStock,
            [
              reservation.quantity,
              reservation.product_id
            ]
          );

        if (result.affectedRows !== 1) {
          throw new Error(
            "Inventory reservation could not be confirmed"
          );
        }

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
      }

      await connection.commit();

      return reservations[0];
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
          inventoryQueries.findReservationsByOrderIdForUpdate,
          [orderId]
        );

      const reservations = reservationRows;

      if (reservations.length === 0) {
        throw new Error(
          "Inventory reservation not found"
        );
      }

      const reservationsToRelease = reservations
        .filter(
          (reservation) =>
            reservation.status !== "RELEASED"
        )
        .sort((left, right) =>
          left.product_id.localeCompare(
            right.product_id
          )
        );

      /*
       * Releasing twice is a no-op. This is what makes cancellation
       * and payment-failure compensation safe to retry.
       */
      for (const reservation of reservationsToRelease) {
        if (reservation.status === "RESERVED") {
          const [result] =
            await connection.execute<ResultSetHeader>(
              inventoryQueries.releaseReservedStock,
              [
                reservation.quantity,
                reservation.quantity,
                reservation.product_id
              ]
            );

          if (result.affectedRows !== 1) {
            throw new Error(
              "Inventory reservation could not be released"
            );
          }
        } else if (
          reservation.status === "CONFIRMED"
        ) {
          /*
           * Confirmed stock was already removed from available
           * quantity and reserved quantity. Cancelling a confirmed
           * order restores those units to available stock.
           */
          const [result] =
            await connection.execute<ResultSetHeader>(
              inventoryQueries.restoreAvailableStock,
              [
                reservation.quantity,
                reservation.product_id
              ]
            );

          if (result.affectedRows !== 1) {
            throw new Error(
              "Confirmed inventory could not be restored"
            );
          }
        }

        await connection.execute<ResultSetHeader>(
          inventoryQueries.releaseReservation,
          [reservation.id]
        );

        reservation.status = "RELEASED";

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
      }

      const [inventoryRows] =
        await connection.execute<InventoryRecord[]>(
          inventoryQueries.findByProductId,
          [reservations[0].product_id]
        );

      const inventory = inventoryRows[0];

      if (!inventory) {
        throw new Error(
          "Inventory could not be retrieved after release"
        );
      }

      await connection.commit();

      return {
        reservation: reservations[0],
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