import { sendOtpEmail } from './mailApi';

/**
 * Generates a 6-digit numeric OTP string.
 * @returns {string}
 */
export function generateOTP() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure OTP generation is unavailable in this environment.');
  }

  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return String(100000 + (buffer[0] % 900000));
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
