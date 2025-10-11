import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface FeedbackEvent {
  request_id: string;
  user_event_id?: string;
  reaction: 'like' | 'dislike' | 'neutral';
  category?: string;
  note?: string;
  source: string;
}

export interface FeedbackEventResponse {
  id: string;
  request_id: string;
  user_event_id?: string;
  reaction: 'like' | 'dislike' | 'neutral';
  category?: string;
  note?: string;
  source: string;
  created_at: string;
  idempotency_key?: string;
}

export interface FeedbackSubmissionResponse {
  success: boolean;
  data: FeedbackEventResponse;
  message?: string;
  timestamp: string;
}

export interface FeedbackError {
  success: false;
  error: string;
  error_code?: string;
  details?: string;
  timestamp: string;
}

export class FeedbackService {
  private apiUrl = `${API_BASE_URL}`;

  // Generate idempotency key
  generateIdempotencyKey(requestId: string, userEventId?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const base = userEventId ? `${requestId}-${userEventId}` : requestId;
    return `feedback-${base}-${timestamp}-${random}`;
  }

  async submitFeedback(
    feedback: FeedbackEvent, 
    idempotencyKey?: string
  ): Promise<FeedbackSubmissionResponse> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
      }
      
      const response = await axios.post(
        `${this.apiUrl}/events/feedback`, 
        feedback,
        { headers }
      );
      
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Handle 409 conflicts gracefully
        throw new FeedbackConflictError(
          error.response.data.error || 'Feedback already exists',
          error.response.data.error_code,
          error.response.data.details
        );
      }
      throw error;
    }
  }

  async submitFeedbackWithIdempotency(feedback: FeedbackEvent): Promise<FeedbackSubmissionResponse> {
    const idempotencyKey = this.generateIdempotencyKey(
      feedback.request_id, 
      feedback.user_event_id
    );
    return this.submitFeedback(feedback, idempotencyKey);
  }

  async getFeedbackEvents(filters?: {
    request_id?: string;
    reaction?: 'like' | 'dislike' | 'neutral';
    category?: string;
    source?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    events: FeedbackEventResponse[];
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  }> {
    const params = new URLSearchParams();
    
    if (filters) {
      if (filters.request_id) params.append('request_id', filters.request_id);
      if (filters.reaction) params.append('reaction', filters.reaction);
      if (filters.category) params.append('category', filters.category);
      if (filters.source) params.append('source', filters.source);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());
    }

    const response = await axios.get(`${this.apiUrl}/events/feedback?${params.toString()}`);
    return response.data.data;
  }

  async getFeedbackEvent(id: string): Promise<FeedbackEventResponse> {
    const response = await axios.get(`${this.apiUrl}/events/feedback/${id}`);
    return response.data.data;
  }
}

// Custom error class for feedback conflicts
export class FeedbackConflictError extends Error {
  constructor(
    message: string,
    public errorCode?: string,
    public details?: string
  ) {
    super(message);
    this.name = 'FeedbackConflictError';
  }
}

export const feedbackService = new FeedbackService();
