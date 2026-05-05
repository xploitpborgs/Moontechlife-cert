import { useEffect, useMemo, useState } from 'react';
import { APP_URL } from '../config';
import CertificateRenderer from './CertificateRenderer';
import {
  createQrDataUrl,
} from '../utils/certificateDesigner';
import { markCertificateVerifiedInBrowser } from '../utils/cert';

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(Number(value || 0) * factor) / factor;
}

function formatIssuedDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function CertView({ student, dataUrl, blob, isPublic, renderBundle }) {
  const [copied, setCopied] = useState(false);
  const [qrPreviewUrl, setQrPreviewUrl] = useState('');
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const showDebug = new URLSearchParams(window.location.search).get('debug') === '1';

  const appUrl = window.location.hostname === 'localhost'
    ? window.location.origin
    : APP_URL;

  const publicLink = `${appUrl}/verify/${student.cert_token}`;
  const verificationDetails = renderBundle?.courseContext || {
    courseName: student.course_name_snapshot || student.course || '',
    facilitatorName: student.facilitator_name_snapshot || '',
    facilitatorTitle: student.facilitator_title_snapshot || '',
    facilitators: student.facilitator_name_snapshot
      ? [{
          name: student.facilitator_name_snapshot,
          title: student.facilitator_title_snapshot || '',
        }]
      : [],
  };
  const facilitatorDisplay = verificationDetails.facilitatorName
    ? `${verificationDetails.facilitatorName}${verificationDetails.facilitatorTitle ? `, ${verificationDetails.facilitatorTitle}` : ''}`
    : '';

  useEffect(() => {
    let cancelled = false;

    async function buildQrPreview() {
      try {
        const dataUrlValue = await createQrDataUrl(
          renderBundle?.previewData?.verificationUrl || publicLink,
        );
        if (!cancelled) setQrPreviewUrl(dataUrlValue);
      } catch {
        if (!cancelled) setQrPreviewUrl('');
      }
    }

    buildQrPreview();
    return () => {
      cancelled = true;
    };
  }, [publicLink, renderBundle?.previewData?.verificationUrl]);

  useEffect(() => {
    if (student?.otp_verified) {
      markCertificateVerifiedInBrowser(student);
    }
  }, [student]);

  useEffect(() => {
    if (!renderBundle) return;

    console.info('[student-certificate-render]', {
      loadedLayoutSettings: renderBundle.layout,
      recipientNameSettings: renderBundle.layout?.recipient_name,
      descriptionTextSettings: renderBundle.layout?.description_text,
      qrCodeSettings: renderBundle.layout?.qr_code,
      studentCertificateData: renderBundle.student || student,
      previewData: renderBundle.previewData,
      layoutSource: renderBundle.layoutSource,
      layoutWarning: renderBundle.layoutWarning,
    });
  }, [renderBundle, student]);

  const debugLines = useMemo(() => {
    if (!renderBundle) return [];

    return [
      `layoutSource: ${renderBundle.layoutSource || 'unknown'}`,
      `layoutWarning: ${renderBundle.layoutWarning || '(none)'}`,
      `recipient_name: ${JSON.stringify(renderBundle.layout?.recipient_name || {}, null, 2)}`,
      `description_text: ${JSON.stringify(renderBundle.layout?.description_text || {}, null, 2)}`,
      `qr_code: ${JSON.stringify(renderBundle.layout?.qr_code || {}, null, 2)}`,
      `student: ${JSON.stringify(renderBundle.student || student || {}, null, 2)}`,
      `previewData: ${JSON.stringify(renderBundle.previewData || {}, null, 2)}`,
      `displayWidth: ${round(displaySize.width)}`,
      `displayHeight: ${round(displaySize.height)}`,
    ];
  }, [displaySize.height, displaySize.width, renderBundle, student]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = publicLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleDownload() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `certificate-${student.full_name.replace(/\s+/g, '-')}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="cert-wrapper">
      {!isPublic && (
        <div className="cert-header">
          <div className="cert-congrats">🎉 Congratulations, {student.full_name}!</div>
          <p className="cert-subtitle">Your certificate has been generated successfully.</p>
        </div>
      )}

      <div className="cert-image-container cert-renderer-container">
        {renderBundle ? (
          <CertificateRenderer
            templateImageUrl={renderBundle.templateUrl}
            elements={renderBundle.layout}
            previewData={renderBundle.previewData}
            displayWidth={displaySize.width || undefined}
            displayHeight={displaySize.height || undefined}
            qrDataUrl={qrPreviewUrl}
            onMeasure={setDisplaySize}
          />
        ) : (
          <img
            src={dataUrl}
            alt={`Certificate for ${student.full_name}`}
            className="cert-image"
          />
        )}
      </div>

      {showDebug && renderBundle && (
        <details className="cert-debug">
          <summary>Certificate Render Debug</summary>
          <div className="cert-debug-grid">
            {debugLines.map((line) => (
              <pre key={line} className="cert-debug-line">{line}</pre>
            ))}
          </div>
        </details>
      )}

      {isPublic && (
        <section className="cert-verify-card">
          <h2 className="cert-verify-title">Certificate Verification</h2>
          <div className="cert-verify-grid">
            <div className="cert-verify-row">
              <span>Recipient Name</span>
              <strong>{student.full_name}</strong>
            </div>
            <div className="cert-verify-row">
              <span>Course/Track</span>
              <strong>{verificationDetails.courseName || student.course || 'Not provided'}</strong>
            </div>
            {facilitatorDisplay && (
              <div className="cert-verify-row">
                <span>Facilitator</span>
                <strong>{facilitatorDisplay}</strong>
              </div>
            )}
            <div className="cert-verify-row">
              <span>Program</span>
              <strong>100-Day Tech Challenge</strong>
            </div>
            <div className="cert-verify-row">
              <span>Issued Date</span>
              <strong>{formatIssuedDate(student.cert_generated_at) || 'Not issued yet'}</strong>
            </div>
            <div className="cert-verify-row">
              <span>Certificate ID</span>
              <strong>{student.cert_token}</strong>
            </div>
            <div className="cert-verify-row">
              <span>Status</span>
              <strong>Valid</strong>
            </div>
          </div>
        </section>
      )}

      <div className="cert-actions">
        <div className="cert-link-box">
          <span className="cert-link-label">Public Certificate Link</span>
          <div className="cert-link-row">
            <span className="cert-link-url">{publicLink}</span>
            <button
              className="btn-copy"
              onClick={handleCopy}
              aria-label="Copy link"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {!isPublic && (
          <button className="btn-download" onClick={handleDownload}>
            ⬇ Download Certificate
          </button>
        )}
      </div>
    </div>
  );
}
