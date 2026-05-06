import { sendMail } from '../_mail.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { toEmail } = req.body || {};
  if (!toEmail) {
    return res.status(400).json({ error: 'toEmail is required.' });
  }

  try {
    await sendMail({
      to: toEmail,
      subject: 'Brevo SMTP test email',
      text: 'This is a test email from the MoonTech Life Community certificate system.',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #223630;">
          <p>This is a test email from the MoonTech Life Community certificate system.</p>
          <p>Brevo SMTP is configured and working.</p>
        </div>
      `,
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error('[smtp][test]', error);
    return res.status(500).json({ error: error?.message || 'Failed to send test email.' });
  }
}
