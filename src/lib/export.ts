import type { LabelSettings, NormalizedLabel } from '../types';
import { exportFileName } from './label';
import type { Font } from 'opentype.js';
import robotoBoldUrl from 'typeface-roboto/files/roboto-latin-700.woff?url';
import robotoBoldItalicUrl from 'typeface-roboto/files/roboto-latin-700italic.woff?url';
import robotoItalicUrl from 'typeface-roboto/files/roboto-latin-400italic.woff?url';
import robotoRegularUrl from 'typeface-roboto/files/roboto-latin-400.woff?url';

type SvgExportOptions = {
  textAsPaths?: boolean;
};

type OutlineFontKey = 'regular' | 'bold' | 'italic' | 'boldItalic';

const svgNamespace = 'http://www.w3.org/2000/svg';

const outlineFontUrls: Record<OutlineFontKey, string> = {
  regular: robotoRegularUrl,
  bold: robotoBoldUrl,
  italic: robotoItalicUrl,
  boldItalic: robotoBoldItalicUrl,
};

const outlineFontCache = new Map<OutlineFontKey, Promise<Font>>();

function cloneSvg(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', svgNamespace);
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  return clone;
}

function serializeClone(clone: SVGSVGElement): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`;
}

function serializeSvg(svg: SVGSVGElement): string {
  return serializeClone(cloneSvg(svg));
}

function numericAttribute(element: Element, attribute: string, fallback: number): number {
  const value = Number(element.getAttribute(attribute));
  return Number.isFinite(value) ? value : fallback;
}

function isBoldText(text: SVGTextElement): boolean {
  const weight = text.getAttribute('font-weight')?.trim().toLowerCase() || '';
  if (weight === 'bold' || weight === 'bolder') return true;
  const numericWeight = Number(weight);
  return Number.isFinite(numericWeight) && numericWeight >= 600;
}

function isItalicText(text: SVGTextElement): boolean {
  const style = text.getAttribute('font-style')?.trim().toLowerCase() || '';
  return style === 'italic' || style === 'oblique';
}

function outlineFontKey(text: SVGTextElement): OutlineFontKey {
  const bold = isBoldText(text);
  const italic = isItalicText(text);
  if (bold && italic) return 'boldItalic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'regular';
}

async function loadOutlineFont(key: OutlineFontKey): Promise<Font> {
  const cached = outlineFontCache.get(key);
  if (cached) return cached;

  const promise = fetch(outlineFontUrls[key])
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load outline font (${response.status})`);
      return response.arrayBuffer();
    })
    .then(async (buffer) => {
      const { parse } = await import('opentype.js');
      return parse(buffer);
    });

  outlineFontCache.set(key, promise);
  return promise;
}

function textAnchorOffset(text: SVGTextElement, advanceWidth: number): number {
  const anchor = text.getAttribute('text-anchor');
  if (anchor === 'middle') return advanceWidth / 2;
  if (anchor === 'end') return advanceWidth;
  return 0;
}

async function replaceTextWithPath(text: SVGTextElement): Promise<void> {
  const value = text.textContent || '';
  const parent = text.parentNode;
  if (!parent || !value) {
    text.remove();
    return;
  }

  const font = await loadOutlineFont(outlineFontKey(text));
  const fontSize = numericAttribute(text, 'font-size', 3);
  const x = numericAttribute(text, 'x', 0);
  const y = numericAttribute(text, 'y', 0);
  const advanceWidth = font.getAdvanceWidth(value, fontSize);
  const pathX = x - textAnchorOffset(text, advanceWidth);
  const pathData = font.getPath(value, pathX, y, fontSize).toPathData(3);
  const path = text.ownerDocument.createElementNS(svgNamespace, 'path');

  path.setAttribute('d', pathData);
  path.setAttribute('fill', text.getAttribute('fill') || '#000000');
  path.setAttribute('fill-rule', 'nonzero');

  const opacity = text.getAttribute('opacity');
  if (opacity) path.setAttribute('opacity', opacity);
  const fillOpacity = text.getAttribute('fill-opacity');
  if (fillOpacity) path.setAttribute('fill-opacity', fillOpacity);
  const transform = text.getAttribute('transform');
  if (transform) path.setAttribute('transform', transform);

  parent.replaceChild(path, text);
}

async function serializeSvgWithTextPaths(svg: SVGSVGElement): Promise<string> {
  const clone = cloneSvg(svg);
  const textElements = Array.from(clone.querySelectorAll('text'));
  await Promise.all(textElements.map((text) => replaceTextWithPath(text)));
  clone.setAttribute('data-text-export', 'paths');
  return serializeClone(clone);
}

export async function serializeSvgForExport(svg: SVGSVGElement, options: SvgExportOptions = {}): Promise<string> {
  return options.textAsPaths ? serializeSvgWithTextPaths(svg) : serializeSvg(svg);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadSvg(svg: SVGSVGElement, label: NormalizedLabel, options: SvgExportOptions = {}): Promise<void> {
  const svgText = await serializeSvgForExport(svg, options);
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, exportFileName(label, 'svg'));
}

export async function downloadPng(
  svg: SVGSVGElement,
  label: NormalizedLabel,
  settings: LabelSettings,
): Promise<void> {
  const svgText = serializeSvg(svg);
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  const image = new Image();
  image.decoding = 'async';
  const canvas = document.createElement('canvas');
  const pxWidth = Math.round((settings.widthMm / 25.4) * settings.dpi);
  const pxHeight = Math.round((settings.heightMm / 25.4) * settings.dpi);
  canvas.width = pxWidth;
  canvas.height = pxHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Could not render SVG export'));
    image.src = svgUrl;
  });

  ctx.clearRect(0, 0, pxWidth, pxHeight);
  ctx.drawImage(image, 0, 0, pxWidth, pxHeight);
  URL.revokeObjectURL(svgUrl);

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Could not encode PNG'));
      else resolve(blob);
    }, 'image/png');
  });
  downloadBlob(pngBlob, exportFileName(label, 'png'));
}
