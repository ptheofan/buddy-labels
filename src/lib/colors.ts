export function cleanHex(value?: string | null): string | null {
  if (!value) return null;
  const clean = value.replace(/^#/, '').trim();
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(clean)) return null;
  return `#${clean.slice(0, 6).toUpperCase()}`;
}

export function colorStops(primary?: string | null, extra?: string | null): string[] {
  const stops = [cleanHex(primary)];
  if (extra) {
    for (const token of extra.split(',')) {
      stops.push(cleanHex(token));
    }
  }
  return stops.filter((value): value is string => Boolean(value));
}

export function swatchBackground(colors: string[]): string {
  if (colors.length === 0) return '#8A8A8A';
  if (colors.length === 1) return colors[0];
  const step = 100 / colors.length;
  const parts = colors.map((color, index) => {
    const start = index * step;
    const end = (index + 1) * step;
    return `${color} ${start}% ${end}%`;
  });
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}
