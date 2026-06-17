import { useState } from 'react';
import { generateCertificateBlob } from '../utils/cert';
import { requestCertificateOtp, isValidEmail } from '../utils/authApi';

export default function EmailStep({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const trimmed = email.trim().toLowerCase();

    // Client-side format check (OWASP A03: input validation)
    if (!trimmed) {
      return setError('Please enter your email address.');
    }
    if (!isValidEmail(trimmed)) {
      return setError('Please enter a valid email address (e.g. you@example.com).');
    }

    setLoading(true);
    try {
      const response = await requestCertificateOtp(trimmed);

      if (response?.alreadyVerified && response?.student) {
        try {
          const { blob, dataUrl, renderBundle } = await generateCertificateBlob(response.student);
          onSuccess({ student: response.student, blob, dataUrl, renderBundle }, false, true);
          return;
        } catch (err) {
          console.error('Verified certificate fast-path failed:', err);
        }
      }

      // emailDispatched=false means the server found the address but email
      // delivery failed — pass the failure flag so OTPStep can show a warning.
      onSuccess(
        { email: trimmed },
        !response?.emailDispatched,
      );
    } catch (err) {
      console.error('EmailStep error:', err);
      // Surface the server error message directly — it is already user-friendly.
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-icon">🎓</div>
      <h1 className="card-title">Access Your Certificate</h1>
      <p className="card-subtitle">
        Enter your registered email to receive a verification code.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="email-input">Email Address</label>
          <input
            id="email-input"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(''); // clear stale error on typing
            }}
            placeholder="you@example.com"
            disabled={loading}
            autoComplete="email"
            aria-describedby={error ? 'email-error' : undefined}
          />
        </div>

        {error && (
          <p id="email-error" className="error-msg" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={loading || !email.trim()}
        >
          {loading ? <span className="spinner" /> : 'Send Verification Code'}
        </button>
      </form>
    </div>
  );
}
