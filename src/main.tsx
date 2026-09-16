import React from 'react';
import { createRoot } from 'react-dom/client';
import BarcodeGenerator from '../generador_premium_de_etiquetas';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BarcodeGenerator />
  </React.StrictMode>,
);
