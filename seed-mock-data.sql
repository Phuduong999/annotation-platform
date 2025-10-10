-- Seed Mock Data for Development
-- This script creates realistic test data for the monorepo project

-- Clear existing data (optional - uncomment if you want fresh data)
-- TRUNCATE TABLE task_assignments, tasks, import_rows, import_jobs, assets, users CASCADE;

-- Insert mock users
INSERT INTO users (id, email, name) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'alice@example.com', 'Alice Anderson'),
    ('550e8400-e29b-41d4-a716-446655440002', 'bob@example.com', 'Bob Builder'),
    ('550e8400-e29b-41d4-a716-446655440003', 'carol@example.com', 'Carol Chen'),
    ('550e8400-e29b-41d4-a716-446655440004', 'david@example.com', 'David Davis'),
    ('550e8400-e29b-41d4-a716-446655440005', 'emma@example.com', 'Emma Evans')
ON CONFLICT (email) DO NOTHING;

-- Insert mock import jobs
INSERT INTO import_jobs (id, filename, uploaded_by, status, total_rows, valid_rows, invalid_rows, started_at, completed_at) VALUES
    ('660e8400-e29b-41d4-a716-446655440001', 'content_scan_batch_1.csv', 'alice@example.com', 'completed', 150, 145, 5, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'),
    ('660e8400-e29b-41d4-a716-446655440002', 'content_scan_batch_2.csv', 'bob@example.com', 'completed', 200, 195, 5, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '8 minutes'),
    ('660e8400-e29b-41d4-a716-446655440003', 'content_scan_batch_3.csv', 'carol@example.com', 'processing', 100, 0, 0, NOW() - INTERVAL '2 hours', NULL)
ON CONFLICT DO NOTHING;

-- Insert mock tasks with different types and statuses
INSERT INTO tasks (id, request_id, user_id, team_id, scan_type, user_input, raw_ai_output, ai_confidence, scan_date, status, assigned_to, assigned_at) VALUES
    -- Explicit content tasks
    ('770e8400-e29b-41d4-a716-446655440001', 'req_001', 'user_123', 'team_alpha', 'explicit', 'User posted explicit adult content', '{"classification": "explicit", "confidence": 0.95, "tags": ["adult", "nsfw"]}', 0.95, NOW() - INTERVAL '2 days', 'completed', '550e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '2 days'),
    ('770e8400-e29b-41d4-a716-446655440002', 'req_002', 'user_456', 'team_alpha', 'explicit', 'Inappropriate sexual content detected', '{"classification": "explicit", "confidence": 0.92, "tags": ["sexual", "explicit"]}', 0.92, NOW() - INTERVAL '2 days', 'completed', '550e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '2 days'),
    ('770e8400-e29b-41d4-a716-446655440003', 'req_003', 'user_789', 'team_alpha', 'explicit', 'Nudity detected in user submission', '{"classification": "explicit", "confidence": 0.88, "tags": ["nudity", "nsfw"]}', 0.88, NOW() - INTERVAL '1 day', 'pending', NULL, NULL),
    
    -- Adult content tasks
    ('770e8400-e29b-41d4-a716-446655440004', 'req_004', 'user_234', 'team_beta', 'adult', 'Adult-themed artwork submission', '{"classification": "adult", "confidence": 0.85, "tags": ["adult", "artistic"]}', 0.85, NOW() - INTERVAL '1 day', 'processing', '550e8400-e29b-41d4-a716-446655440002', NOW() - INTERVAL '3 hours'),
    ('770e8400-e29b-41d4-a716-446655440005', 'req_005', 'user_567', 'team_beta', 'adult', 'Mature content with adult themes', '{"classification": "adult", "confidence": 0.78, "tags": ["mature", "18+"]}', 0.78, NOW() - INTERVAL '1 day', 'pending', NULL, NULL),
    ('770e8400-e29b-41d4-a716-446655440006', 'req_006', 'user_890', 'team_beta', 'adult', 'Age-restricted content detected', '{"classification": "adult", "confidence": 0.91, "tags": ["age-restricted"]}', 0.91, NOW() - INTERVAL '12 hours', 'pending', NULL, NULL),
    
    -- Suggestive content tasks
    ('770e8400-e29b-41d4-a716-446655440007', 'req_007', 'user_345', 'team_gamma', 'suggestive', 'Slightly suggestive pose in image', '{"classification": "suggestive", "confidence": 0.72, "tags": ["suggestive", "borderline"]}', 0.72, NOW() - INTERVAL '8 hours', 'processing', '550e8400-e29b-41d4-a716-446655440003', NOW() - INTERVAL '2 hours'),
    ('770e8400-e29b-41d4-a716-446655440008', 'req_008', 'user_678', 'team_gamma', 'suggestive', 'Potentially suggestive text content', '{"classification": "suggestive", "confidence": 0.65, "tags": ["text", "suggestive"]}', 0.65, NOW() - INTERVAL '6 hours', 'pending', NULL, NULL),
    ('770e8400-e29b-41d4-a716-446655440009', 'req_009', 'user_901', 'team_gamma', 'suggestive', 'Borderline suggestive context', '{"classification": "suggestive", "confidence": 0.68, "tags": ["borderline"]}', 0.68, NOW() - INTERVAL '4 hours', 'pending', NULL, NULL),
    
    -- Medical content tasks
    ('770e8400-e29b-41d4-a716-446655440010', 'req_010', 'user_432', 'team_delta', 'medical', 'Medical imaging with nutrition info: 500 cal meal with chicken breast and vegetables', '{"classification": "medical", "confidence": 0.89, "tags": ["medical", "nutrition"], "nutrition": {"groups": [{"name": "Proteins", "items": [{"name": "Chicken Breast", "amount": 150, "unit": "g", "calories": 165, "carbs": 0, "protein": 31, "fat": 3.6}]}], "total": {"calories": 500, "carbs": 45, "protein": 40, "fat": 15}}}', 0.89, NOW() - INTERVAL '3 hours', 'completed', '550e8400-e29b-41d4-a716-446655440004', NOW() - INTERVAL '3 hours'),
    ('770e8400-e29b-41d4-a716-446655440011', 'req_011', 'user_765', 'team_delta', 'medical', 'Food diary entry: breakfast with eggs and toast', '{"classification": "medical", "confidence": 0.82, "tags": ["food", "nutrition"], "nutrition": {"groups": [{"name": "Breakfast", "items": [{"name": "Eggs", "amount": 2, "unit": "pieces", "calories": 140, "carbs": 1, "protein": 12, "fat": 10}]}], "total": {"calories": 350, "carbs": 30, "protein": 18, "fat": 15}}}', 0.82, NOW() - INTERVAL '2 hours', 'processing', '550e8400-e29b-41d4-a716-446655440004', NOW() - INTERVAL '1 hour'),
    ('770e8400-e29b-41d4-a716-446655440012', 'req_012', 'user_098', 'team_delta', 'medical', 'Meal plan with detailed macros', '{"classification": "medical", "confidence": 0.91, "tags": ["meal-plan", "nutrition"]}', 0.91, NOW() - INTERVAL '1 hour', 'pending', NULL, NULL),
    
    -- More pending tasks for testing
    ('770e8400-e29b-41d4-a716-446655440013', 'req_013', 'user_111', 'team_alpha', 'explicit', 'High confidence explicit content', '{"classification": "explicit", "confidence": 0.97, "tags": ["nsfw"]}', 0.97, NOW() - INTERVAL '30 minutes', 'pending', NULL, NULL),
    ('770e8400-e29b-41d4-a716-446655440014', 'req_014', 'user_222', 'team_beta', 'adult', 'Adult content requiring review', '{"classification": "adult", "confidence": 0.84, "tags": ["adult"]}', 0.84, NOW() - INTERVAL '25 minutes', 'pending', NULL, NULL),
    ('770e8400-e29b-41d4-a716-446655440015', 'req_015', 'user_333', 'team_gamma', 'suggestive', 'Low confidence suggestive', '{"classification": "suggestive", "confidence": 0.62, "tags": ["uncertain"]}', 0.62, NOW() - INTERVAL '20 minutes', 'pending', NULL, NULL),
    ('770e8400-e29b-41d4-a716-446655440016', 'req_016', 'user_444', 'team_delta', 'medical', 'Nutrition calculation needed', '{"classification": "medical", "confidence": 0.87, "tags": ["nutrition"]}', 0.87, NOW() - INTERVAL '15 minutes', 'pending', NULL, NULL),
    ('770e8400-e29b-41d4-a716-446655440017', 'req_017', 'user_555', 'team_alpha', 'explicit', 'Explicit content flagged by AI', '{"classification": "explicit", "confidence": 0.93, "tags": ["flagged"]}', 0.93, NOW() - INTERVAL '10 minutes', 'pending', NULL, NULL),
    ('770e8400-e29b-41d4-a716-446655440018', 'req_018', 'user_666', 'team_beta', 'adult', 'Age verification required', '{"classification": "adult", "confidence": 0.79, "tags": ["age-gate"]}', 0.79, NOW() - INTERVAL '5 minutes', 'pending', NULL, NULL),
    ('770e8400-e29b-41d4-a716-446655440019', 'req_019', 'user_777', 'team_gamma', 'suggestive', 'Borderline content review', '{"classification": "suggestive", "confidence": 0.71, "tags": ["review"]}', 0.71, NOW() - INTERVAL '3 minutes', 'pending', NULL, NULL),
    ('770e8400-e29b-41d4-a716-446655440020', 'req_020', 'user_888', 'team_delta', 'medical', 'Medical content with detailed nutrition data', '{"classification": "medical", "confidence": 0.94, "tags": ["detailed"]}', 0.94, NOW() - INTERVAL '1 minute', 'pending', NULL, NULL)
ON CONFLICT (request_id) DO NOTHING;

-- Insert mock assets for link health tracking
INSERT INTO assets (request_id, url, link_status, latency_ms, content_type, content_length, last_checked_at) VALUES
    ('req_001', 'https://example.com/content/image1.jpg', 'ok', 120, 'image/jpeg', 245678, NOW() - INTERVAL '2 days'),
    ('req_002', 'https://example.com/content/image2.jpg', 'ok', 95, 'image/jpeg', 189234, NOW() - INTERVAL '2 days'),
    ('req_003', 'https://example.com/content/image3.jpg', 'ok', 110, 'image/jpeg', 312456, NOW() - INTERVAL '1 day'),
    ('req_004', 'https://example.com/content/image4.jpg', 'ok', 88, 'image/jpeg', 156789, NOW() - INTERVAL '1 day'),
    ('req_005', 'https://example.com/content/image5.jpg', '404', NULL, NULL, NULL, NOW() - INTERVAL '1 day'),
    ('req_006', 'https://example.com/content/image6.jpg', 'ok', 135, 'image/jpeg', 278901, NOW() - INTERVAL '12 hours'),
    ('req_007', 'https://example.com/content/image7.jpg', 'timeout', NULL, NULL, NULL, NOW() - INTERVAL '8 hours'),
    ('req_008', 'https://example.com/content/image8.jpg', 'ok', 102, 'image/jpeg', 198765, NOW() - INTERVAL '6 hours'),
    ('req_009', 'https://example.com/content/image9.jpg', 'invalid_mime', 98, 'text/html', 4567, NOW() - INTERVAL '4 hours'),
    ('req_010', 'https://example.com/content/image10.jpg', 'ok', 78, 'image/jpeg', 234567, NOW() - INTERVAL '3 hours'),
    ('req_011', 'https://example.com/content/image11.jpg', 'ok', 115, 'image/jpeg', 287654, NOW() - INTERVAL '2 hours'),
    ('req_012', 'https://example.com/content/image12.jpg', 'pending', NULL, NULL, NULL, NOW() - INTERVAL '1 hour'),
    ('req_013', 'https://example.com/content/image13.jpg', 'ok', 92, 'image/jpeg', 223456, NOW() - INTERVAL '30 minutes'),
    ('req_014', 'https://example.com/content/image14.jpg', 'ok', 105, 'image/jpeg', 267890, NOW() - INTERVAL '25 minutes'),
    ('req_015', 'https://example.com/content/image15.jpg', 'ok', 88, 'image/jpeg', 195432, NOW() - INTERVAL '20 minutes'),
    ('req_016', 'https://example.com/content/image16.jpg', 'ok', 98, 'image/jpeg', 256789, NOW() - INTERVAL '15 minutes'),
    ('req_017', 'https://example.com/content/image17.jpg', 'ok', 112, 'image/jpeg', 278901, NOW() - INTERVAL '10 minutes'),
    ('req_018', 'https://example.com/content/image18.jpg', 'ok', 87, 'image/jpeg', 209876, NOW() - INTERVAL '5 minutes'),
    ('req_019', 'https://example.com/content/image19.jpg', 'ok', 96, 'image/jpeg', 245678, NOW() - INTERVAL '3 minutes'),
    ('req_020', 'https://example.com/content/image20.jpg', 'ok', 103, 'image/jpeg', 287654, NOW() - INTERVAL '1 minute')
ON CONFLICT (request_id) DO NOTHING;

-- Insert task assignments for completed and in-progress tasks
INSERT INTO task_assignments (task_id, assigned_to, assignment_method, priority_score) VALUES
    ('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'equal_split', 0.95),
    ('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'equal_split', 0.92),
    ('770e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'pull_queue', 0.85),
    ('770e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440003', 'pull_queue', 0.72),
    ('770e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440004', 'equal_split', 0.89),
    ('770e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440004', 'pull_queue', 0.82)
ON CONFLICT DO NOTHING;

-- Print summary
DO $$
DECLARE
    user_count INTEGER;
    task_count INTEGER;
    asset_count INTEGER;
    job_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO task_count FROM tasks;
    SELECT COUNT(*) INTO asset_count FROM assets;
    SELECT COUNT(*) INTO job_count FROM import_jobs;
    
    RAISE NOTICE '=== Mock Data Seeded Successfully ===';
    RAISE NOTICE 'Users: %', user_count;
    RAISE NOTICE 'Tasks: %', task_count;
    RAISE NOTICE 'Assets: %', asset_count;
    RAISE NOTICE 'Import Jobs: %', job_count;
    RAISE NOTICE '====================================';
END $$;
