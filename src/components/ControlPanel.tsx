import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileImage,
  FileText,
  KeyRound,
  MousePointer2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  BambuddyConfig,
  LabelFitMode,
  LabelInfoTableElement,
  LabelRowKey,
  LabelTextAlign,
  LabelTextStyle,
  LabelTemplate,
  LabelTemplateElement,
  NormalizedLabel,
  SavedLabelTemplate,
} from '../types';
import { labelRowOptions, type LabelRowOption } from '../lib/labelRows';
import { elementDisplayName } from '../lib/templateLayout';

interface ControlPanelProps {
  config: BambuddyConfig | null;
  connectedToInventory: boolean;
  onOpenConnection: () => void;
  label: NormalizedLabel;
  template: LabelTemplate;
  savedTemplates: SavedLabelTemplate[];
  activeTemplateId: string | null;
  templateDirty: boolean;
  importedDraft: boolean;
  templateNameDraft: string;
  designMode: boolean;
  selectedElementId: string;
  loading: boolean;
  shareCode: string;
  importCode: string;
  shareStatus: string;
  exportTextAsPaths: boolean;
  exportStatus: string;
  onTemplateChange: (template: LabelTemplate) => void;
  onSelectTemplate: (templateId: string) => void;
  onSaveTemplate: () => void;
  onSaveTemplateAs: () => void;
  onRenameTemplate: () => void;
  onDuplicateTemplate: () => void;
  onDeleteTemplate: () => void;
  onResetTemplate: () => void;
  onCopyShareCode: () => void;
  onImportCodeChange: (code: string) => void;
  onImportShareCode: () => void;
  onTemplateNameDraftChange: (name: string) => void;
  onDesignModeChange: (enabled: boolean) => void;
  onSelectedElementChange: (elementId: string) => void;
  onRefresh: () => void;
  onExportTextAsPathsChange: (enabled: boolean) => void;
  onDownloadSvg: () => void;
  onDownloadPng: () => void;
}

function updateTemplateElement(
  template: LabelTemplate,
  elementId: string,
  updater: (element: LabelTemplateElement) => LabelTemplateElement,
): LabelTemplate {
  return {
    ...template,
    elements: template.elements.map((element) => (element.id === elementId ? updater(element) : element)),
  };
}

function updateNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const fitModeLabels: Record<LabelFitMode, string> = {
  shrink: 'Shrink',
  wrap: 'Wrap',
  truncate: 'Truncate',
  none: 'None',
};

const textAlignLabels: Record<LabelTextAlign, string> = {
  left: 'Left',
  center: 'Center',
  right: 'Right',
};

const registeredDateFormatPresets = [
  'dd/MM/yyyy (dd MMM yyyy)',
  'dd/MM/yyyy',
  'dd MMM yyyy',
  'yyyy-MM-dd',
  'MMM dd, yyyy',
  'dd mm yyyy',
];

const fontFamilyPresets = [
  'Arial, Helvetica, sans-serif',
  'Helvetica, Arial, sans-serif',
  'Inter, Arial, sans-serif',
  'Verdana, Geneva, sans-serif',
  'Tahoma, Geneva, sans-serif',
  'Georgia, serif',
  '"Times New Roman", Times, serif',
  '"Courier New", Courier, monospace',
];

const rowOptionByKey = new Map(labelRowOptions.map((option) => [option.key, option]));

function isLabelRowOption(value: LabelRowOption | undefined): value is LabelRowOption {
  return Boolean(value);
}

function isTextElement(element: LabelTemplateElement): element is Extract<LabelTemplateElement, { type: 'brand' | 'title' | 'colorName' }> {
  return element.type === 'brand' || element.type === 'title' || element.type === 'colorName';
}

function isStyledTextElement(element: LabelTemplateElement): element is LabelTemplateElement & LabelTextStyle {
  return element.type === 'brand' || element.type === 'title' || element.type === 'colorName' || element.type === 'infoTable';
}

