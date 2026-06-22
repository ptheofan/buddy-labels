import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AlertCircle, CheckCircle2, Printer } from 'lucide-react';
import { ControlPanel } from './components/ControlPanel';
import { InventorySidebar } from './components/InventorySidebar';
import { TemplateCanvas } from './components/TemplateCanvas';
import { sampleSpools } from './data/sampleSpools';
import { fetchConfig, fetchSpools } from './lib/api';
import { downloadPng, downloadSvg } from './lib/export';
import { normalizeLabel } from './lib/label';
import {
  createDefaultTemplate,
  createDefaultTemplateStore,
  createSavedTemplate,
  decodeTemplateShareCode,
  encodeTemplateShareCode,
  loadTemplateStore,
  normalizeTemplate,
  saveTemplateStore,
  updateSavedTemplate,
} from './lib/templates';
import { CURRENT_APP_VERSION, fetchLatestReleaseInfo, isNewerVersion, resolveVersionRepository } from './lib/version';
import type { BambuddyConfig, InventorySource, InventorySpool, LabelTemplate, LabelTemplateStore, QrMatrix } from './types';
import type { LatestReleaseInfo } from './lib/version';
import './styles.css';

interface TemplateState {
  store: LabelTemplateStore;
  activeTemplateId: string | null;
  template: LabelTemplate;
  dirty: boolean;
  importedDraft: boolean;
}

type VersionCheckState =
  | { status: 'idle' | 'checking' | 'unavailable' }
  | { status: 'current' | 'update'; repository: string; release: LatestReleaseInfo }
  | { status: 'error'; repository: string; message: string };

const exportTextAsPathsStorageKey = 'buddy-labels.exportTextAsPaths';

function initialTemplateState(): TemplateState {
  const store = loadTemplateStore();
  const activeTemplate = store.templates.find((template) => template.id === store.selectedId) || store.templates[0];
  return {
    store,
    activeTemplateId: activeTemplate?.id || null,
    template: normalizeTemplate(activeTemplate?.template || createDefaultTemplate()),
    dirty: false,
    importedDraft: false,
  };
}

function initialExportTextAsPaths(): boolean {
  try {
    return window.localStorage.getItem(exportTextAsPathsStorageKey) !== 'false';
  } catch {
    return true;
  }
}

function uniqueTemplateName(name: string, store: LabelTemplateStore, ignoreId?: string): string {
  const baseName = name.trim() || 'Untitled template';
  const existing = new Set(store.templates.filter((item) => item.id !== ignoreId).map((item) => item.name));
  if (!existing.has(baseName)) return baseName;
  let index = 2;
  while (existing.has(`${baseName} ${index}`)) index += 1;
  return `${baseName} ${index}`;
}

