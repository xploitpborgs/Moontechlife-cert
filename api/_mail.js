import nodemailer from 'nodemailer';

const { process } = globalThis;

function stripUnsafeControlCharacters(value) {
  return Array.from(`${value ?? ''}`)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code !== 0 && !(code < 32 && ![9, 10, 13].includes(code)) && code !== 127;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// XSS / Injection helpers
// ---------------------------------------------------------------------------

/**
 * Escape all HTML special characters.
 * Used for ANY user-supplied value inserted into HTML email bodies.
 * Covers the full OWASP XSS encoding set.
 */
function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;')
    .replaceAll('`', '&#x60;')
    .replaceAll('/', '&#x2F;');
}

/**
 * Normalise a plain-text value and enforce a max length.
 * Strips null bytes and control characters (OWASP A03).
 */
function normalizeText(value, fallback = '') {
  const cleaned = stripUnsafeControlCharacters(value)
    .trim()
    .slice(0, 500);
  return cleaned || fallback;
}

/**
 * Validate a URL is http/https before using it in an href attribute.
 * Returns an empty string if the URL is unsafe (javascript:, data:, etc.).
 * Prevents href-injection XSS (OWASP A03).
 */
function safeUrl(value) {
  const raw = normalizeText(value).slice(0, 2048);
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return raw;
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Transporter
// ---------------------------------------------------------------------------

export function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE === 'true',
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export function getFromAddress() {
  const fromEmail = process.env.FROM_EMAIL;
  const fromName = process.env.FROM_NAME || 'MoonTech Life Community';
  return `${fromName} <${fromEmail}>`;
}

export async function sendMail({ to, subject, text, html }) {
  const transporter = getTransporter();
  return transporter.sendMail({ from: getFromAddress(), to, subject, text, html });
}

// ---------------------------------------------------------------------------
// Email builders — all user data is escaped before insertion into HTML
// ---------------------------------------------------------------------------

export function buildOtpEmail({ toName, otpCode }) {
  const safeName = escapeHtml(normalizeText(toName, 'Learner'));
  // OTP is always 6 digits from randomInt — escape is belt-and-suspenders
  const safeCode = escapeHtml(normalizeText(otpCode).replace(/\D/g, '').slice(0, 6));

  return {
    subject: 'Your MoonTech Life certificate verification code',
    text: `Hello ${normalizeText(toName, 'Learner')},\n\nYour certificate verification code is ${normalizeText(otpCode)}.\nIt expires in 10 minutes.\n\nMoonTech Life Community`,
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

export function buildTestEmail() {
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

export function buildCertificateAccessEmail({ toName, accessUrl }) {
  const safeName = escapeHtml(normalizeText(toName, 'Learner'));
  // Validate URL before placing in href — prevents href-injection XSS
  const validatedUrl = safeUrl(accessUrl);
  const safeDisplayUrl = escapeHtml(validatedUrl);

  return {
    subject: 'Access your MoonTech Life certificate',
    text: `Hello ${normalizeText(toName, 'Learner')},\n\nYour certificate is ready. Access it here:\n${validatedUrl}\n\nMoonTech Life Community`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #223630;">
        <p>Hello ${safeName},</p>
        <p>Your certificate is ready. Access it here:</p>
        ${validatedUrl
          ? `<p><a href="${safeDisplayUrl}" rel="noopener noreferrer">${safeDisplayUrl}</a></p>`
          : '<p>(Link unavailable — please contact support.)</p>'}
        <p>MoonTech Life Community</p>
      </div>
    `,
  };
}

export function buildCertificateNotificationEmail({ toName, certificateName, accessUrl }) {
  const safeName = escapeHtml(normalizeText(toName, 'Learner'));
  const safeCertName = escapeHtml(normalizeText(certificateName, 'your certificate'));
  const validatedUrl = safeUrl(accessUrl);
  const safeDisplayUrl = escapeHtml(validatedUrl);

  return {
    subject: 'Your certificate notification',
    text: `Hello ${normalizeText(toName, 'Learner')},\n\n${normalizeText(certificateName, 'your certificate')} is available.${validatedUrl ? `\nAccess it here: ${validatedUrl}\n\n` : '\n\n'}MoonTech Life Community`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #223630;">
        <p>Hello ${safeName},</p>
        <p>${safeCertName} is available.</p>
        ${validatedUrl
          ? `<p><a href="${safeDisplayUrl}" rel="noopener noreferrer">${safeDisplayUrl}</a></p>`
          : ''}
        <p>MoonTech Life Community</p>
      </div>
    `,
  };
}
