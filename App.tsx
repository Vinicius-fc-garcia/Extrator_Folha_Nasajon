
import React, { useState, useCallback, useRef, useMemo } from 'react';
import type { ExtractionResult, PaystubRow } from './types';
import { processPdf } from './services/pdfProcessor';
import { buildExcel } from './services/excelGenerator';

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

const SpinnerIcon: React.FC<{className: string}> = ({ className }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
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

// Helpers moved from excelGenerator to be used in UI
const parseCurrency = (value: string): number => {
  if (!value || typeof value !== 'string') return 0;
  return parseFloat(value.replace(/\./g, '').replace(',', '.'));
};

const normalizeText = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/º/g, 'o')
    .replace(/ª/g, 'a')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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

const ResultsDisplay: React.FC<{ result: ExtractionResult; onDownload: () => void; }> = ({ result, onDownload }) => {
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

    return (
        <div className="space-y-6">
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
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('resumo_folha');

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

  return (
    <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold leading-tight text-gray-900">Extrator — Resumo Geral da Folha (Nasajon)</h1>
                <p className="mt-1 text-sm text-gray-500">Faça upload do PDF da folha para extrair a tabela 'Resumo Geral' e o Salário Líquedо Total.</p>
            </div>
        </header>

        <main>
            <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 max-w-4xl mx-auto">
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
                              <ResultsDisplay result={result} onDownload={handleDownload} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
  );
}
