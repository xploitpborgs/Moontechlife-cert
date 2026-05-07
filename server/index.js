import 'dotenv/config';
import express from 'express';
import {
  buildCertificateAccessEmail,
  buildCertificateNotificationEmail,
  buildTestEmail,
  sendMail,
} from '../api/_mail.js';
import { requestOtpChallenge, verifyOtpChallenge } from '../api/_otp.js';
import {
  getRequestIp,
  securityHeadersMiddleware,
  csrfMiddleware,
  sanitizeEmail,
  sanitizeName,
  sanitizeUrl,
  generateCsrfToken,
  strictJsonBody,
  injectionGuardMiddleware,
} from '../api/_security.js';
import { requireAdminRequest } from '../api/_supabase.js';

const { process } = globalThis;
const app = express();
const port = Number(process.env.PORT || 8787);

// ---------------------------------------------------------------------------
// Global middleware — applied to every request
// ---------------------------------------------------------------------------

// OWASP A05: Security headers on all responses
app.use(securityHeadersMiddleware);

// Parse JSON bodies with a strict size cap (OWASP A04: Resource limits)
app.use(express.json({ limit: '50kb' }));

// Enforce Content-Type on mutation routes (defence-in-depth)
app.use((req, res, next) => {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  if (!safeMethods.has(req.method)) {
    return strictJsonBody(req, res, next);
  }
  return next();
});

// OWASP A01: CSRF protection for all non-admin, non-safe routes
app.use(csrfMiddleware);

// OWASP A03: Block SQL injection and XSS patterns in request bodies
app.use(injectionGuardMiddleware);

// ---------------------------------------------------------------------------
// CSRF token endpoint — lets the SPA fetch a fresh token on load
// ---------------------------------------------------------------------------
app.get('/api/csrf-token', (_req, res) => {
  const token = generateCsrfToken();
  res.json({ csrfToken: token });
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// OTP — request
// ---------------------------------------------------------------------------
app.post('/api/auth/request-otp', async (req, res) => {
  try {
    // Input sanitization happens inside requestOtpChallenge (sanitizeEmail)
    const result = await requestOtpChallenge({
      email: req.body?.email,
      ip: getRequestIp(req),
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[auth][request-otp]', error);
    return res.status(500).json({
      error: 'Unable to process the verification request right now.',
    });
  }
});

// ---------------------------------------------------------------------------
// OTP — verify
// ---------------------------------------------------------------------------
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const result = await verifyOtpChallenge({
      email: req.body?.email,
      otp: req.body?.otp,
      ip: getRequestIp(req),
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[auth][verify-otp]', error);
    return res.status(500).json({ error: 'Unable to verify the code right now.' });
  }
});

// ---------------------------------------------------------------------------
// Admin email routes — protected by Bearer token (admin only)
// ---------------------------------------------------------------------------

app.post('/api/email/test', async (req, res) => {
  try {
    const admin = await requireAdminRequest(req);
    if (!admin.ok) {
      return res.status(admin.status).json({ error: admin.error });
    }

    // OWASP A03: Sanitize inputs
    const toEmail = sanitizeEmail(req.body?.toEmail);
    if (!toEmail) {
      return res.status(400).json({ error: 'A valid toEmail is required.' });
    }

    await sendMail({ to: toEmail, ...buildTestEmail() });
    return res.json({ ok: true });
  } catch (error) {
    console.error('[smtp][test]', error);
    return res.status(500).json({ error: 'Failed to send the email right now.' });
  }
});

app.post('/api/email/certificate-access', async (req, res) => {
  try {
    const admin = await requireAdminRequest(req);
    if (!admin.ok) {
      return res.status(admin.status).json({ error: admin.error });
    }

    // OWASP A03: Sanitize inputs
    const toEmail = sanitizeEmail(req.body?.toEmail);
    const toName = sanitizeName(req.body?.toName || '');
    const accessUrl = sanitizeUrl(req.body?.accessUrl);

    if (!toEmail || !accessUrl) {
      return res.status(400).json({ error: 'Valid toEmail and accessUrl are required.' });
    }

    await sendMail({
      to: toEmail,
      ...buildCertificateAccessEmail({ toName, accessUrl }),
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error('[smtp][certificate-access]', error);
    return res.status(500).json({ error: 'Failed to send the email right now.' });
  }
});

app.post('/api/email/certificate-notification', async (req, res) => {
  try {
    const admin = await requireAdminRequest(req);
    if (!admin.ok) {
      return res.status(admin.status).json({ error: admin.error });
    }

    // OWASP A03: Sanitize inputs
    const toEmail = sanitizeEmail(req.body?.toEmail);
    const toName = sanitizeName(req.body?.toName || '');
    const certificateName = sanitizeName(req.body?.certificateName || '');
    const accessUrl = req.body?.accessUrl ? sanitizeUrl(req.body.accessUrl) : '';

    if (!toEmail) {
      return res.status(400).json({ error: 'A valid toEmail is required.' });
    }

    await sendMail({
      to: toEmail,
      ...buildCertificateNotificationEmail({ toName, certificateName, accessUrl }),
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error('[smtp][certificate-notification]', error);
    return res.status(500).json({ error: 'Failed to send the email right now.' });
  }
});

// ---------------------------------------------------------------------------
// 404 catch-all — don't reveal internal routes (OWASP A05)
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err, _req, res, next) => {
  void next;
  console.error('[server][unhandled]', err);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

app.listen(port, () => {
  console.log(`SMTP mail server listening on http://localhost:${port}`);
});
