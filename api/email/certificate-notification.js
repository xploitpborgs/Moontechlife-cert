import { sendMail } from '../_mail.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { toEmail, toName, certificateName, accessUrl } = req.body || {};
  if (!toEmail) {
    return res.status(400).json({ error: 'toEmail is required.' });
  }

  const safeName = `${toName || 'Learner'}`.trim() || 'Learner';
  const safeCert = `${certificateName || 'your certificate'}`.trim();
  const safeUrl = `${accessUrl || ''}`.trim();

  try {
    await sendMail({
      to: toEmail,
      subject: 'Your certificate notification',
      text: `Hello ${safeName},\n\n${safeCert} is available.\n${safeUrl ? `Access it here: ${safeUrl}\n\n` : ''}MoonTech Life Community`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #223630;">
          <p>Hello ${safeName},</p>
          <p>${safeCert} is available.</p>
          ${safeUrl ? `<p><a href="${safeUrl}">${safeUrl}</a></p>` : ''}
          <p>MoonTech Life Community</p>
        </div>
      `,
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error('[smtp][certificate-notification]', error);
    return res.status(500).json({ error: error?.message || 'Failed to send certificate notification email.' });
  }
}
