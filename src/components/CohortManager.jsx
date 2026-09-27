import { useEffect, useState } from 'react';
import {
  fetchCohorts,
  createCohort,
  updateCohort,
  deleteCohort,
  resolveDesignerAccess,
  resolveCoursePlaceholder,
} from '../utils/certificateDesigner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildStatus(type, message) {
  return { type, message };
}

const EMPTY_FORM = {
  slug: '',
  label: '',
  icon: '🎓',
  description_template: '',
  sort_order: 0,
};

const ICON_OPTIONS = ['🎓', '🏆', '📅', '🚀', '💡', '🌟', '📚', '🔥', '🎯', '💻'];

const PREVIEW_COURSE = 'Web Development with AI';

// ---------------------------------------------------------------------------
// Sub-components (named exports so CertDesigner can import them)
// ---------------------------------------------------------------------------

export function CohortCard({ cohort, onEdit, onDelete, deleting }) {
  const preview = resolveCoursePlaceholder(cohort.description_template, PREVIEW_COURSE, cohort.name, cohort.slug);

  return (
    <div className="cohort-card">
      <div className="cohort-card-head">
        <span className="cohort-icon">{cohort.icon}</span>
        <div className="cohort-meta">
          <h3 className="cohort-label">{cohort.label}</h3>
          <code className="cohort-slug">{cohort.slug}</code>
        </div>
        <div className="cohort-card-actions">
          <button
            type="button"
            className="cohort-action-btn edit"
            onClick={() => onEdit(cohort)}
            title="Edit cohort"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
          <button
            type="button"
            className="cohort-action-btn delete"
            onClick={() => onDelete(cohort)}
            disabled={deleting === cohort.id}
            title="Delete cohort"
          >
            {deleting === cohort.id ? (
              <span className="spinner" style={{ width: 14, height: 14 }} />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            )}
            Delete
          </button>
        </div>
      </div>
      <p className="cohort-preview">
        <em>Preview: </em>{preview}
      </p>
    </div>
  );
}

