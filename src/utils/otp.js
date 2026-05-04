import emailjs from '@emailjs/browser';
import { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY } from '../config';

const EMAILJS_SEND_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

/**
 * Generates a 6-digit numeric OTP string.
 * @returns {string}
 */
export function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function ensureEmailJsConfig() {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    throw new Error('Email delivery is not configured yet.');
  }
}

async function sendOtpViaRestApi(toEmail, toName, otpCode) {
  const response = await fetch(EMAILJS_SEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email: toEmail,
        to_name: toName,
        otp_code: otpCode,
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `EmailJS REST ${response.status}`);
  }
}

function normalizeEmailError(error) {
  const message = `${error?.text || error?.message || error || ''}`.trim();
  if (!message || message.toLowerCase() === 'failed to fetch') {
    return 'Unable to reach the email service from this browser.';
  }
  return message;
}

/**
 * Sends an OTP email via EmailJS.
 * @param {string} toEmail
 * @param {string} toName
 * @param {string} otpCode
 * @returns {Promise<void>}
 */
export async function sendOTPEmail(toEmail, toName, otpCode) {
  ensureEmailJsConfig();

  try {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });

    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        to_email: toEmail,
        to_name: toName,
        otp_code: otpCode,
      },
    );

    if (response.status !== 200) {
      throw new Error(`EmailJS ${response.status}: ${response.text}`);
    }
  } catch (sdkError) {
    try {
      await sendOtpViaRestApi(toEmail, toName, otpCode);
    } catch (restError) {
      throw new Error(
        normalizeEmailError(restError) || normalizeEmailError(sdkError),
        { cause: restError },
      );
    }
  }
}
