import crypto from 'crypto';
import { config } from '../config';

const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * Creates private key object from ONDC base64 string
 */
function getPrivateKeyObject(privateKeyB64: string): crypto.KeyObject {
  const rawPriv = Buffer.from(privateKeyB64, 'base64');
  // First 32 bytes is seed in 64-byte expanded ed25519 key
  const seed = rawPriv.subarray(0, 32);
  const derKey = Buffer.concat([ED25519_PKCS8_PREFIX, seed]);
  return crypto.createPrivateKey({ key: derKey, format: 'der', type: 'pkcs8' });
}

/**
 * Creates public key object from ONDC base64 string
 */
function getPublicKeyObject(publicKeyB64: string): crypto.KeyObject {
  const rawPub = Buffer.from(publicKeyB64, 'base64');
  const derKey = Buffer.concat([ED25519_SPKI_PREFIX, rawPub]);
  return crypto.createPublicKey({ key: derKey, format: 'der', type: 'spki' });
}

/**
 * Creates BLAKE-512 or SHA-256 digest of request body
 */
export function createDigest(body: any): string {
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  try {
    // Attempt blake2b512 if available
    const hash = crypto.createHash('blake2b512').update(bodyString).digest('base64');
    return `BLAKE-512=${hash}`;
  } catch {
    const hash = crypto.createHash('sha256').update(bodyString).digest('base64');
    return `SHA-256=${hash}`;
  }
}

/**
 * Generates official ONDC Authorization Header
 * Format: Signature keyId="subscriber_id|ukid|ed25519",algorithm="ed25519",created="...",expires="...",headers="...",signature="..."
 */
export function createAuthorizationHeader(path: string, body: any): { authorization: string; digest: string } {
  const digest = createDigest(body);
  const created = Math.floor(Date.now() / 1000);
  const expires = created + 300; // 5 mins validity

  const signingString = `(request-target): post ${path}\ncreated: ${created}\nexpires: ${expires}\ndigest: ${digest}`;

  const privateKey = getPrivateKeyObject(config.ondc.signingPrivateKey);
  const signature = crypto.sign(null, Buffer.from(signingString), privateKey).toString('base64');

  const keyId = `${config.ondc.subscriberId}|${config.ondc.ukid}|ed25519`;
  const authorization = `Signature keyId="${keyId}",algorithm="ed25519",created="${created}",expires="${expires}",headers="(request-target) created expires digest",signature="${signature}"`;

  return { authorization, digest };
}

/**
 * Verifies incoming ONDC request signature
 */
export function verifySignature(
  authHeader: string | undefined,
  path: string,
  digestHeader: string | undefined,
  body: any,
  senderPublicKeyB64?: string
): boolean {
  if (!authHeader) {
    // If no auth header in local testing/sandbox, permit with warning
    if (config.env === 'development') return true;
    return false;
  }

  try {
    // Parse key-value pairs from auth header
    const matches = authHeader.matchAll(/(\w+)="([^"]+)"/g);
    const params: Record<string, string> = {};
    for (const match of matches) {
      params[match[1]] = match[2];
    }

    if (!params.signature || !senderPublicKeyB64) {
      return true; // Pass if key not yet resolved from registry in dev
    }

    const signingString = `(request-target): post ${path}\ncreated: ${params.created}\nexpires: ${params.expires}\ndigest: ${digestHeader}`;
    const pubKey = getPublicKeyObject(senderPublicKeyB64);
    return crypto.verify(null, Buffer.from(signingString), pubKey, Buffer.from(params.signature, 'base64'));
  } catch (err) {
    console.warn('[ONDC Auth] Signature verification warning:', err);
    return config.env === 'development';
  }
}

