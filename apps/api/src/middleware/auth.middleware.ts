import { FastifyRequest, FastifyReply } from 'fastify';
import { authService, User } from '../services/auth.service';

// Extend FastifyRequest to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return reply.code(401).send({
        success: false,
        error: 'No authentication token provided',
        timestamp: new Date().toISOString(),
      });
    }

    const user = await authService.verifyToken(token);
    request.user = user;
  } catch (error) {
    return reply.code(401).send({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid or expired token',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Role-based authorization middleware factory
 */
export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // First ensure user is authenticated
    if (!request.user) {
      await authMiddleware(request, reply);
    }

    // Check if user has required role
    if (request.user && !allowedRoles.includes(request.user.role)) {
      return reply.code(403).send({
        success: false,
        error: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't fail if missing
 */
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      const user = await authService.verifyToken(token);
      request.user = user;
    }
  } catch (error) {
    // Silently fail for optional auth
    request.user = undefined;
  }
}
