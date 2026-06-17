import { buildOtpEmail, sendMail } from '../_mail.js';
import { requireAdminRequest } from '../_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdminRequest(req);
  if (!admin.ok) {
    return res.status(admin.status).json({ error: admin.error });
  }

  const { toEmail, toName, otpCode } = req.body || {};
  if (!toEmail || !otpCode) {
    return res.status(400).json({ error: 'toEmail and otpCode are required.' });
  }

  try {
    await sendMail({
      to: toEmail,
      ...buildOtpEmail({ toName, otpCode }),
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error('[smtp][otp]', error);
    return res.status(500).json({ error: 'Failed to send the email right now.' });
  }
}
