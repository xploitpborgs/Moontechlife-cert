import { useEffect, useState } from 'react';
import { Rnd } from 'react-rnd';
import supabase from '../supabase';
import CertificateRenderer from './CertificateRenderer';
import {
  EDITABLE_FIELD_KEYS,
  FONT_FAMILY_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  ORIGINAL_CERTIFICATE_HEIGHT,
  ORIGINAL_CERTIFICATE_WIDTH,
  TEXT_ALIGN_OPTIONS,
  clampLayoutField,
  createQrDataUrl,
  fetchCourseOptions,
  fetchCertificateTemplateSettings,
  getDefaultSampleData,
  getFieldDebugSnapshot,
  getFieldPixelBox,
  loadCertificateTemplate,
  resolveCoursePlaceholder,
  renderCertificateArtifact,
  resolveDesignerAccess,
  saveCertificateTemplateSettings,
} from '../utils/certificateDesigner';

const FIELD_META = {
  recipient_name: { label: 'Recipient Name', sampleKey: 'recipientName' },
  description_text: { label: 'Description Text', sampleKey: 'descriptionText' },
  qr_code: { label: 'QR Code', sampleKey: 'verificationUrl' },
};

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(Number(value || 0) * factor) / factor;
}

function buildStatus(type, message) {
  return { type, message };
}

function formatTemplateDebugValue(value) {
  if (!value) return '(missing)';
  if (value.startsWith('data:')) return '[base64 image hidden]';
  return value.length > 140 ? `${value.slice(0, 140)}...` : value;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function NumberControl({ label, value, step = 1, min, max, onChange }) {
  return (
    <label className="designer-control">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))}
      />
    </label>
  );
}