export function ControlPanel({
  config,
  connectedToInventory,
  onOpenConnection,
  label,
  template,
  savedTemplates,
  activeTemplateId,
  templateDirty,
  importedDraft,
  templateNameDraft,
  designMode,
  selectedElementId,
  loading,
  shareCode,
  importCode,
  shareStatus,
  exportTextAsPaths,
  exportStatus,
  onTemplateChange,
  onSelectTemplate,
  onSaveTemplate,
  onSaveTemplateAs,
  onRenameTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  onResetTemplate,
  onCopyShareCode,
  onImportCodeChange,
  onImportShareCode,
  onTemplateNameDraftChange,
  onDesignModeChange,
  onSelectedElementChange,
  onRefresh,
  onExportTextAsPathsChange,
  onDownloadSvg,
  onDownloadPng,
}: ControlPanelProps) {
  const selectedElement = template.elements.find((element) => element.id === selectedElementId) || template.elements[0];
  const activeTemplate = savedTemplates.find((item) => item.id === activeTemplateId);
  const templateSelectValue = activeTemplateId || '__draft__';
  const templateStateLabel = importedDraft ? 'Imported draft' : activeTemplate?.name || 'Unsaved draft';
  const selectedFontFamilies =
    isStyledTextElement(selectedElement) && !fontFamilyPresets.includes(selectedElement.fontFamily)
      ? [selectedElement.fontFamily, ...fontFamilyPresets]
      : fontFamilyPresets;

  const updateSettings = (settings: Partial<LabelTemplate['settings']>) => {
    onTemplateChange({
      ...template,
      settings: {
        ...template.settings,
        ...settings,
      },
    });
  };

  const updateSelectedElement = (updater: (element: LabelTemplateElement) => LabelTemplateElement) => {
    onTemplateChange(updateTemplateElement(template, selectedElement.id, updater));
  };

  const updateSelectedTextColor = (value: string) => {
    updateSelectedElement((element) =>
      isStyledTextElement(element) ? { ...element, textColor: value.toUpperCase() } : element,
    );
  };

  const updateSelectedElementNumber = (key: keyof Pick<LabelTemplateElement, 'xMm' | 'yMm' | 'widthMm' | 'heightMm' | 'fontSizeMm'>, value: string) => {
    updateSelectedElement((element) => {
      const nextValue = updateNumber(value, Number(element[key]));
      if (element.type === 'qr' && (key === 'widthMm' || key === 'heightMm')) {
        return { ...element, widthMm: nextValue, heightMm: nextValue };
      }
      return { ...element, [key]: nextValue };
    });
  };

  const selectedInfoTable = selectedElement.type === 'infoTable' ? selectedElement : null;

  return (
    <aside className="inspector">
      <div className="section-title">
        <MousePointer2 size={17} />
        <span>Template editor</span>
      </div>

      <div className="status-panel">
        <span className={`status-dot ${connectedToInventory ? 'online' : 'offline'}`} />
        <div>
          <strong>{connectedToInventory ? `Bambuddy ${config?.mode === 'direct' ? 'direct' : 'proxy'}` : 'Sample mode'}</strong>
          <small>
            {config?.qrBaseUrl ||
              (config?.mode === 'direct' ? 'Direct connection needs attention' : 'Connect directly or run the Docker proxy')}
          </small>
        </div>
        <button className="icon-button" type="button" onClick={onRefresh} aria-label="Refresh inventory">
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>
      <button className="connection-settings-button" type="button" onClick={onOpenConnection}>
        <KeyRound size={15} />
        Bambuddy connection
      </button>

      <div className="control-group">
        <label>
          Template
          <select value={templateSelectValue} onChange={(event) => onSelectTemplate(event.target.value)}>
            {!activeTemplateId && <option value="__draft__">{templateStateLabel}</option>}
            {savedTemplates.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Template name
          <input value={templateNameDraft} onChange={(event) => onTemplateNameDraftChange(event.target.value)} />
        </label>
        <label className="inline-check">
          <input type="checkbox" checked={designMode} onChange={(event) => onDesignModeChange(event.target.checked)} />
          Design mode
        </label>
        <div className="button-grid">
          <button type="button" onClick={onSaveTemplate}>
            <Save size={15} />
            Save
          </button>
          <button type="button" onClick={onSaveTemplateAs}>
            <Save size={15} />
            Save as
          </button>
          <button type="button" onClick={onRenameTemplate} disabled={!activeTemplateId}>
            <Pencil size={15} />
            Rename
          </button>
          <button type="button" onClick={onDuplicateTemplate}>
            <Copy size={15} />
            Duplicate
          </button>
          <button type="button" onClick={onResetTemplate}>
            <RotateCcw size={15} />
            Reset
          </button>
          <button type="button" onClick={onDeleteTemplate} disabled={!activeTemplateId}>
            <Trash2 size={15} />
            Delete
          </button>
        </div>
        <small className="template-state">
          {templateDirty ? `${templateStateLabel} has unsaved changes` : templateStateLabel}
        </small>
      </div>

      <div className="control-group">
        <label>
          Width
          <input
            type="number"
            min="30"
            max="160"
            step="0.5"
            value={template.settings.widthMm}
            onChange={(event) => updateSettings({ widthMm: updateNumber(event.target.value, template.settings.widthMm) })}
          />
        </label>
        <label>
          Height
          <input
            type="number"
            min="20"
            max="120"
            step="0.5"
            value={template.settings.heightMm}
            onChange={(event) => updateSettings({ heightMm: updateNumber(event.target.value, template.settings.heightMm) })}
          />
        </label>
        <label>
          PNG DPI
          <input
            type="number"
            min="150"
            max="2400"
            step="60"
            value={template.settings.dpi}
            onChange={(event) => updateSettings({ dpi: updateNumber(event.target.value, template.settings.dpi) })}
          />
        </label>
        <label>
          Diameter
          <input value={template.settings.diameter} onChange={(event) => updateSettings({ diameter: event.target.value })} />
        </label>
        <label className="wide-control">
          Registered format
          <input
            list="registered-date-format-presets"
            value={template.settings.registeredDateFormat}
            onChange={(event) => updateSettings({ registeredDateFormat: event.target.value })}
          />
        </label>
        <datalist id="registered-date-format-presets">
          {registeredDateFormatPresets.map((format) => (
            <option key={format} value={format} />
          ))}
        </datalist>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={template.settings.printBackground}
            onChange={(event) => updateSettings({ printBackground: event.target.checked })}
          />
          Print white background
        </label>
      </div>

      <div className="element-panel">
        <span className="control-subtitle">Selected element</span>
        <label>
          Element
          <select value={selectedElement.id} onChange={(event) => onSelectedElementChange(event.target.value)}>
            {template.elements.map((element) => (
              <option key={element.id} value={element.id}>
                {elementDisplayName(element.type)}
              </option>
            ))}
          </select>
        </label>
        <div className="geometry-grid">
          <label>
            X
            <input type="number" step="0.5" value={selectedElement.xMm} onChange={(event) => updateSelectedElementNumber('xMm', event.target.value)} />
          </label>
          <label>
            Y
            <input type="number" step="0.5" value={selectedElement.yMm} onChange={(event) => updateSelectedElementNumber('yMm', event.target.value)} />
          </label>
          <label>
            W
            <input
              type="number"
              min="1"
              step="0.5"
              value={selectedElement.widthMm}
              onChange={(event) => updateSelectedElementNumber('widthMm', event.target.value)}
            />
          </label>
          <label>
            H
            <input
              type="number"
              min="1"
              step="0.5"
              value={selectedElement.heightMm}
              onChange={(event) => updateSelectedElementNumber('heightMm', event.target.value)}
            />
          </label>
        </div>
        {selectedElement.type !== 'qr' && selectedElement.type !== 'swatch' && (
          <label>
            Font size
            <input
              type="number"
              min="1"
              max="16"
              step="0.1"
              value={selectedElement.fontSizeMm}
              onChange={(event) => updateSelectedElementNumber('fontSizeMm', event.target.value)}
            />
          </label>
        )}
        {isStyledTextElement(selectedElement) && (
          <>
            <label className="wide-control">
              Font family
              <select
                value={selectedElement.fontFamily}
                onChange={(event) =>
                  updateSelectedElement((element) =>
                    isStyledTextElement(element) ? { ...element, fontFamily: event.target.value } : element,
                  )
                }
              >
                {selectedFontFamilies.map((fontFamily) => (
                  <option key={fontFamily} value={fontFamily}>
                    {fontFamily}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Text color
              <input
                type="color"
                value={selectedElement.textColor}
                onInput={(event) => updateSelectedTextColor(event.currentTarget.value)}
                onChange={(event) => updateSelectedTextColor(event.currentTarget.value)}
              />
            </label>
            <div className="font-style-grid">
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={selectedElement.bold}
                  onChange={(event) =>
                    updateSelectedElement((element) => (isStyledTextElement(element) ? { ...element, bold: event.target.checked } : element))
                  }
                />
                Bold
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={selectedElement.italic}
                  onChange={(event) =>
                    updateSelectedElement((element) => (isStyledTextElement(element) ? { ...element, italic: event.target.checked } : element))
                  }
                />
                Italic
              </label>
            </div>
          </>
        )}
        {selectedElement.type !== 'qr' && selectedElement.type !== 'swatch' && (
          <label>
            Fit
            <select
              value={selectedElement.fitMode}
              onChange={(event) => updateSelectedElement((element) => ({ ...element, fitMode: event.target.value as LabelFitMode }))}
            >
              {(Object.keys(fitModeLabels) as LabelFitMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {fitModeLabels[mode]}
                </option>
              ))}
            </select>
          </label>
        )}
        {isTextElement(selectedElement) && (
          <label>
            Alignment
            <select
              value={selectedElement.textAlign}
              onChange={(event) =>
                updateSelectedElement((element) =>
                  isTextElement(element) ? { ...element, textAlign: event.target.value as LabelTextAlign } : element,
                )
              }
            >
              {(Object.keys(textAlignLabels) as LabelTextAlign[]).map((alignment) => (
                <option key={alignment} value={alignment}>
                  {textAlignLabels[alignment]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="inline-check">
          <input
            type="checkbox"
            checked={selectedElement.visible}
            onChange={(event) => updateSelectedElement((element) => ({ ...element, visible: event.target.checked }))}
          />
          Visible
        </label>
        {selectedElement.type === 'colorName' && (
          <label className="inline-check">
            <input
              type="checkbox"
              checked={selectedElement.removeTitleWords}
              onChange={(event) =>
                updateSelectedElement((element) =>
                  element.type === 'colorName' ? { ...element, removeTitleWords: event.target.checked } : element,
                )
              }
            />
            Remove title words
          </label>
        )}

        {selectedInfoTable && (
          <InfoTableControls
            element={selectedInfoTable}
            onChange={(nextElement) => updateSelectedElement(() => nextElement)}
          />
        )}
      </div>

      <div className="share-panel">
        <span className="control-subtitle">Share code</span>
        <div className="button-grid two">
          <button type="button" onClick={onCopyShareCode}>
            <Copy size={15} />
            Copy code
          </button>
          <button type="button" onClick={onImportShareCode}>
            <Upload size={15} />
            Import code
          </button>
        </div>
        <textarea
          value={importCode}
          placeholder={shareCode || 'Paste a template code'}
          onChange={(event) => onImportCodeChange(event.target.value)}
          rows={4}
        />
        {shareStatus && <small className="template-state">{shareStatus}</small>}
      </div>

      <div className="qr-panel">
        <span>QR target</span>
        <code>{label.qrUrl}</code>
      </div>

      <div className="export-actions">
        <label className="inline-check export-option">
          <input
            type="checkbox"
            checked={exportTextAsPaths}
            onChange={(event) => onExportTextAsPathsChange(event.target.checked)}
          />
          Export text as paths
        </label>
        <button className="primary-action" type="button" onClick={onDownloadSvg}>
          <FileText size={17} />
          Export SVG
        </button>
        <button className="secondary-action" type="button" onClick={onDownloadPng}>
          <FileImage size={17} />
          Export PNG
        </button>
        {exportStatus && <small className="template-state">{exportStatus}</small>}
      </div>

      <div className="print-spec">
        <Download size={15} />
        <span>
          {template.settings.widthMm} x {template.settings.heightMm} mm, transparent by default for UV print on the insert.
        </span>
      </div>
    </aside>
  );
}

function InfoTableControls({
  element,
  onChange,
}: {
  element: LabelInfoTableElement;
  onChange: (element: LabelInfoTableElement) => void;
}) {
  const orderedRows = element.rowOrder.map((key) => rowOptionByKey.get(key)).filter(isLabelRowOption);

  const moveRow = (key: LabelRowKey, direction: -1 | 1) => {
    const currentIndex = element.rowOrder.indexOf(key);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= element.rowOrder.length) return;
    const rowOrder = [...element.rowOrder];
    [rowOrder[currentIndex], rowOrder[nextIndex]] = [rowOrder[nextIndex], rowOrder[currentIndex]];
    onChange({ ...element, rowOrder });
  };

  return (
    <div className="table-controls">
      <div className="geometry-grid">
        <label>
          Label col
          <input
            type="number"
            min="8"
            step="0.5"
            value={element.labelColumnWidthMm}
            onChange={(event) =>
              onChange({
                ...element,
                labelColumnWidthMm: updateNumber(event.target.value, element.labelColumnWidthMm),
              })
            }
          />
        </label>
        <label>
          Gap
          <input
            type="number"
            min="1"
            step="0.1"
            value={element.colonGapMm}
            onChange={(event) =>
              onChange({
                ...element,
                colonGapMm: updateNumber(event.target.value, element.colonGapMm),
              })
            }
          />
        </label>
      </div>
      <div className="row-order-list">
        {orderedRows.map((option, index) => (
          <div key={option.key} className="row-order-item">
            <label>
              <input
                type="checkbox"
                checked={element.rowVisibility[option.key]}
                onChange={(event) =>
                  onChange({
                    ...element,
                    rowVisibility: {
                      ...element.rowVisibility,
                      [option.key]: event.target.checked,
                    },
                  })
                }
              />
              {option.controlLabel}
            </label>
            <div className="row-order-actions">
              <button
                type="button"
                className="icon-button tiny"
                onClick={() => moveRow(option.key, -1)}
                disabled={index === 0}
                aria-label={`Move ${option.controlLabel} up`}
              >
                <ChevronUp size={13} />
              </button>
              <button
                type="button"
                className="icon-button tiny"
                onClick={() => moveRow(option.key, 1)}
                disabled={index === orderedRows.length - 1}
                aria-label={`Move ${option.controlLabel} down`}
              >
                <ChevronDown size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
