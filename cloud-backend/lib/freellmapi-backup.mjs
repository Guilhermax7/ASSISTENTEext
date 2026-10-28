import crypto from 'node:crypto';
import {neon} from '@neondatabase/serverless';

const MAX_BYTES = 3_000_000;
let database;
let initialized;

function getSql() {
  if (!database) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url || !/^postgres(?:ql)?:\/\//.test(url)) throw new Error('database unavailable');
    database = neon(url);
  }
  return database;
}
async function init() {
  if (!initialized) {
    initialized = getSql()`CREATE TABLE IF NOT EXISTS sra_luck_freellmapi_backup (
      id TEXT PRIMARY KEY,
      encrypted_base64 TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`.catch(e => { initialized = undefined; throw e; });
  }
  await initialized;
}
const storage = {
  async read() {
    await init();
    const rows = await getSql()`SELECT encrypted_base64 FROM sra_luck_freellmapi_backup WHERE id = 'primary' LIMIT 1`;
    return rows.length ? Buffer.from(rows[0].encrypted_base64, 'base64') : null;
  },
  async write(buffer) {
    await init();
    const b64 = buffer.toString('base64');
    await getSql()`INSERT INTO sra_luck_freellmapi_backup (id, encrypted_base64, bytes, updated_at)
      VALUES ('primary', ${b64}, ${buffer.length}, now())
      ON CONFLICT(id) DO UPDATE SET encrypted_base64=EXCLUDED.encrypted_base64,
       bytes=EXCLUDED.bytes, updated_at=now()`;
  }
};

function reply(res, status, message, contentType = 'application/json; charset=utf-8') {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (status === 204) return res.end();
  res.setHeader('Content-Type', contentType);
  return res.end(typeof message === 'string' ? message : JSON.stringify(message));
}
function error(res, status, code) {
  return reply(res, status, { error: { code } });
}
function validToken(headers, secret) {
  const presented = String(headers?.authorization || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(presented), b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function bodyBytes(req) {
  if (typeof req.headers?.['content-length'] === 'string' && Number(req.headers['content-length']) > MAX_BYTES) {
    const e = new Error('too large'); e.status = 413; throw e;
  }
  if (req.body !== undefined) {
    let buffer;
    if (Buffer.isBuffer(req.body)) buffer = req.body;
    else if (req.body instanceof Uint8Array) buffer = Buffer.from(req.body);
    else if (typeof req.body === 'string') buffer = Buffer.from(req.body, 'binary');
    else { const e = new Error('invalid binary content'); e.status = 415; throw e; }
    if (!buffer.length || buffer.length > MAX_BYTES) {
      const e = new Error('invalid size'); e.status = buffer.length ? 413 : 400; throw e;
    }
    return buffer;
  }
  let total = 0; const chunks = [];
  for await (const part of req) {
    const b = Buffer.from(part); total += b.length;
    if (total > MAX_BYTES) { const e = new Error('too large'); e.status = 413; throw e; }
    chunks.push(b);
  }
  if (!total) { const e = new Error('empty backup'); e.status = 400; throw e; }
  return Buffer.concat(chunks);
}

export function createBackupHandler(store = storage, tokenProvider = () => process.env.SRA_LUCK_FREELLMAPI_BACKUP_TOKEN) {
  return async function backupHandler(req, res) {
    try {
      const secret = tokenProvider() || '';
      if (secret.length < 32) return error(res, 503, 'BACKUP_NOT_CONFIGURED');
      if (!validToken(req.headers, secret)) return error(res, 401, 'UNAUTHORIZED');
      if (req.method === 'GET') {
        const bytes = await store.read();
        if (!bytes) return error(res, 404, 'NO_BACKUP');
        if (bytes.length > MAX_BYTES) return error(res, 500, 'BACKUP_TOO_LARGE');
        return reply(res, 200, bytes, 'application/octet-stream');
      }
      if (req.method === 'PUT') {
        const buffer = await bodyBytes(req);
        await store.write(buffer);
        return reply(res, 204);
      }
      res.setHeader('Allow', 'GET, PUT');
      return error(res, 405, 'METHOD_NOT_ALLOWED');
    } catch (e) {
      return error(res, e.status || 503, e.status ? 'INVALID_BACKUP_REQUEST' : 'BACKUP_STORE_UNAVAILABLE');
    }
  };
}
export const handleBackup = createBackupHandler();
