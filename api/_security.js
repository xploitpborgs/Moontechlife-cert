import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------------
// In-memory rate limiting (sliding-window counter)
// ---------------------------------------------------------------------------
const rateLimitBuckets = new Map();

function pruneBucket(bucket, now) {
  while (bucket.length > 0 && bucket[0] <= now) {
    bucket.shift();
  }
}

export function applyRateLimit(key, { windowMs, max }) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key) || [];

  pruneBucket(bucket, now);

  if (bucket.length >= max) {
    const retryAfterMs = Math.max(bucket[0] - now, 0);
    rateLimitBuckets.set(key, bucket);
    return {
      allowed: false,
      retryAfterMs,
      retryAfterSeconds: Math.max(Math.ceil(retryAfterMs / 1000), 1),
    };
  }

  bucket.push(now + windowMs);
  rateLimitBuckets.set(key, bucket);
  return { allowed: true, retryAfterMs: 0, retryAfterSeconds: 0 };
}

export function clearRateLimit(key) {
  rateLimitBuckets.delete(key);
}

// Periodically prune stale entries to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets) {
    pruneBucket(bucket, now);
    if (bucket.length === 0) rateLimitBuckets.delete(key);
  }
}, 5 * 60 * 1000); // every 5 minutes

// ---------------------------------------------------------------------------
// IP extraction (OWASP: A05 – Security Misconfiguration)
// ---------------------------------------------------------------------------
export function getRequestIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return (
    req?.ip ||
    req?.socket?.remoteAddress ||
    req?.connection?.remoteAddress ||
    'unknown'
  );
}

// ---------------------------------------------------------------------------
// Bearer token reader
// ---------------------------------------------------------------------------
export function readBearerToken(req) {
  const header = req?.headers?.authorization || req?.headers?.Authorization;
  if (!header || typeof header !== 'string') return '';

  const [scheme, token] = header.split(' ');
  if (!/^Bearer$/i.test(scheme || '') || !token) return '';
  return token.trim();
}

// ---------------------------------------------------------------------------
// CSRF Protection (Double-Submit Cookie / HMAC Token)
// OWASP: A01 – Broken Access Control / CSRF
//
// Strategy:
//   1. The server generates a random nonce bound by HMAC with a secret.
//   2. The frontend sends the token back in the X-CSRF-Token request header.
//   3. The server validates the HMAC and rejects mismatches.
//
// For a stateless API consumed by a SPA on the same origin we use the
// "Synchronizer Token" embedded in a short-lived HMAC. This requires no
// server-side session storage.
// ---------------------------------------------------------------------------
const CSRF_SECRET = process.env.CSRF_SECRET || randomBytes(32).toString('hex');
const CSRF_TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Generate a CSRF token: `<timestamp>.<nonce>.<hmac>`.
 */
export function generateCsrfToken() {
  const ts = Date.now().toString(36);
  const nonce = randomBytes(16).toString('hex');
  const payload = `${ts}.${nonce}`;
  const mac = createHmac('sha256', CSRF_SECRET).update(payload).digest('hex');
  return `${payload}.${mac}`;
}

/**
 * Validate a CSRF token.
 * Returns true if valid; false otherwise.
 */
export function validateCsrfToken(token) {
  if (typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [ts, nonce, mac] = parts;
  const payload = `${ts}.${nonce}`;
  const expected = createHmac('sha256', CSRF_SECRET).update(payload).digest('hex');

  // Constant-time comparison to prevent timing attacks (OWASP: A02)
  try {
    const macBuf = Buffer.from(mac, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (macBuf.length !== expectedBuf.length) return false;
    if (!timingSafeEqual(macBuf, expectedBuf)) return false;
  } catch {
    return false;
  }

  // Check token age
  const issuedAt = Number.parseInt(ts, 36);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > CSRF_TOKEN_TTL_MS) {
    return false;
  }

  return true;
}

/**
 * Express middleware: validate CSRF token on state-changing requests.
 * Skip GET/HEAD/OPTIONS (safe methods).
 * Skip admin routes (they use Bearer auth instead).
 */
export function csrfMiddleware(req, res, next) {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  if (safeMethods.has(req.method)) return next();

  // Admin routes use Bearer tokens — they're already CSRF-resistant
  // because browsers cannot set the Authorization header cross-origin.
  const authHeader = req.headers?.authorization;
  if (authHeader && typeof authHeader === 'string' && /^Bearer /i.test(authHeader)) {
    return next();
  }

  const token =
    req.headers['x-csrf-token'] ||
    req.headers['x-xsrf-token'] ||
    req.body?._csrf;

  if (!validateCsrfToken(token)) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token.' });
  }

  return next();
}

