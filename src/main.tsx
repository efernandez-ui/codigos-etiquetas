import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import BarcodeGenerator from '../generador_premium_de_etiquetas';
import MotherBoxLabels from './MotherBoxLabels';
import './index.css';

function App() {
  const [section, setSection] = useState<'barcode' | 'mother'>('barcode');
  return <>
    <nav className="app-navigation" aria-label="Tipo de etiqueta">
      <button type="button" onClick={() => setSection('barcode')} aria-current={section === 'barcode' ? 'page' : undefined}>Etiquetas de código de barra</button>
      <button type="button" onClick={() => setSection('mother')} aria-current={section === 'mother' ? 'page' : undefined}>Etiquetas de caja madre</button>
    </nav>
    <div hidden={section !== 'barcode'}><BarcodeGenerator /></div>
    {section === 'mother' && <MotherBoxLabels />}
  </>;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
