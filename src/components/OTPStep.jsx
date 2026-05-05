import { useState, useEffect, useRef, useCallback } from 'react';
import supabase from '../supabase';
import { generateCertificateBlob, markCertificateVerifiedInBrowser } from '../utils/cert';
import { resolveStudentCourseContext } from '../utils/certificateDesigner';
import { generateOTP, sendOTPEmail } from '../utils/otp';

const RESEND_SECONDS = 60;

export default function OTPStep({ email, name, onSuccess, onBack, emailFailed, emailError }) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
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
      const now = new Date().toISOString();

      // Validate OTP
      const { data: rows, error: fetchErr } = await supabase
        .from('otp_codes')
        .select('id, code, expires_at, used')
        .eq('email', email)
        .eq('code', otp)
        .eq('used', false)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchErr) throw fetchErr;
      if (!rows || rows.length === 0) {
        setError('Invalid or expired code. Please try again.');
        setLoading(false);
        return;
      }

      const otpRow = rows[0];

      // Mark OTP used
      await supabase.from('otp_codes').update({ used: true }).eq('id', otpRow.id);

      // Load student
      const { data: students, error: stuErr } = await supabase
        .from('students')
        .select('*')
        .eq('email', email)
        .limit(1);
      if (stuErr) throw stuErr;
      const student = students[0];

      const certGeneratedAt = new Date().toISOString();
      const courseContext = await resolveStudentCourseContext(student);
      const verifiedUpdate = {
        cert_generated_at: student.cert_generated_at || certGeneratedAt,
        otp_verified: true,
        otp_verified_at: certGeneratedAt,
        otp_verified_by_email: email,
        course_name_snapshot: courseContext.courseName || student.course_name_snapshot || student.course || '',
        facilitator_name_snapshot: courseContext.facilitatorName || student.facilitator_name_snapshot || '',
        facilitator_title_snapshot: courseContext.facilitatorTitle || student.facilitator_title_snapshot || '',
      };

      await supabase
        .from('students')
        .update(verifiedUpdate)
        .eq('id', student.id);

      Object.assign(student, verifiedUpdate);
      markCertificateVerifiedInBrowser(student);

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
    try {
      const code = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await supabase.from('otp_codes').insert({ email, code, expires_at: expiresAt, used: false });
      await sendOTPEmail(email, name, code);
      setCountdown(RESEND_SECONDS);
      setOtp('');
    } catch {
      setError('Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="card">
      <button className="btn-back" onClick={onBack} aria-label="Go back">← Back</button>
      <div className="card-icon">✉️</div>
      <h1 className="card-title">Check Your Email</h1>

      {emailFailed ? (
        <p className="warn-msg">
          ⚠️ Email delivery failed{emailError ? `: "${emailError}"` : ''}.{' '}
          The OTP code was saved to Supabase — look in the <code>otp_codes</code> table for your code, or fix the EmailJS config and resend below.
        </p>
      ) : (
        <p className="card-subtitle">
          We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
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
        />
      </div>

      {error && <p className="error-msg">{error}</p>}

      <button className="btn-primary" onClick={handleVerify} disabled={loading || otp.length !== 6}>
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
