const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const { randomUUID } = require("crypto");

dotenv.config();

async function main() {
  const dryRun =
    process.argv.includes("--dry-run") ||
    !process.argv.includes("--execute");

  /*
   * Products live in the product database while inventory lives in
   * this service's database, so the backfill needs two connections.
   */
  const productConnection = await mysql.createConnection({
    host:
      process.env.PRODUCT_DB_HOST ||
      process.env.DB_HOST ||
      "127.0.0.1",
    port: Number(
      process.env.PRODUCT_DB_PORT ||
        process.env.DB_PORT ||
        3306
    ),
    user:
      process.env.PRODUCT_DB_USER ||
      process.env.DB_USER,
    password:
      process.env.PRODUCT_DB_PASSWORD ||
      process.env.DB_PASSWORD,
    database:
      process.env.PRODUCT_DB_NAME ||
      "quantumcart_products"
  });

  const inventoryConnection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database:
      process.env.DB_NAME || "quantumcart_inventory"
  });

  try {
    const [products] = await productConnection.execute(
      "SELECT id, stock_quantity FROM products"
    );
    const [inventories] = await inventoryConnection.execute(
      "SELECT product_id FROM inventory"
    );
    const inventorySet = new Set(
      inventories.map((i) => i.product_id)
    );

    const missing = products.filter(
      (p) => !inventorySet.has(p.id)
    );
    console.log(
      `Found ${products.length} products, ${inventories.length} inventory rows, ${missing.length} missing`
    );

    if (dryRun) {
      for (const m of missing.slice(0, 50)) {
        console.log(
          `[DRY RUN] Would create inventory for ${m.id} with initialQuantity=${m.stock_quantity}`
        );
      }
      console.log(
        "Dry run complete. To execute, run with --execute"
      );
      return;
    }

    for (const m of missing) {
      const id = randomUUID();
      const qty =
        typeof m.stock_quantity === "number"
          ? m.stock_quantity
          : 0;
      try {
        await inventoryConnection.execute(
          "INSERT INTO inventory (id, product_id, available_quantity, reserved_quantity) VALUES (?, ?, ?, 0)",
          [id, m.id, qty]
        );
        console.log(
          `Created inventory for ${m.id} qty=${qty}`
        );
      } catch (e) {
        console.error(
          `Failed for ${m.id}:`,
          e.message
        );
      }
    }
    console.log("Backfill complete");
  } finally {
    await productConnection.end();
    await inventoryConnection.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
