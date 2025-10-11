import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service';

export async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/login - Login with username/password
  fastify.post(
    '/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
            rememberMe: { type: 'boolean' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: {
          username: string;
          password: string;
          rememberMe?: boolean;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { username, password, rememberMe } = request.body;

        const authToken = await authService.login({
          username,
          password,
          rememberMe: rememberMe || false,
        });

        return reply.code(200).send({
          success: true,
          data: authToken,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(401).send({
          success: false,
          error: error instanceof Error ? error.message : 'Invalid credentials',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // POST /auth/logout - Logout current user
  fastify.post(
    '/auth/logout',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '');
        
        if (token) {
          await authService.logout(token);
        }

        return reply.code(200).send({
          success: true,
          message: 'Logged out successfully',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Logout failed',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // GET /auth/me - Get current user info
  fastify.get(
    '/auth/me',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const token = request.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return reply.code(401).send({
            success: false,
            error: 'No token provided',
            timestamp: new Date().toISOString(),
          });
        }

        const user = await authService.verifyToken(token);

        return reply.code(200).send({
          success: true,
          data: user,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(401).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unauthorized',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
}
