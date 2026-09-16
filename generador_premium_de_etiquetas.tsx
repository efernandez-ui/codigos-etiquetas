import React, { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import 'svg2pdf.js';
import { 
  Settings, AlertCircle, AlertTriangle, Maximize, FileImage, 
  CheckCircle2, Image as ImageIcon, List, Info, Table, 
  Plus, Trash2, Eraser, Printer, FileCode2, Archive, Loader2, FileText
} from 'lucide-react';

const BarcodeGenerator = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [items, setItems] = useState([
    { 
        sku: '032.006.38.0001', 
        desc: 'LINGA JRS LOCK AZUL D.22X1200MM (SECCIONES DE ACERO ARTICULADO CON REVESTIMIENTO PLASTICO)', 
        barcodeVal: '123456789012' 
    },
    { 
        sku: '045.012.99.0023', 
        desc: 'CANDADO U-LOCK NEGRO ALTA SEGURIDAD', 
        barcodeVal: '098765432109' 
    }
  ]);
  
  const [format, setFormat] = useState('CODE128');
  
  // Sliders de proporciones de las barras internas (Ancho: 3 a 15, Alto: 90 a 700)
  const [barcodeWidthScale, setBarcodeWidthScale] = useState(3);
  const [barcodeHeightPx, setBarcodeHeightPx] = useState(120);

  // Sliders de tipografías (de 15 a 150px)
  const [fontSize, setFontSize] = useState(24);
  const [skuFontSize, setSkuFontSize] = useState(24);
  const [descFontSize, setDescFontSize] = useState(18);
  const [displayValue, setDisplayValue] = useState(true);
  
  // Sliders para ancho y alto físicos en centímetros (3 a 14 cm)
  const [labelWidthCm, setLabelWidthCm] = useState(6.0);
  const [labelHeightCm, setLabelHeightCm] = useState(4.0);

  // Fondo y líneas fijos: blanco y negro estricto
  const bgColor = '#ffffff';
  const lineColor = '#000000';

  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState({});
  const [toastMsg, setToastMsg] = useState("");
  const [isZipping, setIsZipping] = useState(false);
  
  const canvasRefs = useRef([]);
  const hiddenSvgContainerRef = useRef(null);
  const layoutRefs = useRef({});

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addRow = () => {
    if (items.length >= 28) {
        showToast("Límite de 28 alcanzado.");
        return;
    }
    setItems([...items, { sku: '', desc: '', barcodeVal: '' }]);
  };

  const removeRow = (index) => setItems(items.filter((_, i) => i !== index));
  const clearAll = () => setItems([{ sku: '', desc: '', barcodeVal: '' }]);

  const handlePaste = (e, rowIndex) => {
    const clipboardData = e.clipboardData;
    const pastedData = clipboardData.getData('Text');

    if (pastedData.indexOf('\t') !== -1 || pastedData.indexOf('\n') !== -1) {
        e.preventDefault(); 
        const rows = pastedData.split(/\r?\n/).filter(row => row.trim() !== '');
        let newItems = [...items];
        
        rows.forEach((row, rIdx) => {
            const targetRow = rowIndex + rIdx;
            if (targetRow < 28) {
                const cols = row.split('\t');
                if (!newItems[targetRow]) newItems[targetRow] = { sku: '', desc: '', barcodeVal: '' };
                if (cols[0] !== undefined) newItems[targetRow].sku = cols[0].trim();
                if (cols[1] !== undefined) newItems[targetRow].desc = cols[1].trim();
                if (cols[2] !== undefined && cols[2].trim() !== '') {
                    newItems[targetRow].barcodeVal = cols[2].trim();
                } else if (cols[0] !== undefined && newItems[targetRow].barcodeVal === '') {
                    newItems[targetRow].barcodeVal = cols[0].trim();
                }
            }
        });
        setItems(newItems.slice(0, 28)); 
        showToast("Datos de Excel pegados.");
    }
  };

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const getLines = (ctx, text, maxWidth) => {
    if (!text || text.trim() === '') return [];
    const words = text.trim().split(/\s+/);
    const lines = [];
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const width = ctx.measureText(currentLine + " " + words[i]).width;
      if (width < maxWidth) currentLine += " " + words[i];
      else { lines.push(currentLine); currentLine = words[i]; }
    }
    lines.push(currentLine);
    return lines;
  };

  useEffect(() => {
    if (!isLoaded || !hiddenSvgContainerRef.current) return;
    
    const newErrors = {};
    setWarnings({});
    hiddenSvgContainerRef.current.innerHTML = '';
    const validItems = items.filter(item => item.barcodeVal.trim() !== '' || item.sku.trim() !== '');

    const pxPerCm = 300 / 2.54;
    const targetW = labelWidthCm * pxPerCm;
    const targetH = labelHeightCm * pxPerCm;

    validItems.forEach((item, index) => {
      const canvas = canvasRefs.current[index];
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const { sku, desc, barcodeVal } = item;
      const finalBarcodeVal = barcodeVal.trim() || sku.trim() || 'ERROR';

      const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      hiddenSvgContainerRef.current.appendChild(svgNode);

      try {
        JsBarcode(svgNode, finalBarcodeVal, {
          format: format,
          width: barcodeWidthScale,
          height: barcodeHeightPx,
          fontSize: fontSize,
          displayValue: displayValue,
          font: "Arial",
          background: '#ffffff00',
          lineColor: lineColor,
          margin: 10,
          valid: (valid) => { if (!valid) newErrors[index] = `Valor inválido para ${format}.`; }
        });

        if (newErrors[index]) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }

        const svgData = new XMLSerializer().serializeToString(svgNode);
        const img = new Image();
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            canvas.width = targetW;
            canvas.height = targetH;

            ctx.fillStyle = bgColor; 
            ctx.fillRect(0, 0, targetW, targetH);

            const maxTextWidth = targetW - 40; 

            ctx.font = `bold ${skuFontSize}px Arial`;
            const skuLines = getLines(ctx, sku, maxTextWidth);
            ctx.font = `${descFontSize}px Arial`;
            const descLines = getLines(ctx, desc, maxTextWidth);

            const skuLineHeight = skuFontSize * 1.2;
            const descLineHeight = descFontSize * 1.2;
            
            const totalSkuHeight = skuLines.length * skuLineHeight;
            const totalDescHeight = descLines.length * descLineHeight;
            const barcodeH = img.height;
            const spacing = 12; 

            const totalContentHeight = totalSkuHeight + (skuLines.length > 0 && descLines.length > 0 ? spacing : 0) + totalDescHeight + (skuLines.length > 0 || descLines.length > 0 ? spacing : 0) + barcodeH;

            let startY = (targetH - totalContentHeight) / 2;
            if (startY < 15) startY = 15; 

            ctx.fillStyle = lineColor; 
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            
            let currentY = startY;

            if (skuLines.length > 0) {
                ctx.font = `bold ${skuFontSize}px Arial`;
                skuLines.forEach(line => { ctx.fillText(line, targetW / 2, currentY); currentY += skuLineHeight; });
                currentY += spacing;
            }
            
            if (descLines.length > 0) {
                ctx.font = `${descFontSize}px Arial`;
                descLines.forEach(line => { ctx.fillText(line, targetW / 2, currentY); currentY += descLineHeight; });
                currentY += spacing;
            }

            const barcodeX = (targetW - img.width) / 2;
            ctx.drawImage(img, barcodeX, currentY);
            URL.revokeObjectURL(url);

            ctx.font = `bold ${skuFontSize}px Arial`;
            const overflowingSku = skuLines.some(line => ctx.measureText(line).width > maxTextWidth);
            ctx.font = `${descFontSize}px Arial`;
            const overflowingDescription = descLines.some(line => ctx.measureText(line).width > maxTextWidth);
            const overflowingText = overflowingSku || overflowingDescription;
            const overflowingBarcode = barcodeX < 0 || barcodeX + img.width > targetW;
            const overflowingHeight = currentY + img.height > targetH - 15;
            const warningParts = [];
            if (overflowingText) warningParts.push('el texto supera el ancho');
            if (overflowingBarcode) warningParts.push('las barras superan el ancho');
            if (overflowingHeight) warningParts.push('el contenido supera el alto');

            if (warningParts.length > 0) {
              setWarnings(previous => ({
                ...previous,
                [index]: `Revisa la etiqueta: ${warningParts.join(' y ')}.`,
              }));
            }

            layoutRefs.current[index] = {
                finalBarcodeVal, skuLines, descLines, 
                targetW, targetH, svgData, currentY, barcodeX, imgW: img.width, imgH: img.height
            };
        };
        img.src = url;
      } catch (err) {
        newErrors[index] = err.message || "Error al generar.";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
    setErrors(newErrors);
  }, [items, format, barcodeWidthScale, barcodeHeightPx, fontSize, displayValue, skuFontSize, descFontSize, labelWidthCm, labelHeightCm, isLoaded]);

  const downloadFile = (data, filename, type) => {
    const link = document.createElement('a');
    if (type.startsWith('image/') && type !== 'image/svg+xml') link.href = data; 
    else {
      const blob = new Blob([data], { type });
      link.href = URL.createObjectURL(blob);
    }
    link.download = filename;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const escapeXML = (str) => {
      if(!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  };

  const getSafeName = (index) => {
      const validItems = items.filter(item => item.barcodeVal.trim() !== '' || item.sku.trim() !== '');
      if(!validItems[index]) return `etiqueta-${index}`;
      return validItems[index].barcodeVal.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'codigo';
  };

  const exportRasterToSize = async (index, mimeType, extension) => {
    const canvas = canvasRefs.current[index];
    if(!canvas) return;

    if (mimeType === 'image/jpeg') {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(canvas, 0, 0);
        downloadFile(tempCanvas.toDataURL(mimeType, 1.0), `etiqueta-${getSafeName(index)}-${labelWidthCm}x${labelHeightCm}cm.${extension}`, mimeType);
    } else {
        downloadFile(canvas.toDataURL(mimeType, 1.0), `etiqueta-${getSafeName(index)}-${labelWidthCm}x${labelHeightCm}cm.${extension}`, mimeType);
    }
  };

  const getSvgString = (index) => {
      const layout = layoutRefs.current[index];
      if(!layout) return null;

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = layout.svgData;
      const innerJsBarcodeSVG = tempDiv.querySelector('svg');
      if(!innerJsBarcodeSVG) return null;
      
      // Remover rectángulos de fondo (Evita cajas negras)
      const bgRects = innerJsBarcodeSVG.querySelectorAll('rect');
      const innerW = parseFloat(innerJsBarcodeSVG.getAttribute('width')) || 200;
      bgRects.forEach(rect => {
          const w = parseFloat(rect.getAttribute('width'));
          const fill = rect.getAttribute('fill') || '';
          if (w > (innerW * 0.5) || fill.includes('fff') || fill === 'white' || fill === 'transparent') {
              rect.remove();
          }
      });

      // FORZAR COLOR NEGRO PURO A TODAS LAS BARRAS (Soluciona el problema de Illustrator y PDF)
        innerJsBarcodeSVG.querySelectorAll<SVGElement>('path, rect, line, text').forEach(el => {
          el.setAttribute('fill', lineColor);
          if (el.style) el.style.fill = lineColor;
      });

      const barcodeElementsHTML = innerJsBarcodeSVG.innerHTML;
      
      let svgString = `<?xml version="1.0" encoding="utf-8"?>\n`;
      svgString += `<svg width="${labelWidthCm}cm" height="${labelHeightCm}cm" viewBox="0 0 ${layout.targetW} ${layout.targetH}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n`;

      const maxTextWidth = layout.targetW - 40;
      const dummyCanvas = document.createElement('canvas').getContext('2d');
      dummyCanvas.font = `bold ${skuFontSize}px Arial`;
      const skuLines = getLines(dummyCanvas, items[index].sku, maxTextWidth);
      dummyCanvas.font = `${descFontSize}px Arial`;
      const descLines = getLines(dummyCanvas, items[index].desc, maxTextWidth);

      const skuLineHeight = skuFontSize * 1.2;
      const descLineHeight = descFontSize * 1.2;
      const totalSkuHeight = skuLines.length * skuLineHeight;
      const totalDescHeight = descLines.length * descLineHeight;
      const spacing = 12;
      const totalContentHeight = totalSkuHeight + (skuLines.length > 0 && descLines.length > 0 ? spacing : 0) + totalDescHeight + (skuLines.length > 0 || descLines.length > 0 ? spacing : 0) + layout.imgH;

      let currentY = (layout.targetH - totalContentHeight) / 2;
      if (currentY < 15) currentY = 15;

      skuLines.forEach((line) => {
          svgString += `  <text x="${layout.targetW / 2}" y="${currentY}" font-family="Arial, sans-serif" font-size="${skuFontSize}px" font-weight="bold" fill="${lineColor}" text-anchor="middle" dominant-baseline="hanging">${escapeXML(line)}</text>\n`;
          currentY += skuLineHeight;
      });

      if(skuLines.length > 0 && descLines.length > 0) currentY += spacing;

      descLines.forEach((line) => {
          svgString += `  <text x="${layout.targetW / 2}" y="${currentY}" font-family="Arial, sans-serif" font-size="${descFontSize}px" fill="${lineColor}" text-anchor="middle" dominant-baseline="hanging">${escapeXML(line)}</text>\n`;
          currentY += descLineHeight;
      });

      if(skuLines.length > 0 || descLines.length > 0) currentY += spacing;

      svgString += `  <g transform="translate(${layout.barcodeX}, ${currentY})">\n`;
      svgString += `    ${barcodeElementsHTML}\n`;
      svgString += `  </g>\n`;
      svgString += `</svg>`;

      return svgString;
  };

  const exportSVGToSize = (index) => {
      const svgString = getSvgString(index);
      if(!svgString) return;
      downloadFile(svgString, `etiqueta-${getSafeName(index)}-${labelWidthCm}x${labelHeightCm}cm.svg`, 'image/svg+xml');
  };

  const exportPDFToSize = async (index) => {
      const svgString = getSvgString(index);
      if (!svgString) return;

      try {
          const orientation = labelWidthCm > labelHeightCm ? 'l' : 'p';
          const doc = new jsPDF({
              orientation: orientation,
              unit: 'cm',
              format: [labelWidthCm, labelHeightCm]
          });

          const parser = new DOMParser();
          const svgElement = parser.parseFromString(svgString, "image/svg+xml").documentElement;

          const parserError = svgElement.querySelector("parsererror");
          if (parserError) throw new Error("SVG parse error");

          await doc.svg(svgElement, {
              x: 0,
              y: 0,
              width: labelWidthCm,
              height: labelHeightCm
          });

          doc.save(`etiqueta-${getSafeName(index)}-${labelWidthCm}x${labelHeightCm}cm.pdf`);
      } catch (err) {
          console.error("Error en PDF:", err);
          showToast("Error al generar el PDF vectorial.");
      }
  };

  const handleDownloadAllZip = async () => {
    const validItems = items.filter(item => item.barcodeVal.trim() !== '' || item.sku.trim() !== '');
    const renderableIndices = validItems.map((_, idx) => idx).filter(idx => !errors[idx] && canvasRefs.current[idx]);

    if (renderableIndices.length === 0) {
      showToast("No hay etiquetas válidas para exportar.");
      return;
    }

    setIsZipping(true);
    showToast("Preparando archivo ZIP con todos los formatos...");

    try {
      const zip = new JSZip();
      const pngFolder = zip.folder("PNG");
      const jpgFolder = zip.folder("JPG");
      const svgFolder = zip.folder("SVG");
      const pdfFolder = zip.folder("PDF");

      for (const idx of renderableIndices) {
        const canvas = canvasRefs.current[idx];
        const safeName = getSafeName(idx);

        // 1. PNG
        const pngDataUrl = canvas.toDataURL('image/png').split(',')[1];
        pngFolder.file(`etiqueta-${safeName}-${labelWidthCm}x${labelHeightCm}cm.png`, pngDataUrl, { base64: true });

        // 2. JPG (fondo blanco forzado)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        ctx.drawImage(canvas, 0, 0);
        const jpgDataUrl = tempCanvas.toDataURL('image/jpeg', 1.0).split(',')[1];
        jpgFolder.file(`etiqueta-${safeName}-${labelWidthCm}x${labelHeightCm}cm.jpg`, jpgDataUrl, { base64: true });

        // 3. SVG limpio sin rectángulos de fondo
        const svgString = getSvgString(idx);
        if (svgString) {
          svgFolder.file(`etiqueta-${safeName}-${labelWidthCm}x${labelHeightCm}cm.svg`, svgString);
          
          // 4. PDF Vectorial
            {
              try {
                  const orientation = labelWidthCm > labelHeightCm ? 'l' : 'p';
                  const doc = new jsPDF({
                      orientation: orientation,
                      unit: 'cm',
                      format: [labelWidthCm, labelHeightCm]
                  });
                  const parser = new DOMParser();
                  const svgElement = parser.parseFromString(svgString, "image/svg+xml").documentElement;
                  
                  if (!svgElement.querySelector("parsererror")) {
                      await doc.svg(svgElement, { x: 0, y: 0, width: labelWidthCm, height: labelHeightCm });
                      pdfFolder.file(`etiqueta-${safeName}-${labelWidthCm}x${labelHeightCm}cm.pdf`, doc.output('blob'));
                  }
              } catch(e) {
                  console.error("Error empaquetando PDF", e);
              }
          }
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      downloadFile(content, `todas-las-etiquetas-${labelWidthCm}x${labelHeightCm}cm.zip`, 'application/zip');
      showToast("¡Archivo ZIP descargado con éxito!");
    } catch (err) {
      console.error(err);
      showToast("Error al generar el archivo ZIP.");
    } finally {
      setIsZipping(false);
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const currentValidItems = items.filter(item => item.barcodeVal.trim() !== '' || item.sku.trim() !== '');

  return (
    <div className="flex h-screen w-full bg-warm-gradient font-sans text-zinc-800 overflow-hidden">
      
      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-zinc-900 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-bounce">
          <Info size={18} className="text-rose-500" />
          <span className="font-medium text-sm">{toastMsg}</span>
        </div>
      )}

      <div ref={hiddenSvgContainerRef} style={{ display: 'none' }}></div>

      <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar relative">
        
        <header className="bg-white border-b border-zinc-200 px-8 py-5 flex items-center justify-between sticky top-0 z-40 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="bg-rose-600 p-2 rounded-lg shadow-md shadow-rose-600/20">
                    <CheckCircle2 size={20} className="text-white"/>
                </div>
                <h1 className="font-bold text-xl text-zinc-800 tracking-tight">Códigos y Etiquetas</h1>
                <span className="hidden sm:inline-block ml-4 pl-4 border-l border-zinc-200 text-sm font-medium text-zinc-500">Generador de códigos de barra y etiquetas de productos</span>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={handleDownloadAllZip} 
                disabled={isZipping || currentValidItems.length === 0} 
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-semibold text-sm rounded-xl shadow-md shadow-rose-600/20 transition-all"
              >
                {isZipping ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
                {isZipping ? "Empaquetando ZIP..." : "Descargar Todo (ZIP)"}
              </button>
              
              <div className="px-4 py-1.5 bg-rose-50 text-rose-600 text-sm font-semibold rounded-full border border-rose-100 flex items-center gap-2">
                  <Printer size={16}/> A Medida
              </div>
            </div>
        </header>

        <div className="p-8 max-w-[1600px] mx-auto w-full space-y-8">
            
          <div className="bg-white rounded-2xl shadow-xl shadow-zinc-200/40 border border-zinc-200 overflow-hidden">
                <div className="p-4 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-700 font-semibold">
                        <Table size={18} className="text-rose-600" />
                        <h2>Base de Datos ({items.length}/28)</h2>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={clearAll} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                            <Eraser size={14}/> Limpiar
                        </button>
                        <button onClick={addRow} disabled={items.length >= 28} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg transition-colors">
                            <Plus size={14}/> Agregar Fila
                        </button>
                    </div>
                </div>
                
                <div className="p-3 bg-zinc-50/50 text-[11px] text-zinc-500 border-b border-zinc-100 flex gap-2 items-center">
                    <Info size={14} className="shrink-0 text-rose-400" />
                    <p>Pega datos directamente desde Excel (SKU, Descripción, Código) seleccionando la primera celda.</p>
                </div>

                <div className="overflow-x-auto border-t border-zinc-200">
                <table className="w-full text-[13px] text-left border-collapse select-none">
                    <thead className="bg-zinc-100 text-zinc-600 uppercase tracking-wider text-[10px] font-bold">
                            <tr>
                                <th className="border-b border-r border-zinc-200 px-3 py-2 w-10 text-center">#</th>
                                <th className="border-b border-r border-zinc-200 px-3 py-2 w-48">SKU (Línea 1)</th>
                                <th className="border-b border-r border-zinc-200 px-3 py-2 min-w-[200px]">Descripción (Línea 2)</th>
                                <th className="border-b border-r border-zinc-200 px-3 py-2 w-56">Código Barras</th>
                                <th className="border-b border-zinc-200 px-3 py-2 w-10 text-center"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={index} className="hover:bg-zinc-50/50 group transition-colors">
                                    <td className="border-b border-r border-zinc-200 px-1 py-0 bg-zinc-50 text-center text-zinc-400 font-mono text-xs">
                                        {index + 1}
                                    </td>
                                    <td className="border-b border-r border-zinc-200 p-0 relative bg-white">
                                        <input type="text" value={item.sku} onChange={(e) => updateItem(index, 'sku', e.target.value)} onPaste={(e) => handlePaste(e, index)} className="w-full h-full px-3 py-2 bg-transparent outline-none focus:ring-2 focus:ring-inset focus:ring-rose-500 font-medium text-zinc-800" />
                                    </td>
                                    <td className="border-b border-r border-zinc-200 p-0 relative bg-white">
                                        <input type="text" value={item.desc} onChange={(e) => updateItem(index, 'desc', e.target.value)} onPaste={(e) => handlePaste(e, index)} className="w-full h-full px-3 py-2 bg-transparent outline-none focus:ring-2 focus:ring-inset focus:ring-rose-500 text-zinc-600" />
                                    </td>
                                    <td className="border-b border-r border-zinc-200 p-0 relative bg-white">
                                        <input type="text" value={item.barcodeVal} onChange={(e) => updateItem(index, 'barcodeVal', e.target.value)} onPaste={(e) => handlePaste(e, index)} className="w-full h-full px-3 py-2 bg-transparent outline-none focus:ring-2 focus:ring-inset focus:ring-rose-500 font-mono text-rose-700 font-medium" />
                                    </td>
                                    <td className="border-b border-zinc-200 p-0 text-center bg-white relative">
                                    <button onClick={() => removeRow(index)} className="w-full h-full flex items-center justify-center text-zinc-300 hover:text-rose-600 hover:bg-rose-50 transition-colors py-2 outline-none focus:ring-2 focus:ring-inset focus:ring-rose-500" title="Eliminar fila">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8">
          
          {/* PANEL IZQUIERDO DE CONFIGURACIÓN */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-6">
            <div className="bg-white p-4 rounded-2xl shadow-xl shadow-zinc-200/40 border border-zinc-100 max-h-[750px] overflow-hidden">
              <div className="flex items-center gap-2 mb-4 text-zinc-800 font-bold text-lg border-b border-zinc-100 pb-3">
                <Settings size={20} className="text-rose-600" />
                    <h2>Diseño Global</h2>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-2">
                        Simbología
                      </label>
                      <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors text-sm font-medium text-zinc-800 font-mono">
                        <option value="CODE128">CODE 128</option>
                        <option value="EAN13">EAN-13</option>
                        <option value="EAN8">EAN-8</option>
                        <option value="UPC">UPC-A</option>
                        <option value="ITF14">ITF-14</option>
                      </select>
                    </div>

                    <div className="pt-3 border-t border-zinc-100">
                      <div className="flex items-center gap-2 mb-3 text-zinc-800 font-semibold">
                        <Printer size={18} className="text-rose-600"/>
                        <h3>Dimensiones Físicas (cm)</h3>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1 text-zinc-600">
                          <label>Ancho Etiqueta</label>
                          <span className="font-mono text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">{labelWidthCm.toFixed(1)} cm</span>
                        </div>
                        <input type="range" min="3" max="14" step="0.5" value={labelWidthCm} onChange={(e) => setLabelWidthCm(parseFloat(e.target.value))} className="w-full accent-rose-600" />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1 text-zinc-600">
                          <label>Alto Etiqueta</label>
                          <span className="font-mono text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">{labelHeightCm.toFixed(1)} cm</span>
                        </div>
                        <input type="range" min="2" max="10" step="0.5" value={labelHeightCm} onChange={(e) => setLabelHeightCm(parseFloat(e.target.value))} className="w-full accent-rose-600" />
                      </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-100">
                      <div className="flex items-center gap-2 mb-3 text-zinc-800 font-semibold">
                        <Maximize size={18} className="text-rose-600"/>
                        <h3>Proporciones del Código de Barras</h3>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1 text-zinc-500 font-medium">
                          <label>Ancho de barra (3-15px)</label><span>{barcodeWidthScale}px</span>
                        </div>
                        <input type="range" min="3" max="15" step="1" value={barcodeWidthScale} onChange={(e) => setBarcodeWidthScale(parseInt(e.target.value))} className="w-full accent-rose-600" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1 text-zinc-500 font-medium">
                          <label>Altura de barra (90-700px)</label><span>{barcodeHeightPx}px</span>
                        </div>
                        <input type="range" min="90" max="700" step="10" value={barcodeHeightPx} onChange={(e) => setBarcodeHeightPx(parseInt(e.target.value))} className="w-full accent-rose-600" />
                      </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-100">
                      <div className="flex items-center gap-2 mb-3 text-zinc-800 font-semibold">
                        <Maximize size={18} className="text-rose-600"/>
                        <h3>Tipografías (15 a 150 px)</h3>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1 text-zinc-500 font-medium">
                          <label>Letra SKU</label><span>{skuFontSize}px</span>
                        </div>
                        <input type="range" min="15" max="150" step="1" value={skuFontSize} onChange={(e) => setSkuFontSize(parseInt(e.target.value))} className="w-full accent-rose-600" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1 text-zinc-500 font-medium">
                          <label>Letra Desc.</label><span>{descFontSize}px</span>
                        </div>
                        <input type="range" min="15" max="150" step="1" value={descFontSize} onChange={(e) => setDescFontSize(parseInt(e.target.value))} className="w-full accent-rose-600" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1 text-zinc-500 font-medium">
                          <label>Letra Código</label><span>{fontSize}px</span>
                        </div>
                        <input type="range" min="15" max="150" step="1" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} disabled={!displayValue} className="w-full accent-rose-600 disabled:opacity-30" />
                      </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-100">
                      <label className="flex items-center gap-3 cursor-pointer text-sm text-zinc-600 font-medium p-2 hover:bg-zinc-50 rounded-lg">
                        <input type="checkbox" checked={displayValue} onChange={(e) => setDisplayValue(e.target.checked)} className="w-4 h-4 text-rose-600 border-zinc-300 rounded focus:ring-rose-500" />
                        Mostrar número inferior
                      </label>
                    </div>

                  </div>
                </div>
              </div>

              {/* PANEL DERECHO DE PREVISUALIZACIÓN */}
              <div className="lg:col-span-8 xl:col-span-9 space-y-6">
                  {currentValidItems.length === 0 ? (
                    <div className="h-[400px] flex flex-col items-center justify-center text-zinc-400 p-6 text-center border-2 border-dashed border-zinc-200 rounded-2xl bg-white">
                      <List size={48} className="mb-4 opacity-20" />
                      <h3 className="text-lg font-bold text-zinc-700">El Dashboard está vacío</h3>
                      <p className="text-sm mt-2 max-w-sm">Agrega productos en la tabla superior para visualizar las etiquetas generadas en tiempo real.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 pb-12">
                      {currentValidItems.map((item, index) => (
                        <div key={`preview-${index}`} className="group bg-white border border-zinc-200 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-zinc-200/50 transition-all overflow-hidden flex flex-col sm:flex-row items-center">
                          
                          <div className="flex-1 p-6 flex items-center justify-center relative min-h-[180px] max-h-[400px] w-full bg-orange-50 border-b sm:border-b-0 sm:border-r border-zinc-100 overflow-hidden">
                            {errors[index] ? (
                              <div className="flex flex-col items-center text-rose-600 text-sm p-4 bg-white rounded-xl shadow-lg border border-rose-100">
                                <AlertCircle size={28} className="mb-2 text-rose-500" />
                                <span className="font-bold">{errors[index]}</span>
                              </div>
                            ) : (
                              <div className="relative p-2 bg-white rounded shadow-sm border border-zinc-100 inline-block transition-transform group-hover:scale-105 duration-300">
                                  <canvas ref={el => canvasRefs.current[index] = el} className="max-w-full max-h-[340px] w-auto h-auto object-contain" />
                              </div>
                            )}
                          </div>
                          
                          {!errors[index] && (
                            <div className="w-full sm:w-36 bg-zinc-50 p-4 flex flex-col justify-center gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-zinc-100">
                              <p className="text-[10px] font-bold uppercase text-zinc-400 text-center mb-1">Exportar</p>
                              <div className="flex flex-col gap-2">
                                {warnings[index] && (
                                  <button onClick={() => showToast(warnings[index])} className="flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-red-800 bg-red-100 hover:bg-red-200 border border-red-300 rounded-lg transition-all shadow-sm" title={warnings[index]}>
                                    <AlertTriangle size={14}/> Advertencia
                                  </button>
                                )}
                                <button onClick={() => exportRasterToSize(index, 'image/png', 'png')} className="flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-semibold text-zinc-700 bg-white hover:bg-rose-50 border border-zinc-200 hover:border-rose-200 hover:text-rose-600 rounded-lg transition-all shadow-sm">
                                    <FileImage size={14}/> PNG
                                </button>
                                <button onClick={() => exportRasterToSize(index, 'image/jpeg', 'jpg')} className="flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-zinc-700 bg-white hover:bg-rose-50 border border-zinc-200 hover:border-rose-200 hover:text-rose-600 rounded-lg transition-all shadow-sm">
                                    <ImageIcon size={14}/> JPG
                                </button>
                                <button onClick={() => exportSVGToSize(index)} className="flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-semibold text-zinc-700 bg-white hover:bg-rose-50 border border-zinc-200 hover:border-rose-200 hover:text-rose-600 rounded-lg transition-all shadow-sm">
                                    <FileCode2 size={14}/> SVG
                                </button>
                                <button onClick={() => exportPDFToSize(index)} className="flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-semibold text-zinc-700 bg-white hover:bg-rose-50 border border-zinc-200 hover:border-rose-200 hover:text-rose-600 rounded-lg transition-all shadow-sm">
                                    <FileText size={14}/> PDF
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #fafafa; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e4e4e7; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d4d4d8; }
      `}} />
    </div>
  );
};

export default BarcodeGenerator;