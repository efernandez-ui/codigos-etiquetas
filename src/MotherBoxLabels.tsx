import React, { useState } from 'react';
import JsBarcode from 'jsbarcode';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import { Archive, FileCode2, FileText, Plus, Printer, Trash2, Eraser } from 'lucide-react';

type Logo = { name: string; dataUrl: string; width: number; height: number };
type Field = 'code' | 'description' | 'quantity' | 'cartonLength' | 'cartonWidth' | 'cartonHeight' | 'grossWeight' | 'netWeight';
type Item = Record<Field, string> & { id: number };
type Design = { barcodeWidthPercent: number; barcodeHeight: number; codeFontSize: number; dataFontSize: number };

let nextId = 1;
const fixedFooter = 'HECHO EN CHINA - Importado por Intercap S.R.L. Cuit: 30-64437204-5';
const newItem = (): Item => ({ id: nextId++, code: '', description: '', quantity: '', cartonLength: '', cartonWidth: '', cartonHeight: '', grossWeight: '', netWeight: '' });
const example: Item = { ...newItem(), code: '025.019.19.0001', description: 'LINGA PK4 GRIS Ø 20 X 1200 mm (CABLE DE ACERO TRENZADO CON REVESTIMIENTO PLASTICO)', quantity: '10' };
const columns: { key: Field; label: string; width: string }[] = [
  { key: 'code', label: 'Código INP', width: '12%' }, { key: 'description', label: 'Descripción', width: '42%' },
  { key: 'quantity', label: 'Cantidad', width: '6%' }, { key: 'cartonLength', label: 'Carton largo', width: '6%' },
  { key: 'cartonWidth', label: 'Carton ancho', width: '6%' }, { key: 'cartonHeight', label: 'Carton alto', width: '6%' },
  { key: 'grossWeight', label: 'G/WEIGHT', width: '7%' }, { key: 'netWeight', label: 'N/WEIGHT', width: '7%' },
];
const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const hasContent = (item: Item) => !!(item.code.trim() || item.description.trim() || item.quantity.trim());
const barcodeValue = (item: Item) => `${item.code.replace(/[.\s]/g, '')}${item.quantity.trim()}`;
const safeName = (item: Item, index: number, width: number, height: number) => `caja-madre-${index + 1}-${item.code.trim().replace(/[^a-zA-Z0-9.-]+/g, '-') || 'etiqueta'}-${width}x${height}cm`;

function wrap(value: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const word of value.trim().split(/\s+/).filter(Boolean)) {
    const last = lines.length - 1;
    if (last >= 0 && `${lines[last]} ${word}`.length <= maxChars) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  return lines.slice(0, maxLines);
}

function barcodeFor(item: Item): { value: string; markup: string; sourceWidth: number; sourceHeight: number; error: string } {
  const value = barcodeValue(item);
  if (!item.code.trim() || !item.quantity.trim()) return { value, markup: '', sourceWidth: 0, sourceHeight: 0, error: 'Ingresá código INP y cantidad para generar las barras.' };
  try {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(node, value.trim(), { format: 'CODE128', width: 2, height: 110, displayValue: false, margin: 0, lineColor: '#000', background: '#ffffff00' });
    const [, , sourceWidth, sourceHeight] = (node.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    if (!sourceWidth || !sourceHeight) throw new Error('Invalid barcode dimensions');
    return { value, markup: node.innerHTML, sourceWidth, sourceHeight, error: '' };
  } catch { return { value, markup: '', sourceWidth: 0, sourceHeight: 0, error: 'Código de barras inválido para CODE 128.' }; }
}

function svgToPng(svg: string, pixelWidth: number, pixelHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvas.getContext('2d')?.drawImage(image, 0, 0, pixelWidth, pixelHeight);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo renderizar la etiqueta.')); };
    image.src = url;
  });
}

