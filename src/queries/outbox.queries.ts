export const outboxQueries = {
  create: `
    INSERT INTO outbox_events (
      id,
      event_type,
      aggregate_type,
      aggregate_id,
      payload,
      status
    )
    VALUES (?, ?, ?, ?, ?, 'PENDING')
  `,

  findPendingEvents: `
    SELECT
      id,
      event_type,
      aggregate_type,
      aggregate_id,
      payload,
      status,
      retry_count,
      created_at,
      published_at,
      updated_at
    FROM outbox_events
    WHERE status IN ('PENDING', 'FAILED')
    ORDER BY created_at ASC
    LIMIT ?
  `,

  markAsPublished: `
    UPDATE outbox_events
    SET
      status = 'PUBLISHED',
      published_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,

  markAsFailed: `
    UPDATE outbox_events
    SET
      status = 'FAILED',
      retry_count = retry_count + 1
    WHERE id = ?
  `
};