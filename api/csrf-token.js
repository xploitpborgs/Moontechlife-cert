import { generateCsrfToken, securityHeadersMiddleware } from './_security.js';

export default function handler(req, res) {
  securityHeadersMiddleware(req, res, () => {});

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const csrfToken = generateCsrfToken();
  return res.json({ csrfToken });
}
