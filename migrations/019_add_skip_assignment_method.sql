-- Migration: Add 'skip' to task_assignments.assignment_method constraint
-- Date: 2025-10-13
-- Description: Allow 'skip' as a valid assignment method for task_assignments table

-- Drop old constraint
ALTER TABLE task_assignments DROP CONSTRAINT IF EXISTS check_assignment_method;

-- Add updated constraint with 'skip' support
ALTER TABLE task_assignments 
ADD CONSTRAINT check_assignment_method 
CHECK (assignment_method IN ('equal_split', 'pull_queue', 'skip'));
