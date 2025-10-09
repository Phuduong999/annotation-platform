import axios, { AxiosError } from 'axios';
import sharp from 'sharp';
import { Pool } from 'pg';
import {
  LinkStatus,
  LinkHealthResult,
  AssetRecord,
  REQUEST_TIMEOUT_MS,
  MAX_BODY_SIZE,
  VALID_IMAGE_MIMES,
} from '../types/link-health.js';
import { recordLinkCheckMetrics } from '../metrics/prometheus.js';

export class LinkHealthService {
  constructor(private pool: Pool) {}

  /**
   * Perform health check on a URL
   */
  async checkLinkHealth(requestId: string, url: string): Promise<LinkHealthResult> {
    const startTime = Date.now();
    let linkStatus: LinkStatus = LinkStatus.NETWORK_ERROR;
    let contentType: string | undefined;
    let contentLength: number | undefined;
    let headers: Record<string, string> = {};
    let errorMessage: string | undefined;

    try {
      // Step 1: Try HEAD request first (faster)
      try {
        const headResponse = await axios.head(url, {
          timeout: REQUEST_TIMEOUT_MS,
          maxRedirects: 5,
          validateStatus: (status) => status < 500, // Don't throw on 4xx
        });

        headers = this.sanitizeHeaders(headResponse.headers);
        contentType = headResponse.headers['content-type'];
        contentLength = parseInt(headResponse.headers['content-length'] || '0');

        // Check status code
        if (headResponse.status === 404) {
          linkStatus = LinkStatus.NOT_FOUND;
          errorMessage = 'Resource not found (404)';
        } else if (headResponse.status === 403) {
          linkStatus = LinkStatus.FORBIDDEN;
          errorMessage = 'Access forbidden (403)';
        } else if (headResponse.status >= 400) {
          linkStatus = LinkStatus.NETWORK_ERROR;
          errorMessage = `HTTP error ${headResponse.status}`;
        } else {
          // Check MIME type
          if (!this.isValidImageMime(contentType)) {
            linkStatus = LinkStatus.INVALID_MIME;
            errorMessage = `Invalid MIME type: ${contentType}`;
          } else {
            // HEAD succeeded and MIME is valid, try GET to decode
            linkStatus = await this.validateImageContent(url, headers);
          }
        }
      } catch (headError) {
        // HEAD failed, try GET
        linkStatus = await this.validateImageContent(url, headers);
      }
    } catch (error) {
      // Handle errors
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
          linkStatus = LinkStatus.TIMEOUT;
          errorMessage = 'Request timeout after 5 seconds';
        } else if (axiosError.response?.status === 404) {
          linkStatus = LinkStatus.NOT_FOUND;
          errorMessage = 'Resource not found (404)';
        } else if (axiosError.response?.status === 403) {
          linkStatus = LinkStatus.FORBIDDEN;
          errorMessage = 'Access forbidden (403)';
        } else if (axiosError.message.includes('presign') || axiosError.message.includes('expired')) {
          linkStatus = LinkStatus.EXPIRED_PRESIGN;
          errorMessage = 'Pre-signed URL expired';
        } else {
          linkStatus = LinkStatus.NETWORK_ERROR;
          errorMessage = axiosError.message;
        }

        if (axiosError.response?.headers) {
          headers = this.sanitizeHeaders(axiosError.response.headers);
          contentType = axiosError.response.headers['content-type'];
        }
      } else {
        linkStatus = LinkStatus.NETWORK_ERROR;
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    const latencyMs = Date.now() - startTime;

    // Record metrics
    const isError = linkStatus !== LinkStatus.OK;
    recordLinkCheckMetrics(linkStatus, latencyMs, isError, isError ? linkStatus : undefined);

    const result: LinkHealthResult = {
      requestId,
      url,
      linkStatus,
      latencyMs,
      contentType,
      contentLength,
      headers,
      errorMessage,
    };

    // Save to database
    await this.saveAssetRecord(result);

    return result;
  }

