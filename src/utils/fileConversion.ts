import * as pdfjsLib from 'pdfjs-dist';
import type { PlanPage, ColorMode } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

function makePage(
  pageIndex: number,
  imageDataUrl: string,
  width: number,
  height: number
): PlanPage {
  return {
    pageIndex,
    imageDataUrl,
    width,
    height,
    scale: null,
    colorMode: 'full' as ColorMode,
    measurements: [],
  };
}

async function convertPDF(file: File): Promise<PlanPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: PlanPage[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;
    pages.push(makePage(i - 1, canvas.toDataURL('image/png'), viewport.width, viewport.height));
  }
  return pages;
}

async function convertImage(file: File): Promise<PlanPage[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target!.result as string;
      const img = new Image();
      img.onload = () => {
        resolve([makePage(0, dataUrl, img.naturalWidth, img.naturalHeight)]);
      };
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function convertTIFF(file: File): Promise<PlanPage[]> {
  const TIFF = (await import('tiff')).default;
  const arrayBuffer = await file.arrayBuffer();
  const ifds = TIFF.decode(arrayBuffer);
  const pages: PlanPage[] = [];
  for (let i = 0; i < ifds.length; i++) {
    const ifd = ifds[i];
    const { data, width, height } = ifd;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);
    if (data instanceof Uint8Array || data instanceof Uint8ClampedArray) {
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
    }
    ctx.putImageData(imageData, 0, 0);
    pages.push(makePage(i, canvas.toDataURL('image/png'), width, height));
  }
  return pages;
}

function parseDXFLines(text: string): { x1: number; y1: number; x2: number; y2: number }[] {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const sections = text.split(/\s*0\s*\n/);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

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

  const allPts: { x: number; y: number }[] = [];

  for (const entity of entities) {
    if (entity.type === 'LINE') {
      const x1 = parseFloat(entity.values.get(10)?.[0] ?? '0');
      const y1 = parseFloat(entity.values.get(20)?.[0] ?? '0');
      const x2 = parseFloat(entity.values.get(11)?.[0] ?? '0');
      const y2 = parseFloat(entity.values.get(21)?.[0] ?? '0');
      allPts.push({ x: x1, y: y1 }, { x: x2, y: y2 });
      lines.push({ x1, y1, x2, y2 });
    } else if (entity.type === 'LWPOLYLINE') {
      const xs = (entity.values.get(10) ?? []).map(Number);
      const ys = (entity.values.get(20) ?? []).map(Number);
      for (let i = 0; i < xs.length - 1; i++) {
        allPts.push({ x: xs[i], y: ys[i] }, { x: xs[i + 1], y: ys[i + 1] });
        lines.push({ x1: xs[i], y1: ys[i], x2: xs[i + 1], y2: ys[i + 1] });
      }
    }
  }

  void sections;
  return lines;
}

async function convertDXF(file: File): Promise<PlanPage[]> {
  const text = await file.text();
  const rawLines = parseDXFLines(text);

  const W = 2000;
  const H = 1500;
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
    const scale = Math.min((W - 40) / dw, (H - 40) / dh);
    const ox = (W - dw * scale) / 2 - minX * scale;
    const oy = (H - dh * scale) / 2 - minY * scale;

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const l of rawLines) {
      ctx.moveTo(l.x1 * scale + ox, H - (l.y1 * scale + oy));
      ctx.lineTo(l.x2 * scale + ox, H - (l.y2 * scale + oy));
    }
    ctx.stroke();
  }

  return [makePage(0, canvas.toDataURL('image/png'), W, H)];
}

export async function convertFileToPlanPages(file: File): Promise<PlanPage[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return convertPDF(file);
  if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png'))
    return convertImage(file);
  if (name.endsWith('.tif') || name.endsWith('.tiff')) return convertTIFF(file);
  if (name.endsWith('.dxf')) return convertDXF(file);
  if (name.endsWith('.dwg'))
    throw new Error('Please export DWG to PDF or DXF from AutoCAD first');
  throw new Error(`Unsupported file type: ${file.name}`);
}
