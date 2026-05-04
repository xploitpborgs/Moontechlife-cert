// Supabase
export const SUPABASE_URL = 'https://egmabtxeftcznyrhfxly.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnbWFidHhlZnRjem55cmhmeGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NDY2NTcsImV4cCI6MjA5MzQyMjY1N30.qL7-U9hve6GPzGhOf7cd2K7DskI593dg2CWhj43SySY';

// EmailJS
export const EMAILJS_SERVICE_ID = 'service_oqziof9';
export const EMAILJS_TEMPLATE_ID = 'template_kfys6mp';
export const EMAILJS_PUBLIC_KEY = '9TEo3EhtKYP15edDO';

// Certificate template
export const CERT_TEMPLATE_BUCKET = 'templates';
export const CERT_TEMPLATE_OBJECT_PATH = 'Copy of CERTIFICATE OF COMPLETION (2).png';
export const CERT_TEMPLATE_FALLBACK_URL =
  'https://egmabtxeftcznyrhfxly.supabase.co/storage/v1/object/public/templates/Copy%20of%20CERTIFICATE%20OF%20COMPLETION%20(2).png';

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
export const APP_URL = 'https://certs.moontechlife.com';
