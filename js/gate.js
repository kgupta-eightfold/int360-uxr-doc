/* Password gate. Fetches the AES-encrypted data blob and decrypts it in the
 * browser (PBKDF2 → AES-GCM) only when the correct password is entered. On
 * success it exposes the data on window.__APPDATA__ and boots the app.
 * Without the password the data is ciphertext — not readable from source. */

const ITER_FALLBACK = 210000;
const b64ToBuf = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

let blobPromise;
function loadBlob() {
  return (blobPromise ||= fetch('js/app-data.enc.json').then(r => r.json()));
}

async function decrypt(password) {
  const { iter, salt, iv, ct } = await loadBlob();
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64ToBuf(salt), iterations: iter || ITER_FALLBACK, hash: 'SHA-256' },
    baseKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBuf(iv) }, key, b64ToBuf(ct));
  return JSON.parse(new TextDecoder().decode(buf)); // throws on wrong password (GCM auth fail)
}

async function boot(data) {
  window.__APPDATA__ = data;
  document.body.classList.remove('locked');
  document.getElementById('gate')?.remove();
  await import('./app.js');
}

const form = document.getElementById('gate-form');
const input = document.getElementById('gate-pw');
const err = document.getElementById('gate-err');

form.addEventListener('submit', async e => {
  e.preventDefault();
  err.hidden = true;
  const pw = input.value;
  form.classList.add('busy');
  try {
    const data = await decrypt(pw);
    try { sessionStorage.setItem('uxr-pw', pw); } catch {}
    await boot(data);
  } catch {
    form.classList.remove('busy');
    err.hidden = false;
    input.value = '';
    input.focus();
  }
});

/* auto-unlock for the rest of the session if already entered */
(async () => {
  let pw;
  try { pw = sessionStorage.getItem('uxr-pw'); } catch {}
  if (!pw) { input?.focus(); return; }
  try { await boot(await decrypt(pw)); }
  catch { try { sessionStorage.removeItem('uxr-pw'); } catch {} input?.focus(); }
})();
