import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { config } from './config';
import { logger } from './logger';

export interface RiderTokenPayload {
  riderId: string;
  phone: string;
  role: 'RIDER' | 'ADMIN' | 'SUPPORT';
}

declare global {
  namespace Express {
    interface Request {
      riderAuth?: RiderTokenPayload;
    }
  }
}

/**
 * Enterprise Helmet configuration
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:", "wss:", "ws:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: config.isProduction ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: config.isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false
});

/**
 * Enterprise CORS configuration
 */
export const corsMiddleware = cors({
  origin: (origin: any, callback: any) => {
    // Allow non-browser requests (mobile apps, curl, server-to-server ONDC)
    if (!origin) return callback(null, true);
    if (config.security.corsOrigins.includes('*') || config.security.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Allow localhost during development
    if (!config.isProduction && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }
    callback(null, true); // Permissive for ONDC and Mobile development
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Accept']
});

/**
 * Rate Limiter for general public APIs
 */
export const apiRateLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again shortly.' }
});

/**
 * Stricter Rate Limiter for sensitive OTP and login operations
 */
export const otpRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.security.otpRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many OTP requests. Please wait a minute before retrying.' }
});

/**
 * ONDC Gateway Rate Limiter (High throughput for network traffic)
 */
export const ondcRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600, // 600 req/min for ONDC network nodes
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: { ack: { status: 'NACK' } }, error: { code: '10001', message: 'Rate limit exceeded' } }
});

/**
 * JWT Token Signing for Delivery Partner App
 */
export function signRiderToken(riderId: string, phone: string, role: 'RIDER' | 'ADMIN' | 'SUPPORT' = 'RIDER'): string {
  const payload: RiderTokenPayload = { riderId, phone, role };
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiry as any,
    issuer: 'ralt-ondc-lsp'
  });
}

/**
 * Verify and decode a Rider JWT token
 */
export function verifyRiderToken(token: string): RiderTokenPayload | null {
  try {
    return jwt.verify(token, config.jwt.secret) as RiderTokenPayload;
  } catch {
    return null;
  }
}

/**
 * JWT Verification Middleware for Rider APIs
 */
export function requireRiderAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // In local dev, allow optional fallback if riderId is passed in query or body
    if (!config.isProduction) {
      const fallbackRiderId = (req.query.riderId || req.body?.riderId || req.params?.riderId || req.params?.id || 'RALT-RIDER-001') as string;
      req.riderAuth = {
        riderId: fallbackRiderId,
        phone: (req.query.phone || '9876543210') as string,
        role: 'RIDER'
      };
      return next();
    }
    return res.status(401).json({ success: false, error: 'Authentication required: missing or invalid Bearer token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as RiderTokenPayload;
    req.riderAuth = decoded;
    next();
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Unauthorized API access attempt with invalid JWT');
    return res.status(401).json({ success: false, error: 'Session expired or invalid token' });
  }
}

// =============================================================================
// ZOD SCHEMAS FOR STRICT INPUT VALIDATION
// =============================================================================

export const SendOtpSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,14}$/, 'Must be a valid numeric phone number (10 to 14 digits)')
});

export const VerifyOtpSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{10,14}$/, 'Must be a valid numeric phone number'),
  otp: z.string().regex(/^[0-9]{4,6}$/, 'OTP must be 4 to 6 numeric digits')
});

export const LocationUpdateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  riderId: z.string().optional()
});

export const StatusUpdateSchema = z.object({
  isOnline: z.boolean(),
  riderId: z.string().optional()
});

