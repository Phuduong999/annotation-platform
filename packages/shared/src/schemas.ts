import { z } from 'zod';

// User schema
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createUserSchema = userSchema.omit({ id: true, createdAt: true, updatedAt: true });

export type User = z.infer<typeof userSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;

// Task schema (for worker jobs)
export const taskSchema = z.object({
  id: z.string(),
  type: z.enum(['email', 'notification', 'data-processing']),
  data: z.record(z.unknown()),
  priority: z.number().int().min(1).max(10).default(5),
});

export type Task = z.infer<typeof taskSchema>;

// API Response schemas
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  timestamp: z.date(),
});

export type ApiResponse<T = unknown> = Omit<z.infer<typeof apiResponseSchema>, 'data'> & {
  data?: T;
};

// Health check schema
export const healthCheckSchema = z.object({
  status: z.enum(['healthy', 'unhealthy', 'degraded']),
  timestamp: z.date(),
  services: z.record(
    z.object({
      status: z.enum(['up', 'down']),
      latency: z.number().optional(),
    })
  ),
});

export type HealthCheck = z.infer<typeof healthCheckSchema>;
