import crypto from 'node:crypto';

function encryptionKey() {
  const value = process.env.INTEGRATION_SECRET_ENCRYPTION_KEY;
  if (!value) throw new Error('INTEGRATION_SECRET_ENCRYPTION_KEY is not configured.');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('INTEGRATION_SECRET_ENCRYPTION_KEY must be a 32-byte base64 value.');
  return key;
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

export function decryptSecret(ciphertext: string, iv: string, tag: string) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
