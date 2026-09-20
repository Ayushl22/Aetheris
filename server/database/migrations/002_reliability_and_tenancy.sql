-- Existing rows are preserved. Legacy jobs cannot be assigned to projects
-- automatically because the old table did not retain ownership. The migration
-- stops before constraints are committed if a manual backfill is required.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR(64);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS api_key_prefix VARCHAR(24);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS api_key_last_four VARCHAR(4);
ALTER TABLE projects ALTER COLUMN api_key DROP NOT NULL;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_api_key_hash_key;
ALTER TABLE projects ADD CONSTRAINT projects_api_key_hash_key UNIQUE (api_key_hash);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS project_id BIGINT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS result JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS delay_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enqueue_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enqueue_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enqueue_error TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS next_enqueue_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM jobs WHERE project_id IS NULL) THEN
        RAISE EXCEPTION USING MESSAGE =
            'Legacy jobs require an explicit project_id backfill before migration 002 can finish. No migration changes were committed.';
    END IF;
END $$;

-- The original schema used timestamp-without-time-zone. Aetheris has always
-- treated those values as UTC; convert them explicitly instead of relying on
-- the database server's local timezone during the type change.
DO $$
DECLARE
    target RECORD;
BEGIN
    FOR target IN
        SELECT * FROM (VALUES
            ('users', 'created_at'),
            ('projects', 'created_at'),
            ('jobs', 'created_at'),
            ('jobs', 'started_at'),
            ('jobs', 'completed_at'),
            ('job_attempts', 'started_at'),
            ('job_attempts', 'completed_at'),
            ('recurring_schedules', 'created_at')
        ) AS columns_to_convert(table_name, column_name)
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = target.table_name
              AND c.column_name = target.column_name
              AND c.data_type = 'timestamp without time zone'
        ) THEN
            EXECUTE format(
                'ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE ''UTC''',
                target.table_name, target.column_name, target.column_name
            );
        END IF;
    END LOOP;
END $$;

ALTER TABLE jobs ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN bullmq_job_id SET NOT NULL;
UPDATE jobs SET data = '{}'::jsonb WHERE data IS NULL;
ALTER TABLE jobs ALTER COLUMN data SET DEFAULT '{}'::jsonb;
ALTER TABLE jobs ALTER COLUMN data SET NOT NULL;
UPDATE jobs SET priority = 5 WHERE priority IS NULL OR priority NOT IN (1, 5, 10);
ALTER TABLE jobs ALTER COLUMN priority SET DEFAULT 5;
ALTER TABLE jobs ALTER COLUMN priority SET NOT NULL;
UPDATE jobs SET attempts = 0 WHERE attempts IS NULL OR attempts < 0;
ALTER TABLE jobs ALTER COLUMN attempts SET DEFAULT 0;
ALTER TABLE jobs ALTER COLUMN attempts SET NOT NULL;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_project_id_fkey;
ALTER TABLE jobs ADD CONSTRAINT jobs_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_project_idempotency_unique;
ALTER TABLE jobs ADD CONSTRAINT jobs_project_idempotency_unique UNIQUE (project_id, idempotency_key);
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_bullmq_job_id_key;
ALTER TABLE jobs ADD CONSTRAINT jobs_bullmq_job_id_key UNIQUE (bullmq_job_id);
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
    CHECK (status IN ('PENDING', 'QUEUED', 'DELAYED', 'PROCESSING', 'RETRYING', 'COMPLETED', 'FAILED', 'CANCELLED'));
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_priority_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_priority_check CHECK (priority IN (1, 5, 10));
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_max_attempts_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_max_attempts_check CHECK (max_attempts BETWEEN 1 AND 20);
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_delay_ms_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_delay_ms_check CHECK (delay_ms >= 0);
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_enqueue_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_enqueue_status_check
    CHECK (enqueue_status IN ('PENDING', 'ENQUEUED', 'FAILED', 'CANCELLED'));
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_attempts_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_attempts_check CHECK (attempts >= 0);
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_enqueue_attempts_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_enqueue_attempts_check CHECK (enqueue_attempts >= 0);
CREATE INDEX IF NOT EXISTS jobs_project_created_idx ON jobs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_enqueue_pending_idx ON jobs(enqueue_status, next_enqueue_at)
    WHERE enqueue_status IN ('PENDING', 'FAILED');

ALTER TABLE job_attempts ADD COLUMN IF NOT EXISTS result JSONB;
ALTER TABLE job_attempts DROP CONSTRAINT IF EXISTS job_attempts_job_attempt_unique;
ALTER TABLE job_attempts ADD CONSTRAINT job_attempts_job_attempt_unique UNIQUE (job_id, attempt_number);
ALTER TABLE job_attempts DROP CONSTRAINT IF EXISTS job_attempts_status_check;
ALTER TABLE job_attempts ADD CONSTRAINT job_attempts_status_check
    CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED'));
