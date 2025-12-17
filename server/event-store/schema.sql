-- Payments Spine Event Store Schema
-- PostgreSQL 14+

-- Events table (append-only, immutable)
CREATE TABLE IF NOT EXISTS payment_events (
    -- Primary key
    id BIGSERIAL PRIMARY KEY,
    
    -- Event identification
    event_id UUID NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    
    -- Payment identification
    payment_id UUID NOT NULL,
    rail VARCHAR(20) NOT NULL CHECK (rail IN ('NPP', 'BECS', 'RTGS', 'CARDS')),
    
    -- Event data
    event_data JSONB NOT NULL,
    metadata JSONB,
    
    -- Temporal ordering
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    persisted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    sequence_number BIGINT NOT NULL,
    
    -- Idempotency
    idempotency_key VARCHAR(255),
    
    -- Audit
    created_by VARCHAR(255),
    correlation_id UUID,
    causation_id UUID,
    
    -- Constraints
    CONSTRAINT unique_payment_sequence UNIQUE (payment_id, sequence_number),
    CONSTRAINT unique_idempotency UNIQUE (payment_id, idempotency_key)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON payment_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_rail ON payment_events(rail);
CREATE INDEX IF NOT EXISTS idx_payment_events_event_type ON payment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_events_occurred_at ON payment_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_payment_events_correlation_id ON payment_events(correlation_id);

-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_payment_events_event_data ON payment_events USING GIN (event_data);

-- Partial index for recent events (hot data)
CREATE INDEX IF NOT EXISTS idx_payment_events_recent ON payment_events(payment_id, sequence_number) 
    WHERE persisted_at > NOW() - INTERVAL '7 days';

-- Snapshots table (optional, for performance)
CREATE TABLE IF NOT EXISTS payment_snapshots (
    -- Primary key
    id BIGSERIAL PRIMARY KEY,
    
    -- Payment identification
    payment_id UUID NOT NULL,
    rail VARCHAR(20) NOT NULL CHECK (rail IN ('NPP', 'BECS', 'RTGS', 'CARDS')),
    
    -- Snapshot data
    state_data JSONB NOT NULL,
    state_hash VARCHAR(64) NOT NULL,
    
    -- Versioning
    sequence_number BIGINT NOT NULL,
    event_count INTEGER NOT NULL,
    
    -- Temporal
    snapshot_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_payment_snapshot UNIQUE (payment_id, sequence_number)
);

-- Indexes for snapshots
CREATE INDEX IF NOT EXISTS idx_payment_snapshots_payment_id ON payment_snapshots(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_snapshots_rail ON payment_snapshots(rail);

-- Metadata table (for event store management)
CREATE TABLE IF NOT EXISTS event_store_metadata (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Insert initial metadata
INSERT INTO event_store_metadata (key, value) VALUES 
    ('version', '"1.0.0"'::jsonb),
    ('created_at', to_jsonb(NOW())),
    ('rails', '["NPP", "BECS", "RTGS", "CARDS"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE payment_events IS 'Append-only event store for all payment state changes';
COMMENT ON COLUMN payment_events.event_id IS 'Globally unique event identifier';
COMMENT ON COLUMN payment_events.payment_id IS 'Payment aggregate identifier';
COMMENT ON COLUMN payment_events.rail IS 'Payment rail (NPP, BECS, RTGS, CARDS)';
COMMENT ON COLUMN payment_events.event_data IS 'Event payload as JSONB';
COMMENT ON COLUMN payment_events.sequence_number IS 'Monotonically increasing sequence per payment';
COMMENT ON COLUMN payment_events.idempotency_key IS 'For duplicate detection and safe retries';

COMMENT ON TABLE payment_snapshots IS 'Optional snapshots for faster replay (performance optimization)';
COMMENT ON COLUMN payment_snapshots.state_hash IS 'SHA-256 hash of state for replay verification';

-- Partitioning strategy (optional, for large-scale deployments)
-- Partition by rail and time range for better performance
-- Example: CREATE TABLE payment_events_npp_2024_12 PARTITION OF payment_events 
--          FOR VALUES FROM ('NPP') TO ('NPP') AND FROM ('2024-12-01') TO ('2025-01-01');

-- Retention policy (optional)
-- Delete events older than X years (regulatory compliance)
-- Example: DELETE FROM payment_events WHERE persisted_at < NOW() - INTERVAL '7 years';
