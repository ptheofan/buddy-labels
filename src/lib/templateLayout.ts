import type {
  LabelFitMode,
  LabelInfoTableElement,
  LabelRowKey,
  LabelSettings,
  LabelTemplateElement,
  NormalizedLabel,
} from '../types';
import { labelRowOptions } from './labelRows';

export const minimumFontSizeMm = 1.05;

const rowOptionByKey = new Map(labelRowOptions.map((option) => [option.key, option]));

export function elementDisplayName(type: LabelTemplateElement['type']): string {
  const names: Record<LabelTemplateElement['type'], string> = {
    brand: 'Brand',
    title: 'Title',
    infoTable: 'Info table',
    swatch: 'Color swatch',
    colorName: 'Color name',
    qr: 'QR code',
  };
  return names[type];
}

export function rowValue(key: LabelRowKey, label: NormalizedLabel, settings: LabelSettings): string {
  const values: Record<LabelRowKey, string> = {
    brand: label.brandLine,
    material: label.materialLine,
    colorName: label.colorName,
    colorHex: label.colorHexLine,
    diameter: settings.diameter,
    printingTemp: label.tempLine,
    netWeight: label.netWeightLine,
    coreWeight: label.coreWeightLine,
    usedWeight: label.usedWeightLine,
    remainingWeight: label.remainingWeightLine,
    filamentCode: label.filamentCode,
    spoolId: label.spoolIdLine,
    registered: label.registeredLine,
    lastUsed: label.lastUsedLine,
    storage: label.storageLine,
    category: label.categoryLine,
  };
  return values[key] || '-';
}

function normalizedWord(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#-]+/g, '');
}

function removeTitleWords(colorName: string, title: string): string {
  const titleWords = new Set(title.split(/\s+/).map(normalizedWord).filter(Boolean));
  if (!titleWords.size) return colorName;
  const remainingWords = colorName.split(/\s+/).filter((word) => {
    const normalized = normalizedWord(word);
    return !normalized || !titleWords.has(normalized);
  });
  return remainingWords.length ? remainingWords.join(' ') : colorName;
}

export function elementValue(element: LabelTemplateElement, label: NormalizedLabel): string {
  if (element.type === 'brand') return label.brand;
  if (element.type === 'title') return label.title;
  if (element.type === 'colorName') {
    return element.removeTitleWords ? removeTitleWords(label.colorName, label.title) : label.colorName;
  }
  return '';
}

