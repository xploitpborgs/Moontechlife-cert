import { requestOtpChallenge } from '../_otp.js';
import { getRequestIp, securityHeadersMiddleware, csrfMiddleware } from '../_security.js';

export default async function handler(req, res) {
  // Apply security headers
  securityHeadersMiddleware(req, res, () => {});

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CSRF validation
  const csrfRejection = await new Promise((resolve) => {
    csrfMiddleware(req, res, () => resolve(null));
  });
  if (csrfRejection !== null) return; // response already sent by middleware

  try {
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
}
