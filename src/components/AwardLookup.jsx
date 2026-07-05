import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Use service role key so we can list storage files (anon key can't list)
const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET = 'AWARD';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function getPublicUrl(filename) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(filename)}`;
}

// Normalize a string for fuzzy matching: lowercase, strip punctuation
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function matchScore(filename, query) {
  const name = normalize(filename.replace('.png', ''));
  const q = normalize(query);
  if (!q) return 0;
  // exact word match scores higher
  const words = name.split(/\s+/);
  const queryWords = q.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const qw of queryWords) {
    for (const w of words) {
      if (w === qw) score += 10;
      else if (w.startsWith(qw)) score += 6;
      else if (w.includes(qw)) score += 3;
    }
  }
  // also check whole name contains query substring
  if (name.includes(q)) score += 5;
  return score;
}

export default function AwardLookup() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const inputRef = useRef(null);

  // Load all files from the AWARD bucket
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabaseAdmin.storage.from(BUCKET).list('', {
          limit: 200,
          sortBy: { column: 'name', order: 'asc' },
        });
        if (error) throw error;
        const pngs = (data || []).filter(f => f.name.endsWith('.png'));
        setFiles(pngs.map(f => f.name));
      } catch (err) {
        setError('Could not load award files. Please try again later.');
        console.error('Award bucket list error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Search whenever query changes — minimum 4 characters required
  useEffect(() => {
    if (query.trim().length < 4) {
      setResults([]);
      setSelected(null);
      return;
    }
    const scored = files
      .map(f => ({ name: f, score: matchScore(f, query) }))
      .filter(f => f.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(f => f.name);
    setResults(scored);
    setSelected(scored.length === 1 ? scored[0] : null);

  }, [query, files]);

  async function handleDownload(filename) {
    setDownloading(true);
    try {
      const url = getPublicUrl(filename);
      const res = await fetch(url);
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      alert('Failed to download. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  const displayName = (filename) => filename.replace('.png', '');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0c29 0%, #1a1040 40%, #0f2027 100%)',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        padding: '20px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <span style={{
          fontSize: '1.3rem',
          fontWeight: 800,
          letterSpacing: '-0.5px',
          color: '#fff',
        }}>
          MoonTech<span style={{ color: '#e4c26d' }}>Life</span>
        </span>
        <span style={{
          marginLeft: '8px',
          background: 'rgba(167,139,250,0.15)',
          color: '#c4b5fd',
          borderRadius: '999px',
          padding: '3px 12px',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          border: '1px solid rgba(167,139,250,0.3)',
        }}>
          Awards Portal
        </span>
      </header>

      {/* Main */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '60px 24px 40px',
      }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            boxShadow: '0 0 40px rgba(228,194,109,0.3)',
            marginBottom: '24px',
            overflow: 'hidden',
          }}>
            <img
              src="/moon-logo.png"
              alt="MoonTech Life"
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
            />
          </div>
          <h1 style={{
            fontSize: 'clamp(1.8rem, 5vw, 2.8rem)',
            fontWeight: 800,
            color: '#fff',
            margin: '0 0 12px',
            letterSpacing: '-1px',
            lineHeight: 1.1,
          }}>
            Retrieve Your Award
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '1rem',
            margin: 0,
            maxWidth: '420px',
          }}>
            Enter your name (or part of it) to find and download your personalised award certificate.
          </p>
        </div>

        {/* Search Box */}
        <div style={{
          width: '100%',
          maxWidth: '560px',
          marginBottom: '40px',
        }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute',
              left: '18px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(255,255,255,0.35)',
              pointerEvents: 'none',
              display: 'flex',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type a name, e.g. oluwasola or adebayo…"
              autoFocus
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '16px 18px 16px 50px',
                fontSize: '1rem',
                borderRadius: '14px',
                border: '1.5px solid rgba(167,139,250,0.3)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                outline: 'none',
                backdropFilter: 'blur(12px)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxShadow: query ? '0 0 0 3px rgba(124,58,237,0.2)' : 'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#a78bfa'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.2)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(167,139,250,0.3)'; e.target.style.boxShadow = 'none'; }}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setSelected(null); inputRef.current?.focus(); }}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '1rem',
                  lineHeight: 1,
                  transition: 'background 0.15s',
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Loading state */}
          {loading && (
            <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: '16px', fontSize: '0.875rem' }}>
              Loading award files…
            </p>
          )}

          {/* Error state */}
          {error && (
            <p style={{ color: '#f87171', textAlign: 'center', marginTop: '16px', fontSize: '0.875rem' }}>
              {error}
            </p>
          )}

          {!loading && query && query.trim().length < 4 && (
            <p style={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: '20px', fontSize: '0.875rem' }}>
              Type at least <strong style={{ color: 'rgba(255,255,255,0.6)' }}>4 characters</strong> to search…
            </p>
          )}

          {/* No results */}
          {!loading && query.trim().length >= 4 && results.length === 0 && (

            <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: '20px', fontSize: '0.9rem' }}>
              No awards found matching "<strong style={{ color: 'rgba(255,255,255,0.7)' }}>{query}</strong>". Try a different name.
            </p>
          )}
        </div>

        {/* Results Grid */}
        {results.length > 0 && (
          <div style={{ width: '100%', maxWidth: '900px' }}>
            {results.length > 1 && (
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textAlign: 'center', marginBottom: '20px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {results.length} match{results.length !== 1 ? 'es' : ''} found
              </p>
            )}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '20px',
            }}>
              {results.map(filename => (
                <AwardCard
                  key={filename}
                  filename={filename}
                  displayName={displayName(filename)}
                  publicUrl={getPublicUrl(filename)}
                  isSelected={selected === filename}
                  onSelect={() => setSelected(filename === selected ? null : filename)}
                  onDownload={() => handleDownload(filename)}
                  downloading={downloading}
                />
              ))}
            </div>
          </div>
        )}

        {/* Selected preview — full size */}
        {selected && (
          <div style={{
            marginTop: '48px',
            width: '100%',
            maxWidth: '800px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(167,139,250,0.2)',
            borderRadius: '20px',
            padding: '24px',
            backdropFilter: 'blur(12px)',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
              Preview — {displayName(selected)}
            </p>
            <img
              src={getPublicUrl(selected)}
              alt={displayName(selected)}
              style={{
                width: '100%',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                display: 'block',
              }}
            />
            <button
              onClick={() => handleDownload(selected)}
              disabled={downloading}
              style={{
                marginTop: '20px',
                width: '100%',
                padding: '14px',
                background: downloading ? 'rgba(167,139,250,0.3)' : 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: downloading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'opacity 0.2s',
                boxShadow: downloading ? 'none' : '0 4px 20px rgba(124,58,237,0.4)',
              }}
            >
              {downloading ? (
                <>⏳ Downloading…</>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download Award Certificate
                </>
              )}
            </button>
          </div>
        )}
      </main>

      <footer style={{
        textAlign: 'center',
        padding: '20px',
        color: 'rgba(255,255,255,0.2)',
        fontSize: '0.75rem',
      }}>
        © {new Date().getFullYear()} MoonTech Life · Awards Portal
      </footer>
    </div>
  );
}

function AwardCard({ filename, displayName, publicUrl, isSelected, onSelect, onDownload, downloading }) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div
      onClick={onSelect}
      style={{
        borderRadius: '16px',
        border: isSelected
          ? '2px solid #a78bfa'
          : '1.5px solid rgba(255,255,255,0.08)',
        background: isSelected
          ? 'rgba(167,139,250,0.08)'
          : 'rgba(255,255,255,0.03)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
        boxShadow: isSelected
          ? '0 0 0 4px rgba(124,58,237,0.2), 0 12px 30px rgba(0,0,0,0.4)'
          : '0 4px 20px rgba(0,0,0,0.3)',
        transform: isSelected ? 'translateY(-2px)' : 'none',
      }}
      onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'; }}}
      onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}}
    >
      {/* Thumbnail */}
      <div style={{
        aspectRatio: '1.414',
        background: 'rgba(0,0,0,0.3)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {!imgLoaded && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img
              src="/moon-logo.png"
              alt="Loading"
              style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '50%', opacity: 0.4 }}
            />
          </div>
        )}
        <img
          src={publicUrl}
          alt={displayName}
          onLoad={() => setImgLoaded(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: imgLoaded ? 'block' : 'none',
            transition: 'opacity 0.3s',
          }}
        />
        {isSelected && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: '#7c3aed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        )}
      </div>

      {/* Card footer */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div>
          <p style={{
            margin: 0,
            color: '#e2d9f3',
            fontWeight: 600,
            fontSize: '0.875rem',
            lineHeight: 1.3,
          }}>
            {displayName}
          </p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDownload(); }}
          disabled={downloading}
          title="Download"
          style={{
            flexShrink: 0,
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'rgba(124,58,237,0.3)',
            border: '1px solid rgba(167,139,250,0.3)',
            color: '#c4b5fd',
            cursor: downloading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s, transform 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.6)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.3)'; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
