import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { ImportService } from '../services/import.service.js';

export async function importRoutes(fastify: FastifyInstance, pool: Pool) {
  const importService = new ImportService(pool);

  // POST /import/jobs - Upload and process CSV file
  fastify.post(
    '/import/jobs',
    {
      schema: {
        consumes: ['multipart/form-data'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  jobId: { type: 'string' },
                  filename: { type: 'string' },
                  totalRows: { type: 'number' },
                  validRows: { type: 'number' },
                  invalidRows: { type: 'number' },
                  errorReportPath: { type: ['string', 'null'] },
                  status: { type: 'string' },
                },
              },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await request.file();

        if (!data) {
          return reply.code(400).send({
            success: false,
            error: 'No file uploaded',
            timestamp: new Date().toISOString(),
          });
        }

        // Check file type
        if (
          !data.mimetype.includes('csv') &&
          !data.mimetype.includes('text') &&
          !data.filename.endsWith('.csv')
        ) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid file type. Please upload a CSV file',
            timestamp: new Date().toISOString(),
          });
        }

        // Process CSV import
        const result = await importService.processCSVImport(
          data.file,
          data.filename,
          request.headers['x-user-id'] as string | undefined
        );

        return reply.code(200).send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // GET /import/jobs/:jobId - Get import job details
  fastify.get(
    '/import/jobs/:jobId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
          },
          required: ['jobId'],
        },
      },
    },
    async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
      try {
        const job = await importService.getImportJob(request.params.jobId);

        if (!job) {
          return reply.code(404).send({
            success: false,
            error: 'Import job not found',
            timestamp: new Date().toISOString(),
          });
        }

        return reply.code(200).send({
          success: true,
          data: job,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // GET /import/jobs/:jobId/errors - Download error report CSV
  fastify.get(
    '/import/jobs/:jobId/errors',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
          },
          required: ['jobId'],
        },
      },
    },
    async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
      try {
        const job = await importService.getImportJob(request.params.jobId);

        if (!job) {
          return reply.code(404).send({
            success: false,
            error: 'Import job not found',
            timestamp: new Date().toISOString(),
          });
        }

        if (job.invalid_rows === 0) {
          return reply.code(404).send({
            success: false,
            error: 'No errors found for this import job',
            timestamp: new Date().toISOString(),
          });
        }

        const csvContent = await importService.getErrorReportContent(request.params.jobId);

        reply.header('Content-Type', 'text/csv');
        reply.header(
          'Content-Disposition',
          `attachment; filename="errors_${request.params.jobId}.csv"`
        );
        return reply.send(csvContent);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
}
