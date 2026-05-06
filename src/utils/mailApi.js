async function readErrorMessage(response) {
  try {
    const payload = await response.json();
    return payload?.error || payload?.message || `Request failed with ${response.status}`;
  } catch {
    try {
      return await response.text();
    } catch {
      return `Request failed with ${response.status}`;
    }
  }
}

async function postMail(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json().catch(() => ({}));
}

export async function sendOtpEmail(toEmail, toName, otpCode) {
  return postMail('/api/email/otp', {
    toEmail,
    toName,
    otpCode,
  });
}

export async function sendTestEmail(toEmail) {
  return postMail('/api/email/test', {
    toEmail,
  });
}

export async function sendCertificateAccessEmail(payload) {
  return postMail('/api/email/certificate-access', payload);
}

export async function sendCertificateNotificationEmail(payload) {
  return postMail('/api/email/certificate-notification', payload);
}
