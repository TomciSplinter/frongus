// Small helpers shared by the API routes (Vercel Node.js functions).

export class UserError extends Error {
  constructor(message, status = 400, code = 'bad_request') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return safeParse(req.body);
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new UserError('Request is too large.', 413, 'too_large');
    chunks.push(chunk);
  }
  return safeParse(Buffer.concat(chunks).toString('utf8'));
}
function safeParse(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new UserError('Request body must be JSON.');
  }
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (Array.isArray(fwd) ? fwd[0] : (fwd || '')).split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

// Best-effort in-memory limiter (per warm function instance).
const buckets = new Map();
export function rateLimit(req, key, limit, windowMs) {
  const id = `${key}:${clientIp(req)}`;
  const now = Date.now();
  const b = buckets.get(id) || { count: 0, reset: now + windowMs };
  if (now > b.reset) { b.count = 0; b.reset = now + windowMs; }
  b.count++;
  buckets.set(id, b);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  if (b.count > limit) throw new UserError('Too many requests. Wait a minute and try again.', 429, 'rate_limited');
}

// Wraps a handler: method check, JSON errors, no stack traces leaked to the browser.
export function route(methods, handler) {
  return async (req, res) => {
    if (!methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '));
      return json(res, 405, { error: 'Method not allowed.' });
    }
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof UserError) return json(res, err.status, { error: err.message, code: err.code });
      console.error(err);
      return json(res, 502, { error: 'Something went wrong on our side. Try again in a moment.', code: 'server_error' });
    }
  };
}
