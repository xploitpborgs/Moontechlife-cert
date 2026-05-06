import { sendMail } from '../_mail.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { toEmail, toName, otpCode } = req.body || {};
  if (!toEmail || !otpCode) {
    return res.status(400).json({ error: 'toEmail and otpCode are required.' });
  }

  const safeName = `${toName || 'Learner'}`.trim() || 'Learner';
  const safeCode = `${otpCode}`.trim();

  try {
    await sendMail({
      to: toEmail,
      subject: 'Your MoonTech Life certificate verification code',
      text: `Hello ${safeName},\n\nYour certificate verification code is ${safeCode}.\nIt expires in 10 minutes.\n\nMoonTech Life Community`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #223630;">
          <p>Hello ${safeName},</p>
          <p>Your certificate verification code is:</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">${safeCode}</p>
          <p>It expires in 10 minutes.</p>
          <p>MoonTech Life Community</p>
        </div>
      `,
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error('[smtp][otp]', error);
    return res.status(500).json({ error: error?.message || 'Failed to send OTP email.' });
  }
}
