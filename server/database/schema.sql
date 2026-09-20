-- Canonical schema for a new Aetheris installation.
-- Existing installations should run `npm run db:migrate`.

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
    api_key TEXT,
    api_key_hash VARCHAR(64) UNIQUE,
    api_key_prefix VARCHAR(24),
    api_key_last_four VARCHAR(4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT projects_api_key_storage CHECK (api_key IS NOT NULL OR api_key_hash IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS jobs (
    id BIGSERIAL PRIMARY KEY,
    bullmq_job_id VARCHAR(100) NOT NULL UNIQUE,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL CHECK (char_length(trim(type)) BETWEEN 1 AND 100),
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'QUEUED', 'DELAYED', 'PROCESSING', 'RETRYING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority IN (1, 5, 10)),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 20),
    delay_ms INTEGER NOT NULL DEFAULT 0 CHECK (delay_ms >= 0),
    idempotency_key VARCHAR(255),
    enqueue_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (enqueue_status IN ('PENDING', 'ENQUEUED', 'FAILED', 'CANCELLED')),
    enqueue_attempts INTEGER NOT NULL DEFAULT 0 CHECK (enqueue_attempts >= 0),
    enqueue_error TEXT,
    next_enqueue_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT jobs_project_idempotency_unique UNIQUE (project_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS jobs_project_created_idx ON jobs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_enqueue_pending_idx ON jobs(enqueue_status, next_enqueue_at)
    WHERE enqueue_status IN ('PENDING', 'FAILED');

CREATE TABLE IF NOT EXISTS job_attempts (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
    status VARCHAR(30) NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
    error TEXT,
    result JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    CONSTRAINT job_attempts_job_attempt_unique UNIQUE (job_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS recurring_schedules (
    id BIGSERIAL PRIMARY KEY,
    schedule_id VARCHAR(100) NOT NULL UNIQUE,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    scheduler_id VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(100) NOT NULL CHECK (char_length(trim(type)) BETWEEN 1 AND 100),
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    every_ms INTEGER NOT NULL CHECK (every_ms >= 1000),
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority IN (1, 5, 10)),
    max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 20),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DELETING', 'ERROR')),
    sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED', 'FAILED')),
    sync_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS schedules_project_idx ON recurring_schedules(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS schedules_sync_idx ON recurring_schedules(sync_status)
    WHERE sync_status IN ('PENDING', 'FAILED');

CREATE TABLE IF NOT EXISTS dead_letter_entries (
    id BIGSERIAL PRIMARY KEY,
    dlq_id VARCHAR(100) NOT NULL UNIQUE,
    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    original_bullmq_job_id VARCHAR(100) NOT NULL,
    error TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RETRYING', 'RETRIED')),
    retry_bullmq_job_id VARCHAR(100),
    enqueue_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (enqueue_status IN ('PENDING', 'ENQUEUED', 'FAILED', 'CANCELLED')),
    enqueue_attempts INTEGER NOT NULL DEFAULT 0 CHECK (enqueue_attempts >= 0),
    enqueue_error TEXT,
    next_enqueue_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retried_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS dead_letter_entries_one_open_per_job
    ON dead_letter_entries(job_id) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS dlq_project_status_idx ON dead_letter_entries(project_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
