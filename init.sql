-- Initialize database schema

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Insert sample data
INSERT INTO users (email, name) VALUES
    ('john@example.com', 'John Doe'),
    ('jane@example.com', 'Jane Smith'),
    ('bob@example.com', 'Bob Johnson')
ON CONFLICT (email) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Import Jobs and Rows tables
CREATE TABLE IF NOT EXISTS import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    uploaded_by VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'processing',
    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    invalid_rows INTEGER NOT NULL DEFAULT 0,
    error_report_path VARCHAR(500),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_status CHECK (status IN ('processing', 'completed', 'failed'))
);

CREATE TABLE IF NOT EXISTS import_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    error_code VARCHAR(100),
    error_detail TEXT,
    row_data JSONB,
    task_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_row_status CHECK (status IN ('valid', 'invalid'))
);

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_row_id UUID REFERENCES import_rows(id) ON DELETE SET NULL,
    request_id VARCHAR(255) UNIQUE NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    team_id VARCHAR(255) NOT NULL,
    scan_type VARCHAR(100) NOT NULL,
    user_input TEXT NOT NULL,
    raw_ai_output JSONB,
    ai_confidence FLOAT,
    scan_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    assigned_to VARCHAR(255),
    assigned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_task_status CHECK (status IN ('pending', 'assigned', 'in_progress', 'processing', 'completed', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_rows_job_id ON import_rows(import_job_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_status ON import_rows(status);
CREATE INDEX IF NOT EXISTS idx_tasks_request_id ON tasks(request_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_ai_confidence ON tasks(ai_confidence DESC) WHERE status = 'pending';

-- Task Assignments table for logging
CREATE TABLE IF NOT EXISTS task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    assigned_to VARCHAR(255) NOT NULL,
    assignment_method VARCHAR(50) NOT NULL,
    priority_score FLOAT,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_assignment_method CHECK (assignment_method IN ('equal_split', 'pull_queue'))
);

CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_to ON task_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assigned_at ON task_assignments(assigned_at DESC);

-- Assets table for link health tracking
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(255) UNIQUE NOT NULL,
    url TEXT NOT NULL,
    link_status VARCHAR(50),
    latency_ms INTEGER,
    content_type VARCHAR(255),
    content_length BIGINT,
    headers JSONB,
    error_message TEXT,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_link_status CHECK (link_status IN (
        'ok', '404', '403', 'timeout', 'invalid_mime', 
        'decode_error', 'expired_presign', 'network_error', 'pending'
    ))
);

CREATE INDEX IF NOT EXISTS idx_assets_request_id ON assets(request_id);
CREATE INDEX IF NOT EXISTS idx_assets_link_status ON assets(link_status);
CREATE INDEX IF NOT EXISTS idx_assets_last_checked ON assets(last_checked_at DESC);

CREATE TRIGGER update_assets_updated_at 
    BEFORE UPDATE ON assets
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
