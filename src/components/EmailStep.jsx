import { useState } from 'react';
import { generateCertificateBlob } from '../utils/cert';
import { requestCertificateOtp, isValidEmail } from '../utils/authApi';

export default function EmailStep({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [multiStudents, setMultiStudents] = useState(null);

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
        // If the student has been verified in more than one cohort, show a picker
        const allStudents = response.students || [response.student];
        const verifiedStudents = allStudents.filter((s) => s.otp_verified);

        if (verifiedStudents.length > 1) {
          setMultiStudents(verifiedStudents);
          setLoading(false);
          return;
        }

        try {
          const { blob, dataUrl, renderBundle } = await generateCertificateBlob(response.student);
          onSuccess({ student: response.student, students: allStudents, blob, dataUrl, renderBundle }, false, true);
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

  async function handlePickCohort(student) {
    setLoading(true);
    setError('');
    try {
      const { blob, dataUrl, renderBundle } = await generateCertificateBlob(student);
      onSuccess({ student, students: multiStudents, blob, dataUrl, renderBundle }, false, true);
    } catch (err) {
      console.error('Cohort pick failed:', err);
      setError('Failed to load that certificate. Please try again.');
      setLoading(false);
    }
  }

  // --- Multi-cohort picker (shown when a student completed both programmes) ---
  if (multiStudents) {
    const cohortMeta = {
      '100day': { label: '100-Day Tech Challenge', icon: '🏆' },
      '4week':  { label: '4-Week Cohort',          icon: '📅' },
    };

    return (
      <div className="card">
        <div className="card-icon">🎓</div>
        <h1 className="card-title">You have multiple certificates</h1>
        <p className="card-subtitle">
          Which certificate would you like to access?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
          {multiStudents.map((student) => {
            const cohortType = student.cohort_type || '100day';
            const meta = cohortMeta[cohortType] || { label: cohortType, icon: '📜' };
            return (
              <button
                key={student.id || student.cert_token}
                className="btn btn-primary btn-block"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}
                onClick={() => handlePickCohort(student)}
                type="button"
                disabled={loading}
              >
                <span>{meta.icon}</span>
                <span>
                  {meta.label}
                  {student.course ? ` — ${student.course}` : ''}
                </span>
              </button>
            );
          })}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <span className="spinner" />
          </div>
        )}
        {error && <p className="error-msg" role="alert">{error}</p>}
      </div>
    );
  }

  // --- Default: email entry screen ---
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
