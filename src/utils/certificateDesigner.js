import QRCode from 'qrcode';
import supabase from '../supabase';
import {
  APP_URL,
  CERT_TEMPLATE_BUCKET,
  CERT_TEMPLATE_DEFAULT_LAYOUT_RATIOS,
  CERT_TEMPLATE_FALLBACK_URL,
  CERT_TEMPLATE_OBJECT_PATH,
} from '../config';

export const CERTIFICATE_SETTINGS_TABLE = 'certificate_template_settings';
export const EDITABLE_FIELD_KEYS = ['recipient_name', 'description_text', 'qr_code'];
export const ADMIN_ROLES = new Set(['admin', 'system_admin']);
export const ORIGINAL_CERTIFICATE_WIDTH = 1472;
export const ORIGINAL_CERTIFICATE_HEIGHT = 1040;
export const CERTIFICATE_LAYOUT_COLUMNS = [
  'field_key',
  'x_position',
  'y_position',
  'width',
  'height',
  'default_text',
  'font_family',
  'font_size',
  'font_weight',
  'text_color',
  'letter_spacing',
  'line_height',
  'text_align',
  'is_bold',
  'is_italic',
  'is_uppercase',
  'auto_fit_enabled',
];
const LEGACY_CERTIFICATE_LAYOUT_COLUMNS = CERTIFICATE_LAYOUT_COLUMNS.filter((column) => column !== 'default_text');

export const FONT_FAMILY_OPTIONS = [
  'Montserrat, sans-serif',
  'Georgia, serif',
  '"Times New Roman", serif',
  '"Playfair Display", serif',
  'Garamond, serif',
  '"DM Sans", sans-serif',
  'Verdana, sans-serif',
  'Tahoma, sans-serif',
];

export const FONT_WEIGHT_OPTIONS = ['300', '400', '500', '600', '700', '800'];
export const TEXT_ALIGN_OPTIONS = ['left', 'center', 'right'];

