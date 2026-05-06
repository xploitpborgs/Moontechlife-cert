import { useState, useEffect, useRef, useCallback } from 'react';
import { generateCertificateBlob } from '../utils/cert';
import { requestCertificateOtp, verifyCertificateOtp } from '../utils/authApi';

const RESEND_SECONDS = 60;

export default function OTPStep({ email, onSuccess, onBack, emailFailed }) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const interval = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleVerify = useCallback(async () => {
    setError('');
    if (otp.length !== 6) return setError('Enter all 6 digits.');
    setLoading(true);
    try {
      const response = await verifyCertificateOtp(email, otp);
      const student = response?.student;
      if (!student) {
        throw new Error('Verification failed. Please try again.');
      }
      const { blob, dataUrl, renderBundle } = await generateCertificateBlob(student);
      onSuccess({ student, blob, dataUrl, renderBundle });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [otp, email, onSuccess]);

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleVerify();
  }

  function handleChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(val);
    setError('');
  }

  async function handleResend() {
    setResending(true);
    setError('');
    setResendSuccess(false);
    try {
      const response = await requestCertificateOtp(email);

      if (response?.alreadyVerified && response?.student) {
        const { blob, dataUrl, renderBundle } = await generateCertificateBlob(response.student);
        onSuccess({ student: response.student, blob, dataUrl, renderBundle });
        return;
      }

      if (!response?.emailDispatched) {
        // The server returned ok:false with an error message when delivery fails
        setError(
          response?.error ||
          'We could not send your verification code right now. Please try again in a moment.',
        );
        return;
      }

      setCountdown(RESEND_SECONDS);
      setOtp('');
      setResendSuccess(true);
    } catch (err) {
      // err.message comes from the server's JSON error field via authApi
      setError(
        err.message ||
        'We could not send your verification code right now. Please try again in a moment.',
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="card">
      <button className="btn-back" onClick={onBack} aria-label="Go back">← Back</button>
      <div className="card-icon">✉️</div>
      <h1 className="card-title">Check Your Email</h1>

      {/* Email dispatch failure warning (shown when initial send failed) */}
      {emailFailed ? (
        <p className="warn-msg" role="alert">
          ⚠️ We could not send your verification code right now. Please use the
          resend option below or try again in a moment.
        </p>
      ) : (
        <p className="card-subtitle">
          We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
        </p>
      )}

      {/* Resend success notice */}
      {resendSuccess && (
        <p className="success-msg" role="status">
          ✅ A new code has been sent to <strong>{email}</strong>.
        </p>
      )}

      <div className="field">
        <label htmlFor="otp-input">Verification Code</label>
        <input
          id="otp-input"
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={otp}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="000000"
          className="otp-input"
          disabled={loading}
          autoComplete="one-time-code"
          aria-describedby={error ? 'otp-error' : undefined}
        />
      </div>

      {error && (
        <p id="otp-error" className="error-msg" role="alert">
          {error}
        </p>
      )}

      <button
        className="btn-primary"
        onClick={handleVerify}
        disabled={loading || otp.length !== 6}
      >
        {loading ? <span className="spinner" /> : 'Verify & Get Certificate'}
      </button>

      <div className="resend-row">
        {countdown > 0 ? (
          <span className="resend-timer">Resend in {countdown}s</span>
        ) : (
          <button
            className="btn-link"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? 'Sending…' : 'Resend Code'}
          </button>
        )}
      </div>
    </div>
  );
}
