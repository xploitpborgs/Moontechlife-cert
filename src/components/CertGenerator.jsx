import { useEffect, useState } from 'react';
import supabase from '../supabase';
import {
  fetchCourseOptions,
  fetchCertificateTemplateSettings,
  getDefaultSampleData,
  loadCertificateTemplate,
  resolveCoursePlaceholder,
  renderCertificateArtifact,
  resolveDesignerAccess,
  createQrDataUrl,
} from '../utils/certificateDesigner';
import CertificateRenderer from './CertificateRenderer';

function buildStatus(type, message) {
  return { type, message };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function CertGenerator() {
  const [authState, setAuthState] = useState({
    loading: true,
    isAllowed: false,
    user: null,
    error: '',
  });

  const [templateId, setTemplateId] = useState('template_1');
  const [templateState, setTemplateState] = useState({ loading: true, url: '', error: '' });
  const [layout, setLayout] = useState(null);
  
  const [sampleData, setSampleData] = useState({
    ...getDefaultSampleData(),
    titleText: 'Director of Programs',
    signatureText: 'Jane Doe',
  });

  const [courseState, setCourseState] = useState({
    loading: false,
    options: [],
    error: '',
  });

  const [qrPreviewUrl, setQrPreviewUrl] = useState('');
  const [status, setStatus] = useState(buildStatus('info', 'Loading...'));
  const [generating, setGenerating] = useState(false);
  const [mainCanvasSize, setMainCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    document.title = 'Certificate Generator';
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
          isAllowed: access.isAllowed,
          error: '',
        });

        if (!access.isAllowed) {
          setStatus(buildStatus('error', 'Admin access required.'));
          return;
        }

        const courseOptions = await fetchCourseOptions().catch(() => []);
        if (cancelled) return;
        setCourseState({ loading: false, options: courseOptions, error: '' });
        
        if (courseOptions.length > 0) {
            setSampleData(s => ({...s, selectedCourse: s.selectedCourse || courseOptions[0]}));
        }

        await loadTemplateData(templateId);

      } catch (error) {
        if (!cancelled) setAuthState((current) => ({ ...current, loading: false, error: error.message }));
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadTemplateData(id) {
    setTemplateState({ loading: true, url: '', error: '' });
    try {
        const [template, savedSettings] = await Promise.all([
          loadCertificateTemplate(id),
          fetchCertificateTemplateSettings(id)
        ]);
        
        setTemplateState({ loading: false, url: template.url, error: '' });
        setLayout(savedSettings.layout);
        
        setSampleData(s => ({
            ...s,
            descriptionText: savedSettings.layout.description_text?.default_text || s.descriptionText,
            titleText: savedSettings.layout.title_text?.default_text || s.titleText,
            signatureText: savedSettings.layout.signature_text?.default_text || s.signatureText,
        }));
        
        setStatus(buildStatus('success', 'Template loaded ready for generation.'));
    } catch (e) {
        setTemplateState({ loading: false, url: '', error: e.message });
        setStatus(buildStatus('error', 'Failed to load template.'));
    }
  }

  useEffect(() => {
    if (authState.isAllowed) {
        loadTemplateData(templateId);
    }
  }, [templateId]);

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
    return () => { cancelled = true; };
  }, [sampleData.verificationUrl]);

  function handleTextInput(key, value) {
    setSampleData((current) => ({ ...current, [key]: value }));
  }

  async function handleGenerate() {
    if (!layout) return;
    setGenerating(true);
    setStatus(buildStatus('info', 'Generating certificate...'));

    const previewSampleData = {
      ...sampleData,
      descriptionText: resolveCoursePlaceholder(sampleData.descriptionText, sampleData.selectedCourse),
    };

    try {
      const result = await renderCertificateArtifact({
        layout,
        sampleData: previewSampleData,
        templateUrl: templateState.url,
      });
      downloadBlob(result.blob, `certificate-${sampleData.recipientName.replace(/\s+/g, '-').toLowerCase()}.png`);
      setStatus(buildStatus('success', 'Certificate successfully generated and downloaded.'));
    } catch (error) {
      setStatus(buildStatus('error', error?.message || 'Failed to generate.'));
    } finally {
      setGenerating(false);
    }
  }

  if (authState.loading) {
    return <div className="designer-shell"><div className="designer-loading"><span className="spinner large" /><p>Loading generator…</p></div></div>;
  }

  if (!authState.isAllowed) {
    return (
      <div className="designer-shell">
        <div className="designer-guard-card">
          <p className="designer-kicker">Certificate Generator</p>
          <h1>Admin access required</h1>
          <a className="designer-link" href="/">Return to app</a>
        </div>
      </div>
    );
  }

  const previewSampleData = {
    ...sampleData,
    descriptionText: resolveCoursePlaceholder(sampleData.descriptionText, sampleData.selectedCourse),
  };

  return (
    <div className="designer-shell">
      <div className="designer-page">
        <header className="designer-header">
          <div>
            <p className="designer-kicker">Admin Workspace</p>
            <h1>Certificate Generator</h1>
            <p className="designer-subtitle">Manually generate certificates using the defined templates.</p>
          </div>
          <div className="designer-actions">
            <button className="designer-btn primary" type="button" onClick={handleGenerate} disabled={generating || templateState.loading}>
              {generating ? 'Generating…' : 'Download Certificate PNG'}
            </button>
            <a href="/" className="designer-close-btn" title="Close Generator">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </a>
          </div>
        </header>

        <div className={`designer-status ${status.type}`}>{status.message}</div>

        <div className="designer-grid">
          <aside className="designer-sidebar" style={{ maxWidth: '400px' }}>
            <section className="designer-sidebar-card">
              <div className="designer-panel-head tight">
                <div><h2>Certificate Data</h2><p>Enter the details below to generate.</p></div>
              </div>
              
              <div className="designer-props-grid">
                <label className="designer-control wide">
                  <span>Template</span>
                  <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                    <option value="template_1">Template 1 (Standard)</option>
                    <option value="template_2">Template 2 (Alternate)</option>
                  </select>
                </label>

                <label className="designer-control wide">
                  <span>Recipient Name</span>
                  <input type="text" value={sampleData.recipientName} onChange={(e) => handleTextInput('recipientName', e.target.value)} />
                </label>

                <label className="designer-control wide">
                  <span>Course / Cohort</span>
                  <select value={sampleData.selectedCourse} onChange={(e) => handleTextInput('selectedCourse', e.target.value)}>
                    {courseState.options.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>

                <label className="designer-control wide">
                  <span>Description Text</span>
                  <textarea rows="3" value={sampleData.descriptionText} onChange={(e) => handleTextInput('descriptionText', e.target.value)} />
                </label>

                <label className="designer-control wide">
                  <span>Title Text</span>
                  <input type="text" value={sampleData.titleText} onChange={(e) => handleTextInput('titleText', e.target.value)} />
                </label>

                <label className="designer-control wide">
                  <span>Signature Text</span>
                  <input type="text" value={sampleData.signatureText} onChange={(e) => handleTextInput('signatureText', e.target.value)} />
                </label>

                <label className="designer-control wide">
                  <span>Verification URL</span>
                  <input type="url" value={sampleData.verificationUrl} onChange={(e) => handleTextInput('verificationUrl', e.target.value)} />
                </label>
              </div>
            </section>
          </aside>

          <section className="designer-stage-panel">
            <div className="designer-panel-head">
                <div><h2>Live Preview</h2><p>What you see is what you get.</p></div>
            </div>
            
            <div className="designer-stage-viewport">
              {templateState.loading ? (
                  <div className="designer-loading"><span className="spinner large" /></div>
              ) : templateState.error ? (
                  <div className="designer-canvas-error">
                    <strong>Failed to load template.</strong>
                    <span>{templateState.error}</span>
                  </div>
              ) : layout ? (
                <div className="designer-canvas-stack designer-canvas-stack-main">
                  <CertificateRenderer
                    templateImageUrl={templateState.url}
                    elements={layout}
                    previewData={previewSampleData}
                    displayWidth={mainCanvasSize.width || undefined}
                    displayHeight={mainCanvasSize.height || undefined}
                    qrDataUrl={qrPreviewUrl}
                    onMeasure={setMainCanvasSize}
                  />
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
