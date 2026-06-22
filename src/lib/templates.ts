import type {
  LabelElementType,
  LabelFitMode,
  LabelInfoTableElement,
  LabelQrElement,
  LabelRowKey,
  LabelRowVisibility,
  LabelTextAlign,
  LabelTextStyle,
  LabelTemplate,
  LabelTemplateElement,
  LabelTemplateStore,
  SavedLabelTemplate,
} from '../types';
import { defaultLabelSettings, defaultLabelTemplate } from './label';
import { defaultRowOrder, defaultRowVisibility, labelRowOptions } from './labelRows';

const storageKey = 'buddy-labels.templates.v1';
const sharePrefix = 'bl1_';
const defaultTemplateId = 'default-bambu-style';
const minTextFontSizeMm = 1.05;
const elementTypes = new Set<LabelElementType>(['brand', 'title', 'infoTable', 'swatch', 'colorName', 'qr']);
const fitModes = new Set<LabelFitMode>(['shrink', 'wrap', 'truncate', 'none']);
const textAlignments = new Set<LabelTextAlign>(['left', 'center', 'right']);
const rowKeys = new Set<LabelRowKey>(labelRowOptions.map((option) => option.key));

type CompactTemplate = {
  v: 1;
  s: {
    w: number;
    h: number;
    d: number;
    b: 0 | 1;
    di: string;
    r?: string;
  };
  e: Array<Record<string, unknown>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isTextStyledElement(element: LabelTemplateElement): element is LabelTemplateElement & LabelTextStyle {
  return element.type === 'brand' || element.type === 'title' || element.type === 'colorName' || element.type === 'infoTable';
}

function normalizeTextColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toUpperCase();
  return fallback;
}

function normalizeFontFamily(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 120);
}

function normalizeTextStyle(source: Record<string, unknown>, fallback: LabelTemplateElement): LabelTextStyle {
  const styleFallback = isTextStyledElement(fallback)
    ? fallback
    : {
        fontFamily: 'Arial, Helvetica, sans-serif',
        textColor: '#111111',
        bold: false,
        italic: false,
      };

  return {
    fontFamily: normalizeFontFamily(source.fontFamily, styleFallback.fontFamily),
    textColor: normalizeTextColor(source.textColor, styleFallback.textColor),
    bold: typeof source.bold === 'boolean' ? source.bold : styleFallback.bold,
    italic: typeof source.italic === 'boolean' ? source.italic : styleFallback.italic,
  };
}

