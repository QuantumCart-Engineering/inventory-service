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
  `
};