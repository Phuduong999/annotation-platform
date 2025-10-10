export enum MetricType {
  TASK_THROUGHPUT = 'task_throughput',
  ACCEPTANCE_RATE = 'acceptance_rate',
  REWORK_RATE = 'rework_rate',
  LINK_ERROR_RATE = 'link_error_rate',
  DISLIKE_RATE = 'dislike_rate',
  INTER_ANNOTATOR_AGREEMENT = 'inter_annotator_agreement',
  REVIEW_THROUGHPUT = 'review_throughput',
  AVERAGE_TASK_COMPLETION_TIME = 'avg_task_completion_time',
  ACTIVE_USERS = 'active_users',
  QUEUE_SIZE = 'queue_size',
  API_RESPONSE_TIME = 'api_response_time',
  ERROR_RATE = 'error_rate',
}

export enum AggregationPeriod {
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  EXPIRED = 'expired',
}

export interface TimePeriod {
  startDate: Date;
  endDate: Date;
  period?: AggregationPeriod;
}

export interface MetricValue {
  timestamp: Date;
  value: number;
  metricType: MetricType;
  projectId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface TimeSeriesData {
  metricType: MetricType;
  data: Array<{
    timestamp: Date;
    value: number;
    count?: number;
  }>;
  aggregation?: AggregationPeriod;
  projectId?: string;
}

export interface KPI {
  name: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercentage?: number;
  trend?: 'up' | 'down' | 'stable';
  target?: number;
  targetMet?: boolean;
  period: string;
}

export interface KPIDashboard {
  taskThroughput: KPI;
  acceptanceRate: KPI;
  reworkRate: KPI;
  linkErrorRate: KPI;
  dislikeRate: KPI;
  interAnnotatorAgreement: KPI;
  reviewThroughput: KPI;
  averageCompletionTime: KPI;
  activeUsers: KPI;
  queueSize: KPI;
}

export interface AlertRule {
  id: string;
  name: string;
  metricType: MetricType;
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  evaluationPeriod: number; // in minutes
  projectId?: string;
  isActive: boolean;
  notificationChannels?: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  metricValue: number;
  threshold: number;
  projectId?: string;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  userEmail: string;
  value: number;
  rank: number;
  previousRank?: number;
  change?: number;
  metadata?: {
    tasksCompleted?: number;
    acceptanceRate?: number;
    reviewThroughput?: number;
    qualityScore?: number;
  };
}

export interface InterAnnotatorAgreementScore {
  id: string;
  projectId: string;
  taskId?: string;
  annotator1Id: string;
  annotator2Id: string;
  agreementScore: number;
  metricType: 'cohen_kappa' | 'fleiss_kappa' | 'percentage_agreement';
  calculatedAt: Date;
  metadata?: Record<string, any>;
}

export interface ProjectSummary {
  projectId: string;
  projectName: string;
  overview: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    totalReviews: number;
    totalUsers: number;
    averageCompletionTime: number;
  };
  kpis: KPIDashboard;
  recentActivity: Array<{
    timestamp: Date;
    activityType: string;
    userId: string;
    userName: string;
    details: string;
  }>;
  topContributors: LeaderboardEntry[];
  alerts: Alert[];
  trends: {
    daily: TimeSeriesData[];
    weekly: TimeSeriesData[];
  };
}

export interface AnalyticsExportData {
  metadata: {
    exportDate: Date;
    startDate: Date;
    endDate: Date;
    projectId?: string;
    format: 'json' | 'csv';
  };
  metrics: MetricValue[];
  kpis: KPIDashboard;
  timeSeries: TimeSeriesData[];
  alerts: Alert[];
  leaderboard: LeaderboardEntry[];
}