export function CohortForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [error, setError] = useState('');

  const isEdit = Boolean(initial?.id);
  const preview = form.description_template
    ? resolveCoursePlaceholder(form.description_template, PREVIEW_COURSE, form.name, form.slug)
    : '';

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    if (error) setError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.slug.trim())                 return setError('Slug is required.');
    if (!form.label.trim())                return setError('Label is required.');
    if (!form.description_template.trim()) return setError('Description template is required.');
    onSave(form);
  }

  return (
    <form className="cohort-form" onSubmit={handleSubmit} noValidate>
      <h2 className="cohort-form-title">
        {isEdit ? `Editing: ${initial.label}` : 'New Cohort'}
      </h2>

      <div className="cohort-form-row">
        <label className="designer-control" style={{ flex: '0 0 auto' }}>
          <span>Icon</span>
          <div className="icon-picker">
            {ICON_OPTIONS.map((ic) => (
              <button
                key={ic}
                type="button"
                className={`icon-option${form.icon === ic ? ' selected' : ''}`}
                onClick={() => set('icon', ic)}
                title={ic}
              >
                {ic}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="cohort-form-row two-col">
        <label className="designer-control">
          <span>Label <small>(shown to students)</small></span>
          <input
            type="text"
            value={form.label}
            onChange={(e) => set('label', e.target.value)}
            placeholder="e.g. 4-Week Cohort"
          />
        </label>
        <label className="designer-control">
          <span>Slug <small>(machine key, no spaces)</small></span>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            placeholder="e.g. 4week"
            readOnly={isEdit}
            style={isEdit ? { opacity: 0.6 } : {}}
          />
        </label>
      </div>

      <label className="designer-control wide">
        <span>
          Description Template&nbsp;
          <small>— use <code style={{ background: 'rgba(0,0,0,0.07)', padding: '1px 4px', borderRadius: 4 }}>{'{course}'}</code> as a placeholder</small>
        </span>
        <textarea
          rows={3}
          value={form.description_template}
          onChange={(e) => set('description_template', e.target.value)}
          placeholder="In recognition of successfully completing the {course} Learning Track at MoonTech Life Community."
          style={{ resize: 'vertical' }}
        />
      </label>

      {preview && (
        <div className="cohort-preview-box">
          <span className="cohort-preview-label">Live Preview</span>
          <p>{preview}</p>
        </div>
      )}

      <label className="designer-control" style={{ width: 140 }}>
        <span>Sort Order</span>
        <input
          type="number"
          value={form.sort_order}
          min={0}
          onChange={(e) => set('sort_order', Number(e.target.value))}
        />
      </label>

      {error && <p className="error-msg" style={{ marginTop: 8 }}>{error}</p>}

      <div className="cohort-form-btns">
        <button type="button" className="designer-btn ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="designer-btn primary" disabled={saving}>
          {saving ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Saving…</> : isEdit ? 'Save Changes' : 'Create Cohort'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// CohortPanel — embeddable panel with no shell/auth (used inside CertDesigner)
// ---------------------------------------------------------------------------

export function CohortPanel({ onStatusChange }) {
  const [cohorts, setCohorts] = useState([]);
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [editingCohort, setEditingCohort] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Load cohorts on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingCohorts(true);
      try {
        const data = await fetchCohorts();
        if (!cancelled) setCohorts(data);
      } catch (err) {
        if (!cancelled && onStatusChange) onStatusChange('error', `Failed to load cohorts: ${err.message}`);
      } finally {
        if (!cancelled) setLoadingCohorts(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleSave(form) {
    setSaving(true);
    try {
      if (editingCohort && editingCohort !== 'new') {
        const updated = await updateCohort(editingCohort.id, form);
        setCohorts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        onStatusChange?.('success', `"${updated.label}" updated.`);
      } else {
        const created = await createCohort(form);
        setCohorts((prev) =>
          [...prev, created].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)),
        );
        onStatusChange?.('success', `"${created.label}" created.`);
      }
      setEditingCohort(null);
    } catch (err) {
      onStatusChange?.('error', err.message || 'Failed to save cohort.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirmed(cohort) {
    setDeleteConfirm(null);
    setDeleting(cohort.id);
    try {
      await deleteCohort(cohort.id);
      setCohorts((prev) => prev.filter((c) => c.id !== cohort.id));
      onStatusChange?.('success', `"${cohort.label}" deleted.`);
    } catch (err) {
      onStatusChange?.('error', `Cannot delete: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  }

  // Delete confirmation overlay
  if (deleteConfirm) {
    return (
      <div className="cohort-delete-overlay">
        <div className="cohort-delete-modal">
          <div style={{ fontSize: '2rem', textAlign: 'center' }}>⚠️</div>
          <h3 style={{ textAlign: 'center', fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}>
            Delete "{deleteConfirm.label}"?
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.55 }}>
            This cohort will be permanently removed. Students linked to it won't be deleted, but their cohort reference will be cleared.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              className="designer-btn ghost"
              style={{ flex: 1 }}
              onClick={() => setDeleteConfirm(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="designer-btn danger"
              style={{ flex: 1 }}
              onClick={() => handleDeleteConfirmed(deleteConfirm)}
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cohort-panel-body">
      {/* Toolbar */}
      <div className="cohort-panel-toolbar">
        <div>
          <p className="designer-subtitle" style={{ margin: 0 }}>
            Define certificate programmes. Each cohort has its own description template with a{' '}
            <code style={{ background: 'rgba(0,0,0,0.07)', padding: '1px 5px', borderRadius: 4 }}>{'{course}'}</code>{' '}
            placeholder resolved at render time.
          </p>
        </div>
        <button
          type="button"
          className="designer-btn primary"
          onClick={() => setEditingCohort('new')}
          disabled={editingCohort !== null}
        >
          + New Cohort
        </button>
      </div>

      {/* Form */}
      {editingCohort && (
        <div className="cohort-form-panel">
          <CohortForm
            initial={editingCohort === 'new' ? null : editingCohort}
            onSave={handleSave}
            onCancel={() => setEditingCohort(null)}
            saving={saving}
          />
        </div>
      )}

      {/* List */}
      <div className="cohort-list-panel">
        {loadingCohorts ? (
          <div className="designer-loading"><span className="spinner large" /></div>
        ) : cohorts.length === 0 ? (
          <div className="cohort-empty">
            <span style={{ fontSize: '2.5rem' }}>🎓</span>
            <p>No cohorts yet. Click "+ New Cohort" to get started.</p>
          </div>
        ) : (
          cohorts.map((cohort) => (
            <CohortCard
              key={cohort.id}
              cohort={cohort}
              onEdit={(c) => setEditingCohort(c)}
              onDelete={(c) => setDeleteConfirm(c)}
              deleting={deleting}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default export — standalone page (kept for direct URL access if needed)
// ---------------------------------------------------------------------------

export default function CohortManager() {
  const [authState, setAuthState] = useState({ loading: true, isAllowed: false, error: '' });
  const [status, setStatus] = useState(null);

  useEffect(() => {
    document.title = 'Cohort Manager';
    let cancelled = false;
    resolveDesignerAccess()
      .then((access) => {
        if (!cancelled) setAuthState({ loading: false, isAllowed: access.isAllowed, error: '' });
      })
      .catch((err) => {
        if (!cancelled) setAuthState({ loading: false, isAllowed: false, error: err.message });
      });
    return () => { cancelled = true; };
  }, []);

  if (authState.loading) {
    return (
      <div className="designer-shell">
        <div className="designer-loading"><span className="spinner large" /><p>Loading…</p></div>
      </div>
    );
  }

  if (!authState.isAllowed) {
    return (
      <div className="designer-shell">
        <div className="designer-guard-card">
          <p className="designer-kicker">Cohort Manager</p>
          <h1>Admin access required</h1>
          <a className="designer-link" href="/">Return to app</a>
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
            <h1>Cohort Manager</h1>
          </div>
          <div className="designer-actions">
            <a href="/designer" className="designer-btn ghost">← Back to Designer</a>
          </div>
        </header>
        {status && (
          <div className={`designer-status ${status.type}`}>{status.message}</div>
        )}
        <CohortPanel onStatusChange={(type, msg) => setStatus({ type, message: msg })} />
      </div>
    </div>
  );
}
