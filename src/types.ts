export type InventorySource = 'local' | 'spoolman';

export type LabelRowKey =
  | 'brand'
  | 'material'
  | 'colorName'
  | 'colorHex'
  | 'diameter'
  | 'printingTemp'
  | 'netWeight'
  | 'coreWeight'
  | 'usedWeight'
  | 'remainingWeight'
  | 'filamentCode'
  | 'spoolId'
  | 'registered'
  | 'lastUsed'
  | 'storage'
  | 'category';

export type LabelRowVisibility = Record<LabelRowKey, boolean>;

export type LabelFitMode = 'shrink' | 'wrap' | 'truncate' | 'none';

export type LabelTextAlign = 'left' | 'center' | 'right';

export type LabelElementType = 'brand' | 'title' | 'infoTable' | 'swatch' | 'colorName' | 'qr';

export interface InventorySpool {
  id: number;
  material: string;
  subtype?: string | null;
  color_name?: string | null;
  rgba?: string | null;
  extra_colors?: string | null;
  effect_type?: string | null;
  brand?: string | null;
  label_weight: number;
  core_weight?: number;
  weight_used?: number;
  slicer_filament?: string | null;
  slicer_filament_name?: string | null;
  nozzle_temp_min?: number | null;
  nozzle_temp_max?: number | null;
  note?: string | null;
  storage_location?: string | null;
  category?: string | null;
  data_origin?: string | null;
  tag_type?: string | null;
  tag_uid?: string | null;
  tray_uid?: string | null;
  tray_uuid?: string | null;
  serial?: string | null;
  serial_number?: string | null;
  sku?: string | null;
  barcode?: string | null;
  created_at?: string;
  updated_at?: string;
  last_used?: string | null;
}

export interface BambuddyConfig {
  configured: boolean;
  connected: boolean;
  baseUrl: string;
  externalUrl: string;
  qrBaseUrl: string;
  hasApiKey: boolean;
  settingsError: string;
  appVersion: string;
  githubRepository: string;
}

export interface LabelSettings {
  widthMm: number;
  heightMm: number;
  diameter: string;
  registeredDateFormat: string;
  dpi: number;
  printBackground: boolean;
}

export interface LabelTemplateElementBase {
  id: string;
  type: LabelElementType;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  fontSizeMm: number;
  visible: boolean;
  fitMode: LabelFitMode;
}

export interface LabelTextStyle {
  fontFamily: string;
  textColor: string;
  bold: boolean;
  italic: boolean;
}

export interface LabelBasicTextElement extends LabelTemplateElementBase, LabelTextStyle {
  type: 'brand' | 'title';
  textAlign: LabelTextAlign;
}

export interface LabelColorNameElement extends LabelTemplateElementBase, LabelTextStyle {
  type: 'colorName';
  textAlign: LabelTextAlign;
  removeTitleWords: boolean;
}

export type LabelTextElement = LabelBasicTextElement | LabelColorNameElement;

export interface LabelInfoTableElement extends LabelTemplateElementBase, LabelTextStyle {
  type: 'infoTable';
  rowVisibility: LabelRowVisibility;
  rowOrder: LabelRowKey[];
  labelColumnWidthMm: number;
  colonGapMm: number;
}

export interface LabelSwatchElement extends LabelTemplateElementBase {
  type: 'swatch';
}

export interface LabelQrElement extends LabelTemplateElementBase {
  type: 'qr';
  quietModules: number;
}

export type LabelTemplateElement =
  | LabelBasicTextElement
  | LabelColorNameElement
  | LabelInfoTableElement
  | LabelSwatchElement
  | LabelQrElement;

export interface LabelTemplate {
  version: 1;
  settings: LabelSettings;
  elements: LabelTemplateElement[];
}

export interface SavedLabelTemplate {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  template: LabelTemplate;
}

export interface LabelTemplateStore {
  version: 1;
  selectedId: string | null;
  templates: SavedLabelTemplate[];
}

export interface NormalizedLabel {
  id: number;
  brand: string;
  title: string;
  colorName: string;
  colorHexes: string[];
  brandLine: string;
  materialLine: string;
  tempLine: string;
  netWeightLine: string;
  coreWeightLine: string;
  usedWeightLine: string;
  remainingWeightLine: string;
  colorHexLine: string;
  registeredLine: string;
  lastUsedLine: string;
  filamentCode: string;
  spoolIdLine: string;
  storageLine: string;
  categoryLine: string;
  qrUrl: string;
}

export interface QrMatrix {
  size: number;
  cells: boolean[];
}
