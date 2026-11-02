import pino from 'pino';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config';

export interface LoggerOptions {
  serviceName: string;
  level?: string;
}

export function createLogger(options: LoggerOptions) {
  const isDev = config.env !== 'production';

  return pino({
    name: options.serviceName,
    level: options.level || config.logging.level,
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      : undefined,
    base: {
      service: options.serviceName,
      env: config.env
    },
    formatters: {
      log(object: any) {
        const traceId = object.traceId || process.env.OTEL_TRACE_ID;
        const spanId = object.spanId || process.env.OTEL_SPAN_ID;
        return {
          ...object,
          ...(traceId ? { 'trace.id': traceId } : {}),
          ...(spanId ? { 'span.id': spanId } : {})
        };
      }
    }
  });
}

export const logger = createLogger({ serviceName: 'ralt-ondc-lsp' });

/**
 * Express middleware for correlation IDs and structured HTTP logging
 */
export function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Skip noisy logs for health probes if configured
  const isProbe = req.path === '/health' || req.path === '/metrics';

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const logData = {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    if (res.statusCode >= 500) {
      logger.error(logData, `[HTTP] ${req.method} ${req.url} -> ${res.statusCode} (${durationMs}ms)`);
    } else if (res.statusCode >= 400) {
      logger.warn(logData, `[HTTP] ${req.method} ${req.url} -> ${res.statusCode} (${durationMs}ms)`);
    } else if (!isProbe) {
      logger.info(logData, `[HTTP] ${req.method} ${req.url} -> ${res.statusCode} (${durationMs}ms)`);
    }
  });

  next();
}