ALTER TABLE job_attempts DROP CONSTRAINT IF EXISTS job_attempts_attempt_number_check;
ALTER TABLE job_attempts ADD CONSTRAINT job_attempts_attempt_number_check CHECK (attempt_number > 0);

ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS schedule_id VARCHAR(100);
UPDATE recurring_schedules SET schedule_id = 'legacy-' || id WHERE schedule_id IS NULL;
ALTER TABLE recurring_schedules ALTER COLUMN schedule_id SET NOT NULL;
ALTER TABLE recurring_schedules DROP CONSTRAINT IF EXISTS recurring_schedules_schedule_id_key;
ALTER TABLE recurring_schedules ADD CONSTRAINT recurring_schedules_schedule_id_key UNIQUE (schedule_id);
ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS every_ms INTEGER;
UPDATE recurring_schedules SET every_ms = every WHERE every_ms IS NULL;
UPDATE recurring_schedules SET every_ms = 1000 WHERE every_ms < 1000;
ALTER TABLE recurring_schedules ALTER COLUMN every_ms SET NOT NULL;
ALTER TABLE recurring_schedules ALTER COLUMN every DROP NOT NULL;
ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 5;
ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3;
ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS sync_error TEXT;
ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE recurring_schedules SET data = '{}'::jsonb WHERE data IS NULL;
ALTER TABLE recurring_schedules ALTER COLUMN data SET DEFAULT '{}'::jsonb;
ALTER TABLE recurring_schedules ALTER COLUMN data SET NOT NULL;
ALTER TABLE recurring_schedules DROP CONSTRAINT IF EXISTS recurring_schedules_priority_check;
ALTER TABLE recurring_schedules ADD CONSTRAINT recurring_schedules_priority_check CHECK (priority IN (1, 5, 10));
ALTER TABLE recurring_schedules DROP CONSTRAINT IF EXISTS recurring_schedules_max_attempts_check;
ALTER TABLE recurring_schedules ADD CONSTRAINT recurring_schedules_max_attempts_check CHECK (max_attempts BETWEEN 1 AND 20);
ALTER TABLE recurring_schedules DROP CONSTRAINT IF EXISTS recurring_schedules_status_check;
ALTER TABLE recurring_schedules ADD CONSTRAINT recurring_schedules_status_check CHECK (status IN ('ACTIVE', 'DELETING', 'ERROR'));
ALTER TABLE recurring_schedules DROP CONSTRAINT IF EXISTS recurring_schedules_sync_status_check;
ALTER TABLE recurring_schedules ADD CONSTRAINT recurring_schedules_sync_status_check CHECK (sync_status IN ('PENDING', 'SYNCED', 'FAILED'));
ALTER TABLE recurring_schedules DROP CONSTRAINT IF EXISTS recurring_schedules_every_ms_check;
ALTER TABLE recurring_schedules ADD CONSTRAINT recurring_schedules_every_ms_check CHECK (every_ms >= 1000);

CREATE TABLE IF NOT EXISTS dead_letter_entries (
    id BIGSERIAL PRIMARY KEY,
    dlq_id VARCHAR(100) NOT NULL UNIQUE,
    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    original_bullmq_job_id VARCHAR(100) NOT NULL,
    error TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    retry_bullmq_job_id VARCHAR(100),
    enqueue_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    enqueue_attempts INTEGER NOT NULL DEFAULT 0,
    enqueue_error TEXT,
    next_enqueue_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retried_at TIMESTAMPTZ
);
ALTER TABLE dead_letter_entries DROP CONSTRAINT IF EXISTS dead_letter_entries_status_check;
ALTER TABLE dead_letter_entries ADD CONSTRAINT dead_letter_entries_status_check CHECK (status IN ('OPEN', 'RETRYING', 'RETRIED'));
ALTER TABLE dead_letter_entries DROP CONSTRAINT IF EXISTS dead_letter_entries_enqueue_status_check;
ALTER TABLE dead_letter_entries ADD CONSTRAINT dead_letter_entries_enqueue_status_check
    CHECK (enqueue_status IN ('PENDING', 'ENQUEUED', 'FAILED', 'CANCELLED'));
CREATE UNIQUE INDEX IF NOT EXISTS dead_letter_entries_one_open_per_job
    ON dead_letter_entries(job_id) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS dlq_project_status_idx
    ON dead_letter_entries(project_id, status, created_at DESC);