function idFromCrypto(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `template-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalizeRowVisibility(value: unknown): LabelRowVisibility {
  const source = isRecord(value) ? value : {};
  return defaultRowOrder.reduce((next, key) => {
    next[key] = typeof source[key] === 'boolean' ? source[key] : defaultRowVisibility[key];
    return next;
  }, {} as LabelRowVisibility);
}

function normalizeRowOrder(value: unknown): LabelRowKey[] {
  const incoming = Array.isArray(value) ? value.filter((key): key is LabelRowKey => rowKeys.has(key as LabelRowKey)) : [];
  const seen = new Set<LabelRowKey>();
  return [...incoming, ...defaultRowOrder].filter((key) => {
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeElement(value: unknown, fallback: LabelTemplateElement, settings: LabelTemplate['settings']): LabelTemplateElement {
  const source = isRecord(value) ? value : {};
  const type = elementTypes.has(source.type as LabelElementType) ? (source.type as LabelElementType) : fallback.type;
  const maxWidth = settings.widthMm;
  const maxHeight = settings.heightMm;
  const minSize = type === 'qr' ? 12 : type === 'swatch' ? 5 : 2;
  const width = clamp(finiteNumber(source.widthMm, fallback.widthMm), minSize, maxWidth);
  const height = type === 'qr' ? width : clamp(finiteNumber(source.heightMm, fallback.heightMm), minSize, maxHeight);
  const x = clamp(finiteNumber(source.xMm, fallback.xMm), 0, Math.max(0, maxWidth - width));
  const y = clamp(finiteNumber(source.yMm, fallback.yMm), 0, Math.max(0, maxHeight - height));
  const base = {
    id: typeof source.id === 'string' && source.id ? source.id : fallback.id,
    type,
    xMm: x,
    yMm: y,
    widthMm: width,
    heightMm: height,
    fontSizeMm: clamp(finiteNumber(source.fontSizeMm, fallback.fontSizeMm), minTextFontSizeMm, 16),
    visible: typeof source.visible === 'boolean' ? source.visible : fallback.visible,
    fitMode: fitModes.has(source.fitMode as LabelFitMode) ? (source.fitMode as LabelFitMode) : fallback.fitMode,
  };
  const textAlign =
    textAlignments.has(source.textAlign as LabelTextAlign)
      ? (source.textAlign as LabelTextAlign)
      : fallback.type === 'brand' || fallback.type === 'title' || fallback.type === 'colorName'
        ? fallback.textAlign
        : type === 'colorName'
          ? 'center'
          : 'left';
  const textStyle = normalizeTextStyle(source, fallback);

  if (type === 'infoTable') {
    const tableFallback = fallback.type === 'infoTable' ? fallback : defaultLabelTemplate.elements.find((item) => item.type === 'infoTable') as LabelInfoTableElement;
    return {
      ...base,
      type: 'infoTable',
      ...textStyle,
      rowVisibility: normalizeRowVisibility(source.rowVisibility),
      rowOrder: normalizeRowOrder(source.rowOrder),
      labelColumnWidthMm: clamp(finiteNumber(source.labelColumnWidthMm, tableFallback.labelColumnWidthMm), 8, width - 4),
      colonGapMm: clamp(finiteNumber(source.colonGapMm, tableFallback.colonGapMm), 1.2, 8),
    };
  }

  if (type === 'qr') {
    const qrFallback = fallback.type === 'qr' ? fallback : defaultLabelTemplate.elements.find((item) => item.type === 'qr') as LabelQrElement;
    return {
      ...base,
      type: 'qr',
      heightMm: width,
      fontSizeMm: 1,
      fitMode: 'none',
      quietModules: clamp(finiteNumber(source.quietModules, qrFallback.quietModules), 1, 6),
    };
  }

  if (type === 'swatch') {
    return {
      ...base,
      type: 'swatch',
      fontSizeMm: 1,
      fitMode: 'none',
    };
  }

  if (type === 'colorName') {
    const colorFallback = fallback.type === 'colorName' ? fallback : defaultLabelTemplate.elements.find((item) => item.type === 'colorName');
    return {
      ...base,
      type: 'colorName',
      ...textStyle,
      textAlign,
      removeTitleWords:
        typeof source.removeTitleWords === 'boolean'
          ? source.removeTitleWords
          : colorFallback?.type === 'colorName'
            ? colorFallback.removeTitleWords
            : true,
    };
  }

  return {
    ...base,
    type,
    ...textStyle,
    textAlign,
  } as LabelTemplateElement;
}

export function createDefaultTemplate(): LabelTemplate {
  return clone(defaultLabelTemplate);
}

export function normalizeTemplate(value: unknown): LabelTemplate {
  const source = isRecord(value) ? value : {};
  const sourceSettings = isRecord(source.settings) ? source.settings : {};
  const widthMm = clamp(finiteNumber(sourceSettings.widthMm, defaultLabelSettings.widthMm), 30, 160);
  const heightMm = clamp(finiteNumber(sourceSettings.heightMm, defaultLabelSettings.heightMm), 20, 120);
  const settings = {
    widthMm,
    heightMm,
    diameter: typeof sourceSettings.diameter === 'string' && sourceSettings.diameter ? sourceSettings.diameter : defaultLabelSettings.diameter,
    registeredDateFormat:
      typeof sourceSettings.registeredDateFormat === 'string'
        ? sourceSettings.registeredDateFormat
        : defaultLabelSettings.registeredDateFormat,
    dpi: clamp(finiteNumber(sourceSettings.dpi, defaultLabelSettings.dpi), 150, 2400),
    printBackground: typeof sourceSettings.printBackground === 'boolean' ? sourceSettings.printBackground : defaultLabelSettings.printBackground,
  };

  const incomingElements = Array.isArray(source.elements) ? source.elements : [];
  const normalizedElements = defaultLabelTemplate.elements.map((fallback) => {
    const match = incomingElements.find((item) => isRecord(item) && (item.id === fallback.id || item.type === fallback.type));
    return normalizeElement(match, fallback, settings);
  });

  return {
    version: 1,
    settings,
    elements: normalizedElements,
  };
}

export function createDefaultTemplateStore(): LabelTemplateStore {
  const now = isoNow();
  return {
    version: 1,
    selectedId: defaultTemplateId,
    templates: [
      {
        id: defaultTemplateId,
        name: 'Bambu-style default',
        createdAt: now,
        updatedAt: now,
        template: createDefaultTemplate(),
      },
    ],
  };
}

function normalizeSavedTemplate(value: unknown): SavedLabelTemplate | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' && value.id ? value.id : idFromCrypto();
  const now = isoNow();
  return {
    id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'Untitled template',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now,
    template: normalizeTemplate(value.template),
  };
}

export function loadTemplateStore(): LabelTemplateStore {
  if (!globalThis.localStorage) return createDefaultTemplateStore();
  try {
    const raw = globalThis.localStorage.getItem(storageKey);
    if (!raw) return createDefaultTemplateStore();
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.templates)) return createDefaultTemplateStore();
    const templates = parsed.templates.map(normalizeSavedTemplate).filter(Boolean) as SavedLabelTemplate[];
    if (!templates.length) return createDefaultTemplateStore();
    const selectedId =
      typeof parsed.selectedId === 'string' && templates.some((template) => template.id === parsed.selectedId)
        ? parsed.selectedId
        : templates[0].id;
    return { version: 1, selectedId, templates };
  } catch {
    return createDefaultTemplateStore();
  }
}

export function saveTemplateStore(store: LabelTemplateStore): void {
  if (!globalThis.localStorage) return;
  globalThis.localStorage.setItem(storageKey, JSON.stringify(store));
}

export function createSavedTemplate(name: string, template: LabelTemplate): SavedLabelTemplate {
  const now = isoNow();
  return {
    id: idFromCrypto(),
    name: name.trim() || 'Untitled template',
    createdAt: now,
    updatedAt: now,
    template: normalizeTemplate(template),
  };
}

export function updateSavedTemplate(template: SavedLabelTemplate, nextTemplate: LabelTemplate): SavedLabelTemplate {
  return {
    ...template,
    updatedAt: isoNow(),
    template: normalizeTemplate(nextTemplate),
  };
}

function compactTemplate(template: LabelTemplate): CompactTemplate {
  return {
    v: 1,
    s: {
      w: template.settings.widthMm,
      h: template.settings.heightMm,
      d: template.settings.dpi,
      b: template.settings.printBackground ? 1 : 0,
      di: template.settings.diameter,
      r: template.settings.registeredDateFormat,
    },
    e: template.elements.map((element) => {
      const compact: Record<string, unknown> = {
        i: element.id,
        t: element.type,
        x: element.xMm,
        y: element.yMm,
        w: element.widthMm,
        h: element.heightMm,
        z: element.fontSizeMm,
        n: element.visible ? 1 : 0,
        f: element.fitMode,
      };
      if (element.type === 'infoTable') {
        compact.r = element.rowOrder.filter((key) => element.rowVisibility[key]);
        compact.o = element.rowOrder;
        compact.l = element.labelColumnWidthMm;
        compact.c = element.colonGapMm;
      }
      if (isTextStyledElement(element)) {
        compact.p = element.fontFamily;
        compact.u = element.textColor;
        compact.b = element.bold ? 1 : 0;
        compact.j = element.italic ? 1 : 0;
      }
      if (element.type === 'brand' || element.type === 'title' || element.type === 'colorName') compact.a = element.textAlign;
      if (element.type === 'colorName') compact.m = element.removeTitleWords ? 1 : 0;
      if (element.type === 'qr') compact.q = element.quietModules;
      return compact;
    }),
  };
}

function expandCompactTemplate(compact: CompactTemplate): LabelTemplate {
  const sourceElements = compact.e.map((element) => {
    const type = element.t;
    const rowOrder = normalizeRowOrder(element.o);
    const visibleRows = new Set(Array.isArray(element.r) ? element.r : []);
    const rowVisibility = rowOrder.reduce((next, key) => {
      next[key] = visibleRows.has(key);
      return next;
    }, {} as LabelRowVisibility);
    return {
      id: element.i,
      type,
      xMm: element.x,
      yMm: element.y,
      widthMm: element.w,
      heightMm: element.h,
      fontSizeMm: element.z,
      visible: element.n === 1,
      fitMode: element.f,
      rowVisibility,
      rowOrder,
      labelColumnWidthMm: element.l,
      colonGapMm: element.c,
      ...(typeof element.p === 'string' ? { fontFamily: element.p } : {}),
      ...(typeof element.u === 'string' ? { textColor: element.u } : {}),
      ...(typeof element.b === 'number' ? { bold: element.b === 1 } : {}),
      ...(typeof element.j === 'number' ? { italic: element.j === 1 } : {}),
      ...(typeof element.a === 'string' ? { textAlign: element.a } : {}),
      ...(typeof element.m === 'number' ? { removeTitleWords: element.m === 1 } : {}),
      quietModules: element.q,
    };
  });

  return normalizeTemplate({
    version: 1,
    settings: {
      widthMm: compact.s.w,
      heightMm: compact.s.h,
      dpi: compact.s.d,
      printBackground: compact.s.b === 1,
      diameter: compact.s.di,
      registeredDateFormat: compact.s.r,
    },
    elements: sourceElements,
  });
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function gzipText(value: string): Promise<Uint8Array> {
  if (!('CompressionStream' in globalThis)) {
    throw new Error('This browser does not support template compression');
  }
  const stream = new Blob([value]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzipText(bytes: Uint8Array): Promise<string> {
  if (!('DecompressionStream' in globalThis)) {
    throw new Error('This browser does not support template decompression');
  }
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

export async function encodeTemplateShareCode(template: LabelTemplate): Promise<string> {
  const compact = compactTemplate(normalizeTemplate(template));
  const zipped = await gzipText(JSON.stringify(compact));
  return `${sharePrefix}${bytesToBase64Url(zipped)}`;
}

export async function decodeTemplateShareCode(code: string): Promise<LabelTemplate> {
  const trimmed = code.trim();
  if (!trimmed.startsWith(sharePrefix)) throw new Error('Template code must start with bl1_');
  const payload = trimmed.slice(sharePrefix.length);
  const text = await gunzipText(base64UrlToBytes(payload));
  const parsed = JSON.parse(text) as unknown;
  if (!isRecord(parsed) || parsed.v !== 1 || !isRecord(parsed.s) || !Array.isArray(parsed.e)) {
    throw new Error('Template code is not a valid Buddy Labels template');
  }
  return expandCompactTemplate(parsed as CompactTemplate);
}
