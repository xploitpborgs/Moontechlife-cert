import { sendOtpEmail } from './mailApi';

/**
 * Generates a 6-digit numeric OTP string.
 * @returns {string}
 */
export function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeEmailError(error) {
  const message = `${error?.message || error || ''}`.trim();
  if (!message || message.toLowerCase() === 'failed to fetch') {
    return 'Unable to reach the email server.';
  }
  return message;
}

/**
 * Sends an OTP email via the backend SMTP server.
 * @param {string} toEmail
 * @param {string} toName
 * @param {string} otpCode
 * @returns {Promise<void>}
 */
export async function sendOTPEmail(toEmail, toName, otpCode) {
  try {
    await sendOtpEmail(toEmail, toName, otpCode);
  } catch (error) {
    throw new Error(normalizeEmailError(error), { cause: error });
  }
}