function estimateTextWidthMm(value: string, fontSizeMm: number): number {
  const wideChars = (value.match(/[MW#@%&]/g) || []).length;
  const narrowChars = (value.match(/[ilI1|. ]/g) || []).length;
  const normalChars = Math.max(0, value.length - wideChars - narrowChars);
  return fontSizeMm * (wideChars * 0.72 + normalChars * 0.54 + narrowChars * 0.28);
}

function lineHeight(fontSizeMm: number): number {
  return fontSizeMm * 1.16;
}

function truncateToWidth(value: string, widthMm: number, fontSizeMm: number): string {
  if (estimateTextWidthMm(value, fontSizeMm) <= widthMm) return value;
  if (widthMm <= estimateTextWidthMm('...', fontSizeMm)) return '';
  let next = value;
  while (next.length > 0 && estimateTextWidthMm(`${next}...`, fontSizeMm) > widthMm) {
    next = next.slice(0, -1);
  }
  return `${next}...`;
}

function wrapToWidth(value: string, widthMm: number, fontSizeMm: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (estimateTextWidthMm(next, fontSizeMm) <= widthMm) {
      current = next;
    } else {
      if (current) lines.push(current);
      if (estimateTextWidthMm(word, fontSizeMm) <= widthMm) {
        current = word;
      } else {
        lines.push(truncateToWidth(word, widthMm, fontSizeMm));
        current = '';
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface FittedText {
  lines: string[];
  fontSizeMm: number;
  overflows: boolean;
}

export function fitText(
  value: string,
  widthMm: number,
  heightMm: number,
  requestedFontSizeMm: number,
  fitMode: LabelFitMode,
): FittedText {
  const text = value || '-';
  const maxFontSize = Math.max(minimumFontSizeMm, requestedFontSizeMm);

  if (fitMode === 'none') {
    return {
      lines: [text],
      fontSizeMm: maxFontSize,
      overflows: estimateTextWidthMm(text, maxFontSize) > widthMm || lineHeight(maxFontSize) > heightMm,
    };
  }

  if (fitMode === 'truncate') {
    const line = truncateToWidth(text, widthMm, maxFontSize);
    return {
      lines: [line],
      fontSizeMm: maxFontSize,
      overflows: lineHeight(maxFontSize) > heightMm,
    };
  }

  if (fitMode === 'wrap') {
    let fontSize = maxFontSize;
    let lines = wrapToWidth(text, widthMm, fontSize);
    while (fontSize > minimumFontSizeMm && lines.length * lineHeight(fontSize) > heightMm) {
      fontSize = Math.max(minimumFontSizeMm, fontSize - 0.1);
      lines = wrapToWidth(text, widthMm, fontSize);
    }
    return {
      lines,
      fontSizeMm: fontSize,
      overflows: lines.length * lineHeight(fontSize) > heightMm,
    };
  }

  const widthRatio = estimateTextWidthMm(text, maxFontSize) > 0 ? widthMm / estimateTextWidthMm(text, maxFontSize) : 1;
  const heightRatio = heightMm / lineHeight(maxFontSize);
  const fontSize = Math.max(minimumFontSizeMm, Math.min(maxFontSize, maxFontSize * widthRatio, maxFontSize * heightRatio));
  return {
    lines: [text],
    fontSizeMm: fontSize,
    overflows: estimateTextWidthMm(text, fontSize) > widthMm || lineHeight(fontSize) > heightMm,
  };
}

export function visibleTableRows(element: LabelInfoTableElement, label: NormalizedLabel, settings: LabelSettings) {
  return element.rowOrder
    .filter((key) => element.rowVisibility[key])
    .map((key) => ({
      key,
      label: rowOptionByKey.get(key)?.label || key,
      value: rowValue(key, label, settings),
    }));
}

export function tableFontSize(element: LabelInfoTableElement, rowCount: number): number {
  if (rowCount <= 0) return element.fontSizeMm;
  if (element.fitMode === 'none') return element.fontSizeMm;
  const requestedLineHeight = lineHeight(element.fontSizeMm);
  const requestedHeight = requestedLineHeight * rowCount;
  if (requestedHeight <= element.heightMm) return element.fontSizeMm;
  if (element.fitMode === 'truncate') return element.fontSizeMm;
  return Math.max(minimumFontSizeMm, element.heightMm / (rowCount * 1.16));
}

export function tableHasOverflow(element: LabelInfoTableElement, label: NormalizedLabel, settings: LabelSettings): boolean {
  const rows = visibleTableRows(element, label, settings);
  if (!rows.length) return false;
  const fontSize = tableFontSize(element, rows.length);
  const rowHeight = element.heightMm / rows.length;
  const valueX = element.labelColumnWidthMm + element.colonGapMm;
  const valueWidth = Math.max(1, element.widthMm - valueX);
  const verticalOverflow = rows.length * lineHeight(fontSize) > element.heightMm;
  const valueOverflow = rows.some((row) => fitText(row.value, valueWidth, rowHeight, fontSize, element.fitMode).overflows);
  return verticalOverflow || valueOverflow;
}

export function elementHasOverflow(element: LabelTemplateElement, label: NormalizedLabel, settings: LabelSettings): boolean {
  if (!element.visible) return false;
  if (element.type === 'infoTable') return tableHasOverflow(element, label, settings);
  if (element.type === 'brand' || element.type === 'title' || element.type === 'colorName') {
    return fitText(elementValue(element, label), element.widthMm, element.heightMm, element.fontSizeMm, element.fitMode).overflows;
  }
  return false;
}
