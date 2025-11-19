import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Set up the PDF.js worker.
import { GlobalWorkerOptions, version } from 'pdfjs-dist';

// Ensure worker is loaded from a CDN that matches the installed version to avoid bundling issues
GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
