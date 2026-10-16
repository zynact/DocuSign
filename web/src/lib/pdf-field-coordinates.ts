export interface PdfFieldRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Stored fields use PDF points with a bottom-left origin. The editor uses
// top-left coordinates, also in points (independent of CSS pixels and zoom).
export function fieldTop(field: PdfFieldRectangle, pageHeight: number) {
  return pageHeight - field.y - field.height;
}

// Keep the top-left position when transferring to a differently sized page.
export function fitPdfFieldToPage<T extends PdfFieldRectangle>(
  field: T,
  previousPageHeight: number,
  pageWidth: number,
  pageHeight: number,
): T {
  const width = Math.min(field.width, pageWidth);
  const height = Math.min(field.height, pageHeight);
  const top = clamp(fieldTop(field, previousPageHeight), 0, pageHeight - height);
  return {
    ...field,
    width,
    height,
    x: clamp(field.x, 0, pageWidth - width),
    y: pageHeight - top - height,
  };
}

export function movePdfField<T extends PdfFieldRectangle>(
  field: T,
  dx: number,
  dy: number,
  pageWidth: number,
  pageHeight: number,
): T {
  const top = clamp(
    fieldTop(field, pageHeight) + dy,
    0,
    pageHeight - field.height,
  );
  return {
    ...field,
    x: clamp(field.x + dx, 0, pageWidth - field.width),
    y: pageHeight - top - field.height,
  };
}

export function resizePdfField<T extends PdfFieldRectangle>(
  field: T,
  dx: number,
  dy: number,
  pageWidth: number,
  pageHeight: number,
): T {
  const top = fieldTop(field, pageHeight);
  const width = clamp(
    field.width + dx,
    Math.min(60, pageWidth - field.x),
    pageWidth - field.x,
  );
  const height = clamp(
    field.height + dy,
    Math.min(30, pageHeight - top),
    pageHeight - top,
  );
  return { ...field, width, height, y: pageHeight - top - height };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
