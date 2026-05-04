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
  const [emailError, setEmailError] = useState('');
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
          <span className="logo-text">MoonTech<span className="logo-accent">Life</span></span>
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

  // --- Auth flow rendering ---
  return (
    <div className="app-bg">
      <header className="site-header">
        <span className="logo-text">MoonTech<span className="logo-accent">Life</span></span>
      </header>
      <main className="main-content centered">
        {screen === 'email' && (
          <EmailStep
            onSuccess={(info, didEmailFail, errMsg, isAlreadyGenerated) => {
              if (isAlreadyGenerated) {
                setCertData(info); // 'info' is the {student, blob, dataUrl} object in this case
                setScreen('cert');
              } else {
                setStudentInfo(info);
                setEmailFailed(!!didEmailFail);
                setEmailError(errMsg || '');
                setScreen('otp');
              }
            }}
          />
        )}

        {screen === 'otp' && studentInfo && (
          <OTPStep
            email={studentInfo.email}
            name={studentInfo.name}
            emailFailed={emailFailed}
            emailError={emailError}
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