function SelectControl({ label, value, options, onChange }) {
  return (
    <label className="designer-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="designer-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function FieldButton({ fieldKey, selectedField, onSelect, layout }) {
  const field = layout[fieldKey];
  const isActive = selectedField === fieldKey;

  return (
    <button
      type="button"
      className={`designer-field-chip${isActive ? ' active' : ''}`}
      onClick={() => onSelect(fieldKey)}
    >
      <span>{FIELD_META[fieldKey].label}</span>
      <small>{`${round(field.x_position, 4)}, ${round(field.y_position, 4)}`}</small>
    </button>
  );
}

function EditorOverlayLayer({
  elements,
  displayWidth,
  displayHeight,
  selectedElement,
  onSelectElement,
  onUpdateElement,
  debugMode,
}) {
  return (
    <div className="designer-overlay-layer">
      {EDITABLE_FIELD_KEYS.map((fieldKey) => {
        const box = getFieldPixelBox(elements[fieldKey], displayWidth, displayHeight);
        const snapshot = getFieldDebugSnapshot(fieldKey, elements[fieldKey], displayWidth, displayHeight);
        const isSelected = selectedElement === fieldKey;

        return (
          <Rnd
            key={fieldKey}
            bounds="parent"
            position={{ x: box.x, y: box.y }}
            size={{ width: box.width, height: box.height }}
            onDragStart={() => onSelectElement(fieldKey)}
            onResizeStart={() => onSelectElement(fieldKey)}
            onDragStop={(_, data) => {
              onUpdateElement(fieldKey, {
                x_position: data.x / displayWidth,
                y_position: data.y / displayHeight,
              });
            }}
            onResizeStop={(_, __, ref, ___, position) => {
              onUpdateElement(fieldKey, {
                x_position: position.x / displayWidth,
                y_position: position.y / displayHeight,
                width: ref.offsetWidth / displayWidth,
                height: ref.offsetHeight / displayHeight,
              });
            }}
            className={`designer-rnd${isSelected ? ' selected' : ''}`}
            enableResizing
          >
            <button
              type="button"
              className="designer-overlay-button designer-overlay-handle"
              onClick={() => onSelectElement(fieldKey)}
            >
              <span className="designer-overlay-label">
                {FIELD_META[fieldKey].label}
                <small>{`${Math.round(box.x)}px · ${Math.round(box.y)}px`}</small>
              </span>
            </button>
            {debugMode && (
              <div className="designer-debug-tag">
                {`${fieldKey}: ${snapshot.xPercent}, ${snapshot.yPercent}`}
              </div>
            )}
          </Rnd>
        );
      })}
    </div>
  );
}

export default function CertDesigner() {
  const [loginState, setLoginState] = useState({
    email: '',
    password: '',
    loading: false,
    error: '',
  });
  const [authState, setAuthState] = useState({
    loading: true,
    isAllowed: false,
    user: null,
    roles: [],
    error: '',
  });
  const [templateState, setTemplateState] = useState({
    loading: true,
    url: '',
    width: ORIGINAL_CERTIFICATE_WIDTH,
    height: ORIGINAL_CERTIFICATE_HEIGHT,
    dataUrl: '',
    error: '',
  });
  const [canvasImageState, setCanvasImageState] = useState({
    status: 'idle',
    url: '',
  });
  const [layout, setLayout] = useState(null);
  const [defaultLayout, setDefaultLayout] = useState(null);
  const [selectedField, setSelectedField] = useState('recipient_name');
  const [sampleData, setSampleData] = useState(getDefaultSampleData());
  const [courseState, setCourseState] = useState({
    loading: false,
    options: [],
    error: '',
  });
  const [mainCanvasSize, setMainCanvasSize] = useState({
    width: 0,
    height: 0,
  });
  const [qrPreviewUrl, setQrPreviewUrl] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [status, setStatus] = useState(buildStatus('info', 'Loading certificate designer…'));
  const [actionState, setActionState] = useState({
    saving: false,
    previewing: false,
    generating: false,
  });

  useEffect(() => {
    document.title = 'Certificate Designer';
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setAuthState((current) => ({ ...current, loading: true, error: '' }));

      try {
        const access = await resolveDesignerAccess();
        if (cancelled) return;

        setAuthState({
          loading: false,
          user: access.user,
          roles: access.roles,
          isAllowed: access.isAllowed,
          error: '',
        });

        if (!access.isAllowed) {
          setTemplateState((current) => ({ ...current, loading: false }));
          setStatus(buildStatus('error', 'Admin access is required to open the certificate designer.'));
          return;
        }

        setTemplateState((current) => ({ ...current, loading: true, error: '' }));
        setCourseState((current) => ({ ...current, loading: true, error: '' }));

        const [template, savedSettings, courseOptions] = await Promise.all([
          loadCertificateTemplate(),
          fetchCertificateTemplateSettings(),
          fetchCourseOptions().catch((error) => {
            if (!cancelled) {
              setCourseState({
                loading: false,
                options: [],
                error: error?.message || 'Unable to load courses from the database.',
              });
            }
            return [];
          }),
        ]);

        if (cancelled) return;

        setTemplateState({
          loading: false,
          url: template.url,
          width: ORIGINAL_CERTIFICATE_WIDTH,
          height: ORIGINAL_CERTIFICATE_HEIGHT,
          dataUrl: template.url,
          error: '',
        });
        setCanvasImageState({
          status: 'idle',
          url: template.url,
        });
        setDefaultLayout(savedSettings.layout);
        setLayout(savedSettings.layout);
        setCourseState({
          loading: false,
          options: courseOptions,
          error: '',
        });

        setSampleData((current) => ({
          ...current,
          selectedCourse: current.selectedCourse || courseOptions[0] || '',
          descriptionText: savedSettings.layout.description_text?.default_text || current.descriptionText,
        }));

        setStatus(
          buildStatus(
            savedSettings.warning ? 'info' : 'success',
            savedSettings.warning || 'Saved layout loaded from Supabase.',
          ),
        );
      } catch (error) {
        if (cancelled) return;

        const message = error?.message || 'Failed to load the certificate designer.';
        setAuthState((current) => ({ ...current, loading: false, error: message }));
        setTemplateState((current) => ({ ...current, loading: false, error: message }));
        setStatus(buildStatus('error', message));
      }
    }

    bootstrap();

    const { data } = supabase.auth.onAuthStateChange(() => {
      bootstrap();
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function buildQrPreview() {
      try {
        const dataUrl = await createQrDataUrl(sampleData.verificationUrl || getDefaultSampleData().verificationUrl);
        if (!cancelled) setQrPreviewUrl(dataUrl);
      } catch {
        if (!cancelled) setQrPreviewUrl('');
      }
    }

    buildQrPreview();
    return () => {
      cancelled = true;
    };
  }, [sampleData.verificationUrl]);

  const displayWidth = mainCanvasSize.width;
  const displayHeight = mainCanvasSize.height;
  const sidebarScale = 360 / ORIGINAL_CERTIFICATE_WIDTH;
  const previewSampleData = {
    ...sampleData,
    descriptionText: resolveCoursePlaceholder(sampleData.descriptionText, sampleData.selectedCourse),
  };
  const selectedLayoutField = layout?.[selectedField] || null;
  const selectedFieldPixels = selectedLayoutField
    ? getFieldPixelBox(selectedLayoutField, ORIGINAL_CERTIFICATE_WIDTH, ORIGINAL_CERTIFICATE_HEIGHT)
    : null;

  function updateLayoutField(fieldKey, updater) {
    if (!layout) return;

    setLayout((current) => {
      const currentField = current[fieldKey];
      const nextField = typeof updater === 'function'
        ? updater(currentField)
        : { ...currentField, ...updater };

      return {
        ...current,
        [fieldKey]: clampLayoutField(fieldKey, nextField, ORIGINAL_CERTIFICATE_WIDTH, ORIGINAL_CERTIFICATE_HEIGHT),
      };
    });
  }

  function updateLayoutFieldFromPixels(fieldKey, updates) {
    updateLayoutField(fieldKey, (currentField) => ({
      ...currentField,
      ...(updates.x_position !== undefined
        ? { x_position: updates.x_position / ORIGINAL_CERTIFICATE_WIDTH }
        : {}),
      ...(updates.y_position !== undefined
        ? { y_position: updates.y_position / ORIGINAL_CERTIFICATE_HEIGHT }
        : {}),
      ...(updates.width !== undefined
        ? { width: updates.width / ORIGINAL_CERTIFICATE_WIDTH }
        : {}),
      ...(updates.height !== undefined
        ? { height: updates.height / ORIGINAL_CERTIFICATE_HEIGHT }
        : {}),
      ...(updates.font_family !== undefined ? { font_family: updates.font_family } : {}),
      ...(updates.font_size !== undefined ? { font_size: updates.font_size } : {}),
      ...(updates.font_weight !== undefined ? { font_weight: updates.font_weight } : {}),
      ...(updates.text_color !== undefined ? { text_color: updates.text_color } : {}),
      ...(updates.letter_spacing !== undefined ? { letter_spacing: updates.letter_spacing } : {}),
      ...(updates.line_height !== undefined ? { line_height: updates.line_height } : {}),
      ...(updates.text_align !== undefined ? { text_align: updates.text_align } : {}),
      ...(updates.is_bold !== undefined ? { is_bold: updates.is_bold } : {}),
      ...(updates.is_italic !== undefined ? { is_italic: updates.is_italic } : {}),
      ...(updates.is_uppercase !== undefined ? { is_uppercase: updates.is_uppercase } : {}),
      ...(updates.auto_fit_enabled !== undefined ? { auto_fit_enabled: updates.auto_fit_enabled } : {}),
    }));
  }

  function handleTextInput(sampleKey, value) {
    setSampleData((current) => ({ ...current, [sampleKey]: value }));
  }

  function handleCourseChange(course) {
    setSampleData((current) => ({
      ...current,
      selectedCourse: course,
    }));
  }

  function updateLoginField(key, value) {
    setLoginState((current) => ({
      ...current,
      [key]: value,
      error: '',
    }));
  }

  async function handleAdminSignIn(event) {
    event.preventDefault();

    if (!loginState.email.trim() || !loginState.password) {
      setLoginState((current) => ({
        ...current,
        error: 'Enter your admin email and password.',
      }));
      return;
    }

    setLoginState((current) => ({ ...current, loading: true, error: '' }));

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginState.email.trim().toLowerCase(),
        password: loginState.password,
      });

      if (error) throw error;

      setLoginState((current) => ({
        ...current,
        email: current.email.trim().toLowerCase(),
        password: '',
        loading: false,
        error: '',
      }));
    } catch (error) {
      setLoginState((current) => ({
        ...current,
        loading: false,
        error: error?.message || 'Admin sign-in failed.',
      }));
    }
  }

  async function handleAdminSignOut() {
    await supabase.auth.signOut();
    setStatus(buildStatus('info', 'Signed out of the admin designer.'));
  }

  async function handleGeneratePreview() {
    if (!layout) return;

    setActionState((current) => ({ ...current, previewing: true }));

    try {
      setStatus(buildStatus('success', 'Front preview is using the same shared renderer as the synced preview.'));
    } finally {
      setActionState((current) => ({ ...current, previewing: false }));
    }
  }

  async function handleGenerateCertificate() {
    if (!layout) return;

    setActionState((current) => ({ ...current, generating: true }));

    try {
      const result = await renderCertificateArtifact({
        layout,
        sampleData: previewSampleData,
        templateUrl: templateState.url,
      });
      downloadBlob(result.blob, `certificate-preview-${sampleData.recipientName.replace(/\s+/g, '-').toLowerCase() || 'sample'}.png`);
      setStatus(buildStatus('success', 'Sample certificate exported as PNG.'));
    } catch (error) {
      setStatus(buildStatus('error', error?.message || 'Failed to generate the certificate PNG.'));
    } finally {
      setActionState((current) => ({ ...current, generating: false }));
    }
  }

  async function handleSaveLayout() {
    if (!layout) return;

    setActionState((current) => ({ ...current, saving: true }));

    try {
      const layoutToSave = {
        ...layout,
        description_text: {
          ...layout.description_text,
          default_text: sampleData.descriptionText,
        },
      };
      await saveCertificateTemplateSettings(layoutToSave);
      setLayout(layoutToSave);
      setDefaultLayout(layoutToSave);
      setStatus(buildStatus('success', 'Layout saved to Supabase.'));
    } catch (error) {
      setStatus(buildStatus('error', error?.message || 'Failed to save layout to Supabase.'));
    } finally {
      setActionState((current) => ({ ...current, saving: false }));
    }
  }

  function handleResetLayout() {
    if (!defaultLayout) return;
    setLayout(defaultLayout);
    setSampleData((current) => ({
      ...current,
      descriptionText: defaultLayout.description_text?.default_text || current.descriptionText,
    }));
    setSelectedField('recipient_name');
    setStatus(buildStatus('info', 'Layout reset to the default template positions.'));
  }

  if (authState.loading || templateState.loading) {
    return (
      <div className="designer-shell">
        <div className="designer-loading">
          <span className="spinner large" />
          <p>Loading certificate designer…</p>
        </div>
      </div>
    );
  }

  if (!authState.isAllowed) {
    return (
      <div className="designer-shell">
        <div className="designer-guard-card">
          <p className="designer-kicker">Certificate Designer</p>
          <h1>{authState.user ? 'Admin access required' : 'Admin sign in required'}</h1>
          <p>This page only accepts users with the <code>admin</code> or <code>system_admin</code> role.</p>
          {authState.user ? (
            <p className="designer-guard-meta">
              {`Signed in as ${authState.user.email || authState.user.id}. Roles: ${authState.roles.join(', ') || 'none found'}.`}
            </p>
          ) : (
            <>
              <p className="designer-guard-meta">
                No authenticated Supabase user session was found. Sign in with your admin account below.
              </p>
              <form className="designer-login-form" onSubmit={handleAdminSignIn}>
                <label className="designer-control wide">
                  <span>Admin Email</span>
                  <input
                    type="email"
                    value={loginState.email}
                    onChange={(event) => updateLoginField('email', event.target.value)}
                    autoComplete="email"
                  />
                </label>
                <label className="designer-control wide">
                  <span>Password</span>
                  <input
                    type="password"
                    value={loginState.password}
                    onChange={(event) => updateLoginField('password', event.target.value)}
                    autoComplete="current-password"
                  />
                </label>
                {loginState.error && <p className="designer-login-error">{loginState.error}</p>}
                <button className="designer-btn primary designer-login-submit" type="submit" disabled={loginState.loading}>
                  {loginState.loading ? 'Signing In…' : 'Sign In'}
                </button>
              </form>
            </>
          )}
          <a className="designer-link" href="/">Return to certificate app</a>
        </div>
      </div>
    );
  }

  if (!layout || templateState.error) {
    return (
      <div className="designer-shell">
        <div className="designer-guard-card">
          <p className="designer-kicker">Certificate Designer</p>
          <h1>Unable to load the designer</h1>
          <p>{templateState.error || authState.error || 'An unexpected error occurred.'}</p>
          <a className="designer-link" href="/">Return to certificate app</a>
        </div>
      </div>
    );
  }

  return (
    <div className="designer-shell">
      <div className="designer-page">
        <header className="designer-header">
          <div>
            <p className="designer-kicker">Admin Workspace</p>
            <h1>Certificate Designer</h1>
            <p className="designer-subtitle">
              Only the recipient name, description text, and QR code are editable. All previews and exports use the same CertificateRenderer path.
            </p>
          </div>

          <div className="designer-actions">
            <button className="designer-btn ghost" type="button" onClick={() => setDebugMode((current) => !current)}>
              {debugMode ? 'Hide Debug' : 'Show Debug'}
            </button>
            <button className="designer-btn ghost" type="button" onClick={handleAdminSignOut}>
              Sign Out
            </button>
            <button className="designer-btn ghost" type="button" onClick={handleResetLayout}>
              Reset Layout
            </button>
            <button className="designer-btn" type="button" onClick={handleGeneratePreview} disabled={actionState.previewing}>
              {actionState.previewing ? 'Rendering…' : 'Generate Preview'}
            </button>
            <button className="designer-btn" type="button" onClick={handleGenerateCertificate} disabled={actionState.generating}>
              {actionState.generating ? 'Generating…' : 'Generate Certificate'}
            </button>
            <button className="designer-btn primary" type="button" onClick={handleSaveLayout} disabled={actionState.saving}>
              {actionState.saving ? 'Saving…' : 'Save Layout'}
            </button>
          </div>
        </header>

        <div className={`designer-status ${status.type}`}>{status.message}</div>

        <div className="designer-grid">
          <section className="designer-stage-panel">
            <div className="designer-panel-head">
              <div>
                <h2>Main Certificate Workspace</h2>
                <p>Primary editable canvas. Positions are stored relative to the original 1472 x 1040 certificate image.</p>
              </div>
              <div className="designer-stage-meta">
                <span>{`${ORIGINAL_CERTIFICATE_WIDTH} × ${ORIGINAL_CERTIFICATE_HEIGHT}px`}</span>
                <span>{`Rendered ${displayWidth} × ${displayHeight}px`}</span>
              </div>
            </div>

            <div className="designer-sample-grid">
              <label className="designer-control wide">
                <span>Sample Recipient Name</span>
                <input
                  type="text"
                  value={sampleData.recipientName}
                  onChange={(event) => handleTextInput('recipientName', event.target.value)}
                />
              </label>

              <label className="designer-control">
                <span>Course Selector From DB</span>
                <select
                  value={sampleData.selectedCourse}
                  onChange={(event) => handleCourseChange(event.target.value)}
                  disabled={courseState.loading || courseState.options.length === 0}
                >
                  {courseState.options.length === 0 && (
                    <option value="">
                      {courseState.loading ? 'Loading courses…' : 'No courses found'}
                    </option>
                  )}
                  {courseState.options.map((course) => (
                    <option key={course} value={course}>
                      {course}
                    </option>
                  ))}
                </select>
              </label>

              <div className="designer-course-note">
                {courseState.error
                  ? `Course selector error: ${courseState.error}`
                  : 'Selecting a course fills the description text, and you can still edit the description manually.'}
              </div>

              <label className="designer-control wide">
                <span>Sample Description Text</span>
                <textarea
                  rows="3"
                  value={sampleData.descriptionText}
                  onChange={(event) => handleTextInput('descriptionText', event.target.value)}
                />
              </label>
              <div className="designer-course-note">
                Use <code>{'{course}'}</code> to automatically insert the student&apos;s course name.
              </div>

              <label className="designer-control wide">
                <span>Sample Verification URL</span>
                <input
                  type="url"
                  value={sampleData.verificationUrl}
                  onChange={(event) => handleTextInput('verificationUrl', event.target.value)}
                />
              </label>
            </div>

            <div className="designer-canvas-debug">
              <div className="designer-debug-line">{`templateImageUrl: ${formatTemplateDebugValue(templateState.url)}`}</div>
              <div className="designer-debug-line">{`originalWidth: ${ORIGINAL_CERTIFICATE_WIDTH}`}</div>
              <div className="designer-debug-line">{`originalHeight: ${ORIGINAL_CERTIFICATE_HEIGHT}`}</div>
              <div className="designer-debug-line">{`displayWidth: ${displayWidth}`}</div>
              <div className="designer-debug-line">{`displayHeight: ${displayHeight}`}</div>
              <div className="designer-debug-line">{`overlayElements: ${EDITABLE_FIELD_KEYS.length}`}</div>
              <div className="designer-debug-line">{`selectedElement: ${selectedField}`}</div>
            </div>

            <div className="designer-stage-viewport">
              {canvasImageState.status === 'error' && (
                <div className="designer-canvas-error">
                  <strong>Certificate template image failed to load.</strong>
                  <span>{canvasImageState.url || templateState.url || '(missing image URL)'}</span>
                </div>
              )}

              <div className="designer-canvas-stack designer-canvas-stack-main">
                <CertificateRenderer
                  templateImageUrl={templateState.url}
                  elements={layout}
                  previewData={previewSampleData}
                  displayWidth={displayWidth || undefined}
                  displayHeight={displayHeight || undefined}
                  qrDataUrl={qrPreviewUrl}
                  onImageStatusChange={setCanvasImageState}
                  onMeasure={setMainCanvasSize}
                />
                {displayWidth > 0 && displayHeight > 0 && (
                  <EditorOverlayLayer
                    elements={layout}
                    displayWidth={displayWidth}
                    displayHeight={displayHeight}
                    selectedElement={selectedField}
                    onSelectElement={setSelectedField}
                    onUpdateElement={updateLayoutField}
                    debugMode={debugMode}
                  />
                )}
              </div>
            </div>

            {debugMode && (
              <div className="designer-debug-panel">
                {EDITABLE_FIELD_KEYS.map((fieldKey) => {
                  const snapshot = getFieldDebugSnapshot(fieldKey, layout[fieldKey], displayWidth, displayHeight);
                  return (
                    <div key={fieldKey} className="designer-debug-line">
                      {`${fieldKey} | x% ${snapshot.xPercent} | y% ${snapshot.yPercent} | w% ${snapshot.widthPercent} | h% ${snapshot.heightPercent} | x ${snapshot.renderedX}px | y ${snapshot.renderedY}px`}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="designer-sidebar">
            <section className="designer-sidebar-card">
              <div className="designer-panel-head tight">
                <div>
                  <h2>Editable Fields</h2>
                  <p>Only recipient name, description text, and QR code exist in the layout state.</p>
                </div>
              </div>

              <div className="designer-field-list">
                {EDITABLE_FIELD_KEYS.map((fieldKey) => (
                  <FieldButton
                    key={fieldKey}
                    fieldKey={fieldKey}
                    selectedField={selectedField}
                    onSelect={setSelectedField}
                    layout={layout}
                  />
                ))}
              </div>
            </section>

            <section className="designer-sidebar-card">
              <div className="designer-panel-head tight">
                <div>
                  <h2>{FIELD_META[selectedField].label} Settings</h2>
                  <p>Percent-based layout with pixel helpers for editing.</p>
                </div>
              </div>

              <div className="designer-control-grid">
                <NumberControl
                  label="X Position"
                  value={round(selectedFieldPixels.x)}
                  min={0}
                  max={ORIGINAL_CERTIFICATE_WIDTH}
                  onChange={(value) => updateLayoutFieldFromPixels(selectedField, { x_position: value })}
                />
                <NumberControl
                  label="Y Position"
                  value={round(selectedFieldPixels.y)}
                  min={0}
                  max={ORIGINAL_CERTIFICATE_HEIGHT}
                  onChange={(value) => updateLayoutFieldFromPixels(selectedField, { y_position: value })}
                />
                <NumberControl
                  label="Width"
                  value={round(selectedFieldPixels.width)}
                  min={selectedField === 'qr_code' ? 48 : 120}
                  max={ORIGINAL_CERTIFICATE_WIDTH}
                  onChange={(value) => updateLayoutFieldFromPixels(selectedField, { width: value })}
                />
                <NumberControl
                  label="Height"
                  value={round(selectedFieldPixels.height)}
                  min={selectedField === 'qr_code' ? 48 : 64}
                  max={ORIGINAL_CERTIFICATE_HEIGHT}
                  onChange={(value) => updateLayoutFieldFromPixels(selectedField, { height: value })}
                />

                <div className="designer-coord-summary">
                  {`x% ${round(selectedLayoutField.x_position, 6)} · y% ${round(selectedLayoutField.y_position, 6)} · w% ${round(selectedLayoutField.width, 6)} · h% ${round(selectedLayoutField.height, 6)}`}
                </div>

                {selectedField !== 'qr_code' && (
                  <>
                    <label className="designer-control wide">
                      <span>Font Family</span>
                      <input
                        list="designer-font-families"
                        type="text"
                        value={selectedLayoutField.font_family}
                        onChange={(event) => updateLayoutField(selectedField, { font_family: event.target.value })}
                      />
                      <datalist id="designer-font-families">
                        {FONT_FAMILY_OPTIONS.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                    </label>
                    <NumberControl
                      label="Font Size"
                      value={round(selectedLayoutField.font_size)}
                      min={8}
                      max={200}
                      onChange={(value) => updateLayoutField(selectedField, { font_size: value })}
                    />
                    <SelectControl
                      label="Font Weight"
                      value={selectedLayoutField.font_weight}
                      options={FONT_WEIGHT_OPTIONS}
                      onChange={(value) => updateLayoutField(selectedField, { font_weight: value })}
                    />
                    <label className="designer-control">
                      <span>Text Color</span>
                      <input
                        type="color"
                        value={selectedLayoutField.text_color}
                        onChange={(event) => updateLayoutField(selectedField, { text_color: event.target.value })}
                      />
                    </label>
                    <NumberControl
                      label="Letter Spacing"
                      value={round(selectedLayoutField.letter_spacing)}
                      step={0.1}
                      min={-4}
                      max={20}
                      onChange={(value) => updateLayoutField(selectedField, { letter_spacing: value })}
                    />
                    <NumberControl
                      label="Line Height"
                      value={round(selectedLayoutField.line_height)}
                      step={0.01}
                      min={0.6}
                      max={2.5}
                      onChange={(value) => updateLayoutField(selectedField, { line_height: value })}
                    />
                    <SelectControl
                      label="Text Align"
                      value={selectedLayoutField.text_align}
                      options={TEXT_ALIGN_OPTIONS}
                      onChange={(value) => updateLayoutField(selectedField, { text_align: value })}
                    />
                    <div className="designer-toggle-row wide">
                      <Toggle
                        label="Bold"
                        checked={selectedLayoutField.is_bold}
                        onChange={(value) => updateLayoutField(selectedField, { is_bold: value })}
                      />
                      <Toggle
                        label="Italic"
                        checked={selectedLayoutField.is_italic}
                        onChange={(value) => updateLayoutField(selectedField, { is_italic: value })}
                      />
                      <Toggle
                        label="Uppercase"
                        checked={selectedLayoutField.is_uppercase}
                        onChange={(value) => updateLayoutField(selectedField, { is_uppercase: value })}
                      />
                      {selectedField === 'recipient_name' && (
                        <Toggle
                          label="Auto Fit"
                          checked={selectedLayoutField.auto_fit_enabled}
                          onChange={(value) => updateLayoutField(selectedField, { auto_fit_enabled: value })}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="designer-sidebar-card">
              <div className="designer-panel-head tight">
                <div>
                  <h2>Synced Preview</h2>
                  <p>Shared CertificateRenderer output.</p>
                </div>
              </div>

              <CertificateRenderer
                templateImageUrl={templateState.url}
                elements={layout}
                previewData={previewSampleData}
                scale={sidebarScale}
                qrDataUrl={qrPreviewUrl}
              />

              <div className="designer-export-divider" />

              <div className="designer-panel-head tight">
                <div>
                  <h2>Front Preview</h2>
                  <p>Same CertificateRenderer as the main workspace and synced preview.</p>
                </div>
              </div>

              <CertificateRenderer
                templateImageUrl={templateState.url}
                elements={layout}
                previewData={previewSampleData}
                scale={sidebarScale}
                qrDataUrl={qrPreviewUrl}
              />
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