function createSvg(item: Item, width: number, height: number, barcode: ReturnType<typeof barcodeFor>, design: Design, logo: Logo | null, logoSize: number): string {
  const H = 1000 * height / width;
  const sy = (n: number) => n * H / 1000;
  const rect = (x: number, y: number, w: number, h: number, stroke = 'none', sw = 0) => `<rect x="${x}" y="${sy(y)}" width="${w}" height="${sy(h)}" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>`;
  const line = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${x1}" y1="${sy(y1)}" x2="${x2}" y2="${sy(y2)}" stroke="#111" stroke-width="3"/>`;
  const text = (x: number, y: number, value: string, size: number, weight = 400, anchor = 'start', extra = '') => `<text x="${x}" y="${sy(y)}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="#111" ${extra}>${esc(value)}</text>`;
  const descriptionLines = wrap(item.description.toUpperCase(), 39, 3);
  const descriptionFont = descriptionLines.some(value => value.length > 35) ? design.dataFontSize * .875 : design.dataFontSize;
  const logoScale = logoSize / 100;
  const logoSvg = logo ? `<image x="60" y="${sy(28)}" width="${260 * logoScale}" height="${sy(125) * logoScale}" href="${logo.dataUrl}" preserveAspectRatio="xMinYMin meet"/>` : '';
  // The frame spans x=42..958. Keep a 3 mm quiet zone at each side of the bars.
  const quietZone = 300 / width;
  const barcodeWidth = (916 - quietZone * 2) * design.barcodeWidthPercent / 100;
  const barcodeX = 500 - barcodeWidth / 2;
  // A transform scales JsBarcode's actual vector paths. Its width/height attributes use
  // px units, which cannot be concatenated into a valid viewBox.
  const barcodeSvg = !barcode.error ? `<g transform="translate(${barcodeX} ${sy(682)}) scale(${barcodeWidth / barcode.sourceWidth} ${sy(design.barcodeHeight) / barcode.sourceHeight})">${barcode.markup}</g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}cm" height="${height}cm" viewBox="0 0 1000 ${H}">
    ${rect(0, 0, 1000, 1000)}${logoSvg}
    ${text(505, 122, 'CÓDIGO:', 38)}${text(510, 186, item.code, design.codeFontSize, 700, 'start', item.code.length > 17 ? 'textLength="425" lengthAdjust="spacingAndGlyphs"' : '')}
    ${rect(42, 238, 916, 668, '#111', 3)}
    ${text(60, 281, 'DESCRIPCIÓN:', 34)}
    ${descriptionLines.map((value, i) => text(62, 340 + i * 45, value, descriptionFont, i === 0 ? 700 : 500, 'start', value.length > 35 ? 'textLength="875" lengthAdjust="spacingAndGlyphs"' : '')).join('')}
    ${line(42, 465, 958, 465)}${text(55, 516, `CANTIDAD: ${item.quantity}`, design.dataFontSize, 600)}
    ${line(42, 535, 958, 535)}${text(55, 584, 'CARTON SIZE:', 38, 600)}${text(370, 585, `${item.cartonLength || '____'}  x  ${item.cartonWidth || '____'}  x  ${item.cartonHeight || '____'}  cm`, design.dataFontSize, 600)}
    ${line(42, 605, 958, 605)}${line(500, 605, 500, 674)}${text(55, 651, 'G/WEIGHT:', 37, 600)}${text(305, 650, item.grossWeight, design.dataFontSize)}${text(510, 651, 'N/WEIGHT:', 37, 600)}${text(770, 650, item.netWeight, design.dataFontSize)}
    ${line(42, 674, 958, 674)}${barcodeSvg}${text(500, 885, barcode.value, design.codeFontSize, 400, 'middle')}
    ${text(500, 945, fixedFooter, 28, 700, 'middle', 'textLength="860" lengthAdjust="spacingAndGlyphs"')}
  </svg>`;
}

async function pdfBytes(svg: string, width: number, height: number, logo: Logo | null, logoSize: number): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: width > height ? 'l' : 'p', unit: 'cm', format: [width, height] });
  const element = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  element.querySelector('image')?.remove();
  const renderedSvg = new XMLSerializer().serializeToString(element);
  const png = await svgToPng(renderedSvg, 2000, Math.round(2000 * height / width));
  doc.addImage(png, 'PNG', 0, 0, width, height);
  if (logo) {
    const boxWidth = width * .26 * logoSize / 100;
    const boxHeight = height * .125 * logoSize / 100;
    const scale = Math.min(boxWidth / logo.width, boxHeight / logo.height);
    doc.addImage(logo.dataUrl, 'PNG', width * .06, height * .028, logo.width * scale, logo.height * scale);
  }
  return new Uint8Array(doc.output('arraybuffer'));
}

