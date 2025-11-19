import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Set up the PDF.js worker.
import { GlobalWorkerOptions, version } from 'pdfjs-dist';

// Using a CDN for the worker is the most reliable way to avoid bundler/Vite issues 
// with pdfjs-dist v4+ .mjs files and default exports.
// We dynamically insert the installed version to ensure API and Worker always match.
GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

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
