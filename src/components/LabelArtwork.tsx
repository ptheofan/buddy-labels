import type { RefObject } from 'react';
import type {
  LabelInfoTableElement,
  LabelTemplate,
  LabelTemplateElement,
  LabelTextElement,
  NormalizedLabel,
  QrMatrix,
} from '../types';
import { elementValue, fitText, tableFontSize, visibleTableRows } from '../lib/templateLayout';

interface LabelArtworkProps {
  label: NormalizedLabel;
  template: LabelTemplate;
  qrMatrix: QrMatrix | null;
  svgRef?: RefObject<SVGSVGElement | null>;
}

function lineStep(fontSizeMm: number): number {
  return fontSizeMm * 1.16;
}

function textAnchor(element: LabelTextElement): 'start' | 'middle' | 'end' {
  const anchors = {
    left: 'start',
    center: 'middle',
    right: 'end',
  } as const;
  return anchors[element.textAlign];
}

function textX(element: LabelTextElement): number {
  if (element.textAlign === 'center') return element.xMm + element.widthMm / 2;
  if (element.textAlign === 'right') return element.xMm + element.widthMm;
  return element.xMm;
}

function renderTextElement(element: LabelTextElement, label: NormalizedLabel) {
  const fitted = fitText(elementValue(element, label), element.widthMm, element.heightMm, element.fontSizeMm, element.fitMode);
  const startY = element.yMm + fitted.fontSizeMm;
  const x = textX(element);

  return (
    <g key={element.id}>
      {fitted.lines.map((line, index) => (
        <text
          key={index}
          x={x}
          y={startY + index * lineStep(fitted.fontSizeMm)}
          textAnchor={textAnchor(element)}
          fontFamily={element.fontFamily}
          fontWeight={element.bold ? 700 : 400}
          fontStyle={element.italic ? 'italic' : 'normal'}
          fontSize={fitted.fontSizeMm}
          fill={element.textColor}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

function renderInfoTable(element: LabelInfoTableElement, label: NormalizedLabel, template: LabelTemplate) {
  const rows = visibleTableRows(element, label, template.settings);
  if (!rows.length) return null;

  const fontSize = tableFontSize(element, rows.length);
  const rowHeight = element.heightMm / rows.length;
  const colonX = element.xMm + element.labelColumnWidthMm;
  const valueX = colonX + element.colonGapMm;
  const labelWidth = Math.max(1, element.labelColumnWidthMm - 1);
  const valueWidth = Math.max(1, element.widthMm - element.labelColumnWidthMm - element.colonGapMm);

  const fontStyle = element.italic ? 'italic' : 'normal';
  const baseWeight = element.bold ? 700 : 400;

  return (
    <g key={element.id}>
      {rows.map((row, index) => {
        const rowY = element.yMm + index * rowHeight;
        const baselineY = rowY + Math.min(rowHeight * 0.78, fontSize);
        const labelFit = fitText(row.label, labelWidth, rowHeight, fontSize, element.fitMode === 'none' ? 'none' : 'shrink');
        const valueFit = fitText(row.value, valueWidth, rowHeight, fontSize, element.fitMode);
        return (
          <g key={row.key}>
            <text
              x={element.xMm}
              y={baselineY}
              fontFamily={element.fontFamily}
              fontSize={labelFit.fontSizeMm}
              fontWeight={baseWeight}
              fontStyle={fontStyle}
              fill={element.textColor}
            >
              {labelFit.lines[0]}
            </text>
            <text
              x={colonX}
              y={baselineY}
              fontFamily={element.fontFamily}
              fontSize={labelFit.fontSizeMm}
              fontWeight={baseWeight}
              fontStyle={fontStyle}
              fill={element.textColor}
            >
              :
            </text>
            {valueFit.lines.map((line, lineIndex) => (
              <text
                key={`${row.key}-${lineIndex}`}
                x={valueX}
                y={baselineY + lineIndex * lineStep(valueFit.fontSizeMm)}
                fontFamily={element.fontFamily}
                fontSize={valueFit.fontSizeMm}
                fontWeight={element.bold || row.key === 'spoolId' ? 700 : 400}
                fontStyle={fontStyle}
                fill={element.textColor}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
}

function renderSwatch(element: LabelTemplateElement, gradientId: string) {
  const size = Math.min(element.widthMm, element.heightMm);
  const cx = element.xMm + element.widthMm / 2;
  const cy = element.yMm + element.heightMm / 2;
  const outerRadius = Math.max(1, size / 2 - 0.3);
  const innerRadius = Math.max(1, outerRadius * 0.68);

  return (
    <g key={element.id}>
      <circle cx={cx} cy={cy} r={outerRadius} fill="none" stroke="#DCDCDC" strokeWidth="0.55" />
      <circle cx={cx} cy={cy} r={innerRadius} fill={`url(#${gradientId})`} stroke="#232323" strokeWidth="0.28" />
    </g>
  );
}

function renderQr(element: LabelTemplateElement, qrMatrix: QrMatrix | null, printBackground: boolean) {
  if (element.type !== 'qr') return null;
  const size = Math.max(12, Math.min(element.widthMm, element.heightMm));
  const quietModules = element.quietModules;
  const moduleSize = qrMatrix ? size / (qrMatrix.size + quietModules * 2) : 0;

  if (!qrMatrix) {
    return (
      <rect
        key={element.id}
        x={element.xMm}
        y={element.yMm}
        width={size}
        height={size}
        fill={printBackground ? '#F1F1F1' : 'transparent'}
        stroke="#CCCCCC"
        strokeWidth="0.25"
      />
    );
  }

  return (
    <g key={element.id} aria-label="Bambuddy edit QR code">
      {printBackground && <rect x={element.xMm} y={element.yMm} width={size} height={size} fill="#FFFFFF" />}
      {qrMatrix.cells.map((filled, index) => {
        if (!filled) return null;
        const row = Math.floor(index / qrMatrix.size);
        const col = index % qrMatrix.size;
        return (
          <rect
            key={index}
            x={element.xMm + (col + quietModules) * moduleSize}
            y={element.yMm + (row + quietModules) * moduleSize}
            width={moduleSize}
            height={moduleSize}
            fill="#111111"
          />
        );
      })}
    </g>
  );
}

function renderElement(element: LabelTemplateElement, label: NormalizedLabel, template: LabelTemplate, qrMatrix: QrMatrix | null, gradientId: string) {
  if (!element.visible) return null;
  if (element.type === 'brand' || element.type === 'title' || element.type === 'colorName') return renderTextElement(element, label);
  if (element.type === 'infoTable') return renderInfoTable(element, label, template);
  if (element.type === 'swatch') return renderSwatch(element, gradientId);
  if (element.type === 'qr') return renderQr(element, qrMatrix, template.settings.printBackground);
  return null;
}

export function LabelArtwork({ label, template, qrMatrix, svgRef }: LabelArtworkProps) {
  const { widthMm, heightMm } = template.settings;
  const gradientId = `swatch-${label.id}`;
  const swatchColors = label.colorHexes.length ? label.colorHexes : ['#8A8A8A'];

  return (
    <svg
      ref={svgRef}
      className="label-svg"
      width={`${widthMm}mm`}
      height={`${heightMm}mm`}
      viewBox={`0 0 ${widthMm} ${heightMm}`}
      role="img"
      aria-label={`${label.title} label for spool ${label.id}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {swatchColors.map((color, index) => {
            const offset = swatchColors.length === 1 ? 0 : (index / (swatchColors.length - 1)) * 100;
            return <stop key={`${color}-${index}`} offset={`${offset}%`} stopColor={color} />;
          })}
        </linearGradient>
      </defs>

      {template.settings.printBackground && <rect x="0" y="0" width={widthMm} height={heightMm} fill="#FFFFFF" />}

      {template.elements.map((element) => renderElement(element, label, template, qrMatrix, gradientId))}
    </svg>
  );
}
