CREATE TABLE IF NOT EXISTS outbox_events (
    id CHAR(36) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id CHAR(36) NOT NULL,
    payload JSON NOT NULL,
    status ENUM(
        'PENDING',
        'PUBLISHED',
        'FAILED'
    ) NOT NULL DEFAULT 'PENDING',
    retry_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_outbox_status (status),
    KEY idx_outbox_event_type (event_type),
    KEY idx_outbox_aggregate (
        aggregate_type,
        aggregate_id
    ),
    KEY idx_outbox_created_at (created_at),

    CONSTRAINT chk_outbox_retry_count
        CHECK (retry_count >= 0)
);