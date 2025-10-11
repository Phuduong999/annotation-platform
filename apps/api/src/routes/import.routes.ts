import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import '@fastify/multipart';
import { Pool } from 'pg';
import { ImportService } from '../services/import.service.js';

export async function importRoutes(fastify: FastifyInstance, pool: Pool) {
  const importService = new ImportService(pool);

  // POST /import/jobs - Upload and process CSV file
  fastify.post(
    '/import/jobs',
    {
      schema: {
        consumes: ['multipart/form-data', 'application/json'],
        body: {
          // Allow flexible JSON body for import
          // Validation happens in normalizeJsonRecord after field name normalization
          oneOf: [
            {
              type: 'array',
              items: { type: 'object' }, // Accept any object, validation in service layer
            },
            { type: 'object' }, // For multipart/form-data
          ],
        },
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
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      try {
        const contentType = request.headers['content-type'] || '';
        const uploadedBy = request.headers['x-user-id'] as string | undefined;

        if (typeof request.isMultipart === 'function' && request.isMultipart()) {
          const data = await request.file();

          if (!data) {
            return reply.code(400).send({
              success: false,
              error: 'No file uploaded',
              timestamp: new Date().toISOString(),
            });
          }

          // Check file type
          const isXLSX =
            data.filename.endsWith('.xlsx') ||
            data.filename.endsWith('.xls') ||
            data.mimetype.includes('spreadsheet') ||
            data.mimetype.includes('excel');

          const isCSV =
            data.filename.endsWith('.csv') ||
            data.mimetype.includes('csv') ||
            data.mimetype.includes('text');

          if (!isCSV && !isXLSX) {
            return reply.code(400).send({
              success: false,
              error: 'Invalid file type. Please upload a CSV or XLSX file',
              timestamp: new Date().toISOString(),
            });
          }

          // Process CSV/XLSX import
          const result = await importService.processCSVImport(
            data.file,
            data.filename,
            uploadedBy,
            isXLSX
          );

          return reply.code(200).send({
            success: true,
            data: result,
            timestamp: new Date().toISOString(),
          });
        }

        if (contentType.includes('application/json')) {
          const payload = request.body;

          if (!Array.isArray(payload) || payload.length === 0) {
            return reply.code(400).send({
              success: false,
              error: 'Request body must be a non-empty array of records',
              timestamp: new Date().toISOString(),
            });
          }

          const filename =
            (request.headers['x-import-filename'] as string | undefined)?.trim() ||
            'json-import.json';

          const result = await importService.processJSONImport(payload, {
            filename,
            uploadedBy,
          });

          return reply.code(200).send({
            success: true,
            data: result,
            timestamp: new Date().toISOString(),
          });
        }

        return reply.code(400).send({
          success: false,
          error: 'Unsupported content type. Use multipart/form-data or application/json',
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
