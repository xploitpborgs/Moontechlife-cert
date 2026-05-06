import supabase from '../supabase';

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

async function getAdminHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };

  const { data } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token;
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function postMail(path, payload, { requireAdmin = false } = {}) {
  const response = await fetch(path, {
    method: 'POST',
    headers: requireAdmin ? await getAdminHeaders() : { 'Content-Type': 'application/json' },
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
  }, { requireAdmin: true });
}

export async function sendCertificateAccessEmail(payload) {
  return postMail('/api/email/certificate-access', payload, { requireAdmin: true });
}

export async function sendCertificateNotificationEmail(payload) {
  return postMail('/api/email/certificate-notification', payload, { requireAdmin: true });
}
