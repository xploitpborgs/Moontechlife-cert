import { useState } from 'react';
import supabase from '../supabase';
import { generateOTP, sendOTPEmail } from '../utils/otp';
import {
  generateCertificateBlob,
  isCertificateVerifiedInBrowser,
  markCertificateVerifiedInBrowser,
} from '../utils/cert';

export default function EmailStep({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return setError('Please enter your email address.');

    setLoading(true);
    try {
      // 1. Look up student by email
      const { data: students, error: fetchErr } = await supabase
        .from('students')
        .select('*')
        .eq('email', trimmed)
        .limit(1);

      if (fetchErr) {
        throw new Error(`Database error: ${fetchErr.message}`);
      }
      if (!students || students.length === 0) {
        setError('No student record found for this email address.');
        setLoading(false);
        return;
      }

      const student = students[0];
      
      const isVerifiedInDatabase = Boolean(student.otp_verified);
      const isVerifiedInBrowser = isCertificateVerifiedInBrowser(student);

      if (isVerifiedInDatabase || isVerifiedInBrowser) {
        setLoading(true);
        try {
          const { blob, dataUrl, renderBundle } = await generateCertificateBlob(student);
          markCertificateVerifiedInBrowser(student);
          onSuccess({ student, blob, dataUrl, renderBundle }, false, '', true);
          return;
        } catch (err) {
          console.error('Verified certificate fast-path failed:', err);
        } finally {
          setLoading(false);
        }
      }

      const code = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // 2. Save OTP to database
      const { error: insertErr } = await supabase.from('otp_codes').insert({
        email: trimmed,
        code,
        expires_at: expiresAt,
        used: false,
      });
      if (insertErr) {
        throw new Error(`Failed to create OTP: ${insertErr.message}`);
      }

      // 3. Send email — non-fatal so user can still proceed even if SMTP isn't configured
      let emailFailed = false;
      let emailError = '';
      try {
        await sendOTPEmail(trimmed, student.full_name, code);
      } catch (emailErr) {
        console.error('SMTP full error object:', emailErr);
        emailFailed = true;
        if (emailErr?.text) {
          emailError = `[${emailErr.status}] ${emailErr.text}`;
        } else if (emailErr?.message) {
          emailError = emailErr.message;
        } else {
          try { emailError = JSON.stringify(emailErr); } catch { emailError = String(emailErr); }
        }
      }

      // Advance to OTP screen regardless of email delivery
      onSuccess({ email: trimmed, name: student.full_name, student }, emailFailed, emailError);
    } catch (err) {
      console.error('EmailStep error:', err);
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
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={loading}
            autoComplete="email"
          />
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={loading || !email}
        >
          {loading ? <span className="spinner" /> : 'Send Verification Code'}
        </button>
      </form>
    </div>
  );
}