  /**
   * Validate image content by downloading and decoding with Sharp
   */
  private async validateImageContent(
    url: string,
    existingHeaders: Record<string, string>
  ): Promise<LinkStatus> {
    try {
      const response = await axios.get(url, {
        timeout: REQUEST_TIMEOUT_MS,
        maxRedirects: 5,
        responseType: 'arraybuffer',
        maxBodyLength: MAX_BODY_SIZE,
        validateStatus: (status) => status < 500,
      });

      // Update headers if we got new ones
      if (response.headers) {
        Object.assign(existingHeaders, this.sanitizeHeaders(response.headers));
      }

      // Check status
      if (response.status === 404) {
        return LinkStatus.NOT_FOUND;
      }
      if (response.status === 403) {
        return LinkStatus.FORBIDDEN;
      }
      if (response.status >= 400) {
        return LinkStatus.NETWORK_ERROR;
      }

      // Check MIME type
      const contentType = response.headers['content-type'];
      if (!this.isValidImageMime(contentType)) {
        return LinkStatus.INVALID_MIME;
      }

      // Try to decode first few bytes with Sharp
      const buffer = Buffer.from(response.data);
      
      try {
        const metadata = await sharp(buffer).metadata();
        
        // If we can get metadata, the image is decodable
        if (metadata.format) {
          return LinkStatus.OK;
        } else {
          return LinkStatus.DECODE_ERROR;
        }
      } catch (sharpError) {
        console.error('Sharp decode error:', sharpError);
        return LinkStatus.DECODE_ERROR;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
          return LinkStatus.TIMEOUT;
        }
        if (axiosError.response?.status === 404) {
          return LinkStatus.NOT_FOUND;
        }
        if (axiosError.response?.status === 403) {
          return LinkStatus.FORBIDDEN;
        }
        if (axiosError.message.includes('presign') || axiosError.message.includes('expired')) {
          return LinkStatus.EXPIRED_PRESIGN;
        }
      }
      
      return LinkStatus.NETWORK_ERROR;
    }
  }

  /**
   * Check if content type is a valid image MIME
   */
  private isValidImageMime(contentType?: string): boolean {
    if (!contentType) return false;
    
    const mimeType = contentType.split(';')[0].trim().toLowerCase();
    return VALID_IMAGE_MIMES.includes(mimeType);
  }

  /**
   * Sanitize headers to store only relevant ones
   */
  private sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
    const relevantHeaders = [
      'content-type',
      'content-length',
      'last-modified',
      'etag',
      'cache-control',
      'expires',
      'x-amz-request-id',
    ];

    const sanitized: Record<string, string> = {};
    
    for (const key of relevantHeaders) {
      if (headers[key]) {
        sanitized[key] = String(headers[key]);
      }
    }

    return sanitized;
  }

  /**
   * Save asset record to database
   */
  private async saveAssetRecord(result: LinkHealthResult): Promise<void> {
    const record: AssetRecord = {
      request_id: result.requestId,
      url: result.url,
      link_status: result.linkStatus,
      latency_ms: result.latencyMs,
      content_type: result.contentType,
      content_length: result.contentLength,
      headers: result.headers,
      error_message: result.errorMessage,
      last_checked_at: new Date(),
    };

    await this.pool.query(
      `INSERT INTO assets 
       (request_id, url, link_status, latency_ms, content_type, content_length, headers, error_message, last_checked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (request_id) 
       DO UPDATE SET
         link_status = EXCLUDED.link_status,
         latency_ms = EXCLUDED.latency_ms,
         content_type = EXCLUDED.content_type,
         content_length = EXCLUDED.content_length,
         headers = EXCLUDED.headers,
         error_message = EXCLUDED.error_message,
         last_checked_at = EXCLUDED.last_checked_at`,
      [
        record.request_id,
        record.url,
        record.link_status,
        record.latency_ms,
        record.content_type || null,
        record.content_length || null,
        record.headers ? JSON.stringify(record.headers) : null,
        record.error_message || null,
        record.last_checked_at,
      ]
    );
  }

  /**
   * Get asset by request ID
   */
  async getAsset(requestId: string): Promise<AssetRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM assets WHERE request_id = $1',
      [requestId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }
}
