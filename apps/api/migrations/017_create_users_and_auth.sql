-- Migration 017: Create users table and authentication system
-- Author: System
-- Date: 2025-10-11
-- Description: Add user management with role-based access control

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'annotator',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT users_role_check CHECK (role IN ('admin', 'annotator', 'viewer'))
);

-- Create sessions table for authentication
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON user_sessions(expires_at);

-- Seed default users
-- Password: "admin123" for admin
-- Password: "user123" for user123
-- Password: "viewer123" for viewer1
INSERT INTO users (username, email, password_hash, full_name, role, is_active) VALUES
  ('admin', 'admin@monorepo.local', '$2b$10$7ua3tcfQjjx52jMwZxsMAOHFFrHS92ymr4tBlGyLSjg25uM96wv2S', 'Administrator', 'admin', true),
  ('user123', 'user123@monorepo.local', '$2b$10$BnYxqAO7bxMUfWKOtBYLlOPqP1liLPtzSBuBqsDvBnmE5oQGKe0hu', 'Test User 123', 'annotator', true),
  ('viewer1', 'viewer1@monorepo.local', '$2b$10$dpUfw880z4V8laccaUpmgeUjOUDoYWNFLpEmxahtr894riL86D38u', 'Viewer User', 'viewer', true)
ON CONFLICT (username) DO NOTHING;

-- Comments
COMMENT ON TABLE users IS 'User accounts with role-based access control';
COMMENT ON TABLE user_sessions IS 'Active user sessions for authentication';
COMMENT ON COLUMN users.role IS 'User role: admin (full access), annotator (can label), viewer (read-only)';
COMMENT ON COLUMN users.is_active IS 'Whether the user account is active';
COMMENT ON COLUMN user_sessions.token IS 'JWT or session token for authentication';
COMMENT ON COLUMN user_sessions.expires_at IS 'Token expiration timestamp';