function matchesQuery(spool: InventorySpool, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const normalizedNeedle = needle.replace(/^#/, '');
  const compactNeedle = normalizedNeedle.replace(/[\s._:-]+/g, '');
  const haystack = [
    spool.id,
    spool.material,
    spool.subtype,
    spool.brand,
    spool.color_name,
    spool.rgba,
    spool.extra_colors,
    spool.slicer_filament,
    spool.slicer_filament_name,
    spool.storage_location,
    spool.category,
    spool.note,
    spool.data_origin,
    spool.tag_type,
    spool.tag_uid,
    spool.tray_uid,
    spool.tray_uuid,
    spool.serial,
    spool.serial_number,
    spool.sku,
    spool.barcode,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const compactHaystack = haystack.replace(/[\s._:-]+/g, '');
  return haystack.includes(normalizedNeedle) || (compactNeedle.length >= 3 && compactHaystack.includes(compactNeedle));
}

function createQrMatrix(value: string): QrMatrix | null {
  try {
    const qr = QRCode.create(value, {
      errorCorrectionLevel: 'M',
    });
    const cells: boolean[] = [];
    for (let row = 0; row < qr.modules.size; row += 1) {
      for (let col = 0; col < qr.modules.size; col += 1) {
        cells.push(Boolean(qr.modules.get(row, col)));
      }
    }
    return { size: qr.modules.size, cells };
  } catch {
    return null;
  }
}

export default function App() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [config, setConfig] = useState<BambuddyConfig | null>(null);
  const [source, setSource] = useState<InventorySource>('local');
  const [spools, setSpools] = useState<InventorySpool[]>(sampleSpools);
  const [selectedId, setSelectedId] = useState<number>(sampleSpools[0].id);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usingSampleData, setUsingSampleData] = useState(true);
  const [templateState, setTemplateState] = useState<TemplateState>(initialTemplateState);
  const [designMode, setDesignMode] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState(templateState.template.elements[0]?.id || 'brand');
  const [shareCode, setShareCode] = useState('');
  const [importCode, setImportCode] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [exportTextAsPaths, setExportTextAsPaths] = useState(initialExportTextAsPaths);
  const [exportStatus, setExportStatus] = useState('');
  const [versionCheck, setVersionCheck] = useState<VersionCheckState>({ status: 'idle' });
  const [templateNameDraft, setTemplateNameDraft] = useState(
    templateState.store.templates.find((item) => item.id === templateState.activeTemplateId)?.name || 'Custom template',
  );

  const { store: templateStore, activeTemplateId, template, dirty: templateDirty, importedDraft } = templateState;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextConfig = await fetchConfig();
      setConfig(nextConfig);
      if (!nextConfig.configured) {
        throw new Error('BAMBUDDY_URL is not configured; using sample spools');
      }
      const nextSpools = await fetchSpools(source);
      if (!nextSpools.length) {
        throw new Error('Bambuddy returned no spools');
      }
      setSpools(nextSpools);
      setUsingSampleData(false);
      setSelectedId((current) => (nextSpools.some((spool) => spool.id === current) ? current : nextSpools[0].id));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setSpools(sampleSpools);
      setUsingSampleData(true);
      setSelectedId(sampleSpools[0].id);
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const repository = resolveVersionRepository(config?.githubRepository);
    if (!repository) {
      setVersionCheck({ status: 'unavailable' });
      return;
    }

    const controller = new AbortController();
    setVersionCheck({ status: 'checking' });
    void fetchLatestReleaseInfo(repository, controller.signal)
      .then((release) => {
        setVersionCheck({
          status: isNewerVersion(release.version) ? 'update' : 'current',
          repository,
          release,
        });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setVersionCheck({
          status: 'error',
          repository,
          message: err instanceof Error ? err.message : 'Could not check latest release',
        });
      });

    return () => controller.abort();
  }, [config?.githubRepository]);

  useEffect(() => {
    try {
      window.localStorage.setItem(exportTextAsPathsStorageKey, exportTextAsPaths ? 'true' : 'false');
    } catch {
      // Export still works if browser storage is unavailable.
    }
  }, [exportTextAsPaths]);

  const filteredSpools = useMemo(
    () => spools.filter((spool) => matchesQuery(spool, query)),
    [spools, query],
  );

  const selectedSpool = useMemo(
    () => spools.find((spool) => spool.id === selectedId) || spools[0] || sampleSpools[0],
    [spools, selectedId],
  );

  const qrBaseUrl = config?.qrBaseUrl || config?.baseUrl || 'http://bambuddy.local';
  const label = useMemo(() => normalizeLabel(selectedSpool, template.settings, qrBaseUrl), [selectedSpool, template.settings, qrBaseUrl]);
  const qrMatrix = useMemo(() => createQrMatrix(label.qrUrl), [label.qrUrl]);
  const versionTitle = useMemo(() => {
    if (versionCheck.status === 'update') {
      return `Buddy Labels ${CURRENT_APP_VERSION}; latest release is ${versionCheck.release.tagName}`;
    }
    if (versionCheck.status === 'current') {
      return `Buddy Labels ${CURRENT_APP_VERSION}; latest release checked from ${versionCheck.repository}`;
    }
    if (versionCheck.status === 'checking') return 'Checking GitHub releases for updates';
    if (versionCheck.status === 'error') return `${versionCheck.message} (${versionCheck.repository})`;
    return 'GitHub repository is not configured for release checks';
  }, [versionCheck]);

  const handleTemplateChange = useCallback((nextTemplate: LabelTemplate) => {
    setTemplateState((current) => ({
      ...current,
      template: normalizeTemplate(nextTemplate),
      dirty: true,
    }));
    setShareCode('');
    setShareStatus('');
  }, []);

  const handleSelectTemplate = useCallback((templateId: string) => {
    if (templateId === '__draft__') return;
    setTemplateState((current) => {
      const selected = current.store.templates.find((item) => item.id === templateId);
      if (!selected) return current;
      const nextStore = { ...current.store, selectedId: selected.id };
      saveTemplateStore(nextStore);
      const nextTemplate = normalizeTemplate(selected.template);
      setSelectedElementId(nextTemplate.elements[0]?.id || 'brand');
      setTemplateNameDraft(selected.name);
      setShareCode('');
      setShareStatus('');
      return {
        store: nextStore,
        activeTemplateId: selected.id,
        template: nextTemplate,
        dirty: false,
        importedDraft: false,
      };
    });
  }, []);

  const saveAsTemplate = useCallback((defaultName: string) => {
    setTemplateState((current) => {
      const saved = createSavedTemplate(uniqueTemplateName(defaultName || templateNameDraft, current.store), current.template);
      const nextStore = {
        version: 1 as const,
        selectedId: saved.id,
        templates: [...current.store.templates, saved],
      };
      saveTemplateStore(nextStore);
      setTemplateNameDraft(saved.name);
      setShareStatus(`Saved "${saved.name}"`);
      return {
        store: nextStore,
        activeTemplateId: saved.id,
        template: saved.template,
        dirty: false,
        importedDraft: false,
      };
    });
  }, [templateNameDraft]);

  const handleSaveTemplate = useCallback(() => {
    if (!activeTemplateId || importedDraft) {
      saveAsTemplate(importedDraft ? 'Imported template' : 'Custom template');
      return;
    }
    setTemplateState((current) => {
      const nextStore = {
        ...current.store,
        templates: current.store.templates.map((item) =>
          item.id === current.activeTemplateId
            ? {
                ...updateSavedTemplate(item, current.template),
                name: uniqueTemplateName(templateNameDraft, current.store, item.id),
              }
            : item,
        ),
      };
      saveTemplateStore(nextStore);
      const nextName = nextStore.templates.find((item) => item.id === current.activeTemplateId)?.name || templateNameDraft;
      setTemplateNameDraft(nextName);
      setShareStatus('Template saved');
      return {
        ...current,
        store: nextStore,
        dirty: false,
        importedDraft: false,
      };
    });
  }, [activeTemplateId, importedDraft, saveAsTemplate, templateNameDraft]);

  const handleSaveTemplateAs = useCallback(() => {
    const active = templateStore.templates.find((item) => item.id === activeTemplateId);
    saveAsTemplate(templateNameDraft || (active ? `${active.name} copy` : 'Custom template'));
  }, [activeTemplateId, saveAsTemplate, templateNameDraft, templateStore.templates]);

  const handleRenameTemplate = useCallback(() => {
    if (!activeTemplateId) return;
    setTemplateState((current) => {
      const nextName = uniqueTemplateName(templateNameDraft, current.store, current.activeTemplateId || undefined);
      const nextStore = {
        ...current.store,
        templates: current.store.templates.map((item) =>
          item.id === current.activeTemplateId ? { ...item, name: nextName, updatedAt: new Date().toISOString() } : item,
        ),
      };
      saveTemplateStore(nextStore);
      setTemplateNameDraft(nextName);
      return { ...current, store: nextStore };
    });
  }, [activeTemplateId, templateNameDraft]);

  const handleDuplicateTemplate = useCallback(() => {
    const active = templateStore.templates.find((item) => item.id === activeTemplateId);
    saveAsTemplate(active ? `${active.name} copy` : `${templateNameDraft || 'Template'} copy`);
  }, [activeTemplateId, saveAsTemplate, templateNameDraft, templateStore.templates]);

  const handleDeleteTemplate = useCallback(() => {
    if (!activeTemplateId) return;
    const active = templateStore.templates.find((item) => item.id === activeTemplateId);
    if (!window.confirm(`Delete "${active?.name || 'this template'}"?`)) return;
    setTemplateState((current) => {
      const remainingTemplates = current.store.templates.filter((item) => item.id !== current.activeTemplateId);
      const nextStore = remainingTemplates.length
        ? { version: 1 as const, selectedId: remainingTemplates[0].id, templates: remainingTemplates }
        : createDefaultTemplateStore();
      const nextTemplate = nextStore.templates[0].template;
      saveTemplateStore(nextStore);
      setSelectedElementId(nextTemplate.elements[0]?.id || 'brand');
      setTemplateNameDraft(nextStore.templates[0]?.name || 'Custom template');
      return {
        store: nextStore,
        activeTemplateId: nextStore.selectedId,
        template: normalizeTemplate(nextTemplate),
        dirty: false,
        importedDraft: false,
      };
    });
  }, [activeTemplateId, templateStore.templates]);

  const handleResetTemplate = useCallback(() => {
    if (!window.confirm('Reset the current template to the default layout?')) return;
    const nextTemplate = createDefaultTemplate();
    setSelectedElementId(nextTemplate.elements[0]?.id || 'brand');
    setTemplateNameDraft('Default draft');
    setTemplateState((current) => ({
      ...current,
      activeTemplateId: null,
      template: nextTemplate,
      dirty: true,
      importedDraft: false,
    }));
    setShareCode('');
    setShareStatus('Default layout loaded as an unsaved draft');
  }, []);

  const handleCopyShareCode = useCallback(async () => {
    try {
      const nextCode = await encodeTemplateShareCode(template);
      setShareCode(nextCode);
      setImportCode(nextCode);
      try {
        await navigator.clipboard.writeText(nextCode);
        setShareStatus('Template code copied');
      } catch {
        setShareStatus('Template code generated');
      }
    } catch (err) {
      setShareStatus(err instanceof Error ? err.message : 'Could not generate template code');
    }
  }, [template]);

  const handleImportShareCode = useCallback(async () => {
    try {
      const importedTemplate = await decodeTemplateShareCode(importCode);
      setTemplateState((current) => ({
        ...current,
        activeTemplateId: null,
        template: importedTemplate,
        dirty: true,
        importedDraft: true,
      }));
      setSelectedElementId(importedTemplate.elements[0]?.id || 'brand');
      setTemplateNameDraft('Imported template');
      setShareCode('');
      setShareStatus('Imported as unsaved draft');
    } catch (err) {
      setShareStatus(err instanceof Error ? err.message : 'Could not import template code');
    }
  }, [importCode]);

  const handleDownloadSvg = () => {
    if (!svgRef.current) return;
    setExportStatus(exportTextAsPaths ? 'Exporting SVG with text paths...' : 'Exporting SVG...');
    void downloadSvg(svgRef.current, label, { textAsPaths: exportTextAsPaths })
      .then(() => setExportStatus(exportTextAsPaths ? 'SVG exported with text paths' : 'SVG exported'))
      .catch((err) => {
        setExportStatus(err instanceof Error ? err.message : 'Could not export SVG');
      });
  };

  const handleDownloadPng = () => {
    if (!svgRef.current) return;
    void downloadPng(svgRef.current, label, template.settings);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Printer size={19} />
          </div>
          <div>
            <h1>Buddy Labels</h1>
            <p>Bambu-style UV labels from Bambuddy spool inventory</p>
          </div>
        </div>
        <div className="topbar-actions">
          {versionCheck.status === 'update' ? (
            <a className="version-pill update" href={versionCheck.release.url} target="_blank" rel="noreferrer" title={versionTitle}>
              Update v{versionCheck.release.version} available
            </a>
          ) : (
            <span className={`version-pill ${versionCheck.status}`} title={versionTitle}>
              v{CURRENT_APP_VERSION}
              {versionCheck.status === 'checking' ? ' checking' : ''}
            </span>
          )}
          <div className="connection-pill">
            {config?.connected ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{config?.connected ? 'Bambuddy connected' : 'Configure Bambuddy proxy'}</span>
          </div>
        </div>
      </header>

      <main className="workspace">
        <InventorySidebar
          spools={filteredSpools}
          selectedId={selectedId}
          source={source}
          query={query}
          usingSampleData={usingSampleData}
          onQueryChange={setQuery}
          onSourceChange={setSource}
          onSelect={(spool) => setSelectedId(spool.id)}
        />

        <section className="canvas-panel">
          <div className="canvas-toolbar">
            <div>
              <h2>{label.title}</h2>
              <p>
                Insert artwork: {template.settings.widthMm} x {template.settings.heightMm} mm using editable template
              </p>
            </div>
            <span className="spool-token">#{selectedSpool.id}</span>
          </div>

          {error && (
            <div className="inline-alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="label-stage">
            <TemplateCanvas
              label={label}
              template={template}
              qrMatrix={qrMatrix}
              svgRef={svgRef}
              designMode={designMode}
              selectedElementId={selectedElementId}
              onSelectedElementChange={setSelectedElementId}
              onTemplateChange={handleTemplateChange}
            />
          </div>
        </section>

        <ControlPanel
          config={config}
          label={label}
          template={template}
          savedTemplates={templateStore.templates}
          activeTemplateId={activeTemplateId}
          templateDirty={templateDirty}
          importedDraft={importedDraft}
          templateNameDraft={templateNameDraft}
          designMode={designMode}
          selectedElementId={selectedElementId}
          loading={loading}
          shareCode={shareCode}
          importCode={importCode}
          shareStatus={shareStatus}
          exportTextAsPaths={exportTextAsPaths}
          exportStatus={exportStatus}
          onTemplateChange={handleTemplateChange}
          onSelectTemplate={handleSelectTemplate}
          onSaveTemplate={handleSaveTemplate}
          onSaveTemplateAs={handleSaveTemplateAs}
          onRenameTemplate={handleRenameTemplate}
          onDuplicateTemplate={handleDuplicateTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onResetTemplate={handleResetTemplate}
          onCopyShareCode={handleCopyShareCode}
          onImportCodeChange={setImportCode}
          onImportShareCode={handleImportShareCode}
          onTemplateNameDraftChange={setTemplateNameDraft}
          onDesignModeChange={setDesignMode}
          onSelectedElementChange={setSelectedElementId}
          onRefresh={refresh}
          onExportTextAsPathsChange={(enabled) => {
            setExportTextAsPaths(enabled);
            setExportStatus('');
          }}
          onDownloadSvg={handleDownloadSvg}
          onDownloadPng={handleDownloadPng}
        />
      </main>
    </div>
  );
}
