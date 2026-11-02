
import React, { useState, useCallback, useRef, useMemo } from 'react';
import type { ExtractionResult, PaystubRow, BatchExtractionResult } from './types';
import { processPdf } from './services/pdfProcessor';
import { buildExcel, buildBatchExcel } from './services/excelGenerator';
import { calculateTotals, normalizeText, parseCurrency, calculateReferences, adjustPaystubValues } from './services/calculations';
import { exportClassificationPdf, exportBatchClassificationPdf, DEFAULT_PDF_OFFSETS } from './services/pdfGenerator';

// --- Helper Icon Components ---
const UploadIcon: React.FC<{className: string}> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const DownloadIcon: React.FC<{className: string}> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const PrinterIcon: React.FC<{className: string}> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
);

const PdfIcon: React.FC<{className?: string}> = ({ className = "h-4 w-4" }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-6 4h4" />
  </svg>
);

const CalendarIcon: React.FC<{className: string}> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const SpinnerIcon: React.FC<{className: string}> = ({ className }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2}></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const CopyIcon: React.FC<{className: string}> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckIcon: React.FC<{className: string}> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const AlertIcon: React.FC<{className: string}> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
        <path d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-4a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" />
    </svg>
);

const SearchIcon: React.FC<{className?: string}> = ({ className = "h-4 w-4" }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const CloseIcon: React.FC<{className?: string}> = ({ className = "h-4 w-4" }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

interface WindowsSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WindowsSearchModal: React.FC<WindowsSearchModalProps> = ({ isOpen, onClose }) => {
  const [inputText, setInputText] = useState('');
  const [includePdf, setIncludePdf] = useState(true);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const formattedQuery = useMemo(() => {
    const lines = inputText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) return '';

    return lines
      .map(code => {
        if (!includePdf) return code;
        return code.toLowerCase().endsWith('.pdf') ? code : `${code}.pdf`;
      })
      .join(' OR ');
  }, [inputText, includePdf]);

  const itemCount = useMemo(() => {
    return inputText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0).length;
  }, [inputText]);

  const handleCopy = useCallback(() => {
    if (!formattedQuery) return;
    navigator.clipboard.writeText(formattedQuery).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [formattedQuery]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
          <div className="flex items-center space-x-2">
            <SearchIcon className="h-4 w-4 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900">
              Pesquisa de Arquivos no Windows
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            title="Fechar"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="client-codes-textarea" className="text-xs font-semibold text-gray-700">
                Códigos dos Clientes (um por linha)
              </label>
              {itemCount > 0 && (
                <span className="text-[11px] text-gray-500 font-mono">
                  {itemCount} {itemCount === 1 ? 'código' : 'códigos'}
                </span>
              )}
            </div>
            <textarea
              id="client-codes-textarea"
              rows={5}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={"003\n009\n011"}
              className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-y"
              autoFocus
            />
          </div>

          {/* Controls: .pdf toggle (pre-selected by default) */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-600">Extensão dos arquivos:</span>
            <button
              type="button"
              onClick={() => setIncludePdf(prev => !prev)}
              className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                includePdf
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
              title="Incluir extensão .pdf nos nomes de arquivos para busca"
            >
              <span className="mr-1.5">{includePdf ? '✓' : ''}</span>
              .pdf
            </button>
          </div>

          {/* Formatted Output */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Texto para colar na pesquisa do Windows:
            </label>
            <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-800 break-all max-h-28 overflow-y-auto select-all min-h-[42px] flex items-center">
              {formattedQuery ? (
                formattedQuery
              ) : (
                <span className="text-gray-400 italic">
                  O resultado aparecerá aqui (ex: 003.pdf OR 009.pdf OR 011.pdf)...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setInputText('')}
            disabled={!inputText}
            className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30 transition-colors"
          >
            Limpar
          </button>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-200/60 transition-colors"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!formattedQuery}
              className={`inline-flex items-center px-4 py-1.5 rounded-md text-xs font-medium text-white shadow-xs transition-colors ${
                copied
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-primary hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {copied ? (
                <>
                  <CheckIcon className="h-3.5 w-3.5 mr-1" />
                  Copiado!
                </>
              ) : (
                <>
                  <CopyIcon className="h-3.5 w-3.5 mr-1" />
                  Copiar Pesquisa
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// --- UI Components ---
const ThirteenthSalaryWarning: React.FC = () => {
  return (
    <div className="group relative flex items-center">
      <AlertIcon className="h-8 w-8 animate-blink" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
        Folha contém 13º salário!
        <svg className="absolute text-gray-800 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
      </div>
    </div>
  );
};

const ClipboardButton: React.FC<{ textToCopy: string }> = ({ textToCopy }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = useCallback(() => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    });
  }, [textToCopy]);

  return (
    <button
      onClick={handleCopy}
      className="ml-2 p-2.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-accent transition-all duration-150"
      aria-label="Copiar para a área de transferência"
    >
      {copied ? <CheckIcon className="h-4 w-4 text-green-500" /> : <CopyIcon className="h-4 w-4" />}
    </button>
  );
};


const FileUploader: React.FC<{ onFileSelect: (file: File) => void; isProcessing: boolean }> = ({ onFileSelect, isProcessing }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      if (e.dataTransfer.files[0].type === 'application/pdf') {
        onFileSelect(e.dataTransfer.files[0]);
      }
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        onFileSelect(e.target.files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors duration-300 ${isProcessing ? 'cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:border-accent hover:bg-blue-50'}`}
      aria-disabled={isProcessing}
    >
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="application/pdf" disabled={isProcessing} />
      <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
      <p className="mt-2 text-sm text-gray-600">
        <span className="font-semibold text-accent">Clique para escolher</span> ou arraste e solte o PDF aqui.
      </p>
    </div>
  );
};

const BatchFileUploader: React.FC<{ onFilesSelect: (files: FileList) => void; isProcessing: boolean }> = ({ onFilesSelect, isProcessing }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFilesSelect(e.dataTransfer.files);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        onFilesSelect(e.target.files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors duration-300 ${isProcessing ? 'cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:border-accent hover:bg-blue-50'}`}
      aria-disabled={isProcessing}
    >
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="application/pdf" multiple disabled={isProcessing} />
      <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
      <p className="mt-2 text-sm text-gray-600">
        <span className="font-semibold text-accent">Clique para escolher múltiplos arquivos</span> ou arraste e solte os PDFs aqui.
      </p>
      <p className="mt-1 text-xs text-gray-400">Suporta seleção de múltiplos arquivos (100+)</p>
    </div>
  );
};

const getRowStyle = (description: string): string => {
    const descNorm = normalizeText(description);

    // Strict check for 13th Salary (Adiantamento or 13o Salario)
    const isTarget13th = descNorm.includes('adiantamento de 13o') || descNorm.includes('13o salario');
    const isIgnored13thDiscount = descNorm.includes('inss') || descNorm.replace(/\./g, '').includes('irrf') || descNorm.includes('pensao alimenticia');
    const isExcludedAdiantamento = descNorm.includes('desconto de adiantamento de');
    
    if (isTarget13th && !isIgnored13thDiscount && !isExcludedAdiantamento) return "text-blue-700";
    
    if (descNorm.includes("cesta")) return "text-purple-700";
    if (descNorm.includes("alimentacao")) return "text-red-700";
    if (descNorm.includes("transporte") && !description.includes('%')) return "text-green-600";
    return "text-gray-600";
};

interface ClassificationCardProps {
  condName?: string;
  salarioRef: string;
  beneficioRef: string;
  salario: number;
  alimentacao: number;
  transporte: number;
  width?: string;
  height?: string;
}

const formatVal = (num: number) => {
  if (num === undefined || num === null || num <= 0) return 'Ausente';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const ClassificationCard: React.FC<ClassificationCardProps> = ({
  salarioRef,
  beneficioRef,
  salario,
  alimentacao,
  transporte,
  width = '52mm',
  height = '35mm',
}) => {
  return (
    <div className="flex flex-col items-center">
      {/* Box layout: 52mm x 35mm, Arial 10 */}
      <div
        className="bg-white border border-black text-black select-none flex flex-col"
        style={{
          width,
          height,
          fontFamily: 'Arial, sans-serif',
          fontSize: '10pt',
          lineHeight: 1.15,
          boxSizing: 'border-box',
        }}
      >
        {/* Row 44: Header */}
        <div className="flex-1 min-h-0 px-1.5 flex items-center border-b border-gray-400 text-[10pt] font-normal whitespace-nowrap overflow-hidden">
          EBAC - Classificação
        </div>

        {/* Row 45: Salários Title */}
        <div className="flex-1 min-h-0 px-1.5 flex items-center font-bold text-[10pt] whitespace-nowrap overflow-hidden">
          Salários
        </div>

        {/* Row 46: Salários Details */}
        <div className="flex-1 min-h-0 px-1.5 flex items-center justify-between border-b border-black text-[10pt] whitespace-nowrap overflow-hidden">
          <div className="flex items-center space-x-1.5">
            <span className="font-normal">Ref.: &nbsp;{salarioRef || 'Ausente'}</span>
            <span className="font-normal">R$</span>
          </div>
          <span className="text-right">
            {formatVal(salario)}
          </span>
        </div>

        {/* Row 47: Vale Alimentação Title */}
        <div className="flex-1 min-h-0 px-1.5 flex items-center font-bold text-[10pt] whitespace-nowrap overflow-hidden">
          Vale Alimentação
        </div>

        {/* Row 48: Vale Alimentação Details */}
        <div className="flex-1 min-h-0 px-1.5 flex items-center justify-between border-b border-black text-[10pt] whitespace-nowrap overflow-hidden">
          <div className="flex items-center space-x-1.5">
            <span className="font-normal">Ref.: &nbsp;{beneficioRef || 'Ausente'}</span>
            <span className="font-normal">R$</span>
          </div>
          <span className="text-right">
            {formatVal(alimentacao)}
          </span>
        </div>

        {/* Row 49: Vale Transporte Title */}
        <div className="flex-1 min-h-0 px-1.5 flex items-center font-bold text-[10pt] whitespace-nowrap overflow-hidden">
          Vale Transporte
        </div>

        {/* Row 50: Vale Transporte Details */}
        <div className="flex-1 min-h-0 px-1.5 flex items-center justify-between text-[10pt] whitespace-nowrap overflow-hidden">
          <div className="flex items-center space-x-1.5">
            <span className="font-normal">Ref.: &nbsp;{beneficioRef || 'Ausente'}</span>
            <span className="font-normal">R$</span>
          </div>
          <span className="text-right">
            {formatVal(transporte)}
          </span>
        </div>
      </div>
    </div>
  );
};

const ReferenceMonthSelector: React.FC<{
  referenceMonth: string;
  onChange: (val: string) => void;
  salarioRef: string;
  beneficioRef: string;
}> = ({ referenceMonth, onChange, salarioRef, beneficioRef }) => {
  return (
    <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-4 mb-6 print:hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 text-primary rounded-md">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <label htmlFor="ref-month" className="block text-sm font-semibold text-gray-900">
              Mês/Ano de Referência do Salário
            </label>
            <p className="text-xs text-gray-500">
              Alimentação e Transporte ajustam automaticamente para o mês seguinte.
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <input
            id="ref-month"
            type="month"
            value={referenceMonth}
            onChange={(e) => onChange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium bg-white text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          />

          <div className="flex items-center space-x-2 text-xs">
            <span className="px-2.5 py-1 bg-white border border-blue-200 rounded-md font-mono text-blue-900">
              Salário: <strong>{salarioRef}</strong>
            </span>
            <span className="px-2.5 py-1 bg-green-50 border border-green-200 rounded-md font-mono text-green-800">
              Alimentação/Transp.: <strong>{beneficioRef}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PrintOffsets {
  leftMm: number;
  topMm: number;
  widthMm: number;
  heightMm: number;
}

const ResultsDisplay: React.FC<{
  result: ExtractionResult;
  fileName: string;
  salarioRef: string;
  beneficioRef: string;
  onDownload: () => void;
  onExportPdf: () => void;
}> = ({
  result,
  fileName,
  salarioRef,
  beneficioRef,
  onDownload,
  onExportPdf,
}) => {
    const [previewMode, setPreviewMode] = useState<'a4' | 'card'>('a4');
    const { alimentacaoSum, transporteSum, decimoTerceiroSum, calculatedRowsIndices } = useMemo(() => {
        const alimentacaoValues: number[] = [];
        const transporteValues: number[] = [];
        const decimoTerceiroValues: number[] = [];
        const calculatedRowsIndices = new Set<number>();

        result.rows.forEach((row, index) => {
            const descNorm = normalizeText(row.Descrição);
            const rendimento = parseCurrency(row.Rendimentos);
            const desconto = parseCurrency(row.Descontos);
            
            let wasCalculated = false;

            if (descNorm.includes('alimentacao') || descNorm.includes('cesta')) {
                if (rendimento > 0) alimentacaoValues.push(rendimento);
                if (desconto > 0) alimentacaoValues.push(-desconto);
                wasCalculated = true;
            }
            
            if (descNorm.includes('transporte') && !row.Descrição.includes('%')) {
                if (rendimento > 0) transporteValues.push(rendimento);
                if (desconto > 0) transporteValues.push(-desconto);
                wasCalculated = true;
            }

            // Strict check for 13th Salary (Adiantamento or 13o Salario)
            const isTarget13th = descNorm.includes('adiantamento de 13o') || descNorm.includes('13o salario');
            const isIgnored13thDiscount = descNorm.includes('inss') || descNorm.replace(/\./g, '').includes('irrf') || descNorm.includes('pensao alimenticia');
            const isExcludedAdiantamento = descNorm.includes('desconto de adiantamento de');

            if (isTarget13th && !isIgnored13thDiscount && !isExcludedAdiantamento) {
                if (rendimento > 0) decimoTerceiroValues.push(rendimento);
                if (desconto > 0) decimoTerceiroValues.push(-desconto);
                wasCalculated = true;
            }
            
            if (wasCalculated) {
                calculatedRowsIndices.add(index);
            }
        });

        return {
            alimentacaoSum: alimentacaoValues.reduce((sum, val) => sum + val, 0),
            transporteSum: transporteValues.reduce((sum, val) => sum + val, 0),
            decimoTerceiroSum: decimoTerceiroValues.reduce((sum, val) => sum + val, 0),
            calculatedRowsIndices
        };
    }, [result.rows]);

    const verificationResult = useMemo(() => {
        const paintedRowsIndices = new Set<number>();
        result.rows.forEach((row, index) => {
            if (getRowStyle(row.Descrição) !== 'text-gray-600') {
                paintedRowsIndices.add(index);
            }
        });

        if (paintedRowsIndices.size !== calculatedRowsIndices.size) {
            return { hasConflict: true };
        }

        for (const index of paintedRowsIndices) {
            if (!calculatedRowsIndices.has(index)) {
                return { hasConflict: true };
            }
        }

        return { hasConflict: false };
    }, [result.rows, calculatedRowsIndices]);

    const textToCopyAll = useMemo(() => {
        const formatForClipboard = (num: number) => num.toLocaleString('pt-BR', { minimumFractionDigits: 2, useGrouping: false }).replace('.', ',');
        
        const values = [
            result.totals['Salário Líquido Total'] || '0,00',
            formatForClipboard(alimentacaoSum),
            formatForClipboard(transporteSum)
        ];

        if (decimoTerceiroSum !== 0) {
            values.push(formatForClipboard(decimoTerceiroSum));
        }

        return values.join('\n');
    }, [result.totals, alimentacaoSum, transporteSum, decimoTerceiroSum]);

    const { salario, alimentacao, transporte, isSalarioNegativo, alimentacaoDeducted, transporteDeducted } = useMemo(() => {
        const rawSalario = result.totals['Salário Líquido Total'] ? parseCurrency(result.totals['Salário Líquido Total']) : 0;
        return adjustPaystubValues(rawSalario, alimentacaoSum, transporteSum);
    }, [result.totals, alimentacaoSum, transporteSum]);

    return (
        <div className="space-y-6">
          {/* Alerta de Salário Negativo: exibido SOMENTE se ocorrer */}
          {isSalarioNegativo && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm">
              <div className="flex items-start">
                <AlertIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
                <div className="ml-3">
                  <h4 className="text-sm font-bold text-red-800">
                    Atenção para Análise: Documento com Salário Negativo
                  </h4>
                  <p className="mt-1 text-sm text-red-700">
                    O documento <span className="font-semibold underline">{fileName}.pdf</span> resultou em salário líquido negativo de{' '}
                    <span className="font-bold text-red-900">
                      {salario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>.
                    {alimentacaoDeducted && ' (A diferença do valor negativo de alimentação foi deduzida do salário e a alimentação colocada como Ausente).'}
                    {transporteDeducted && ' (A diferença do valor negativo de transporte foi deduzida do salário e o transporte colocado como Ausente).'}
                    &nbsp;Este documento requer atenção e conferência manual dos lançamentos.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-6 bg-green-50 border border-green-200 rounded-lg shadow-sm">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-green-800">Extração Concluída com Sucesso!</h3>
              <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-700 mr-1">Copiar Tudo</span>
                  <ClipboardButton textToCopy={textToCopyAll} />
              </div>
            </div>
            <div className="mt-2 flex justify-between items-center text-lg text-green-700">
                <span>Salário Líquido Total Detectado:</span>
                <div className="flex items-center">
                    <span className="font-mono bg-green-100 text-green-900 px-2 py-1 rounded">
                        {result.totals['Salário Líquido Total'] || "Não detectado"}
                    </span>
                    <ClipboardButton textToCopy={result.totals['Salário Líquido Total'] || ''} />
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-green-300 space-y-2">
                <div className="flex justify-between items-center text-lg text-green-700">
                    <span>Total Alimentação/Cesta:</span>
                    <div className="flex items-center">
                        <span className="font-mono bg-green-100 text-green-900 px-2 py-1 rounded">
                            {alimentacaoSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        <ClipboardButton textToCopy={alimentacaoSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, useGrouping: false }).replace('.',',')} />
                    </div>
                </div>
                <div className="flex justify-between items-center text-lg text-green-700">
                    <span>Total Transporte:</span>
                     <div className="flex items-center">
                        <span className="font-mono bg-green-100 text-green-900 px-2 py-1 rounded">
                           {transporteSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        <ClipboardButton textToCopy={transporteSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, useGrouping: false }).replace('.',',')} />
                    </div>
                </div>
                {decimoTerceiroSum !== 0 && (
                  <div className="flex justify-between items-center text-lg text-green-700">
                      <span>Total 13º Salário:</span>
                      <div className="flex items-center">
                          <span className="font-mono bg-green-100 text-green-900 px-2 py-1 rounded">
                             {decimoTerceiroSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          <ClipboardButton textToCopy={decimoTerceiroSum.toLocaleString('pt-BR', { minimumFractionDigits: 2, useGrouping: false }).replace('.',',')} />
                      </div>
                  </div>
                )}
            </div>
             {verificationResult.hasConflict && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md text-sm">
                  <p className="text-yellow-800">
                      <span className="font-bold">Aviso de Verificação:</span> Foi detectada uma inconsistência entre os itens coloridos na tabela e os totais calculados. Por favor, revise os dados com atenção.
                  </p>
              </div>
            )}
          </div>

          {/* Folha de Classificação - Layout do Excel (Pronta para Exportação) */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 pb-3 border-b border-gray-100 gap-2">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Folha de Classificação</h4>
              </div>
              <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-md text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setPreviewMode('a4')}
                  className={`px-3 py-1 rounded transition-colors ${previewMode === 'a4' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Visão Folha A4
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('card')}
                  className={`px-3 py-1 rounded transition-colors ${previewMode === 'card' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Tamanho Real (100%)
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg border border-gray-200 min-h-[360px]">
              {previewMode === 'a4' ? (
                <div className="flex flex-col items-center">
                  {/* Miniature A4 Sheet (Ratio 210 x 297) */}
                  <div className="relative w-72 md:w-80 aspect-[210/297] bg-white border-2 border-gray-400 shadow-lg rounded-sm overflow-hidden select-none">
                    <div className="absolute top-2 left-2 text-[9px] text-gray-400 font-mono tracking-wide">
                      FOLHA A4
                    </div>
                    <div className="absolute top-2 right-2 text-[8px] text-gray-300 font-mono">
                      210 x 297 mm
                    </div>

                    {/* Dotted border lines representing printable margin */}
                    <div className="absolute inset-3 border border-dashed border-gray-200 pointer-events-none" />

                    {/* Block positioned proportionally: 125mm left, 220mm top, 52mm width, 35mm height */}
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        left: `${(125 / 210) * 100}%`,
                        top: `${(220 / 297) * 100}%`,
                        width: `${(52 / 210) * 100}%`,
                        height: `${(35 / 297) * 100}%`,
                      }}
                    >
                      <div
                        className="w-full h-full bg-white border border-black flex flex-col px-1 py-0.5 select-none overflow-hidden"
                        style={{
                          fontSize: '4.8px',
                          lineHeight: 1.15,
                          fontFamily: 'Arial, sans-serif',
                        }}
                      >
                        <div className="flex-1 min-h-0 flex items-center border-b border-gray-300 font-normal whitespace-nowrap overflow-hidden">
                          EBAC - Classificação
                        </div>
                        <div className="flex-1 min-h-0 flex items-center font-bold whitespace-nowrap overflow-hidden">
                          Salários
                        </div>
                        <div className="flex-1 min-h-0 flex items-center justify-between border-b border-black whitespace-nowrap overflow-hidden">
                          <div className="flex items-center">
                            <span>Ref.: {salarioRef}</span>
                            <span className="ml-1 font-sans">R$</span>
                          </div>
                          <span className="text-right">{formatVal(salario)}</span>
                        </div>
                        <div className="flex-1 min-h-0 flex items-center font-bold whitespace-nowrap overflow-hidden">
                          Vale Alimentação
                        </div>
                        <div className="flex-1 min-h-0 flex items-center justify-between border-b border-black whitespace-nowrap overflow-hidden">
                          <div className="flex items-center">
                            <span>Ref.: {beneficioRef}</span>
                            <span className="ml-1 font-sans">R$</span>
                          </div>
                          <span className="text-right">{formatVal(alimentacao)}</span>
                        </div>
                        <div className="flex-1 min-h-0 flex items-center font-bold whitespace-nowrap overflow-hidden">
                          Vale Transporte
                        </div>
                        <div className="flex-1 min-h-0 flex items-center justify-between whitespace-nowrap overflow-hidden">
                          <div className="flex items-center">
                            <span>Ref.: {beneficioRef}</span>
                            <span className="ml-1 font-sans">R$</span>
                          </div>
                          <span className="text-right">{formatVal(transporte)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <ClassificationCard
                  salarioRef={salarioRef}
                  beneficioRef={beneficioRef}
                  salario={salario}
                  alimentacao={alimentacao}
                  transporte={transporte}
                  width="52mm"
                  height="35mm"
                />
              )}

              {/* Action Buttons: Only PDF */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                <button
                  onClick={onExportPdf}
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  <PdfIcon className="-ml-1 mr-2 h-4 w-4" />
                  Exportar PDF
                </button>
              </div>
            </div>
          </div>
    
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold">Resumo da Folha por Rubrica</h4>
              <div className="flex items-center space-x-4">
                {decimoTerceiroSum !== 0 && <ThirteenthSalaryWarning />}
                <button
                    onClick={onDownload}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
                >
                    <DownloadIcon className="-ml-1 mr-2 h-5 w-5" />
                    Baixar Excel (.xlsx)
                </button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rubrica</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rendimentos</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descontos</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {result.rows.map((row, index) => {
                            const rowStyle = getRowStyle(row.Descrição);
                            return (
                                <tr key={index} className="hover:bg-gray-50">
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-mono ${rowStyle === 'text-gray-600' ? 'text-gray-800' : rowStyle}`}>{row.Rubrica}</td>
                                    <td className={`px-6 py-4 whitespace-normal text-sm ${rowStyle}`}>{row.Descrição}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-mono text-right ${rowStyle === 'text-gray-600' ? 'text-gray-800' : rowStyle}`}>{row.Rendimentos}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-mono text-right ${rowStyle === 'text-gray-600' ? 'text-gray-800' : rowStyle}`}>{row.Descontos}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
          </div>
        </div>
    );
}

// --- Main App Component ---
export default function App() {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  
  // Reference Month State (Default to previous month as requested)
  const [referenceMonth, setReferenceMonth] = useState<string>(() => {
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prevMonthDate.getFullYear();
    const month = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  const { salarioRef, beneficioRef } = useMemo(() => {
    return calculateReferences(referenceMonth);
  }, [referenceMonth]);

  // Single Mode State
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('resumo_folha');

  // Batch Mode State
  const [batchResults, setBatchResults] = useState<BatchExtractionResult[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{current: number, total: number}>({current: 0, total: 0});
  const [batchTab, setBatchTab] = useState<'list' | 'cards'>('list');

  // Windows Search Query Modal State
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const handleExportPdfSingle = useCallback(() => {
    if (!result) return;
    const { rows, totals } = result;
    const { alimentacaoSum, transporteSum } = calculateTotals(rows);
    const rawSalario = totals['Salário Líquido Total'] ? parseCurrency(totals['Salário Líquido Total']) : 0;
    const { salario, alimentacao, transporte } = adjustPaystubValues(rawSalario, alimentacaoSum, transporteSum);
    exportClassificationPdf(
      fileName,
      {
        salarioRef,
        beneficioRef,
        salario,
        alimentacao,
        transporte,
      },
      DEFAULT_PDF_OFFSETS
    );
  }, [result, fileName, salarioRef, beneficioRef]);

  const handleExportPdfBatch = useCallback(() => {
    if (batchResults.length === 0) return;
    const items = batchResults
      .filter(item => item.result !== null)
      .map(item => {
        const { rows, totals } = item.result!;
        const { alimentacaoSum, transporteSum } = calculateTotals(rows);
        const rawSalario = totals['Salário Líquido Total'] ? parseCurrency(totals['Salário Líquido Total']) : 0;
        const { salario, alimentacao, transporte } = adjustPaystubValues(rawSalario, alimentacaoSum, transporteSum);
        return {
          fileName: item.fileName,
          data: {
            salarioRef,
            beneficioRef,
            salario,
            alimentacao,
            transporte,
          },
        };
      });

    exportBatchClassificationPdf(items, DEFAULT_PDF_OFFSETS);
  }, [batchResults, salarioRef, beneficioRef]);

  const handleExportPdfCard = useCallback((card: { condName: string; salario: number; alimentacao: number; transporte: number }) => {
    exportClassificationPdf(
      card.condName,
      {
        salarioRef,
        beneficioRef,
        salario: card.salario,
        alimentacao: card.alimentacao,
        transporte: card.transporte,
      },
      DEFAULT_PDF_OFFSETS
    );
  }, [salarioRef, beneficioRef]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setResult(null);
    setError(null);
    setFileName(file.name.replace(/\.pdf$/i, ''));
    
    try {
      const extractionResult = await processPdf(file);
      setResult(extractionResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.');
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing]);

  const handleBatchFilesSelect = useCallback(async (files: FileList) => {
    if (isBatchProcessing) return;
    setIsBatchProcessing(true);
    setBatchResults([]);
    setBatchProgress({ current: 0, total: files.length });

    const results: BatchExtractionResult[] = [];
    
    // Process sequentially to avoid overwhelming the browser/PDF.js
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name.replace(/\.pdf$/i, '');
        
        try {
            const extractionResult = await processPdf(file);
            results.push({ fileName, result: extractionResult });
        } catch (e) {
            console.error(`Error processing ${file.name}:`, e);
            results.push({ fileName, result: null, error: e instanceof Error ? e.message : 'Unknown error' });
        }
        setBatchProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setBatchResults(results);
    setIsBatchProcessing(false);
  }, [isBatchProcessing]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const excelBlob = buildExcel(result.rows, result.totals);
    const url = window.URL.createObjectURL(excelBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }, [result, fileName]);

  const handleBatchDownload = useCallback(() => {
    if (batchResults.length === 0) return;
    const excelBlob = buildBatchExcel(batchResults);
    const url = window.URL.createObjectURL(excelBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lote_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }, [batchResults]);

  const successfulBatchCount = useMemo(() => {
    return batchResults.filter(r => r.result !== null).length;
  }, [batchResults]);

  // Documents requiring attention due to negative salary (only shown if they occur)
  const negativeSalaryBatchItems = useMemo(() => {
    return batchResults
      .filter(item => item.result !== null)
      .map(item => {
        const { rows, totals } = item.result!;
        const { alimentacaoSum, transporteSum } = calculateTotals(rows);
        const rawSalario = totals['Salário Líquido Total'] ? parseCurrency(totals['Salário Líquido Total']) : 0;
        const adjusted = adjustPaystubValues(rawSalario, alimentacaoSum, transporteSum);
        return {
          fileName: item.fileName,
          salario: adjusted.salario,
          isSalarioNegativo: adjusted.isSalarioNegativo,
        };
      })
      .filter(item => item.isSalarioNegativo);
  }, [batchResults]);

  return (
    <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto py-5 px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-gray-900">Extrator — Resumo Geral da Folha (Nasajon)</h1>
                    <p className="mt-1 text-sm text-gray-500">Faça upload do PDF da folha para extrair o Resumo Geral, calcular totais e exportar a folha de classificação em PDF e Excel.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setIsSearchModalOpen(true)}
                    className="inline-flex items-center self-start sm:self-center px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 border border-gray-200 rounded-md transition-colors shadow-2xs whitespace-nowrap"
                    title="Abrir gerador de pesquisa para Windows"
                >
                    <SearchIcon className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                    Busca no Windows
                </button>
            </div>
        </header>

        <main>
            <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 max-w-4xl mx-auto">
                        
                        {/* Mode Toggle */}
                        <div className="flex justify-center mb-6">
                            <div className="bg-gray-100 p-1 rounded-lg inline-flex">
                                <button
                                    onClick={() => setMode('single')}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'single' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                >
                                    Arquivo Único
                                </button>
                                <button
                                    onClick={() => setMode('batch')}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'batch' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                                >
                                    Processamento em Lote
                                </button>
                            </div>
                        </div>

                        {/* Reference Month / Year Selector */}
                        <ReferenceMonthSelector
                          referenceMonth={referenceMonth}
                          onChange={setReferenceMonth}
                          salarioRef={salarioRef}
                          beneficioRef={beneficioRef}
                        />

                        {mode === 'single' ? (
                            <>
                                <FileUploader onFileSelect={handleFileSelect} isProcessing={isProcessing} />
                            
                                <div className="mt-8">
                                    {isProcessing && (
                                        <div className="flex flex-col items-center justify-center p-10">
                                            <SpinnerIcon className="h-12 w-12 text-primary" />
                                            <p className="mt-4 text-lg text-gray-600">Analisando o PDF, por favor aguarde...</p>
                                            <p className="mt-1 text-sm text-gray-500">Este processo pode demorar alguns segundos.</p>
                                        </div>
                                    )}
                                    
                                    {error && !isProcessing && (
                                        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                                            <p className="font-bold">Erro na Extração</p>
                                            <p>{error}</p>
                                        </div>
                                    )}
                                    
                                    {result && !isProcessing && (
                                    <ResultsDisplay
                                      result={result}
                                      fileName={fileName}
                                      salarioRef={salarioRef}
                                      beneficioRef={beneficioRef}
                                      onDownload={handleDownload}
                                      onExportPdf={handleExportPdfSingle}
                                    />
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <BatchFileUploader onFilesSelect={handleBatchFilesSelect} isProcessing={isBatchProcessing} />

                                <div className="mt-8">
                                    {isBatchProcessing && (
                                        <div className="flex flex-col items-center justify-center p-10">
                                            <SpinnerIcon className="h-12 w-12 text-primary" />
                                            <p className="mt-4 text-lg text-gray-600">Processando arquivos...</p>
                                            <p className="mt-1 text-sm text-gray-500">{batchProgress.current} de {batchProgress.total} arquivos processados</p>
                                            <div className="w-full max-w-md mt-4 bg-gray-200 rounded-full h-2.5">
                                                <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}></div>
                                            </div>
                                        </div>
                                    )}

                                    {!isBatchProcessing && batchResults.length > 0 && (
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                                            <div className="text-center mb-6">
                                                <h3 className="text-xl font-bold text-green-800 mb-1">Processamento em Lote Concluído!</h3>
                                                <p className="text-green-700 text-sm">{batchResults.length} arquivos processados ({successfulBatchCount} com sucesso).</p>
                                            </div>

                                            {/* Alerta de Documentos com Salário Negativo (exibido SOMENTE se ocorrer) */}
                                            {negativeSalaryBatchItems.length > 0 && (
                                                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm text-left">
                                                    <div className="flex items-start">
                                                        <AlertIcon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                                                        <div className="ml-3">
                                                            <h4 className="text-sm font-bold text-red-800">
                                                                Atenção para Análise: {negativeSalaryBatchItems.length} documento(s) com Salário Negativo
                                                            </h4>
                                                            <p className="mt-1 text-xs text-red-700">
                                                                O(s) seguinte(s) documento(s) apresentaram deduções superiores aos rendimentos, resultando em salário líquido negativo:
                                                            </p>
                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                                {negativeSalaryBatchItems.map((item, idx) => (
                                                                    <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-md bg-red-100 text-red-900 font-mono text-xs font-semibold border border-red-200">
                                                                        {item.fileName}: {item.salario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Action Buttons: Apenas Exportação em Excel e PDF */}
                                            <div className="flex flex-wrap justify-center gap-3 mb-6">
                                                <button
                                                    onClick={handleBatchDownload}
                                                    className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
                                                >
                                                    <DownloadIcon className="-ml-1 mr-2 h-5 w-5" />
                                                    Planilha Consolidada
                                                </button>
                                                <button
                                                    onClick={handleExportPdfBatch}
                                                    disabled={successfulBatchCount === 0}
                                                    className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
                                                >
                                                    <PdfIcon className="-ml-1 mr-2 h-5 w-5" />
                                                    Exportar PDF ({successfulBatchCount})
                                                </button>
                                            </div>

                                            {/* Subtabs for Results */}
                                            <div className="border-b border-gray-200 mb-4">
                                                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                                                    <button
                                                        onClick={() => setBatchTab('list')}
                                                        className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm ${
                                                            batchTab === 'list'
                                                                ? 'border-primary text-primary'
                                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        Lista de Arquivos ({batchResults.length})
                                                    </button>
                                                    <button
                                                        onClick={() => setBatchTab('cards')}
                                                        className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm ${
                                                            batchTab === 'cards'
                                                                ? 'border-primary text-primary'
                                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        Visualizar Folhas A4 ({successfulBatchCount})
                                                    </button>
                                                </nav>
                                            </div>

                                            {batchTab === 'list' ? (
                                                <div className="text-left">
                                                    <div className="max-h-64 overflow-y-auto bg-white rounded border border-gray-200 p-2 text-sm">
                                                        {batchResults.map((res, idx) => {
                                                            let has13th = false;
                                                            if (res.result) {
                                                                const totals = calculateTotals(res.result.rows);
                                                                if (totals.decimoTerceiroSum !== 0) has13th = true;
                                                            }
                                                            const isNegative = negativeSalaryBatchItems.some(neg => neg.fileName === res.fileName);

                                                            return (
                                                                <div key={idx} className={`flex justify-between items-center py-2 px-3 ${idx % 2 === 0 ? 'bg-gray-50' : ''}`}>
                                                                    <div className="flex items-center space-x-2 truncate">
                                                                        <span className="truncate max-w-[16rem]" title={res.fileName}>{res.fileName}</span>
                                                                        {has13th && (
                                                                            <span title="Contém 13º Salário" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                                                <AlertIcon className="h-3 w-3 mr-1 animate-blink" />
                                                                                13º
                                                                            </span>
                                                                        )}
                                                                        {isNegative && (
                                                                            <span title="Salário Líquido Negativo — Atenção para análise" className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">
                                                                                Atenção: Salário Negativo
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {res.result ? (
                                                                        <span className="text-green-600 font-medium whitespace-nowrap">Sucesso</span>
                                                                    ) : (
                                                                        <span className="text-red-600 font-medium whitespace-nowrap" title={res.error}>Erro</span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-left">
                                                    <div className="max-h-[550px] overflow-y-auto bg-gray-100 rounded-lg p-4 border border-gray-200">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 justify-items-center">
                                                            {batchResults
                                                                .filter(res => res.result !== null)
                                                                .map((res, idx) => {
                                                                    const { rows, totals } = res.result!;
                                                                    const { alimentacaoSum, transporteSum } = calculateTotals(rows);
                                                                    const rawSalario = totals['Salário Líquido Total'] ? parseCurrency(totals['Salário Líquido Total']) : 0;
                                                                    const { salario, alimentacao, transporte, isSalarioNegativo } = adjustPaystubValues(rawSalario, alimentacaoSum, transporteSum);
                                                                    
                                                                    return (
                                                                        <div key={idx} className={`bg-white p-4 rounded-lg shadow-sm border ${isSalarioNegativo ? 'border-red-400 ring-2 ring-red-300' : 'border-gray-200'} flex flex-col items-center`}>
                                                                            {/* Alerta contextual se salário negativo */}
                                                                            {isSalarioNegativo && (
                                                                                <div className="w-full mb-2 p-1.5 bg-red-100 border border-red-300 rounded text-center text-xs font-bold text-red-800">
                                                                                    Atenção: Salário Negativo ({salario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                                                                                </div>
                                                                            )}

                                                                            {/* Miniature A4 Sheet representation with proportional 52mm block and Arial 10 styling */}
                                                                            <div className="relative w-56 aspect-[210/297] bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden select-none mb-3">
                                                                                <div className="absolute top-1 left-1.5 text-[7px] text-gray-400 font-mono truncate max-w-[150px]">
                                                                                    {res.fileName}
                                                                                </div>
                                                                                <div
                                                                                    className="absolute pointer-events-none"
                                                                                    style={{
                                                                                        left: `${(125 / 210) * 100}%`,
                                                                                        top: `${(220 / 297) * 100}%`,
                                                                                        width: `${(52 / 210) * 100}%`,
                                                                                        height: `${(35 / 297) * 100}%`,
                                                                                    }}
                                                                                >
                                                                                    <div
                                                                                        className="w-full h-full bg-white border border-black flex flex-col px-0.5 py-0.5 select-none overflow-hidden"
                                                                                        style={{
                                                                                            fontSize: '4.2px',
                                                                                            lineHeight: 1.15,
                                                                                            fontFamily: 'Arial, sans-serif',
                                                                                        }}
                                                                                    >
                                                                                        <div className="flex-1 min-h-0 flex items-center border-b border-gray-300 font-normal whitespace-nowrap overflow-hidden">
                                                                                            EBAC - Classificação
                                                                                        </div>
                                                                                        <div className="flex-1 min-h-0 flex items-center font-bold whitespace-nowrap overflow-hidden">
                                                                                            Salários
                                                                                        </div>
                                                                                        <div className="flex-1 min-h-0 flex items-center justify-between border-b border-black whitespace-nowrap overflow-hidden">
                                                                                            <div className="flex items-center">
                                                                                                <span>Ref.: {salarioRef}</span>
                                                                                                <span className="ml-0.5 font-sans">R$</span>
                                                                                            </div>
                                                                                            <span className="text-right">{salario > 0 ? salario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Ausente'}</span>
                                                                                        </div>
                                                                                        <div className="flex-1 min-h-0 flex items-center font-bold whitespace-nowrap overflow-hidden">
                                                                                            Vale Alimentação
                                                                                        </div>
                                                                                        <div className="flex-1 min-h-0 flex items-center justify-between border-b border-black whitespace-nowrap overflow-hidden">
                                                                                            <div className="flex items-center">
                                                                                                <span>Ref.: {beneficioRef}</span>
                                                                                                <span className="ml-0.5 font-sans">R$</span>
                                                                                            </div>
                                                                                            <span className="text-right">{alimentacao > 0 ? alimentacao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Ausente'}</span>
                                                                                        </div>
                                                                                        <div className="flex-1 min-h-0 flex items-center font-bold whitespace-nowrap overflow-hidden">
                                                                                            Vale Transporte
                                                                                        </div>
                                                                                        <div className="flex-1 min-h-0 flex items-center justify-between whitespace-nowrap overflow-hidden">
                                                                                            <div className="flex items-center">
                                                                                                <span>Ref.: {beneficioRef}</span>
                                                                                                <span className="ml-0.5 font-sans">R$</span>
                                                                                            </div>
                                                                                            <span className="text-right">{transporte > 0 ? transporte.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Ausente'}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Card Actions: PDF */}
                                                                            <div className="flex items-center space-x-2">
                                                                                <button
                                                                                    onClick={() => handleExportPdfCard({
                                                                                        condName: res.fileName,
                                                                                        salario,
                                                                                        alimentacao,
                                                                                        transporte,
                                                                                    })}
                                                                                    type="button"
                                                                                    className="inline-flex items-center px-3 py-1 border border-transparent shadow-sm text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none transition-colors"
                                                                                    title="Exportar folha A4 em PDF"
                                                                                >
                                                                                    <PdfIcon className="h-3.5 w-3.5 mr-1" />
                                                                                    PDF
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </main>

        {/* Modal de busca formatada para o Windows */}
        <WindowsSearchModal
            isOpen={isSearchModalOpen}
            onClose={() => setIsSearchModalOpen(false)}
        />
    </div>
  );
}
