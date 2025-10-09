import { z } from 'zod';

/**
 * Ontology enums for classification system
 */

// Scan Type - Main classification categories
export const ScanTypeEnum = z.enum([
  'content_moderation',
  'safety_check',
  'quality_assessment',
  'compliance_review',
  'authenticity_verification',
  'sentiment_analysis',
]);

export type ScanType = z.infer<typeof ScanTypeEnum>;

// Feedback - User or system feedback categories
export const FeedbackEnum = z.enum([
  'positive',
  'negative',
  'neutral',
  'flagged',
  'approved',
  'rejected',
  'escalated',
  'pending_review',
]);

export type Feedback = z.infer<typeof FeedbackEnum>;

// Result - Scan result classifications
export const ResultEnum = z.enum([
  'pass',
  'fail',
  'warning',
  'error',
  'inconclusive',
  'requires_human_review',
  'auto_approved',
  'auto_rejected',
]);

export type Result = z.infer<typeof ResultEnum>;

// Reaction - System or user reaction types
export const ReactionEnum = z.enum([
  'accept',
  'reject',
  'challenge',
  'appeal',
  'confirm',
  'dispute',
  'acknowledge',
  'ignore',
]);

export type Reaction = z.infer<typeof ReactionEnum>;

// Export all enums as a group
export const OntologyEnums = {
  ScanType: ScanTypeEnum,
  Feedback: FeedbackEnum,
  Result: ResultEnum,
  Reaction: ReactionEnum,
} as const;
