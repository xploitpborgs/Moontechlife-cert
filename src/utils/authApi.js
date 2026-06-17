// ---------------------------------------------------------------------------
// CSRF token management
// The server issues a short-lived HMAC token. We cache it and refresh it
// if we receive a 403 with a CSRF-related error.
// ---------------------------------------------------------------------------
let _csrfToken = null;
let _csrfFetchPromise = null;

async function fetchCsrfToken() {
  // Deduplicate concurrent fetches
  if (_csrfFetchPromise) return _csrfFetchPromise;

  _csrfFetchPromise = fetch('/api/csrf-token', { method: 'GET' })
    .then(async (res) => {
      if (!res.ok) throw new Error('Failed to fetch CSRF token');
      const data = await res.json();
      _csrfToken = data.csrfToken;
      return _csrfToken;
    })
    .finally(() => {
      _csrfFetchPromise = null;
    });

  return _csrfFetchPromise;
}

async function getCsrfToken() {
  if (_csrfToken) return _csrfToken;
  return fetchCsrfToken();
}

function invalidateCsrfToken() {
  _csrfToken = null;
}

// ---------------------------------------------------------------------------
// Error reading helper
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Core POST helper — includes CSRF token, retries once if token is stale
// ---------------------------------------------------------------------------
async function postAuth(path, payload, retrying = false) {
  const csrfToken = await getCsrfToken();

  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(payload),
  });

  // If we get a 403 and haven't retried yet, the CSRF token may be stale —
  // refresh it and try once more.
  if (response.status === 403 && !retrying) {
    invalidateCsrfToken();
    return postAuth(path, payload, true);
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json().catch(() => ({}));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate email format on the client before making a network call.
 * Mirrors the server-side regex to give instant feedback.
 */
export function isValidEmail(email) {
  return /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/.test(
    String(email || '').trim().toLowerCase(),
  );
}

export async function requestCertificateOtp(email) {
  return postAuth('/api/auth/request-otp', { email });
}

export async function verifyCertificateOtp(email, otp) {
  return postAuth('/api/auth/verify-otp', { email, otp });
}
