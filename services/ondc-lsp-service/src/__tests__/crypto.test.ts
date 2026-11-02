import { createAuthorizationHeader, verifySignature } from '../crypto/auth';
import { config } from '../config';

describe('ONDC Beckn Cryptographic Authentication', () => {
  const sampleBody = {
    context: {
      domain: 'ONDC:LOG10',
      action: 'search',
      bap_id: 'buyer-app.ondc.org',
      transaction_id: 'tx-12345'
    },
    message: {}
  };

  it('should generate an authorization header with keyId and algorithm', async () => {
    const authHeader = await createAuthorizationHeader(sampleBody);
    expect(typeof authHeader).toBe('string');
    expect(authHeader).toContain('Signature');
    expect(authHeader).toContain('algorithm="ed25519"');
  });

  it('should verify incoming request signatures permissively in dev mode', async () => {
    const isValid = await verifySignature(
      'Signature keyId="test-key",algorithm="ed25519",signature="abc"',
      sampleBody
    );
    expect(typeof isValid).toBe('boolean');
    expect(isValid).toBe(true);
  });

  it('should reject signature when authorization header is completely missing in strict mode', async () => {
    const originalEnv = config.env;
    try {
      (config as any).env = 'production';
      const isValid = await verifySignature(undefined, sampleBody);
      expect(isValid).toBe(false);
    } finally {
      (config as any).env = originalEnv;
    }
  });
});
