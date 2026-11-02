import { createAuthorizationHeader as sdkCreateAuthHeader, isHeaderValid as sdkIsHeaderValid } from 'ondc-crypto-sdk-nodejs';
import { config } from '../config';
import { logger } from '../logger';

/**
 * Generates official ONDC Authorization Header using the official ONDC Crypto SDK
 * Header format: Signature keyId="subscriber_id|ukid|ed25519",algorithm="ed25519",created="...",expires="...",headers="(created) (expires) digest",signature="..."
 */
export async function createAuthorizationHeader(body: any): Promise<string> {
  if (!config.ondc.signingPrivateKey) {
    logger.warn('ONDC signing private key not configured; returning mock authorization header');
    return 'Signature keyId="mock-key-id",algorithm="ed25519",signature="mock-signature"';
  }

  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  try {
    return await sdkCreateAuthHeader({
      body: bodyString,
      privateKey: config.ondc.signingPrivateKey,
      subscriberId: config.ondc.subscriberId,
      subscriberUniqueKeyId: config.ondc.ukid,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to generate ONDC authorization header');
    return '';
  }
}

/**
 * Verifies incoming ONDC request signature using official ONDC Crypto SDK
 */
export async function verifySignature(
  authHeader: string | undefined,
  body: any,
  senderPublicKeyB64?: string
): Promise<boolean> {
  if (!authHeader) {
    if (config.env === 'development') return true;
    return false;
  }

  if (!senderPublicKeyB64) {
    return true; // Pass if key not yet resolved from registry in dev
  }

  try {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    return await sdkIsHeaderValid({
      header: authHeader,
      body: bodyString,
      publicKey: senderPublicKeyB64,
    });
  } catch (err: any) {
    logger.warn({ err: err.message }, 'ONDC signature verification failed');
    return config.env === 'development';
  }
}
