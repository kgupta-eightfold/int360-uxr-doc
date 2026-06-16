/**
 * Encrypts the research data into js/app-data.enc.json so the published
 * (public) repo never contains plaintext participant names or findings.
 *
 * Usage:  node scripts/encrypt.mjs "<password>"
 *
 * The browser (js/gate.js) decrypts this blob with the same password using
 * Web Crypto (PBKDF2 → AES-GCM). Re-run this to rotate the password.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { UXR } from '../js/data.js';
import { V2 } from '../js/v2content.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../js/app-data.enc.json');
const ITER = 210000;

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/encrypt.mjs "<password>"');
  process.exit(1);
}

const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
  baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const payload = enc.encode(JSON.stringify({ UXR, V2 }));
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);

const b64 = b => Buffer.from(b).toString('base64');
writeFileSync(OUT, JSON.stringify({ v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) }));
console.log(`Wrote ${OUT} (${(ct.byteLength / 1024).toFixed(1)} KB ciphertext). Password set.`);
