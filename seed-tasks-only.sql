-- Insert sample tasks directly into database
-- These tasks use the correct ontology scan types

INSERT INTO tasks (request_id, user_id, team_id, scan_type, user_input, raw_ai_output, scan_date, status, ai_confidence) VALUES
    ('req_test_001', 'user_999', 'team_test', 'content_moderation', 'https://example.com/images/test001.jpg', '{"classification": "explicit", "confidence": 0.96, "tags": ["test", "explicit"]}', '2025-10-09T10:00:00Z', 'pending', 0.96),
    ('req_test_002', 'user_999', 'team_test', 'safety_check', 'https://example.com/images/test002.jpg', '{"classification": "safe", "confidence": 0.88, "tags": ["test", "safe"]}', '2025-10-09T11:00:00Z', 'pending', 0.88),
    ('req_test_003', 'user_999', 'team_test', 'quality_assessment', 'https://example.com/images/test003.jpg', '{"classification": "high_quality", "confidence": 0.75, "tags": ["test", "quality"]}', '2025-10-09T12:00:00Z', 'pending', 0.75),
    ('req_test_004', 'user_999', 'team_test', 'compliance_review', 'https://example.com/images/test004.jpg', '{"classification": "compliant", "confidence": 0.92, "tags": ["test", "compliance"]}', '2025-10-09T13:00:00Z', 'pending', 0.92),
    ('req_test_005', 'user_999', 'team_test', 'authenticity_verification', 'https://example.com/images/test005.jpg', '{"classification": "authentic", "confidence": 0.89, "tags": ["test", "verified"]}', '2025-10-09T14:00:00Z', 'processing', 0.89),
    ('req_test_006', 'user_999', 'team_test', 'sentiment_analysis', 'https://example.com/images/test006.jpg', '{"classification": "positive", "confidence": 0.91, "tags": ["test", "sentiment"]}', '2025-10-09T15:00:00Z', 'completed', 0.91),
    ('req_test_007', 'user_888', 'team_alpha', 'content_moderation', 'https://example.com/images/test007.jpg', '{"classification": "safe", "confidence": 0.94, "tags": ["clean"]}', '2025-10-09T16:00:00Z', 'pending', 0.94),
    ('req_test_008', 'user_777', 'team_beta', 'safety_check', 'https://example.com/images/test008.jpg', '{"classification": "flagged", "confidence": 0.82, "tags": ["review_needed"]}', '2025-10-09T17:00:00Z', 'pending', 0.82),
    ('req_test_009', 'user_666', 'team_gamma', 'quality_assessment', 'https://example.com/images/test009.jpg', '{"classification": "poor", "confidence": 0.65, "tags": ["low_quality"]}', '2025-10-09T18:00:00Z', 'pending', 0.65),
    ('req_test_010', 'user_555', 'team_delta', 'compliance_review', 'https://example.com/images/test010.jpg', '{"classification": "pass", "confidence": 0.98, "tags": ["compliant"]}', '2025-10-09T19:00:00Z', 'completed', 0.98)
ON CONFLICT (request_id) DO NOTHING;

SELECT 'Inserted ' || COUNT(*) || ' tasks' FROM tasks;