// ---------------------------------------------------------------------------
// Security headers (OWASP: A05 – Security Misconfiguration)
// ---------------------------------------------------------------------------
export function securityHeadersMiddleware(req, res, next) {
  // Prevent clickjacking (OWASP: A05)
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME-type sniffing (OWASP: A05)
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enforce HTTPS (OWASP: A02)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Referrer policy — don't leak path in referer header
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy — restrict browser features
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  );

  // Content-Security-Policy (tightened for API endpoints)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'",
  );

  // Remove fingerprinting headers
  res.removeHeader('X-Powered-By');

  return next();
}

// ---------------------------------------------------------------------------
// Input sanitization helpers (OWASP: A03 – Injection)
// ---------------------------------------------------------------------------

/** Strip control characters and normalise whitespace. */
export function sanitizeString(value, maxLength = 1000) {
  if (value === null || value === undefined) return '';
  // Coerce to string, strip null bytes & control chars (except \t \n \r)
  return String(value)
    .replace(/\x00/g, '')                  // null byte
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // other control chars
    .trim()
    .slice(0, maxLength);
}

/** Validate and normalise an email address. */
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;

export function sanitizeEmail(value) {
  const cleaned = sanitizeString(value, 320).toLowerCase();
  if (!EMAIL_RE.test(cleaned)) return null; // null signals invalid
  return cleaned;
}

/** Validate that a value is a 6-digit numeric OTP. */
export function sanitizeOtp(value) {
  const digits = sanitizeString(value, 10).replace(/\D/g, '').slice(0, 6);
  return digits.length === 6 ? digits : null;
}

/** Validate a URL is http/https and within reasonable length. */
export function sanitizeUrl(value) {
  const cleaned = sanitizeString(value, 2048);
  try {
    const u = new URL(cleaned);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return cleaned;
  } catch {
    return null;
  }
}

/** Sanitize a plain name field (no HTML, limited length). */
export function sanitizeName(value) {
  return sanitizeString(value, 200).replace(/[<>&"']/g, '');
}

// ---------------------------------------------------------------------------
// SQL Injection guard (OWASP: A03)
// Supabase SDK already uses parameterized PostgREST queries so raw SQL
// injection is not possible through the SDK. This is a belt-and-suspenders
// pattern guard that rejects inputs containing obvious SQL attack payloads
// before they ever reach the DB layer.
// ---------------------------------------------------------------------------

const SQL_INJECTION_RE = /('|--|;|\/\*|\*\/|xp_|exec\s*\(|union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+\w+\s+set|select\s+.*\s+from|or\s+1\s*=\s*1|and\s+1\s*=\s*1)/i;

/**
 * Returns true if the value contains a recognisable SQL injection pattern.
 */
export function containsSqlInjection(value) {
  return SQL_INJECTION_RE.test(String(value || ''));
}

// ---------------------------------------------------------------------------
// XSS pattern guard (OWASP: A03)
// React escapes JSX by default and we use escapeHtml() in email builders,
// but this server-side check rejects payloads that look like XSS attempts
// before they are stored or processed.
// ---------------------------------------------------------------------------

const XSS_RE = /<\s*(script|iframe|object|embed|link|svg|img\s[^>]*onerror|on\w+\s*=)/i;

/**
 * Returns true if the value contains a recognisable XSS payload.
 */
export function containsXss(value) {
  return XSS_RE.test(String(value || ''));
}

/**
 * Express middleware: reject any request body field that contains
 * SQL injection or XSS patterns. Applied globally before route handlers.
 */
export function injectionGuardMiddleware(req, res, next) {
  if (!req.body || typeof req.body !== 'object') return next();

  for (const [key, value] of Object.entries(req.body)) {
    const strVal = String(value ?? '');

    if (containsSqlInjection(strVal)) {
      console.warn(`[security][sql-injection] Blocked on field "${key}" from ${getRequestIp(req)}`);
      return res.status(400).json({ error: 'Invalid input detected.' });
    }

    if (containsXss(strVal)) {
      console.warn(`[security][xss] Blocked on field "${key}" from ${getRequestIp(req)}`);
      return res.status(400).json({ error: 'Invalid input detected.' });
    }
  }

  return next();
}

// ---------------------------------------------------------------------------
// Request body size guard (defence-in-depth)
// ---------------------------------------------------------------------------
export function strictJsonBody(req, res, next) {
  // express.json() is already applied; this is a secondary guard
  if (req.headers['content-type'] && !req.headers['content-type'].includes('application/json')) {
    return res.status(415).json({ error: 'Unsupported Media Type.' });
  }
  return next();
}

