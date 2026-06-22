import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { LabelTemplate, LabelTemplateElement, NormalizedLabel, QrMatrix } from '../types';
import { elementDisplayName, elementHasOverflow } from '../lib/templateLayout';
import { LabelArtwork } from './LabelArtwork';

interface TemplateCanvasProps {
  label: NormalizedLabel;
  template: LabelTemplate;
  qrMatrix: QrMatrix | null;
  svgRef: RefObject<SVGSVGElement | null>;
  designMode: boolean;
  selectedElementId: string;
  onSelectedElementChange: (elementId: string) => void;
  onTemplateChange: (template: LabelTemplate) => void;
}

type DragMode = 'move' | 'resize';
type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface DragState {
  elementId: string;
  mode: DragMode;
  resizeHandle?: ResizeHandle;
  startClientX: number;
  startClientY: number;
  startElement: LabelTemplateElement;
}

const resizeHandles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundMm(value: number): number {
  return Math.round(value * 20) / 20;
}

function minSize(element: LabelTemplateElement): number {
  if (element.type === 'qr') return 12;
  if (element.type === 'swatch') return 5;
  return 2;
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

function moveElement(element: LabelTemplateElement, dxMm: number, dyMm: number, template: LabelTemplate): LabelTemplateElement {
  return {
    ...element,
    xMm: roundMm(clamp(element.xMm + dxMm, 0, template.settings.widthMm - element.widthMm)),
    yMm: roundMm(clamp(element.yMm + dyMm, 0, template.settings.heightMm - element.heightMm)),
  };
}

function resizeSquareElement(
  element: LabelTemplateElement,
  dxMm: number,
  dyMm: number,
  template: LabelTemplate,
  handle: ResizeHandle,
): LabelTemplateElement {
  const minimum = minSize(element);
  const right = element.xMm + element.widthMm;
  const bottom = element.yMm + element.heightMm;
  const widthCandidate = handle.includes('w')
    ? element.widthMm - dxMm
    : handle.includes('e')
      ? element.widthMm + dxMm
      : element.widthMm;
  const heightCandidate = handle.includes('n')
    ? element.heightMm - dyMm
    : handle.includes('s')
      ? element.heightMm + dyMm
      : element.heightMm;
  const requestedSize =
    (handle.includes('w') || handle.includes('e')) && (handle.includes('n') || handle.includes('s'))
      ? Math.max(widthCandidate, heightCandidate)
      : handle.includes('w') || handle.includes('e')
        ? widthCandidate
        : heightCandidate;
  const maxWidth = handle.includes('w') ? right : template.settings.widthMm - element.xMm;
  const maxHeight = handle.includes('n') ? bottom : template.settings.heightMm - element.yMm;
  const size = roundMm(clamp(requestedSize, minimum, Math.min(maxWidth, maxHeight)));

  return {
    ...element,
    xMm: roundMm(handle.includes('w') ? right - size : element.xMm),
    yMm: roundMm(handle.includes('n') ? bottom - size : element.yMm),
    widthMm: size,
    heightMm: size,
  };
}

function resizeElement(
  element: LabelTemplateElement,
  dxMm: number,
  dyMm: number,
  template: LabelTemplate,
  handle: ResizeHandle,
): LabelTemplateElement {
  if (element.type === 'qr') return resizeSquareElement(element, dxMm, dyMm, template, handle);

  const minimum = minSize(element);
  let left = element.xMm;
  let top = element.yMm;
  let right = element.xMm + element.widthMm;
  let bottom = element.yMm + element.heightMm;

  if (handle.includes('w')) left = clamp(element.xMm + dxMm, 0, right - minimum);
  if (handle.includes('e')) right = clamp(right + dxMm, left + minimum, template.settings.widthMm);
  if (handle.includes('n')) top = clamp(element.yMm + dyMm, 0, bottom - minimum);
  if (handle.includes('s')) bottom = clamp(bottom + dyMm, top + minimum, template.settings.heightMm);

  return {
    ...element,
    xMm: roundMm(left),
    yMm: roundMm(top),
    widthMm: roundMm(right - left),
    heightMm: roundMm(bottom - top),
  };
}

export function TemplateCanvas({
  label,
  template,
  qrMatrix,
  svgRef,
  designMode,
  selectedElementId,
  onSelectedElementChange,
  onTemplateChange,
}: TemplateCanvasProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const selectedElement = template.elements.find((element) => element.id === selectedElementId);

  useEffect(() => {
    if (!dragState) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dxMm = ((event.clientX - dragState.startClientX) / rect.width) * template.settings.widthMm;
      const dyMm = ((event.clientY - dragState.startClientY) / rect.height) * template.settings.heightMm;
      onTemplateChange(
        updateTemplateElement(template, dragState.elementId, () =>
          dragState.mode === 'move'
            ? moveElement(dragState.startElement, dxMm, dyMm, template)
            : resizeElement(dragState.startElement, dxMm, dyMm, template, dragState.resizeHandle || 'se'),
        ),
      );
    };

    const handlePointerUp = () => setDragState(null);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, onTemplateChange, template]);

  const startDrag = (event: ReactPointerEvent, element: LabelTemplateElement, mode: DragMode, resizeHandle?: ResizeHandle) => {
    if (!designMode) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectedElementChange(element.id);
    overlayRef.current?.focus();
    setDragState({
      elementId: element.id,
      mode,
      resizeHandle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startElement: element,
    });
  };

  const nudgeSelected = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!designMode || !selectedElement) return;
    const step = event.shiftKey ? 2 : 0.5;
    const deltas: Record<string, [number, number] | undefined> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    onTemplateChange(updateTemplateElement(template, selectedElement.id, (element) => moveElement(element, delta[0], delta[1], template)));
  };

  return (
    <div className="label-shadow template-canvas" style={{ aspectRatio: `${template.settings.widthMm} / ${template.settings.heightMm}` }}>
      <LabelArtwork label={label} template={template} qrMatrix={qrMatrix} svgRef={svgRef} />

      {designMode && (
        <div
          ref={overlayRef}
          className="editor-overlay"
          tabIndex={0}
          onKeyDown={nudgeSelected}
          aria-label="Label template editor"
        >
          {template.elements.map((element) => {
            const warning = elementHasOverflow(element, label, template.settings);
            return (
              <button
                key={element.id}
                type="button"
                className={`editor-box ${selectedElementId === element.id ? 'selected' : ''} ${warning ? 'warning' : ''} ${
                  element.visible ? '' : 'hidden-element'
                }`}
                style={{
                  left: `${(element.xMm / template.settings.widthMm) * 100}%`,
                  top: `${(element.yMm / template.settings.heightMm) * 100}%`,
                  width: `${(element.widthMm / template.settings.widthMm) * 100}%`,
                  height: `${(element.heightMm / template.settings.heightMm) * 100}%`,
                }}
                aria-label={`${elementDisplayName(element.type)} element`}
                onClick={() => onSelectedElementChange(element.id)}
                onPointerDown={(event) => startDrag(event, element, 'move')}
              >
                <span className="editor-box-label">{elementDisplayName(element.type)}</span>
                {selectedElementId === element.id &&
                  resizeHandles.map((handle) => (
                    <span
                      key={handle}
                      className={`resize-handle resize-handle-${handle}`}
                      data-handle={handle}
                      onPointerDown={(event) => startDrag(event, element, 'resize', handle)}
                      aria-hidden="true"
                    />
                  ))}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
