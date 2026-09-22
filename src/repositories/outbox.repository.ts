import {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket
} from "mysql2/promise";

import { pool } from "../database/mysql";
import { outboxQueries } from "../queries/outbox.queries";

export interface OutboxEventRecord
  extends RowDataPacket {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: string | object;
  status:
    | "PENDING"
    | "PUBLISHED"
    | "FAILED";
  retry_count: number;
  created_at: Date;
  published_at: Date | null;
  updated_at: Date;
}

export interface CreateOutboxEvent {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: object;
}

export class OutboxRepository {
  async create(
    connection: PoolConnection,
    event: CreateOutboxEvent
  ): Promise<void> {
    await connection.execute<ResultSetHeader>(
      outboxQueries.create,
      [
        event.id,
        event.eventType,
        event.aggregateType,
        event.aggregateId,
        JSON.stringify(event.payload)
      ]
    );
  }

  async findPendingEvents(
    limit: number
  ): Promise<OutboxEventRecord[]> {
    const [rows] =
      await pool.execute<OutboxEventRecord[]>(
        outboxQueries.findPendingEvents,
        [limit]
      );

    return rows;
  }

  async markAsPublished(
    id: string
  ): Promise<void> {
    await pool.execute<ResultSetHeader>(
      outboxQueries.markAsPublished,
      [id]
    );
  }

  async markAsFailed(
    id: string
  ): Promise<void> {
    await pool.execute<ResultSetHeader>(
      outboxQueries.markAsFailed,
      [id]
    );
  }
}