const fieldLabels = {
  recipient_name: 'Recipient Name',
  description_text: 'Description Text',
  qr_code: 'QR Code',
};

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(Number(value || 0) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeNumber(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  if (typeof value === 'number') return value === 1;
  return fallback;
}

function normalizeTextAlign(value, fallback = 'center') {
  return TEXT_ALIGN_OPTIONS.includes(value) ? value : fallback;
}

function buildFontFamily(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeDescriptionFontFamily(value, fallback) {
  const fontFamily = buildFontFamily(value, fallback);
  if (fontFamily === '"DM Sans", sans-serif') {
    return 'Montserrat, sans-serif';
  }
  return fontFamily;
}

function toPercent(value, total) {
  if (!total) return 0;
  return round(Number(value || 0) / total, 6);
}

function toPixels(percent, total) {
  return Number(percent || 0) * total;
}

function getEffectiveFontWeight(field) {
  const configuredWeight = Number.parseInt(field.font_weight, 10);
  const baseWeight = Number.isFinite(configuredWeight) ? configuredWeight : 400;
  return field.is_bold ? Math.max(baseWeight, 700) : baseWeight;
}

function buildCanvasFont(field, fontSize) {
  const parts = [];
  if (field.is_italic) parts.push('italic');
  parts.push(String(getEffectiveFontWeight(field)));
  parts.push(`${fontSize}px`);
  parts.push(field.font_family);
  return parts.join(' ');
}

function transformText(text, field) {
  const normalizedText = `${text || ''}`.replace(/\r\n/g, '\n');
  const baseText = field.field_key === 'description_text'
    ? normalizedText.trim()
    : normalizedText.trim();
  return field.is_uppercase ? baseText.toUpperCase() : baseText;
}

function measureLetterSpacedText(ctx, text, letterSpacing = 0) {
  if (!text) return 0;
  if (!letterSpacing) return ctx.measureText(text).width;

  const glyphs = [...text];
  const glyphWidth = glyphs.reduce((total, glyph) => total + ctx.measureText(glyph).width, 0);
  return glyphWidth + letterSpacing * Math.max(glyphs.length - 1, 0);
}

function splitLongToken(ctx, token, maxWidth, letterSpacing) {
  const pieces = [];
  let current = '';

  for (const glyph of token) {
    const candidate = `${current}${glyph}`;
    if (current && measureLetterSpacedText(ctx, candidate, letterSpacing) > maxWidth) {
      pieces.push(current);
      current = glyph;
      continue;
    }

    current = candidate;
  }

  if (current) {
    pieces.push(current);
  }

  return pieces;
}

function wrapTextLines(ctx, text, maxWidth, letterSpacing, maxLines) {
  const tokens = `${text || ''}`.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [''];

  const lines = [];
  let currentLine = '';

  const pushLine = (value) => {
    if (lines.length < maxLines) lines.push(value);
  };

  for (const token of tokens) {
    if (measureLetterSpacedText(ctx, token, letterSpacing) > maxWidth) {
      const fragments = splitLongToken(ctx, token, maxWidth, letterSpacing);
      for (const fragment of fragments) {
        if (!currentLine) {
          currentLine = fragment;
          continue;
        }

        const candidate = `${currentLine} ${fragment}`;
        if (measureLetterSpacedText(ctx, candidate, letterSpacing) <= maxWidth) {
          currentLine = candidate;
        } else {
          pushLine(currentLine);
          currentLine = fragment;
        }
      }
      continue;
    }

    if (!currentLine) {
      currentLine = token;
      continue;
    }

    const candidate = `${currentLine} ${token}`;
    if (measureLetterSpacedText(ctx, candidate, letterSpacing) <= maxWidth) {
      currentLine = candidate;
    } else {
      pushLine(currentLine);
      currentLine = token;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return lines.slice(0, maxLines);
}

function getTextMetrics(field, text, options = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const maxLines = options.maxLines || 2;
  const allowShrink = options.allowShrink ?? true;
  const minFontSize = options.minFontSize || field.min_font_size || 16;
  const maxFontSize = field.font_size || 32;
  const letterSpacing = field.letter_spacing || 0;
  const formattedText = transformText(text, field) || ' ';

  let candidateSize = maxFontSize;
  let bestFit = null;

  while (candidateSize >= minFontSize) {
    ctx.font = buildCanvasFont(field, candidateSize);
    const lines = wrapTextLines(ctx, formattedText, field.width, letterSpacing, maxLines);
    const lineHeightPx = candidateSize * (field.line_height || 1.1);
    const contentHeight = lines.length * lineHeightPx;
    const widestLine = Math.max(...lines.map((line) => measureLetterSpacedText(ctx, line, letterSpacing)));

    const metrics = {
      lines,
      fontSize: candidateSize,
      lineHeightPx,
      contentHeight,
      widestLine,
    };

    if (widestLine <= field.width && contentHeight <= field.height) {
      bestFit = metrics;
      break;
    }

    bestFit = metrics;
    if (!allowShrink) break;
    candidateSize -= 1;
  }

  return bestFit || {
    lines: [formattedText],
    fontSize: minFontSize,
    lineHeightPx: minFontSize * (field.line_height || 1.1),
    contentHeight: minFontSize * (field.line_height || 1.1),
    widestLine: 0,
  };
}

function drawLetterSpacedLine(ctx, text, x, y, letterSpacing, align) {
  if (!letterSpacing) {
    ctx.fillText(text, x, y);
    return;
  }

  const glyphs = [...text];
  const lineWidth = measureLetterSpacedText(ctx, text, letterSpacing);
  let cursor = x;

  if (align === 'center') cursor -= lineWidth / 2;
  if (align === 'right') cursor -= lineWidth;

  for (const glyph of glyphs) {
    ctx.fillText(glyph, cursor, y);
    cursor += ctx.measureText(glyph).width + letterSpacing;
  }
}

function createTextField(config) {
  return {
    field_key: config.fieldKey,
    field_label: fieldLabels[config.fieldKey],
    x_position: round(config.xRatio, 6),
    y_position: round(config.yRatio, 6),
    width: round(config.widthRatio, 6),
    height: round(config.heightRatio, 6),
    default_text: config.defaultText || '',
    font_family: config.fontFamily || '"Playfair Display", serif',
    font_size: config.fontSize,
    min_font_size: config.minFontSize,
    font_weight: config.fontWeight || '600',
    text_color: config.textColor || '#1a1a2e',
    letter_spacing: config.letterSpacing || 0,
    line_height: config.lineHeight || 1.1,
    text_align: config.textAlign || 'center',
    is_uppercase: config.isUppercase || false,
    is_bold: config.isBold || false,
    is_italic: config.isItalic || false,
    auto_fit_enabled: config.autoFitEnabled || false,
  };
}

function normalizeCoordinatePercent(value, fallback, total) {
  const next = normalizeNumber(value, fallback);
  if (next > 1) return clamp(toPercent(next, total), 0, 1);
  return clamp(next, 0, 1);
}

function isMissingSettingsTableError(error) {
  const code = `${error?.code || ''}`.toLowerCase();
  const message = `${error?.message || ''}`.toLowerCase();
  return code === '42p01' || code === 'pgrst205' || message.includes('certificate_template_settings');
}

function isMissingDefaultTextColumnError(error) {
  const code = `${error?.code || ''}`.toLowerCase();
  const message = `${error?.message || ''}`.toLowerCase();
  return code === '42703' || message.includes('default_text');
}

export function getRuntimeAppUrl() {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return window.location.origin;
  }
  return APP_URL;
}

export function buildVerificationUrl(token) {
  return `${getRuntimeAppUrl().replace(/\/$/, '')}/verify/${token}`;
}

export function getCertificateDescription(course) {
  if (!course) {
    return 'For successfully completing the learning activities during the 100 days tech challenge at MoonTech Life Community';
  }

  return `For successfully completing the learning activities for ${course} during the 100 days tech challenge at MoonTech Life Community`;
}

export function normalizeDescriptionTemplate(text) {
  return `${text || ''}`.replace(
    /learning activities for the\s+\{course\}/gi,
    'learning activities for {course}',
  );
}

export function resolveCoursePlaceholder(text, course) {
  const replacement = `${course || ''}`.trim() || 'the selected course';
  return normalizeDescriptionTemplate(text).replace(/\{course\}/gi, replacement);
}

export function getDefaultSampleData() {
  return {
    recipientName: 'Ada Lovelace',
    selectedCourse: '',
    descriptionText: getCertificateDescription('Cybersecurity'),
    verificationUrl: `${getRuntimeAppUrl().replace(/\/$/, '')}/verify/12345`,
  };
}

export function resolveStudentCertificateDescription(student = {}, savedDefaultText = '') {
  const customDescriptionKeys = [
    'certificate_description',
    'cert_description',
    'custom_certificate_description',
    'description_text',
    'certificate_text',
    'description',
  ];

  for (const key of customDescriptionKeys) {
    const value = student?.[key];
    if (typeof value === 'string' && value.trim()) {
      return resolveCoursePlaceholder(value.trim(), student?.course || '');
    }
  }

  if (typeof savedDefaultText === 'string' && savedDefaultText.trim()) {
    return resolveCoursePlaceholder(savedDefaultText.trim(), student?.course || '');
  }

  return getCertificateDescription(student?.course || '');
}

export function buildCertificatePreviewData({
  recipientName = '',
  course = '',
  token = '',
  verificationUrl = '',
  descriptionText = '',
} = {}) {
  return {
    recipientName: recipientName || '',
    descriptionText: descriptionText || getCertificateDescription(course),
    verificationUrl: verificationUrl || buildVerificationUrl(token || '12345'),
  };
}

export function buildStudentCertificatePreviewData(student = {}, savedDefaultText = '') {
  return buildCertificatePreviewData({
    recipientName: student.full_name || student.name || '',
    course: student.course || '',
    token: student.cert_token || '',
    descriptionText: resolveStudentCertificateDescription(student, savedDefaultText),
  });
}

export async function fetchCourseOptions() {
  const { data, error } = await supabase
    .from('students')
    .select('course')
    .not('course', 'is', null);

  if (error) throw error;

  return [...new Set(
    (data || [])
      .map((row) => `${row.course || ''}`.trim())
      .filter(Boolean),
  )].sort((left, right) => left.localeCompare(right));
}

export async function loadCertificateRenderBundle(previewData) {
  const [templateUrl, { layout, source, warning }] = await Promise.all([
    getCertificateTemplatePublicUrl(),
    fetchCertificateTemplateSettings(),
  ]);

  return {
    templateUrl,
    layout,
    previewData,
    layoutSource: source,
    layoutWarning: warning,
  };
}

export async function loadStudentCertificateRenderBundle(student) {
  const [templateUrl, { layout, source, warning }] = await Promise.all([
    getCertificateTemplatePublicUrl(),
    fetchCertificateTemplateSettings(),
  ]);

  const defaultTextUsed = layout?.description_text?.default_text || '';
  const previewData = buildStudentCertificatePreviewData(
    student,
    defaultTextUsed,
  );

  console.info('[certificate-generation]', {
    studentId: student?.id || null,
    fullName: student?.full_name || student?.name || '',
    course: student?.course || '',
    defaultTextUsed,
    finalDescriptionRendered: previewData.descriptionText,
  });

  return {
    templateUrl,
    layout,
    previewData,
    layoutSource: source,
    layoutWarning: warning,
    student,
    debug: {
      layoutSettings: layout,
      recipientNameSettings: layout.recipient_name,
      descriptionTextSettings: layout.description_text,
      qrCodeSettings: layout.qr_code,
      studentCertificateData: student,
      previewData,
      layoutSource: source,
      layoutWarning: warning,
    },
  };
}

export function createDefaultLayout() {
  return {
    recipient_name: createTextField({
      ...CERT_TEMPLATE_DEFAULT_LAYOUT_RATIOS.recipient_name,
      fieldKey: 'recipient_name',
      fontFamily: '"Playfair Display", serif',
      fontWeight: '700',
      textColor: '#1a1a2e',
      letterSpacing: 0.5,
      lineHeight: 1.05,
      textAlign: 'center',
      isBold: true,
      autoFitEnabled: true,
      fontSize: 92,
      minFontSize: 34,
    }),
    description_text: createTextField({
      ...CERT_TEMPLATE_DEFAULT_LAYOUT_RATIOS.description_text,
      fieldKey: 'description_text',
      defaultText: '',
      fontFamily: 'Montserrat, sans-serif',
      fontWeight: '500',
      textColor: '#2f3552',
      letterSpacing: 0,
      lineHeight: 1.25,
      textAlign: 'center',
      fontSize: 34,
      minFontSize: 18,
    }),
    qr_code: {
      field_key: 'qr_code',
      field_label: fieldLabels.qr_code,
      x_position: round(CERT_TEMPLATE_DEFAULT_LAYOUT_RATIOS.qr_code?.xRatio || 0.073, 6),
      y_position: round(CERT_TEMPLATE_DEFAULT_LAYOUT_RATIOS.qr_code?.yRatio || 0.655, 6),
      width: round(CERT_TEMPLATE_DEFAULT_LAYOUT_RATIOS.qr_code?.widthRatio || 0.11, 6),
      height: round(CERT_TEMPLATE_DEFAULT_LAYOUT_RATIOS.qr_code?.heightRatio || 0.155, 6),
      default_text: null,
      font_family: null,
      font_size: null,
      min_font_size: null,
      font_weight: null,
      text_color: null,
      letter_spacing: null,
      line_height: null,
      text_align: null,
      is_uppercase: false,
      is_bold: false,
      is_italic: false,
      auto_fit_enabled: false,
    },
  };
}

export function normalizeFieldLayout(fieldKey, field, fallback) {
  return {
    ...fallback,
    ...field,
    field_key: fieldKey,
    field_label: field?.field_label || fallback.field_label,
    x_position: normalizeCoordinatePercent(field?.x_position, fallback.x_position, ORIGINAL_CERTIFICATE_WIDTH),
    y_position: normalizeCoordinatePercent(field?.y_position, fallback.y_position, ORIGINAL_CERTIFICATE_HEIGHT),
    width: normalizeCoordinatePercent(field?.width, fallback.width, ORIGINAL_CERTIFICATE_WIDTH, true),
    height: normalizeCoordinatePercent(field?.height, fallback.height, ORIGINAL_CERTIFICATE_HEIGHT, true),
    default_text: fieldKey === 'description_text'
      ? `${field?.default_text ?? fallback.default_text ?? ''}`
      : null,
    font_family: fieldKey === 'description_text'
      ? normalizeDescriptionFontFamily(field?.font_family, fallback.font_family)
      : buildFontFamily(field?.font_family, fallback.font_family),
    font_size: fieldKey === 'qr_code' ? null : round(normalizeNumber(field?.font_size, fallback.font_size)),
    min_font_size: fieldKey === 'qr_code' ? null : round(normalizeNumber(field?.min_font_size, fallback.min_font_size)),
    font_weight: fieldKey === 'qr_code' ? null : String(field?.font_weight || fallback.font_weight || '400'),
    text_color: fieldKey === 'qr_code' ? null : field?.text_color || fallback.text_color,
    letter_spacing: fieldKey === 'qr_code'
      ? null
      : fieldKey === 'description_text'
        ? 0
        : round(normalizeNumber(field?.letter_spacing, fallback.letter_spacing)),
    line_height: fieldKey === 'qr_code'
      ? null
      : fieldKey === 'description_text'
        ? clamp(round(normalizeNumber(field?.line_height, fallback.line_height)), 1.2, 1.3)
        : round(normalizeNumber(field?.line_height, fallback.line_height)),
    text_align: fieldKey === 'qr_code' ? null : normalizeTextAlign(field?.text_align, fallback.text_align),
    is_uppercase: fieldKey === 'qr_code' ? false : normalizeBoolean(field?.is_uppercase, fallback.is_uppercase),
    is_bold: fieldKey === 'qr_code' ? false : normalizeBoolean(field?.is_bold, fallback.is_bold),
    is_italic: fieldKey === 'qr_code' ? false : normalizeBoolean(field?.is_italic, fallback.is_italic),
    auto_fit_enabled: fieldKey === 'recipient_name'
      ? normalizeBoolean(field?.auto_fit_enabled, fallback.auto_fit_enabled)
      : false,
  };
}

export async function getCertificateTemplatePublicUrl() {
  const { data } = supabase.storage
    .from(CERT_TEMPLATE_BUCKET)
    .getPublicUrl(CERT_TEMPLATE_OBJECT_PATH);

  return data?.publicUrl || CERT_TEMPLATE_FALLBACK_URL;
}

export async function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${source}`));
    image.src = source;
  });
}

export async function loadCertificateTemplate() {
  const url = await getCertificateTemplatePublicUrl();
  await loadImage(url);
  return {
    url,
    width: ORIGINAL_CERTIFICATE_WIDTH,
    height: ORIGINAL_CERTIFICATE_HEIGHT,
  };
}

export async function fetchCertificateTemplateSettings() {
  const defaults = createDefaultLayout();
  let { data, error } = await supabase
    .from(CERTIFICATE_SETTINGS_TABLE)
    .select(CERTIFICATE_LAYOUT_COLUMNS.join(','))
    .in('field_key', EDITABLE_FIELD_KEYS)
    .order('field_key');

  if (error && isMissingDefaultTextColumnError(error)) {
    ({ data, error } = await supabase
      .from(CERTIFICATE_SETTINGS_TABLE)
      .select(LEGACY_CERTIFICATE_LAYOUT_COLUMNS.join(','))
      .in('field_key', EDITABLE_FIELD_KEYS)
      .order('field_key'));
  }

  if (error) {
    if (isMissingSettingsTableError(error)) {
      return {
        layout: defaults,
        source: 'default',
        warning: 'The certificate_template_settings table is missing. Defaults are being used.',
      };
    }
    throw error;
  }

  const layout = { ...defaults };
  for (const fieldKey of EDITABLE_FIELD_KEYS) {
    const savedField = data?.find((row) => row.field_key === fieldKey);
    layout[fieldKey] = normalizeFieldLayout(fieldKey, savedField, defaults[fieldKey]);
  }

  return {
    layout,
    source: data?.length ? 'supabase' : 'default',
    warning: data?.length ? '' : 'No saved layout found yet. Using defaults.',
  };
}

export async function saveCertificateTemplateSettings(layout) {
  const rows = EDITABLE_FIELD_KEYS.map((fieldKey) => {
    const field = layout[fieldKey];
    return {
      field_key: fieldKey,
      x_position: round(field.x_position, 6),
      y_position: round(field.y_position, 6),
      width: round(field.width, 6),
      height: round(field.height, 6),
      default_text: fieldKey === 'description_text' ? `${field.default_text || ''}` : null,
      font_family: fieldKey === 'qr_code' ? null : field.font_family,
      font_size: fieldKey === 'qr_code' ? null : round(field.font_size),
      font_weight: fieldKey === 'qr_code' ? null : field.font_weight,
      text_color: fieldKey === 'qr_code' ? null : field.text_color,
      letter_spacing: fieldKey === 'qr_code' ? null : round(field.letter_spacing),
      line_height: fieldKey === 'qr_code' ? null : round(field.line_height),
      text_align: fieldKey === 'qr_code' ? null : field.text_align,
      is_uppercase: fieldKey === 'qr_code' ? false : field.is_uppercase,
      is_bold: fieldKey === 'qr_code' ? false : field.is_bold,
      is_italic: fieldKey === 'qr_code' ? false : field.is_italic,
      auto_fit_enabled: fieldKey === 'recipient_name' ? field.auto_fit_enabled : false,
    };
  });

  let { error } = await supabase
    .from(CERTIFICATE_SETTINGS_TABLE)
    .upsert(rows, { onConflict: 'field_key' });

  if (error && isMissingDefaultTextColumnError(error)) {
    const legacyRows = rows.map((row) => {
      const nextRow = { ...row };
      delete nextRow.default_text;
      return nextRow;
    });
    ({ error } = await supabase
      .from(CERTIFICATE_SETTINGS_TABLE)
      .upsert(legacyRows, { onConflict: 'field_key' }));
  }

  if (error) throw error;
}

export function getUserRoleCandidates(user, profileRole = '') {
  const roles = new Set();
  const pushRole = (role) => {
    if (!role) return;
    if (Array.isArray(role)) {
      role.forEach(pushRole);
      return;
    }
    roles.add(String(role).trim().toLowerCase());
  };

  pushRole(user?.app_metadata?.role);
  pushRole(user?.app_metadata?.roles);
  pushRole(user?.user_metadata?.role);
  pushRole(user?.user_metadata?.roles);
  pushRole(profileRole);
  return [...roles];
}

export async function resolveDesignerAccess() {
  const { data: userData, error } = await supabase.auth.getUser();
  if (error) throw error;

  const user = userData?.user || null;
  if (!user) return { user: null, roles: [], isAllowed: false };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const roles = getUserRoleCandidates(user, profile?.role || '');
  return {
    user,
    roles,
    isAllowed: roles.some((role) => ADMIN_ROLES.has(role)),
  };
}

export function clampLayoutField(fieldKey, field, imageWidth = ORIGINAL_CERTIFICATE_WIDTH, imageHeight = ORIGINAL_CERTIFICATE_HEIGHT) {
  const minWidthPercent = toPercent(fieldKey === 'qr_code' ? 48 : 120, imageWidth);
  const minHeightPercent = toPercent(fieldKey === 'qr_code' ? 48 : 64, imageHeight);
  const width = clamp(normalizeNumber(field.width, minWidthPercent), minWidthPercent, 1);
  const height = clamp(normalizeNumber(field.height, minHeightPercent), minHeightPercent, 1);

  return {
    ...field,
    x_position: clamp(normalizeNumber(field.x_position, 0), 0, 1 - width),
    y_position: clamp(normalizeNumber(field.y_position, 0), 0, 1 - height),
    width,
    height,
  };
}

export function getFieldPixelBox(field, canvasWidth, canvasHeight) {
  return {
    x: toPixels(field.x_position, canvasWidth),
    y: toPixels(field.y_position, canvasHeight),
    width: toPixels(field.width, canvasWidth),
    height: toPixels(field.height, canvasHeight),
  };
}

export function getFieldRenderState(field, text, canvasWidth, canvasHeight, options = {}) {
  const box = getFieldPixelBox(field, canvasWidth, canvasHeight);
  if (field.field_key === 'qr_code') return { box, metrics: null };

  const scale = canvasWidth / ORIGINAL_CERTIFICATE_WIDTH;
  const isRecipientName = field.field_key === 'recipient_name';
  const isDescriptionText = field.field_key === 'description_text';
  const scaledField = {
    ...field,
    width: box.width,
    height: box.height,
    font_size: field.font_size ? field.font_size * scale : field.font_size,
    min_font_size: field.min_font_size ? field.min_font_size * scale : field.min_font_size,
    letter_spacing: isDescriptionText
      ? 0
      : field.letter_spacing
        ? field.letter_spacing * scale
        : field.letter_spacing,
    line_height: isDescriptionText
      ? clamp(normalizeNumber(field.line_height, 1.25), 1.2, 1.3)
      : field.line_height,
  };

  const metrics = getTextMetrics(scaledField, text, {
    allowShrink: isRecipientName ? (field.auto_fit_enabled || options.allowShrink) : false,
    maxLines: options.maxLines || 2,
    minFontSize: scaledField.min_font_size,
  });

  return { box, metrics, scale, scaledField };
}

export function getFieldDebugSnapshot(fieldKey, field, canvasWidth, canvasHeight) {
  const box = getFieldPixelBox(field, canvasWidth, canvasHeight);
  return {
    fieldKey,
    containerWidth: round(canvasWidth, 2),
    containerHeight: round(canvasHeight, 2),
    xPercent: round(field.x_position, 6),
    yPercent: round(field.y_position, 6),
    widthPercent: round(field.width, 6),
    heightPercent: round(field.height, 6),
    renderedX: round(box.x, 2),
    renderedY: round(box.y, 2),
    renderedWidth: round(box.width, 2),
    renderedHeight: round(box.height, 2),
  };
}

export async function createQrDataUrl(value) {
  return QRCode.toDataURL(value, {
    width: 256,
    margin: 1,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
  });
}

export async function renderCertificateToCanvas(canvas, {
  templateImageUrl,
  previewData,
  elements,
  qrDataUrl,
  width = ORIGINAL_CERTIFICATE_WIDTH,
  height = ORIGINAL_CERTIFICATE_HEIGHT,
}) {
  const context = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;

  const templateImage = await loadImage(templateImageUrl || await getCertificateTemplatePublicUrl());
  context.clearRect(0, 0, width, height);
  context.drawImage(templateImage, 0, 0, width, height);

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const textFieldKeys = ['recipient_name', 'description_text'];
  const maxLinesByField = {
    recipient_name: 2,
    description_text: 4,
  };

  textFieldKeys.forEach((fieldKey) => {
    const field = elements[fieldKey];
    const text = fieldKey === 'recipient_name'
      ? previewData.recipientName
      : previewData.descriptionText;
    const renderState = getFieldRenderState(field, text, width, height, {
      allowShrink: true,
      maxLines: maxLinesByField[fieldKey],
    });
    const align = normalizeTextAlign(field.text_align, 'center');

    context.fillStyle = field.text_color;
    context.textAlign = align;
    context.textBaseline = 'middle';
    context.font = buildCanvasFont(renderState.scaledField, renderState.metrics.fontSize);

    const blockTop = renderState.box.y + Math.max((renderState.box.height - renderState.metrics.contentHeight) / 2, 0);

    renderState.metrics.lines.forEach((line, index) => {
      const y = blockTop + renderState.metrics.lineHeightPx * index + renderState.metrics.lineHeightPx / 2;
      let x = renderState.box.x;
      if (align === 'center') x += renderState.box.width / 2;
      if (align === 'right') x += renderState.box.width;

      drawLetterSpacedLine(
        context,
        line,
        x,
        y,
        renderState.scaledField.letter_spacing || 0,
        align,
      );
    });
  });

  const qrValue = previewData.verificationUrl || getDefaultSampleData().verificationUrl;
  const qrSource = qrDataUrl || await createQrDataUrl(qrValue);
  const qrImage = await loadImage(qrSource);
  const qrBox = getFieldPixelBox(elements.qr_code, width, height);

  context.drawImage(qrImage, qrBox.x, qrBox.y, qrBox.width, qrBox.height);
}

export async function renderCertificateArtifact({
  layout,
  sampleData,
  templateUrl,
  width = ORIGINAL_CERTIFICATE_WIDTH,
  height = ORIGINAL_CERTIFICATE_HEIGHT,
}) {
  const canvas = document.createElement('canvas');
  await renderCertificateToCanvas(canvas, {
    templateImageUrl: templateUrl,
    previewData: sampleData,
    elements: layout,
    width,
    height,
  });

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

  return {
    canvas,
    blob,
    dataUrl,
    width,
    height,
  };
}
