import {
  buildCertificatePreviewData,
  loadCertificateRenderBundle,
  loadStudentCertificateRenderBundle,
  ORIGINAL_CERTIFICATE_HEIGHT,
  ORIGINAL_CERTIFICATE_WIDTH,
  renderCertificateArtifact,
} from './certificateDesigner';

export function getCertificateVerificationStorageKey(student = {}) {
  const certificateId = student.cert_token || student.id || student.email || 'unknown';
  return `certificate_verified_${certificateId}`;
}

export function isCertificateVerifiedInBrowser(student = {}) {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(getCertificateVerificationStorageKey(student)) === 'true';
  } catch {
    return false;
  }
}

export function markCertificateVerifiedInBrowser(student = {}) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getCertificateVerificationStorageKey(student), 'true');
  } catch {
    // Ignore localStorage write failures.
  }
}

/**
 * Generates a certificate blob and dataUrl for the given student.
 */
export async function getStudentCertificateRenderData(student) {
  return loadStudentCertificateRenderBundle(student);
}

export async function generateCertificateBlob(studentOrName, course, token, descriptionText = '') {
  const renderBundle = typeof studentOrName === 'object' && studentOrName !== null
    ? await loadStudentCertificateRenderBundle(studentOrName)
    : await loadCertificateRenderBundle(buildCertificatePreviewData({
        recipientName: studentOrName,
        course,
        token,
        descriptionText,
      }));

  const artifact = await renderCertificateArtifact({
    layout: renderBundle.layout,
    templateUrl: renderBundle.templateUrl,
    sampleData: renderBundle.previewData,
    width: ORIGINAL_CERTIFICATE_WIDTH,
    height: ORIGINAL_CERTIFICATE_HEIGHT,
  });

  return {
    ...artifact,
    renderBundle,
  };
}
