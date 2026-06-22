import type { InventorySpool, LabelSettings, LabelTemplate, NormalizedLabel } from '../types';
import { colorStops } from './colors';
import { defaultRowOrder, defaultRowVisibility } from './labelRows';

export const defaultLabelSettings: LabelSettings = {
  widthMm: 75,
  heightMm: 53.5,
  diameter: '1.75 +/- 0.03 mm',
  registeredDateFormat: 'dd/MM/yyyy (dd MMM yyyy)',
  dpi: 1440,
  printBackground: false,
};

export const defaultLabelTemplate: LabelTemplate = {
  version: 1,
  settings: defaultLabelSettings,
  elements: [
    {
      id: 'brand',
      type: 'brand',
      xMm: 3,
      yMm: 4.4,
      widthMm: 36,
      heightMm: 4.8,
      fontSizeMm: 3.4,
      visible: true,
      fitMode: 'shrink',
      textAlign: 'left',
      fontFamily: 'Arial, Helvetica, sans-serif',
      textColor: '#111111',
      bold: false,
      italic: false,
    },
    {
      id: 'title',
      type: 'title',
      xMm: 3,
      yMm: 9.5,
      widthMm: 44,
      heightMm: 9,
      fontSizeMm: 7.2,
      visible: true,
      fitMode: 'shrink',
      textAlign: 'left',
      fontFamily: 'Arial, Helvetica, sans-serif',
      textColor: '#111111',
      bold: true,
      italic: false,
    },
    {
      id: 'infoTable',
      type: 'infoTable',
      xMm: 3,
      yMm: 21.3,
      widthMm: 46,
      heightMm: 28.8,
      fontSizeMm: 2.92,
      visible: true,
      fitMode: 'shrink',
      rowVisibility: defaultRowVisibility,
      rowOrder: defaultRowOrder,
      labelColumnWidthMm: 19.8,
      colonGapMm: 2.8,
      fontFamily: 'Arial, Helvetica, sans-serif',
      textColor: '#221F1F',
      bold: false,
      italic: false,
    },
    {
      id: 'swatch',
      type: 'swatch',
      xMm: 51,
      yMm: 4,
      widthMm: 18,
      heightMm: 18,
      fontSizeMm: 1,
      visible: true,
      fitMode: 'none',
    },
    {
      id: 'colorName',
      type: 'colorName',
      xMm: 47,
      yMm: 24,
      widthMm: 26,
      heightMm: 8,
      fontSizeMm: 2.85,
      visible: true,
      fitMode: 'wrap',
      textAlign: 'center',
      fontFamily: 'Arial, Helvetica, sans-serif',
      textColor: '#111111',
      bold: true,
      italic: false,
      removeTitleWords: true,
    },
    {
      id: 'qr',
      type: 'qr',
      xMm: 56,
      yMm: 34.5,
      widthMm: 16,
      heightMm: 16,
      fontSizeMm: 1,
      visible: true,
      fitMode: 'none',
      quietModules: 2,
    },
  ],
};

const monthAbbreviations = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface DateParts {
  day: number;
  month: number;
  year: number;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function materialTitle(spool: InventorySpool): string {
  return [spool.material, spool.subtype].filter(Boolean).join(' ').trim() || 'Filament';
}

function formatTemp(spool: InventorySpool): string {
  if (spool.nozzle_temp_min && spool.nozzle_temp_max) {
    return `${spool.nozzle_temp_min}-${spool.nozzle_temp_max} C`;
  }
  if (spool.nozzle_temp_min) return `${spool.nozzle_temp_min} C`;
  if (spool.nozzle_temp_max) return `${spool.nozzle_temp_max} C`;
  return '-';
}

function formatWeight(grams?: number | null): string {
  if (!Number.isFinite(grams)) return '-';
  const rounded = Math.max(0, Math.round(Number(grams)));
  if (rounded >= 1000 && rounded % 1000 === 0) return `${rounded / 1000} kg`;
  if (rounded >= 1000) return `${(rounded / 1000).toFixed(1)} kg`;
  return `${rounded} g`;
}

function datePartsFromValue(value?: string | null): DateParts | null {
  if (!value) return null;
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    const monthIndex = Number(month) - 1;
    if (monthIndex >= 0 && monthIndex < monthAbbreviations.length) {
      return {
        day: Number(day),
        month: Number(month),
        year: Number(year),
      };
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

function formatDateLine(value?: string | null, format = defaultLabelSettings.registeredDateFormat): string {
  const parts = datePartsFromValue(value);
  if (!parts) return '-';

  const monthIndex = parts.month - 1;
  const safeFormat = format.trim() || defaultLabelSettings.registeredDateFormat;
  const tokens: Record<string, string> = {
    d: String(parts.day),
    D: String(parts.day),
    dd: String(parts.day).padStart(2, '0'),
    DD: String(parts.day).padStart(2, '0'),
    m: String(parts.month),
    M: String(parts.month),
    mm: String(parts.month).padStart(2, '0'),
    MM: String(parts.month).padStart(2, '0'),
    mmm: monthAbbreviations[monthIndex],
    MMM: monthAbbreviations[monthIndex],
    mmmm: monthNames[monthIndex],
    MMMM: monthNames[monthIndex],
    yy: String(parts.year).slice(-2),
    YY: String(parts.year).slice(-2),
    yyyy: String(parts.year),
    YYYY: String(parts.year),
  };

  return safeFormat.replace(/yyyy|YYYY|mmmm|MMMM|mmm|MMM|yy|YY|dd|DD|mm|MM|d|D|m|M/g, (token) => tokens[token] || token);
}

export function normalizeLabel(
  spool: InventorySpool,
  settings: LabelSettings,
  qrBaseUrl: string,
): NormalizedLabel {
  const title = materialTitle(spool);
  const colorName = spool.color_name || titleCase(spool.rgba || 'Color');
  const colorHexes = colorStops(spool.rgba, spool.extra_colors);
  const qrRoot = qrBaseUrl.replace(/\/+$/, '');
  const remainingWeight =
    Number.isFinite(spool.weight_used) ? Math.max((spool.label_weight || 0) - Number(spool.weight_used), 0) : null;

  return {
    id: spool.id,
    brand: spool.brand || 'Filament',
    title,
    colorName,
    colorHexes,
    brandLine: spool.brand || '-',
    materialLine: title,
    tempLine: formatTemp(spool),
    netWeightLine: formatWeight(spool.label_weight || 1000),
    coreWeightLine: formatWeight(spool.core_weight),
    usedWeightLine: formatWeight(spool.weight_used),
    remainingWeightLine: formatWeight(remainingWeight),
    colorHexLine: colorHexes[0] || '-',
    registeredLine: formatDateLine(spool.created_at, settings.registeredDateFormat),
    lastUsedLine: formatDateLine(spool.last_used),
    filamentCode: spool.slicer_filament || spool.slicer_filament_name || '-',
    spoolIdLine: `#${spool.id}`,
    storageLine: spool.storage_location || '-',
    categoryLine: spool.category || '-',
    qrUrl: qrRoot ? `${qrRoot}/inventory?spool=${spool.id}` : `/inventory?spool=${spool.id}`,
  };
}

export function exportFileName(label: NormalizedLabel, extension: string): string {
  const filePart = (value: string, fallback: string) =>
    (value || fallback)
      .trim()
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || fallback;

  const safeColorName = filePart(label.colorName, 'Color');
  const safeTitle = filePart(label.title, 'Spool');

  return `buddy-label-${safeColorName}-${safeTitle}.${extension}`;
}
