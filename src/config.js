const env = import.meta.env;

// Supabase
export const SUPABASE_URL = env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || '';

// Certificate template
export const CERT_TEMPLATE_BUCKET = env.VITE_CERT_TEMPLATE_BUCKET || '';
export const CERT_TEMPLATE_OBJECT_PATH = env.VITE_CERT_TEMPLATE_OBJECT_PATH || '';
export const CERT_TEMPLATE_FALLBACK_URL = env.VITE_CERT_TEMPLATE_FALLBACK_URL || '';

export const CERT_TEMPLATE_DEFAULT_LAYOUT_RATIOS = {
  recipient_name: {
    xRatio: 0.19,
    yRatio: 0.372,
    widthRatio: 0.62,
    heightRatio: 0.13,
    fontSize: 92,
    minFontSize: 34,
  },
  description_text: {
    xRatio: 0.225,
    yRatio: 0.535,
    widthRatio: 0.55,
    heightRatio: 0.11,
    fontSize: 34,
    minFontSize: 18,
  },
  qr_code: {
    xRatio: 0.073,
    yRatio: 0.655,
    widthRatio: 0.11,
    heightRatio: 0.155,
  },
};

// Public app URL
export const APP_URL = env.VITE_APP_URL || '';