function download(content: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function MotherBoxLabels() {
  const [items, setItems] = useState<Item[]>([example]);
  const [width, setWidth] = useState(15);
  const [height, setHeight] = useState(15);
  const [design, setDesign] = useState<Design>({ barcodeWidthPercent: 100, barcodeHeight: 150, codeFontSize: 41, dataFontSize: 40 });
  const [logo, setLogo] = useState<Logo | null>(null);
  const [logoSize, setLogoSize] = useState(130);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const validItems = items.map((item, index) => ({ item, index })).filter(({ item }) => hasContent(item));

  const update = (id: number, field: Field, value: string) => setItems(previous => previous.map(item => item.id === id ? { ...item, [field]: value } : item));
  const remove = (id: number) => setItems(previous => previous.filter(row => row.id !== id));
  const clear = () => {
    setItems([newItem()]); setMessage('Base de datos limpia.');
  };
  const onPaste = (event: React.ClipboardEvent<HTMLInputElement>, rowIndex: number, fieldIndex: number) => {
    const value = event.clipboardData.getData('text');
    if (!/[\t\r\n]/.test(value)) return;
    event.preventDefault();
    const rows = value.split(/\r?\n/).filter(row => row.trim());
    setItems(previous => {
      const next = [...previous];
      rows.forEach((row, offset) => {
        const target = rowIndex + offset;
        if (target >= 28) return;
        while (next.length <= target) next.push(newItem());
        const updated = { ...next[target] };
        row.split('\t').forEach((cell, column) => {
          const key = columns[fieldIndex + column]?.key;
          if (key) updated[key] = cell.trim();
        });
        next[target] = updated;
      });
      return next;
    });
    setMessage('Datos pegados desde Excel.');
  };
  const onLogo = async (file?: File) => {
    if (!file) return;
    try {
      const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      if (signature.length !== 8 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => signature[index] === byte)) throw new Error('Seleccioná un archivo PNG válido.');
      const loadedUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('No se pudo leer el PNG.'));
        reader.readAsDataURL(file);
      });
      const dataUrl = loadedUrl.replace(/^data:[^;]*;base64,/, 'data:image/png;base64,');
      const imageInfo = await new Promise<{ width: number; height: number; transparent: boolean }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(image.naturalWidth, 128);
          canvas.height = Math.min(image.naturalHeight, 128);
          const context = canvas.getContext('2d');
          if (!context) { reject(new Error('No se pudo comprobar el PNG.')); return; }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let transparent = false;
          for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 250) { transparent = true; break; }
          resolve({ width: image.naturalWidth, height: image.naturalHeight, transparent });
        };
        image.onerror = () => reject(new Error('No se pudo abrir el PNG.'));
        image.src = dataUrl;
      });
      setLogo({ name: file.name, dataUrl, width: imageInfo.width, height: imageInfo.height });
      setMessage(imageInfo.transparent ? 'Logo PNG cargado. Se aplica a todas las etiquetas.' : 'Logo PNG cargado, pero parece no tener transparencia; su fondo se verá en la etiqueta.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo abrir el logo.'); }
  };
  const exportOne = async (item: Item, index: number, format: 'svg' | 'pdf', print = false) => {
    const barcode = barcodeFor(item);
    if (barcode.error) { setMessage(`Fila ${index + 1}: ${barcode.error}`); return; }
    const svg = createSvg(item, width, height, barcode, design, logo, logoSize);
    const name = safeName(item, index, width, height);
    if (format === 'svg') { download(svg, `${name}.svg`, 'image/svg+xml'); return; }
    setBusy(true);
    try {
      const bytes = await pdfBytes(svg, width, height, logo, logoSize);
      if (print) {
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else download(bytes, `${name}.pdf`, 'application/pdf');
    } catch (error) { console.error(error); setMessage(`No se pudo generar el PDF de la fila ${index + 1}.`); }
    finally { setBusy(false); }
  };
  const exportAll = async () => {
    setBusy(true);
    try {
      const zip = new JSZip(); const pdfFolder = zip.folder('PDF')!; const svgFolder = zip.folder('SVG')!;
      let count = 0; const errors: number[] = [];
      for (const { item, index } of validItems) {
        const barcode = barcodeFor(item);
        if (barcode.error) { errors.push(index + 1); continue; }
        const svg = createSvg(item, width, height, barcode, design, logo, logoSize);
        const name = safeName(item, index, width, height);
        pdfFolder.file(`${name}.pdf`, await pdfBytes(svg, width, height, logo, logoSize));
        svgFolder.file(`${name}.svg`, svg);
        count++;
      }
      if (!count) { setMessage('No hay filas con códigos de barras válidos para exportar.'); return; }
      download(await zip.generateAsync({ type: 'blob' }), `cajas-madre-${width}x${height}cm.zip`, 'application/zip');
      setMessage(errors.length ? `ZIP descargado. Revisá las filas ${errors.join(', ')}: falta código INP o cantidad, o el valor generado no es válido.` : `ZIP descargado con ${count} etiquetas.`);
    } catch (error) { console.error(error); setMessage('No se pudo preparar el ZIP. Revisá los logos.'); }
    finally { setBusy(false); }
  };

  return <main className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Etiquetas de caja madre</h2><p className="text-sm text-zinc-600">Una fila por caja. Pegá datos de Excel en el mismo orden de las columnas. El código de barras se forma con el INP sin puntos y la cantidad.</p></div><button type="button" className="mother-button" onClick={exportAll} disabled={busy || !validItems.length}><Archive size={16}/>{busy ? 'Preparando...' : 'Descargar todo (ZIP)'}</button></div>
    {message && <div role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>}
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 p-4"><h3 className="font-bold">Base de datos ({items.length}/28)</h3><div className="flex gap-2"><button type="button" onClick={clear} className="mother-button"><Eraser size={15}/> Limpiar</button><button type="button" onClick={() => setItems(previous => [...previous, newItem()])} disabled={items.length >= 28} className="mother-button"><Plus size={15}/> Agregar fila</button></div></div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-xs">
          <thead className="bg-zinc-100 text-left text-zinc-600"><tr>
            <th className="w-[3%] border-b border-r border-zinc-200 p-1 text-center">#</th>
            {columns.map(column => <th key={column.key} className="border-b border-r border-zinc-200 p-1.5 text-[10px] leading-tight" style={{ width: column.width }}>{column.label}</th>)}
            <th className="w-[5%] border-b border-zinc-200 p-1 text-center text-[10px]">Eliminar</th>
          </tr></thead>
          <tbody>{items.map((item, rowIndex) => <tr key={item.id} className="hover:bg-zinc-50">
            <td className="border-b border-r border-zinc-200 p-2 text-center text-zinc-500">{rowIndex + 1}</td>
            {columns.map((column, fieldIndex) => <td key={column.key} className="border-b border-r border-zinc-200 p-0"><input type="text" aria-label={`${column.label} fila ${rowIndex + 1}`} title={item[column.key]} value={item[column.key]} onChange={event => update(item.id, column.key, event.target.value)} onPaste={event => onPaste(event, rowIndex, fieldIndex)} className="block min-w-0 w-full bg-transparent px-1.5 py-2 outline-none focus:bg-orange-50 focus:ring-2 focus:ring-inset focus:ring-orange-500" /></td>)}
            <td className="border-b border-zinc-200 p-2"><button type="button" aria-label={`Eliminar fila ${rowIndex + 1}`} onClick={() => remove(item.id)} className="text-zinc-500 hover:text-red-600"><Trash2 size={17}/></button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 xl:gap-8">
      <aside className="lg:col-span-4 xl:col-span-3">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-4">
          <h3 className="mb-2 text-lg font-bold">Diseño global</h3>
          <p className="mb-5 text-xs text-zinc-500">Estos ajustes se aplican a todas las etiquetas.</p>
          <div className="border-t border-zinc-100 pt-4">
            <h4 className="mb-2 font-semibold">Logo global (PNG transparente)</h4>
            <input type="file" aria-label="Logo PNG para todas las etiquetas" accept=".png,image/png" onChange={event => { void onLogo(event.target.files?.[0]); event.target.value = ''; }} className="block w-full text-xs" />
            {logo && <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-600"><span className="min-w-0 truncate" title={logo.name}>{logo.name}</span><button type="button" onClick={() => setLogo(null)} className="shrink-0 text-zinc-500 hover:text-red-600" aria-label="Quitar logo global"><Trash2 size={16}/></button></div>}
            <label className="mt-4 block text-sm text-zinc-700"><span className="flex justify-between"><span>Tamaño del logo</span><strong>{logoSize}%</strong></span><input type="range" min="50" max="150" step="1" value={logoSize} onChange={event => setLogoSize(Number(event.target.value))} className="mt-2 w-full accent-orange-600" /></label>
          </div>
          <div className="border-t border-zinc-100 pt-4">
            <h4 className="mb-1 font-semibold">Medidas de etiqueta</h4>
            <p className="mb-4 text-xs text-zinc-500">De 10 a 30 cm por lado, en pasos de 1 cm.</p>
            <div className="space-y-5">{([['Ancho', width, setWidth], ['Alto', height, setHeight]] as const).map(([name, value, setter]) => <label key={name} className="block text-sm text-zinc-700"><span className="flex justify-between"><span>{name}</span><strong>{value} cm</strong></span><input type="range" min="10" max="30" step="1" value={value} onChange={event => setter(Number(event.target.value))} className="mt-2 w-full accent-orange-600" /></label>)}</div>
          </div>
          <div className="mt-5 border-t border-zinc-100 pt-4">
            <h4 className="mb-4 font-semibold">Barras del código</h4>
            <div className="space-y-5">{([
              ['barcodeWidthPercent', 'Ancho ocupado', 60, 100, '%'],
              ['barcodeHeight', 'Alto de barras', 70, 150, ''],
            ] as const).map(([key, label, min, max, unit]) => <label key={key} className="block text-sm text-zinc-700"><span className="flex justify-between"><span>{label}</span><strong>{design[key]}{unit}</strong></span><input type="range" min={min} max={max} step="1" value={design[key]} onChange={event => setDesign(previous => ({ ...previous, [key]: Number(event.target.value) }))} className="mt-2 w-full accent-orange-600" /></label>)}</div>
          </div>
          <div className="mt-5 border-t border-zinc-100 pt-4">
            <h4 className="mb-4 font-semibold">Tamaños de letra</h4>
            <div className="space-y-5">{([
              ['codeFontSize', 'Código INP y número de barras'],
              ['dataFontSize', 'Descripción y datos variables'],
            ] as const).map(([key, label]) => <label key={key} className="block text-sm text-zinc-700"><span className="flex justify-between gap-2"><span>{label}</span><strong>{design[key]} px</strong></span><input type="range" min="24" max="50" step="1" value={design[key]} onChange={event => setDesign(previous => ({ ...previous, [key]: Number(event.target.value) }))} className="mt-2 w-full accent-orange-600" /></label>)}</div>
          </div>
        </section>
      </aside>
      <section className="min-w-0 space-y-4 lg:col-span-8 xl:col-span-9"><h3 className="text-lg font-bold">Vista previa ({validItems.length})</h3>{validItems.length === 0 && <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">Agregá datos en la tabla para ver las etiquetas.</div>}{validItems.map(({ item, index }) => {
      const barcode = barcodeFor(item);
      const svg = createSvg(item, width, height, barcode, design, logo, logoSize);
      const previewSvg = logo ? createSvg(item, width, height, barcode, design, null, logoSize) : svg;
      return <article key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">#{index + 1} {item.code || 'Sin código INP'}</div><div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportOne(item, index, 'svg')} disabled={!!barcode.error} className="mother-button"><FileCode2 size={15}/> SVG</button>
          <button type="button" onClick={() => exportOne(item, index, 'pdf')} disabled={busy || !!barcode.error} className="mother-button"><FileText size={15}/> PDF</button>
          <button type="button" onClick={() => exportOne(item, index, 'pdf', true)} disabled={busy || !!barcode.error} className="mother-button"><Printer size={15}/> Imprimir</button>
        </div></div>
        {barcode.error && <p className="mb-2 text-sm text-red-600">{barcode.error}</p>}
        {!barcode.error && <p className="mb-2 text-xs text-zinc-500">Código de barras generado: <span className="font-mono font-semibold">{barcode.value}</span></p>}
        {item.description.length > 145 && <p className="mb-2 text-sm text-amber-700">Descripción extensa: revisá que se vea completa antes de imprimir.</p>}
        <div className="flex justify-center rounded-xl bg-zinc-100 p-3 md:p-6"><div className="relative w-full max-w-[780px] bg-white shadow-lg" style={{ aspectRatio: `${width} / ${height}` }}>
          <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`} alt={`Vista previa de caja madre ${index + 1}`} className="h-full w-full" />
          {logo && <img src={logo.dataUrl} alt="Logo" className="absolute left-[6%] top-[2.8%] object-contain object-left-top" style={{ width: `${26 * logoSize / 100}%`, height: `${12.5 * logoSize / 100}%` }} />}
        </div></div>
      </article>;
    })}</section>
    </div>
  </main>;
}
