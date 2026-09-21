import { ResultSetHeader, RowDataPacket } from "mysql2";

import { pool } from "../database/mysql";
import { inventoryQueries } from "../queries/inventory.queries";

export interface InventoryRecord extends RowDataPacket {
  id: string;
  product_id: string;
  available_quantity: number;
  reserved_quantity: number;
  created_at: Date;
  updated_at: Date;
}

export class InventoryRepository {
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
    const [rows] = await pool.execute<InventoryRecord[]>(
      inventoryQueries.findByProductId,
      [productId]
    );

    return rows[0] ?? null;
  }
}