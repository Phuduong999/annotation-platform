import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import {
  generateChecksum,
  generateVersionId,
  stratifiedSplit,
  calculateDatasetStatistics,
  generateManifest,
  convertToCSV,
  convertToJSONL,
} from '../utils/snapshot.utils.js';

export async function exportRoutes(fastify: FastifyInstance, pool: Pool) {
  // POST /snapshots - Create a new snapshot
  fastify.post(
    '/snapshots',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            filter_criteria: { type: 'object' },
            stratify_by: { type: 'string' },
            split_seed: { type: 'number' },
            train_ratio: { type: 'number' },
            validation_ratio: { type: 'number' },
            test_ratio: { type: 'number' },
            parent_snapshot_id: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: {
          name: string;
          description?: string;
          filter_criteria?: any;
          stratify_by?: string;
          split_seed?: number;
          train_ratio?: number;
          validation_ratio?: number;
          test_ratio?: number;
          parent_snapshot_id?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const {
          name,
          description,
          filter_criteria,
          stratify_by = 'classification',
          split_seed = 42,
          train_ratio = 0.7,
          validation_ratio = 0.15,
          test_ratio = 0.15,
          parent_snapshot_id,
        } = request.body;

        // Validate split ratios
        if (Math.abs(train_ratio + validation_ratio + test_ratio - 1.0) > 0.001) {
          return reply.code(400).send({
            success: false,
            error: 'Split ratios must sum to 1.0',
            timestamp: new Date().toISOString(),
          });
        }

        // Generate version ID
        const version_id = await generateVersionId(pool);

        // Create snapshot record
        const snapshotResult = await client.query(
          `INSERT INTO snapshots 
           (version_id, name, description, split_seed, train_ratio, 
            validation_ratio, test_ratio, stratify_by, filter_criteria, 
            parent_snapshot_id, created_by, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'processing')
           RETURNING *`,
          [
            version_id,
            name,
            description,
            split_seed,
            train_ratio,
            validation_ratio,
            test_ratio,
            stratify_by,
            filter_criteria ? JSON.stringify(filter_criteria) : null,
            parent_snapshot_id,
            'system', // Mock user
          ]
        );

        const snapshot = snapshotResult.rows[0];

        // Get finalized tasks
        let taskQuery = `
          SELECT t.*, r.result->>'classification' as classification,
                 t.ai_confidence
          FROM tasks t
          LEFT JOIN reviews r ON r.task_id = t.id AND r.action = 'accept'
          WHERE t.status = 'completed' 
            AND t.review_status = 'accepted'
        `;

        const taskResult = await client.query(taskQuery);
        const tasks = taskResult.rows;

        // Perform stratified splitting
        const splitAssignments = stratifiedSplit(
          tasks,
          stratify_by,
          split_seed,
          train_ratio,
          validation_ratio
        );

        // Create snapshot items
        for (const task of tasks) {
          const assignment = splitAssignments.get(task.id);
          if (!assignment) continue;

          const itemData = {
            id: task.id,
            classification: task.classification || task.type,
            tags: task.result?.tags || [],
            confidence: task.ai_confidence,
            request_id: task.request_id,
            team_id: task.team_id,
            scan_date: task.scan_date,
            user_input: task.user_input,
          };

          const itemChecksum = generateChecksum(JSON.stringify(itemData));

          await client.query(
            `INSERT INTO snapshot_items 
             (snapshot_id, task_id, split, split_index, data, item_checksum)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              snapshot.id,
              task.id,
              assignment.split,
              assignment.index,
              JSON.stringify(itemData),
              itemChecksum,
            ]
          );
        }

        // Calculate statistics
        const itemsResult = await client.query(
          `SELECT data, split FROM snapshot_items WHERE snapshot_id = $1`,
          [snapshot.id]
        );

        const items = itemsResult.rows.map(row => ({
          ...row.data,
          split: row.split,
        }));

        const statistics = calculateDatasetStatistics(items);

        // Generate and store manifest
        const manifest = generateManifest(
          snapshot,
          statistics,
          { classifications: ['meal', 'label', 'front_label', 'screenshot', 'others', 'safe'] }
        );

        const manifestChecksum = generateChecksum(JSON.stringify(manifest));
        manifest.checksums.manifest = manifestChecksum;

        await client.query(
          `INSERT INTO export_manifests 
           (snapshot_id, version, schema_version, ontology, schema, 
            statistics, lineage, dataset_name, dataset_description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            snapshot.id,
            version_id,
            manifest.schema_version,
            JSON.stringify(manifest.ontology),
            JSON.stringify(manifest.schema),
            JSON.stringify(statistics),
            JSON.stringify(manifest.lineage),
            name,
            description,
          ]
        );

        // Calculate data checksum
        const dataChecksum = await client.query(
          `SELECT calculate_snapshot_checksum($1) as checksum`,
          [snapshot.id]
        );

        // Update snapshot with checksums
        await client.query(
          `UPDATE snapshots 
           SET data_checksum = $1, manifest_checksum = $2, status = 'completed'
           WHERE id = $3`,
          [dataChecksum.rows[0].checksum, manifestChecksum, snapshot.id]
        );

        await client.query('COMMIT');

        return reply.code(201).send({
          success: true,
          data: {
            ...snapshot,
            statistics,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        await client.query('ROLLBACK');
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          timestamp: new Date().toISOString(),
        });
      } finally {
        client.release();
      }
    }
  );

  // GET /exports - Get export data
  fastify.get(
    '/exports',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['snapshot'],
          properties: {
            snapshot: { type: 'string' },
            format: { type: 'string', enum: ['csv', 'json', 'jsonl'] },
            split: { type: 'string', enum: ['train', 'validation', 'test', 'all'] },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          snapshot: string;
          format?: 'csv' | 'json' | 'jsonl';
          split?: 'train' | 'validation' | 'test' | 'all';
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { snapshot, format = 'json', split = 'all' } = request.query;

        // Get snapshot
        const snapshotResult = await pool.query(
          `SELECT * FROM snapshots WHERE version_id = $1 OR id = $1`,
          [snapshot]
        );

        if (snapshotResult.rows.length === 0) {
          return reply.code(404).send({
            success: false,
            error: 'Snapshot not found',
            timestamp: new Date().toISOString(),
          });
        }

        const snapshotData = snapshotResult.rows[0];

        // Get snapshot items
        let itemsQuery = `
          SELECT data, split, split_index 
          FROM snapshot_items 
          WHERE snapshot_id = $1
        `;
        const params = [snapshotData.id];

        if (split !== 'all') {
          itemsQuery += ` AND split = $2`;
          params.push(split);
        }

        itemsQuery += ` ORDER BY split, split_index`;

        const itemsResult = await pool.query(itemsQuery, params);
        const items = itemsResult.rows.map(row => ({
          ...row.data,
          split: row.split,
        }));

        let output: string;
        let contentType: string;
        let filename: string;

        // Convert to requested format
        switch (format) {
          case 'csv':
            output = convertToCSV(items);
            contentType = 'text/csv';
            filename = `${snapshotData.version_id}-${split}.csv`;
            break;
          case 'jsonl':
            output = convertToJSONL(items);
            contentType = 'application/x-ndjson';
            filename = `${snapshotData.version_id}-${split}.jsonl`;
            break;
          default:
            output = JSON.stringify(items, null, 2);
            contentType = 'application/json';
            filename = `${snapshotData.version_id}-${split}.json`;
        }

        // Generate checksum for this export
        const exportChecksum = generateChecksum(output);

        // Record export
        await pool.query(
          `INSERT INTO exports 
           (snapshot_id, format, split, file_checksum, row_count, status, created_by)
           VALUES ($1, $2, $3, $4, $5, 'completed', 'system')`,
          [
            snapshotData.id,
            format,
            split === 'all' ? null : split,
            exportChecksum,
            items.length,
          ]
        );

        // Set response headers
        reply.header('Content-Type', contentType);
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);
        reply.header('X-Checksum', exportChecksum);
        reply.header('X-Version', snapshotData.version_id);

        return reply.send(output);
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

  // GET /snapshots - List snapshots
  fastify.get(
    '/snapshots',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            is_published: { type: 'boolean' },
            is_archived: { type: 'boolean' },
            limit: { type: 'number' },
            offset: { type: 'number' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          status?: string;
          is_published?: boolean;
          is_archived?: boolean;
          limit?: number;
          offset?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const {
          status,
          is_published,
          is_archived,
          limit = 20,
          offset = 0,
        } = request.query;

        let query = `
          SELECT s.*, 
            em.ontology, 
            em.statistics
          FROM snapshots s
          LEFT JOIN export_manifests em ON em.snapshot_id = s.id
          WHERE 1=1
        `;
        const params: any[] = [];

        if (status) {
          query += ` AND s.status = $${params.length + 1}`;
          params.push(status);
        }

        if (is_published !== undefined) {
          query += ` AND s.is_published = $${params.length + 1}`;
          params.push(is_published);
        }

        if (is_archived !== undefined) {
          query += ` AND s.is_archived = $${params.length + 1}`;
          params.push(is_archived);
        }

        query += ` ORDER BY s.created_at DESC`;
        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        return reply.code(200).send({
          success: true,
          data: result.rows,
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

  // GET /exports/manifest/:snapshotId - Get manifest
  fastify.get(
    '/exports/manifest/:snapshotId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['snapshotId'],
          properties: {
            snapshotId: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: {
          snapshotId: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { snapshotId } = request.params;

        const result = await pool.query(
          `SELECT em.*, s.version_id, s.name, s.description
           FROM export_manifests em
           JOIN snapshots s ON s.id = em.snapshot_id
           WHERE s.id = $1 OR s.version_id = $1`,
          [snapshotId]
        );

        if (result.rows.length === 0) {
          return reply.code(404).send({
            success: false,
            error: 'Manifest not found',
            timestamp: new Date().toISOString(),
          });
        }

        const manifest = result.rows[0];
        reply.header('Content-Type', 'application/json');
        reply.header('Content-Disposition', `attachment; filename="${manifest.version_id}-manifest.json"`);

        return reply.send(JSON.stringify(manifest, null, 2));
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

  // POST /snapshots/:id/publish - Publish a snapshot
  fastify.post(
    '/snapshots/:id/publish',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: {
          id: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;

        const result = await pool.query(
          `UPDATE snapshots 
           SET is_published = true, published_at = NOW()
           WHERE id = $1 OR version_id = $1
           RETURNING *`,
          [id]
        );

        if (result.rows.length === 0) {
          return reply.code(404).send({
            success: false,
            error: 'Snapshot not found',
            timestamp: new Date().toISOString(),
          });
        }

        return reply.code(200).send({
          success: true,
          data: result.rows[0],
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
}