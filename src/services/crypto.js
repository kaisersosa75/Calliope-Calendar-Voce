import crypto from 'node:crypto';
import 'dotenv/config';

/**
 * Cifratura simmetrica AES-256-GCM per i refresh token salvati nel DB.
 * La chiave è una variabile d'ambiente di 32 byte (64 caratteri hex).
 * Genera una chiave con: node -e "console.log(crypto.randomBytes(32).toString('hex'))"
 */
const KEY = Buffer.from(process.env.TOKEN_ENC_KEY, 'hex');
const ALGO = 'aes-256-gcm';

export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // formato: iv:tag:ciphertext (tutto in hex)
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':');
}

export function decrypt(payload) {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
