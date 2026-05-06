import nodemailer from 'nodemailer';

export function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE === 'true',
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
