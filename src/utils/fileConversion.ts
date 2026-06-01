import * as pdfjsLib from 'pdfjs-dist';
import type { PlanPage, ColorMode, UploadOptions } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

const DEFAULT_OPTIONS: UploadOptions = { colorMode: 'full', scale: 1 };

function applyColorMode(
  srcCanvas: HTMLCanvasElement,
  colorMode: ColorMode
): HTMLCanvasElement {
  if (colorMode === 'full') return srcCanvas;
  const out = document.createElement('canvas');
  out.width = srcCanvas.width;
  out.height = srcCanvas.height;
  const ctx = out.getContext('2d')!;
  if (colorMode === 'grayscale') {
    ctx.filter = 'grayscale(1)';
  } else {
    ctx.filter = 'grayscale(1) contrast(2) brightness(1.1)';
  }
  ctx.drawImage(srcCanvas, 0, 0);
  return out;
}

function encodeCanvas(canvas: HTMLCanvasElement, colorMode: ColorMode): string {
  if (colorMode === 'full') return canvas.toDataURL('image/png');
  return canvas.toDataURL('image/jpeg', 0.85);
}

function makePage(
  pageIndex: number,
  imageDataUrl: string,
  width: number,
  height: number,
  colorMode: ColorMode
): PlanPage {
  return {
    pageIndex,
    imageDataUrl,
    width,
    height,
    scale: null,
    colorMode,
    measurements: [],
  };
}

async function convertPDF(file: File, options: UploadOptions): Promise<PlanPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: PlanPage[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: options.scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx as any, canvas, viewport } as any).promise;
    const colored = applyColorMode(canvas, options.colorMode);
    const dataUrl = encodeCanvas(colored, options.colorMode);
    pages.push(makePage(i - 1, dataUrl, viewport.width, viewport.height, options.colorMode));
  }
  return pages;
}

async function convertImage(file: File, options: UploadOptions): Promise<PlanPage[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target!.result as string;
      const img = new Image();
      img.onload = () => {
        const w = Math.round(img.naturalWidth * options.scale);
        const h = Math.round(img.naturalHeight * options.scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const colored = applyColorMode(canvas, options.colorMode);
        const encoded = encodeCanvas(colored, options.colorMode);
        resolve([makePage(0, encoded, w, h, options.colorMode)]);
      };
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function convertTIFF(file: File, options: UploadOptions): Promise<PlanPage[]> {
  const TIFF = await import('tiff');
  const arrayBuffer = await file.arrayBuffer();
  const ifds = TIFF.decode(arrayBuffer) as {
    data: Uint8Array | Uint8ClampedArray;
    width: number;
    height: number;
  }[];
  const pages: PlanPage[] = [];
  for (let i = 0; i < ifds.length; i++) {
    const ifd = ifds[i];
    const { data, width, height } = ifd;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * options.scale);
    canvas.height = Math.round(height * options.scale);
    const ctx = canvas.getContext('2d')!;
    const tmp = document.createElement('canvas');
    tmp.width = width;
    tmp.height = height;
    const tctx = tmp.getContext('2d')!;
    const imageData = tctx.createImageData(width, height);
    if (data.length === width * height * 4) {
      imageData.data.set(data);
    } else if (data.length === width * height * 3) {
      for (let px = 0; px < width * height; px++) {
        imageData.data[px * 4] = data[px * 3];
        imageData.data[px * 4 + 1] = data[px * 3 + 1];
        imageData.data[px * 4 + 2] = data[px * 3 + 2];
        imageData.data[px * 4 + 3] = 255;
      }
    } else {
      for (let px = 0; px < width * height; px++) {
        const v = data[px];
        imageData.data[px * 4] = v;
        imageData.data[px * 4 + 1] = v;
        imageData.data[px * 4 + 2] = v;
        imageData.data[px * 4 + 3] = 255;
      }
    }
    tctx.putImageData(imageData, 0, 0);
    ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
    const colored = applyColorMode(canvas, options.colorMode);
    const dataUrl = encodeCanvas(colored, options.colorMode);
    pages.push(makePage(i, dataUrl, canvas.width, canvas.height, options.colorMode));
  }
  return pages;
}

function parseDXFLines(
  text: string
): { x1: number; y1: number; x2: number; y2: number }[] {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const entities: { type: string; values: Map<number, string[]> }[] = [];
  let current: { type: string; values: Map<number, string[]> } | null = null;
  const rawLines = text.split('\n');
  for (let i = 0; i < rawLines.length - 1; i += 2) {
    const code = parseInt(rawLines[i].trim());
    const val = rawLines[i + 1]?.trim() ?? '';
    if (isNaN(code)) continue;
    if (code === 0) {
      if (current) entities.push(current);
      current = { type: val, values: new Map() };
    } else if (current) {
      const arr = current.values.get(code) ?? [];
      arr.push(val);
      current.values.set(code, arr);
    }
  }
  if (current) entities.push(current);
  for (const entity of entities) {
    if (entity.type === 'LINE') {
      lines.push({
        x1: parseFloat(entity.values.get(10)?.[0] ?? '0'),
        y1: parseFloat(entity.values.get(20)?.[0] ?? '0'),
        x2: parseFloat(entity.values.get(11)?.[0] ?? '0'),
        y2: parseFloat(entity.values.get(21)?.[0] ?? '0'),
      });
    } else if (entity.type === 'LWPOLYLINE') {
      const xs = (entity.values.get(10) ?? []).map(Number);
      const ys = (entity.values.get(20) ?? []).map(Number);
      for (let i = 0; i < xs.length - 1; i++) {
        lines.push({ x1: xs[i], y1: ys[i], x2: xs[i + 1], y2: ys[i + 1] });
      }
    }
  }
  return lines;
}

async function convertDXF(file: File, options: UploadOptions): Promise<PlanPage[]> {
  const text = await file.text();
  const rawLines = parseDXFLines(text);
  const W = Math.round(2000 * options.scale);
  const H = Math.round(1500 * options.scale);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  if (rawLines.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const l of rawLines) {
      minX = Math.min(minX, l.x1, l.x2);
      minY = Math.min(minY, l.y1, l.y2);
      maxX = Math.max(maxX, l.x1, l.x2);
      maxY = Math.max(maxY, l.y1, l.y2);
    }
    const dw = maxX - minX || 1;
    const dh = maxY - minY || 1;
    const sc = Math.min((W - 40) / dw, (H - 40) / dh);
    const ox = (W - dw * sc) / 2 - minX * sc;
    const oy = (H - dh * sc) / 2 - minY * sc;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const l of rawLines) {
      ctx.moveTo(l.x1 * sc + ox, H - (l.y1 * sc + oy));
      ctx.lineTo(l.x2 * sc + ox, H - (l.y2 * sc + oy));
    }
    ctx.stroke();
  }
  const colored = applyColorMode(canvas, options.colorMode);
  return [makePage(0, encodeCanvas(colored, options.colorMode), W, H, options.colorMode)];
}

export async function convertFileToPlanPages(
  file: File,
  options: UploadOptions = DEFAULT_OPTIONS
): Promise<PlanPage[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return convertPDF(file, options);
  if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png'))
    return convertImage(file, options);
  if (name.endsWith('.tif') || name.endsWith('.tiff')) return convertTIFF(file, options);
  if (name.endsWith('.dxf')) return convertDXF(file, options);
  if (name.endsWith('.dwg'))
    throw new Error('Please export DWG to PDF or DXF from AutoCAD first');
  throw new Error(`Unsupported file type: ${file.name}`);
}
