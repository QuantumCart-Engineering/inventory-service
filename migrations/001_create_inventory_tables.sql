CREATE TABLE IF NOT EXISTS inventory (
    id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    available_quantity INT UNSIGNED NOT NULL DEFAULT 0,
    reserved_quantity INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_inventory_product_id (product_id),

    CONSTRAINT chk_inventory_available_quantity
        CHECK (available_quantity >= 0),

    CONSTRAINT chk_inventory_reserved_quantity
        CHECK (reserved_quantity >= 0)
);


CREATE TABLE IF NOT EXISTS inventory_reservations (
    id CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    order_id CHAR(36) NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    status ENUM(
        'RESERVED',
        'CONFIRMED',
        'RELEASED'
    ) NOT NULL DEFAULT 'RESERVED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_reservation_order_product (
        order_id,
        product_id
    ),

    KEY idx_reservation_product_id (product_id),
    KEY idx_reservation_order_id (order_id),
    KEY idx_reservation_status (status),

    CONSTRAINT chk_reservation_quantity
        CHECK (quantity > 0)
);