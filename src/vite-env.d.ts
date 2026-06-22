declare module '*.woff?url' {
  const src: string;
  export default src;
}

declare module 'opentype.js' {
  export interface FontPath {
    toPathData(decimalPlaces?: number): string;
  }

  export interface Font {
    getAdvanceWidth(text: string, fontSize: number): number;
    getPath(text: string, x: number, y: number, fontSize: number): FontPath;
  }

  export function parse(buffer: ArrayBuffer): Font;
}

declare const __APP_VERSION__: string;
declare const __DEFAULT_GITHUB_REPOSITORY__: string;
