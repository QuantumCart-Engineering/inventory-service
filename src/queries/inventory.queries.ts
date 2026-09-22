export const inventoryQueries = {
  create: `
    INSERT INTO inventory (
      id,
      product_id,
      available_quantity,
      reserved_quantity
    )
    VALUES (?, ?, ?, 0)
  `,

  findByProductId: `
    SELECT
      id,
      product_id,
      available_quantity,
      reserved_quantity,
      created_at,
      updated_at
    FROM inventory
    WHERE product_id = ?
    LIMIT 1
  `,

  findByProductIdForUpdate: `
    SELECT
      id,
      product_id,
      available_quantity,
      reserved_quantity,
      created_at,
      updated_at
    FROM inventory
    WHERE product_id = ?
    LIMIT 1
    FOR UPDATE
  `,

  updateReservedStock: `
    UPDATE inventory
    SET
      available_quantity = available_quantity - ?,
      reserved_quantity = reserved_quantity + ?
    WHERE product_id = ?
  `,

  decreaseReservedStock: `
    UPDATE inventory
    SET
      reserved_quantity = reserved_quantity - ?
    WHERE product_id = ?
  `,

  createReservation: `
    INSERT INTO inventory_reservations (
      id,
      product_id,
      order_id,
      quantity,
      status
    )
    VALUES (?, ?, ?, ?, 'RESERVED')
  `,

  findReservationByOrderAndProductForUpdate: `
    SELECT
      id,
      product_id,
      order_id,
      quantity,
      status,
      created_at,
      updated_at
    FROM inventory_reservations
    WHERE order_id = ?
      AND product_id = ?
    LIMIT 1
    FOR UPDATE
  `,

  findReservationByOrderIdForUpdate: `
    SELECT
      id,
      product_id,
      order_id,
      quantity,
      status,
      created_at,
      updated_at
    FROM inventory_reservations
    WHERE order_id = ?
    LIMIT 1
    FOR UPDATE
  `,

  confirmReservation: `
    UPDATE inventory_reservations
    SET status = 'CONFIRMED'
    WHERE id = ?
  `,

  releaseReservation: `
    UPDATE inventory_reservations
    SET status = 'RELEASED'
    WHERE id = ?
  `,

  releaseReservedStock: `
    UPDATE inventory
    SET
      available_quantity = available_quantity + ?,
      reserved_quantity = reserved_quantity - ?
    WHERE product_id = ?
  `
};