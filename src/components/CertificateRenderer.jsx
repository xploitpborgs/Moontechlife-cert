import { useEffect, useRef } from 'react';
import {
  EDITABLE_FIELD_KEYS,
  ORIGINAL_CERTIFICATE_WIDTH,
  ORIGINAL_CERTIFICATE_HEIGHT,
  getFieldPixelBox,
  getFieldRenderState,
} from '../utils/certificateDesigner';

const FIELD_SAMPLE_KEYS = {
  recipient_name: 'recipientName',
  description_text: 'descriptionText',
  qr_code: 'verificationUrl',
};

function getInlineAlignment(textAlign) {
  if (textAlign === 'right') return 'flex-end';
  if (textAlign === 'left') return 'flex-start';
  return 'center';
}

function getPreviewFontWeight(field) {
  const configuredWeight = Number.parseInt(field.font_weight, 10);
  const baseWeight = Number.isFinite(configuredWeight) ? configuredWeight : 400;
  return field.is_bold ? Math.max(baseWeight, 700) : baseWeight;
}

export default function CertificateRenderer({
  templateImageUrl,
  elements,
  previewData,
  scale,
  displayWidth,
  displayHeight,
  qrDataUrl,
  onImageStatusChange,
  onMeasure,
}) {
  const imageRef = useRef(null);
  const renderWidth = displayWidth || (scale ? Math.round(ORIGINAL_CERTIFICATE_WIDTH * scale) : 0);
  const renderHeight = displayHeight || (scale ? Math.round(ORIGINAL_CERTIFICATE_HEIGHT * scale) : 0);

  useEffect(() => {
    if (!onMeasure || !imageRef.current) return undefined;

    const measure = () => {
      if (!imageRef.current) return;
      const rect = imageRef.current.getBoundingClientRect();
      onMeasure({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    measure();

    const observer = new ResizeObserver(() => {
      measure();
    });

    observer.observe(imageRef.current);
    return () => observer.disconnect();
  }, [onMeasure, templateImageUrl, scale, displayWidth, displayHeight]);

  if (!templateImageUrl || !elements) {
    return null;
  }

  return (
    <div
      className="designer-renderer"
      style={renderWidth && renderHeight ? { width: renderWidth, height: renderHeight } : undefined}
    >
      <img
        ref={imageRef}
        src={templateImageUrl}
        alt="Certificate Template"
        className="designer-renderer-image"
        onLoad={() => onImageStatusChange?.({ status: 'loaded', url: templateImageUrl })}
        onError={() => onImageStatusChange?.({ status: 'error', url: templateImageUrl })}
      />

      {renderWidth > 0 && renderHeight > 0 && EDITABLE_FIELD_KEYS.map((fieldKey) => {
        const field = elements[fieldKey];
        const box = getFieldPixelBox(field, renderWidth, renderHeight);

        if (fieldKey === 'qr_code') {
          if (!qrDataUrl) return null;
          return (
            <img
              key={fieldKey}
              src={qrDataUrl}
              alt="QR code"
              className="designer-renderer-qr"
              style={{
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
              }}
            />
          );
        }

        const renderState = getFieldRenderState(
          field,
          previewData[FIELD_SAMPLE_KEYS[fieldKey]],
          renderWidth,
          renderHeight,
          {
            allowShrink: fieldKey === 'recipient_name',
            maxLines: fieldKey === 'recipient_name' ? 2 : 4,
          },
        );

        const blockTop = box.y + Math.max((box.height - renderState.metrics.contentHeight) / 2, 0);

        return (
          <div
            key={fieldKey}
            className="designer-renderer-text"
            style={{
              left: box.x,
              top: blockTop,
              width: box.width,
              height: renderState.metrics.contentHeight,
              color: field.text_color,
              fontFamily: field.font_family,
              fontWeight: getPreviewFontWeight(field),
              fontStyle: field.is_italic ? 'italic' : 'normal',
              textTransform: field.is_uppercase ? 'uppercase' : 'none',
              letterSpacing: `${renderState.scaledField.letter_spacing || 0}px`,
              textAlign: field.text_align,
            }}
          >
            {renderState.metrics.lines.map((line, index) => (
              <span
                key={`${fieldKey}-${index}`}
                className="designer-renderer-line"
                style={{
                  height: `${renderState.metrics.lineHeightPx}px`,
                  lineHeight: `${renderState.metrics.lineHeightPx}px`,
                  fontSize: `${renderState.metrics.fontSize}px`,
                  justifyContent: getInlineAlignment(field.text_align),
                }}
              >
                {line}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
