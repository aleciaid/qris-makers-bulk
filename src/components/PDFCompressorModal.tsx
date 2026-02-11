import React, { useState, useRef, useCallback } from 'react';
import { X, FileDown, Download, Trash2, Loader2, AlertCircle, Check, Minimize2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// Set the worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PDFFileEntry {
    id: string;
    file: File;
    name: string;
    originalSize: number;
    compressedSize: number | null;
    compressedBlob: Blob | null;
    status: 'pending' | 'processing' | 'completed' | 'error';
    progress: number;
    errorMessage?: string;
}

interface PDFCompressorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getCompressionRatio = (original: number, compressed: number): string => {
    const ratio = ((1 - compressed / original) * 100).toFixed(1);
    return `${ratio}%`;
};

export const PDFCompressorModal: React.FC<PDFCompressorModalProps> = ({ isOpen, onClose }) => {
    const [pdfFiles, setPdfFiles] = useState<PDFFileEntry[]>([]);
    const [isCompressing, setIsCompressing] = useState(false);
    const [compressionLevel, setCompressionLevel] = useState<'low' | 'medium' | 'high' | 'custom'>('medium');
    const [customQuality, setCustomQuality] = useState(0.7);
    const [customScale, setCustomScale] = useState(1.5);
    const [targetSizeMB, setTargetSizeMB] = useState<number>(1);
    const [useTargetSize, setUseTargetSize] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const COMPRESSION_PRESETS = {
        low: { quality: 0.85, scale: 2, label: 'Rendah', desc: 'Kualitas tinggi, kompresi sedikit' },
        medium: { quality: 0.65, scale: 1.5, label: 'Sedang', desc: 'Keseimbangan kualitas & ukuran' },
        high: { quality: 0.4, scale: 1, label: 'Tinggi', desc: 'Ukuran kecil, kualitas menurun' },
        custom: { quality: customQuality, scale: customScale, label: 'Custom', desc: 'Atur manual' },
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newFiles: PDFFileEntry[] = Array.from(files)
            .filter(f => f.type === 'application/pdf')
            .map(file => ({
                id: crypto.randomUUID(),
                file,
                name: file.name,
                originalSize: file.size,
                compressedSize: null,
                compressedBlob: null,
                status: 'pending' as const,
                progress: 0,
            }));

        setPdfFiles(prev => [...prev, ...newFiles]);
        e.target.value = '';
    };

    const compressSinglePDF = useCallback(async (
        entry: PDFFileEntry,
        quality: number,
        scale: number,
        targetBytes?: number
    ): Promise<{ blob: Blob; size: number }> => {
        const arrayBuffer = await entry.file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;

        let currentQuality = quality;
        let currentScale = scale;
        let attempt = 0;
        const maxAttempts = targetBytes ? 5 : 1;

        let resultBlob: Blob | null = null;

        while (attempt < maxAttempts) {
            const newPdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
            });

            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                if (pageNum > 1) newPdf.addPage();

                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: currentScale });

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                if (!context) throw new Error('Could not get canvas context');

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({
                    canvasContext: context,
                    viewport,
                    canvas,
                }).promise;

                const imgData = canvas.toDataURL('image/jpeg', currentQuality);

                // Calculate dimensions to fit page
                const pdfPageWidth = newPdf.internal.pageSize.getWidth();
                const pdfPageHeight = newPdf.internal.pageSize.getHeight();
                const imgRatio = viewport.width / viewport.height;
                const pageRatio = pdfPageWidth / pdfPageHeight;

                let drawW: number, drawH: number, drawX: number, drawY: number;
                if (imgRatio > pageRatio) {
                    drawW = pdfPageWidth;
                    drawH = drawW / imgRatio;
                    drawX = 0;
                    drawY = (pdfPageHeight - drawH) / 2;
                } else {
                    drawH = pdfPageHeight;
                    drawW = drawH * imgRatio;
                    drawX = (pdfPageWidth - drawW) / 2;
                    drawY = 0;
                }

                newPdf.addImage(imgData, 'JPEG', drawX, drawY, drawW, drawH);

                // Update progress
                const progress = Math.round((pageNum / numPages) * 100);
                setPdfFiles(prev => prev.map(f =>
                    f.id === entry.id ? { ...f, progress } : f
                ));
            }

            resultBlob = newPdf.output('blob');

            // Check if target size is met
            if (targetBytes && resultBlob.size > targetBytes && attempt < maxAttempts - 1) {
                // Reduce quality and scale further
                currentQuality = Math.max(0.1, currentQuality * 0.7);
                currentScale = Math.max(0.5, currentScale * 0.8);
                attempt++;
            } else {
                break;
            }
        }

        if (!resultBlob) throw new Error('Compression failed');

        return { blob: resultBlob, size: resultBlob.size };
    }, []);

    const handleCompressAll = async () => {
        setIsCompressing(true);
        const pendingFiles = pdfFiles.filter(f => f.status === 'pending');
        const preset = COMPRESSION_PRESETS[compressionLevel];
        const targetBytes = useTargetSize ? targetSizeMB * 1024 * 1024 : undefined;

        for (const entry of pendingFiles) {
            setPdfFiles(prev => prev.map(f =>
                f.id === entry.id ? { ...f, status: 'processing', progress: 0 } : f
            ));

            try {
                const result = await compressSinglePDF(
                    entry,
                    preset.quality,
                    preset.scale,
                    targetBytes
                );

                setPdfFiles(prev => prev.map(f =>
                    f.id === entry.id
                        ? {
                            ...f,
                            status: 'completed',
                            progress: 100,
                            compressedSize: result.size,
                            compressedBlob: result.blob,
                        }
                        : f
                ));
            } catch (error) {
                console.error(`Error compressing ${entry.name}:`, error);
                setPdfFiles(prev => prev.map(f =>
                    f.id === entry.id
                        ? { ...f, status: 'error', errorMessage: 'Gagal mengkompresi PDF' }
                        : f
                ));
            }
        }

        setIsCompressing(false);
    };

    const downloadCompressed = (entry: PDFFileEntry) => {
        if (!entry.compressedBlob) return;
        const url = URL.createObjectURL(entry.compressedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compressed_${entry.name}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadAll = () => {
        const completedFiles = pdfFiles.filter(f => f.status === 'completed' && f.compressedBlob);
        completedFiles.forEach(entry => downloadCompressed(entry));
    };

    const removeFile = (id: string) => {
        setPdfFiles(prev => prev.filter(f => f.id !== id));
    };

    const clearAll = () => {
        setPdfFiles([]);
    };

    const pendingCount = pdfFiles.filter(f => f.status === 'pending').length;
    const completedCount = pdfFiles.filter(f => f.status === 'completed').length;
    const totalOriginalSize = pdfFiles.reduce((sum, f) => sum + f.originalSize, 0);
    const totalCompressedSize = pdfFiles
        .filter(f => f.compressedSize !== null)
        .reduce((sum, f) => sum + (f.compressedSize || 0), 0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 no-print">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-violet-500 to-purple-600">
                    <div className="flex items-center gap-3">
                        <Minimize2 className="w-6 h-6 text-white" />
                        <div>
                            <h3 className="font-bold text-white">PDF Compressor</h3>
                            <p className="text-violet-100 text-sm">Kompres ukuran file PDF</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4 space-y-4">
                    {/* Compression Settings */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h4 className="text-sm font-bold text-gray-700 uppercase mb-3">⚙️ Level Kompresi</h4>

                        {/* Preset Buttons */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                            {(Object.entries(COMPRESSION_PRESETS) as [string, typeof COMPRESSION_PRESETS['low']][]).map(([key, preset]) => (
                                <button
                                    key={key}
                                    onClick={() => setCompressionLevel(key as typeof compressionLevel)}
                                    className={`p-3 rounded-lg border text-left transition-all ${compressionLevel === key
                                            ? 'bg-violet-500 text-white border-violet-500 shadow-md'
                                            : 'bg-white text-gray-700 border-gray-200 hover:border-violet-300'
                                        }`}
                                >
                                    <p className="font-semibold text-sm">{preset.label}</p>
                                    <p className={`text-xs mt-0.5 ${compressionLevel === key ? 'text-violet-100' : 'text-gray-500'}`}>
                                        {preset.desc}
                                    </p>
                                </button>
                            ))}
                        </div>

                        {/* Custom Settings */}
                        {compressionLevel === 'custom' && (
                            <div className="bg-white rounded-lg p-4 border border-violet-200 space-y-3">
                                <div>
                                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Kualitas JPEG</label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="1"
                                            step="0.05"
                                            value={customQuality}
                                            onChange={(e) => setCustomQuality(Number(e.target.value))}
                                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-500"
                                        />
                                        <span className="text-sm font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded min-w-[50px] text-center">
                                            {Math.round(customQuality * 100)}%
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Resolusi Render (Scale)</label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="3"
                                            step="0.1"
                                            value={customScale}
                                            onChange={(e) => setCustomScale(Number(e.target.value))}
                                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-500"
                                        />
                                        <span className="text-sm font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded min-w-[50px] text-center">
                                            {customScale}x
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Target Size Option */}
                        <div className="mt-4 bg-white rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="font-semibold text-gray-800 text-sm">🎯 Target Ukuran File</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Kompresi otomatis hingga mendekati target</p>
                                </div>
                                <button
                                    onClick={() => setUseTargetSize(!useTargetSize)}
                                    className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${useTargetSize ? 'bg-violet-500' : 'bg-gray-300'}`}
                                >
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${useTargetSize ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {useTargetSize && (
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min="0.1"
                                        max="100"
                                        step="0.1"
                                        value={targetSizeMB}
                                        onChange={(e) => setTargetSizeMB(Number(e.target.value))}
                                        className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 outline-none text-center font-bold"
                                    />
                                    <span className="text-sm font-semibold text-gray-600">MB</span>
                                    <div className="flex-1">
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="20"
                                            step="0.1"
                                            value={targetSizeMB}
                                            onChange={(e) => setTargetSizeMB(Number(e.target.value))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-500"
                                        />
                                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                                            <span>0.1 MB</span>
                                            <span>20 MB</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Upload Area */}
                    <div className="border-2 border-dashed border-violet-300 bg-violet-50 rounded-xl p-6">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept=".pdf,application/pdf"
                            multiple
                            className="hidden"
                        />
                        <div className="text-center">
                            <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                                <FileDown className="w-8 h-8 text-violet-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Upload File PDF</h3>
                            <p className="text-gray-500 text-sm mb-4">Pilih satu atau lebih file PDF untuk dikompres</p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-6 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors font-medium"
                            >
                                📁 Pilih File PDF
                            </button>
                        </div>
                    </div>

                    {/* File List */}
                    {pdfFiles.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-gray-700">
                                    📄 Daftar PDF ({pdfFiles.length} file)
                                </h4>
                                <button
                                    onClick={clearAll}
                                    className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                >
                                    Hapus Semua
                                </button>
                            </div>

                            {pdfFiles.map((entry) => (
                                <div
                                    key={entry.id}
                                    className={`border rounded-lg p-3 transition-all ${entry.status === 'completed' ? 'border-green-200 bg-green-50' :
                                            entry.status === 'error' ? 'border-red-200 bg-red-50' :
                                                entry.status === 'processing' ? 'border-violet-200 bg-violet-50' :
                                                    'border-gray-200 bg-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Status Icon */}
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${entry.status === 'completed' ? 'bg-green-100' :
                                                entry.status === 'error' ? 'bg-red-100' :
                                                    entry.status === 'processing' ? 'bg-violet-100' :
                                                        'bg-gray-100'
                                            }`}>
                                            {entry.status === 'processing' ? (
                                                <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                                            ) : entry.status === 'completed' ? (
                                                <Check className="w-5 h-5 text-green-500" />
                                            ) : entry.status === 'error' ? (
                                                <AlertCircle className="w-5 h-5 text-red-500" />
                                            ) : (
                                                <FileDown className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>

                                        {/* File Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-800 text-sm truncate">{entry.name}</p>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="text-gray-500">
                                                    Asli: {formatFileSize(entry.originalSize)}
                                                </span>
                                                {entry.status === 'completed' && entry.compressedSize !== null && (
                                                    <>
                                                        <span className="text-gray-300">→</span>
                                                        <span className="font-bold text-green-600">
                                                            {formatFileSize(entry.compressedSize)}
                                                        </span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${entry.compressedSize < entry.originalSize
                                                                ? 'bg-green-100 text-green-700'
                                                                : 'bg-amber-100 text-amber-700'
                                                            }`}>
                                                            {entry.compressedSize < entry.originalSize
                                                                ? `↓ ${getCompressionRatio(entry.originalSize, entry.compressedSize)}`
                                                                : `↑ Lebih besar`
                                                            }
                                                        </span>
                                                    </>
                                                )}
                                                {entry.status === 'processing' && (
                                                    <span className="text-violet-600">Mengkompresi... {entry.progress}%</span>
                                                )}
                                                {entry.status === 'error' && (
                                                    <span className="text-red-500">{entry.errorMessage}</span>
                                                )}
                                            </div>

                                            {/* Progress Bar */}
                                            {entry.status === 'processing' && (
                                                <div className="mt-2 h-1.5 bg-violet-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-violet-500 transition-all duration-300"
                                                        style={{ width: `${entry.progress}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            {entry.status === 'completed' && entry.compressedBlob && (
                                                <button
                                                    onClick={() => downloadCompressed(entry)}
                                                    className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                                    title="Download file terkompresi"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => removeFile(entry.id)}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Summary */}
                            {completedCount > 0 && (
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-semibold">Ukuran Asli</p>
                                            <p className="text-lg font-bold text-gray-700">{formatFileSize(totalOriginalSize)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-semibold">Setelah Kompresi</p>
                                            <p className="text-lg font-bold text-green-600">{formatFileSize(totalCompressedSize)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-semibold">Hemat</p>
                                            <p className="text-lg font-bold text-emerald-600">
                                                {totalCompressedSize < totalOriginalSize
                                                    ? getCompressionRatio(totalOriginalSize, totalCompressedSize)
                                                    : '0%'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        {completedCount > 0 && (
                            <span className="flex items-center gap-1">
                                <Check className="w-4 h-4 text-green-500" />
                                {completedCount} file selesai dikompres
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {completedCount > 1 && (
                            <button
                                onClick={downloadAll}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                Download Semua
                            </button>
                        )}
                        {pendingCount > 0 && (
                            <button
                                onClick={handleCompressAll}
                                disabled={isCompressing}
                                className="px-6 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isCompressing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Mengkompresi...
                                    </>
                                ) : (
                                    <>
                                        <Minimize2 className="w-4 h-4" />
                                        Kompres ({pendingCount})
                                    </>
                                )}
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
