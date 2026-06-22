import type { LabelRowKey, LabelRowVisibility } from '../types';

export interface LabelRowOption {
  key: LabelRowKey;
  label: string;
  controlLabel: string;
}

export const labelRowOptions: readonly LabelRowOption[] = [
  { key: 'brand', label: 'Brand', controlLabel: 'Brand' },
  { key: 'material', label: 'Material', controlLabel: 'Material' },
  { key: 'colorName', label: 'Color Name', controlLabel: 'Color name' },
  { key: 'colorHex', label: 'Color', controlLabel: 'RGB hex color' },
  { key: 'diameter', label: 'Diameter', controlLabel: 'Diameter' },
  { key: 'printingTemp', label: 'Printing Temp', controlLabel: 'Printing temp' },
  { key: 'netWeight', label: 'Net Weight', controlLabel: 'Net weight' },
  { key: 'coreWeight', label: 'Core Weight', controlLabel: 'Core weight' },
  { key: 'usedWeight', label: 'Used Weight', controlLabel: 'Used weight' },
  { key: 'remainingWeight', label: 'Remaining', controlLabel: 'Remaining weight' },
  { key: 'filamentCode', label: 'Filament Code', controlLabel: 'Filament code' },
  { key: 'spoolId', label: 'Spool ID', controlLabel: 'Spool ID' },
  { key: 'registered', label: 'Registered', controlLabel: 'Registered date' },
  { key: 'lastUsed', label: 'Last Used', controlLabel: 'Last used date' },
  { key: 'storage', label: 'Storage', controlLabel: 'Storage location' },
  { key: 'category', label: 'Category', controlLabel: 'Category' },
] as const;

export const defaultRowOrder: LabelRowKey[] = labelRowOptions.map((option) => option.key);

export const defaultRowVisibility: LabelRowVisibility = {
  brand: false,
  material: false,
  colorName: false,
  colorHex: true,
  diameter: true,
  printingTemp: true,
  netWeight: true,
  coreWeight: false,
  usedWeight: false,
  remainingWeight: false,
  filamentCode: true,
  spoolId: true,
  registered: true,
  lastUsed: false,
  storage: false,
  category: false,
};
