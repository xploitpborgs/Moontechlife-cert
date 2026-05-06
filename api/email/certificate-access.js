import { sendMail } from '../_mail.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { toEmail, toName, accessUrl } = req.body || {};
  if (!toEmail || !accessUrl) {
    return res.status(400).json({ error: 'toEmail and accessUrl are required.' });
  }

  const safeName = `${toName || 'Learner'}`.trim() || 'Learner';
  const safeUrl = `${accessUrl}`.trim();

  try {
    await sendMail({
      to: toEmail,
      subject: 'Access your MoonTech Life certificate',
      text: `Hello ${safeName},\n\nYour certificate is ready. Access it here:\n${safeUrl}\n\nMoonTech Life Community`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #223630;">
          <p>Hello ${safeName},</p>
          <p>Your certificate is ready. Access it here:</p>
          <p><a href="${safeUrl}">${safeUrl}</a></p>
          <p>MoonTech Life Community</p>
        </div>
      `,
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error('[smtp][certificate-access]', error);
    return res.status(500).json({ error: error?.message || 'Failed to send certificate access email.' });
  }
}
