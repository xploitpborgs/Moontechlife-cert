import { useState, useEffect } from 'react';
import supabase from './supabase';
import { generateCertificateBlob } from './utils/cert';
import EmailStep from './components/EmailStep';
import OTPStep from './components/OTPStep';
import CertView from './components/CertView';
import CertDesigner from './components/CertDesigner';

function getInitialRoute() {
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';

  if (params.get('design') || pathname === '/designer' || pathname === '/certificate-designer') {
    return { screen: 'design', token: null };
  }

  const verifyMatch = pathname.match(/^\/verify\/([^/]+)$/);
  return {
    screen: verifyMatch?.[1] || params.get('cert') ? 'public' : 'email',
    token: verifyMatch?.[1] || params.get('cert'),
  };
}

export default function App() {
  const initialRoute = getInitialRoute();
  const [screen, setScreen] = useState(initialRoute.screen);
  const [studentInfo, setStudentInfo] = useState(null);
  const [emailFailed, setEmailFailed] = useState(false);
  const [certData, setCertData] = useState(null);
  const [publicLoading, setPublicLoading] = useState(initialRoute.screen === 'public');
  const [publicError, setPublicError] = useState('');

  // Check for public cert link on mount
  useEffect(() => {
    if (screen !== 'public' || !initialRoute.token) {
      return;
    }

    (async () => {
      try {
        const { data: students, error } = await supabase
          .from('students')
          .select('*')
          .eq('cert_token', initialRoute.token)
          .limit(1);

        if (error) throw error;
        if (!students || students.length === 0) {
          setPublicError('Certificate not found.');
          return;
        }

        const student = students[0];
        if (!student.cert_generated_at) {
          setPublicError('This certificate has not been generated yet.');
          return;
        }

        const { blob, dataUrl, renderBundle } = await generateCertificateBlob(student);
        setCertData({ student, blob, dataUrl, renderBundle });
      } catch (err) {
        console.error(err);
        setPublicError(err.message || 'Failed to load certificate.');
      } finally {
        setPublicLoading(false);
      }
    })();
  }, [initialRoute.token, screen]);

  // --- Designer route rendering ---
  if (screen === 'design') return <CertDesigner />;

  // --- Public route rendering ---
  if (screen === 'public') {
    return (
      <div className="app-bg">
        <header className="site-header">
          <div className="header-container">
            <span className="logo-text">MoonTech<span className="logo-accent">Life</span></span>
            <a href="/" className="header-signout" title="Go to Portal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>Go to Portal</span>
            </a>
          </div>
        </header>
        <main className="main-content">
          {publicLoading && (
            <div className="centered-spinner">
              <span className="spinner large" />
              <p className="loading-text">Loading certificate…</p>
            </div>
          )}
          {publicError && (
            <div className="card error-card">
              <div className="card-icon">⚠️</div>
              <h1 className="card-title">Certificate Not Found</h1>
              <p className="card-subtitle">{publicError}</p>
            </div>
          )}
          {certData && !publicLoading && (
            <CertView
              student={certData.student}
              dataUrl={certData.dataUrl}
              blob={certData.blob}
              renderBundle={certData.renderBundle}
              isPublic
            />
          )}
        </main>
      </div>
    );
  }

  const handleSignOut = () => {
    setScreen('email');
    setStudentInfo(null);
    setCertData(null);
  };

  // --- Auth flow rendering ---
  return (
    <div className="app-bg">
      <header className="site-header">
        <div className="header-container">
          <span className="logo-text">MoonTech<span className="logo-accent">Life</span></span>
          {(screen === 'otp' || screen === 'cert') && (
            <button className="header-signout" onClick={handleSignOut} title="Sign Out">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </header>
      <main className="main-content centered">
        {screen === 'email' && (
          <EmailStep
            onSuccess={(info, didEmailFail, isAlreadyGenerated) => {
              if (isAlreadyGenerated) {
                setCertData(info); // 'info' is the {student, blob, dataUrl} object in this case
                setScreen('cert');
              } else {
                setStudentInfo(info);
                setEmailFailed(!!didEmailFail);
                setScreen('otp');
              }
            }}
          />
        )}

        {screen === 'otp' && studentInfo && (
          <OTPStep
            email={studentInfo.email}
            emailFailed={emailFailed}
            onSuccess={(data) => {
              setCertData(data);
              setScreen('cert');
            }}
            onBack={() => setScreen('email')}
          />
        )}

        {screen === 'cert' && certData && (
          <CertView
            student={certData.student}
            dataUrl={certData.dataUrl}
            blob={certData.blob}
            renderBundle={certData.renderBundle}
            isPublic={false}
          />
        )}
      </main>
    </div>
  );
}
