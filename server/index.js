import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';

const { process } = globalThis;
const app = express();
const port = Number(process.env.PORT || 8787);

app.use(express.json({ limit: '1mb' }));

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function getTransporter() {
  return nodemailer.createTransport({
    host: requireEnv('SMTP_HOST'),
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: requireEnv('SMTP_USER'),
      pass: requireEnv('SMTP_PASS'),
    },
  });
}

function getFromAddress() {
  const fromEmail = requireEnv('FROM_EMAIL');
  const fromName = process.env.FROM_NAME || 'MoonTech Life Community';
  return `${fromName} <${fromEmail}>`;
}

async function sendMail({ to, subject, text, html }) {
  const transporter = getTransporter();
  return transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });
}

function buildOtpEmail({ toName, otpCode }) {
  const safeName = `${toName || 'Learner'}`.trim() || 'Learner';
  const safeCode = `${otpCode || ''}`.trim();

  return {
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
  };
}

function buildTestEmail() {
  return {
    subject: 'Brevo SMTP test email',
    text: 'This is a test email from the MoonTech Life Community certificate system.',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #223630;">
        <p>This is a test email from the MoonTech Life Community certificate system.</p>
        <p>Brevo SMTP is configured and working.</p>
      </div>
    `,
  };
}

function buildCertificateAccessEmail({ toName, accessUrl }) {
  const safeName = `${toName || 'Learner'}`.trim() || 'Learner';
  const safeUrl = `${accessUrl || ''}`.trim();

  return {
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
  };
}

function buildCertificateNotificationEmail({ toName, certificateName, accessUrl }) {
  const safeName = `${toName || 'Learner'}`.trim() || 'Learner';
  const safeCertificateName = `${certificateName || 'your certificate'}`.trim();
  const safeUrl = `${accessUrl || ''}`.trim();

  return {
    subject: 'Your certificate notification',
    text: `Hello ${safeName},\n\n${safeCertificateName} is available.\n${safeUrl ? `Access it here: ${safeUrl}\n\n` : ''}MoonTech Life Community`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #223630;">
        <p>Hello ${safeName},</p>
        <p>${safeCertificateName} is available.</p>
        ${safeUrl ? `<p><a href="${safeUrl}">${safeUrl}</a></p>` : ''}
        <p>MoonTech Life Community</p>
      </div>
    `,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/email/otp', async (req, res) => {
  try {
    const { toEmail, toName, otpCode } = req.body || {};
    if (!toEmail || !otpCode) {
      return res.status(400).json({ error: 'toEmail and otpCode are required.' });
    }

    await sendMail({
      to: toEmail,
      ...buildOtpEmail({ toName, otpCode }),
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('[smtp][otp]', error);
    return res.status(500).json({ error: error?.message || 'Failed to send OTP email.' });
  }
});

app.post('/api/email/test', async (req, res) => {
  try {
    const { toEmail } = req.body || {};
    if (!toEmail) {
      return res.status(400).json({ error: 'toEmail is required.' });
    }

    await sendMail({
      to: toEmail,
      ...buildTestEmail(),
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('[smtp][test]', error);
    return res.status(500).json({ error: error?.message || 'Failed to send test email.' });
  }
});

app.post('/api/email/certificate-access', async (req, res) => {
  try {
    const { toEmail, toName, accessUrl } = req.body || {};
    if (!toEmail || !accessUrl) {
      return res.status(400).json({ error: 'toEmail and accessUrl are required.' });
    }

    await sendMail({
      to: toEmail,
      ...buildCertificateAccessEmail({ toName, accessUrl }),
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('[smtp][certificate-access]', error);
    return res.status(500).json({ error: error?.message || 'Failed to send certificate access email.' });
  }
});

app.post('/api/email/certificate-notification', async (req, res) => {
  try {
    const { toEmail, toName, certificateName, accessUrl } = req.body || {};
    if (!toEmail) {
      return res.status(400).json({ error: 'toEmail is required.' });
    }

    await sendMail({
      to: toEmail,
      ...buildCertificateNotificationEmail({ toName, certificateName, accessUrl }),
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('[smtp][certificate-notification]', error);
    return res.status(500).json({ error: error?.message || 'Failed to send certificate notification email.' });
  }
});

app.listen(port, () => {
  console.log(`SMTP mail server listening on http://localhost:${port}`);
});
