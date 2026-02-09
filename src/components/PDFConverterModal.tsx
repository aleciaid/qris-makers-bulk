import React, { useState, useRef, useCallback } from 'react';
import { X, FileImage, Download, Trash2, Loader2, ChevronDown, ChevronUp, AlertCircle, Check } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Set the worker source using jsDelivr CDN (more reliable than cdnjs for newer versions)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface PDFFile {
    id: string;
    file: File;
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    progress: number;
    pages: ConvertedPage[];
    totalPages: number;
    errorMessage?: string;
}

interface ConvertedPage {
    pageNumber: number;
    dataUrl: string;
    blob: Blob | null;
}

interface PDFConverterModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PDFConverterModal: React.FC<PDFConverterModalProps> = ({ isOpen, onClose }) => {
    const [pdfFiles, setPdfFiles] = useState<PDFFile[]>([]);
    const [isConverting, setIsConverting] = useState(false);
    const [quality, setQuality] = useState(0.92); // JPEG quality 0-1
    const [scale, setScale] = useState(2); // Render scale for higher resolution
    const [expandedPdf, setExpandedPdf] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newPdfFiles: PDFFile[] = Array.from(files).map(file => ({
            id: crypto.randomUUID(),
            file,
            name: file.name,
            status: 'pending',
            progress: 0,
            pages: [],
            totalPages: 0
        }));

        setPdfFiles(prev => [...prev, ...newPdfFiles]);
        e.target.value = '';
    };

    const convertPDFToImages = useCallback(async (pdfFile: PDFFile): Promise<ConvertedPage[]> => {
        const arrayBuffer = await pdfFile.file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages: ConvertedPage[] = [];

        setPdfFiles(prev => prev.map(f =>
            f.id === pdfFile.id
                ? { ...f, status: 'processing', totalPages: pdf.numPages }
                : f
        ));

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Could not get canvas context');

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport,
                canvas
            }).promise;

            const dataUrl = canvas.toDataURL('image/jpeg', quality);

            // Convert data URL to Blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            pages.push({
                pageNumber: pageNum,
                dataUrl,
                blob
            });

            // Update progress
            const progress = Math.round((pageNum / pdf.numPages) * 100);
            setPdfFiles(prev => prev.map(f =>
                f.id === pdfFile.id
                    ? { ...f, progress, pages: [...pages] }
                    : f
            ));
        }

        return pages;
    }, [quality, scale]);

    const handleConvertAll = async () => {
        setIsConverting(true);
        const pendingFiles = pdfFiles.filter(f => f.status === 'pending');

        for (const pdfFile of pendingFiles) {
            try {
                const pages = await convertPDFToImages(pdfFile);
                setPdfFiles(prev => prev.map(f =>
                    f.id === pdfFile.id
                        ? { ...f, status: 'completed', progress: 100, pages }
                        : f
                ));
            } catch (error) {
                console.error(`Error converting ${pdfFile.name}:`, error);
                setPdfFiles(prev => prev.map(f =>
                    f.id === pdfFile.id
                        ? { ...f, status: 'error', errorMessage: 'Gagal mengkonversi PDF' }
                        : f
                ));
            }
        }

        setIsConverting(false);
    };

    const downloadSinglePage = (pdfName: string, page: ConvertedPage) => {
        if (!page.blob) return;
        const fileName = `${pdfName.replace('.pdf', '')}_page_${page.pageNumber}.jpg`;
        saveAs(page.blob, fileName);
    };

    const downloadAllPagesForPdf = async (pdfFile: PDFFile) => {
        if (pdfFile.pages.length === 0) return;

        if (pdfFile.pages.length === 1) {
            downloadSinglePage(pdfFile.name, pdfFile.pages[0]);
            return;
        }

        const zip = new JSZip();
        const folder = zip.folder(pdfFile.name.replace('.pdf', ''));
        if (!folder) return;

        for (const page of pdfFile.pages) {
            if (page.blob) {
                folder.file(`page_${page.pageNumber}.jpg`, page.blob);
            }
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `${pdfFile.name.replace('.pdf', '')}_images.zip`);
    };

    const downloadAllAsZip = async () => {
        const completedFiles = pdfFiles.filter(f => f.status === 'completed' && f.pages.length > 0);
        if (completedFiles.length === 0) return;

        const zip = new JSZip();

        for (const pdfFile of completedFiles) {
            const folder = zip.folder(pdfFile.name.replace('.pdf', ''));
            if (!folder) continue;

            for (const page of pdfFile.pages) {
                if (page.blob) {
                    folder.file(`page_${page.pageNumber}.jpg`, page.blob);
                }
            }
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `converted_images_${Date.now()}.zip`);
    };

    const removePdfFile = (id: string) => {
        setPdfFiles(prev => prev.filter(f => f.id !== id));
    };

    const clearAll = () => {
        setPdfFiles([]);
    };

    const toggleExpanded = (id: string) => {
        setExpandedPdf(prev => prev === id ? null : id);
    };

    const pendingCount = pdfFiles.filter(f => f.status === 'pending').length;
    const completedCount = pdfFiles.filter(f => f.status === 'completed').length;
    const totalPages = pdfFiles.reduce((sum, f) => sum + f.pages.length, 0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 no-print">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-orange-500 to-red-500">
                    <div className="flex items-center gap-3">
                        <FileImage className="w-6 h-6 text-white" />
                        <div>
                            <h3 className="font-bold text-white">PDF to JPG Converter</h3>
                            <p className="text-orange-100 text-sm">Konversi multi PDF ke gambar JPG</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4 space-y-4">
                    {/* Settings */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <h4 className="text-sm font-bold text-gray-700 uppercase mb-3">⚙️ Pengaturan Output</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-gray-600 mb-1 block">Kualitas JPEG</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="1"
                                        step="0.01"
                                        value={quality}
                                        onChange={(e) => setQuality(Number(e.target.value))}
                                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                    />
                                    <span className="text-sm font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded min-w-[50px] text-center">
                                        {Math.round(quality * 100)}%
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-600 mb-1 block">Resolusi (Scale)</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min="1"
                                        max="4"
                                        step="0.5"
                                        value={scale}
                                        onChange={(e) => setScale(Number(e.target.value))}
                                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                    />
                                    <span className="text-sm font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded min-w-[50px] text-center">
                                        {scale}x
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Upload Area */}
                    <div className="border-2 border-dashed border-orange-300 bg-orange-50 rounded-xl p-6">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept=".pdf"
                            multiple
                            className="hidden"
                        />
                        <div className="text-center">
                            <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                                <FileImage className="w-8 h-8 text-orange-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Upload File PDF</h3>
                            <p className="text-gray-500 text-sm mb-4">Pilih satu atau lebih file PDF untuk dikonversi</p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
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
                                {pdfFiles.length > 0 && (
                                    <button
                                        onClick={clearAll}
                                        className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                    >
                                        Hapus Semua
                                    </button>
                                )}
                            </div>

                            {pdfFiles.map((pdfFile) => (
                                <div
                                    key={pdfFile.id}
                                    className={`border rounded-lg overflow-hidden transition-all ${pdfFile.status === 'completed' ? 'border-green-200 bg-green-50' :
                                        pdfFile.status === 'error' ? 'border-red-200 bg-red-50' :
                                            pdfFile.status === 'processing' ? 'border-orange-200 bg-orange-50' :
                                                'border-gray-200 bg-white'
                                        }`}
                                >
                                    {/* File Header */}
                                    <div className="p-3 flex items-center gap-3">
                                        {/* Status Icon */}
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${pdfFile.status === 'completed' ? 'bg-green-100' :
                                            pdfFile.status === 'error' ? 'bg-red-100' :
                                                pdfFile.status === 'processing' ? 'bg-orange-100' :
                                                    'bg-gray-100'
                                            }`}>
                                            {pdfFile.status === 'processing' ? (
                                                <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                                            ) : pdfFile.status === 'completed' ? (
                                                <Check className="w-5 h-5 text-green-500" />
                                            ) : pdfFile.status === 'error' ? (
                                                <AlertCircle className="w-5 h-5 text-red-500" />
                                            ) : (
                                                <FileImage className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>

                                        {/* File Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-800 truncate">{pdfFile.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {pdfFile.status === 'processing' && `Memproses... ${pdfFile.progress}%`}
                                                {pdfFile.status === 'completed' && `${pdfFile.pages.length} halaman selesai`}
                                                {pdfFile.status === 'error' && pdfFile.errorMessage}
                                                {pdfFile.status === 'pending' && 'Menunggu konversi'}
                                            </p>

                                            {/* Progress Bar */}
                                            {pdfFile.status === 'processing' && (
                                                <div className="mt-2 h-1.5 bg-orange-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-orange-500 transition-all duration-300"
                                                        style={{ width: `${pdfFile.progress}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            {pdfFile.status === 'completed' && pdfFile.pages.length > 0 && (
                                                <>
                                                    <button
                                                        onClick={() => downloadAllPagesForPdf(pdfFile)}
                                                        className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                                        title="Download semua halaman"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => toggleExpanded(pdfFile.id)}
                                                        className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                                    >
                                                        {expandedPdf === pdfFile.id ? (
                                                            <ChevronUp className="w-4 h-4" />
                                                        ) : (
                                                            <ChevronDown className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => removePdfFile(pdfFile.id)}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Pages Preview */}
                                    {expandedPdf === pdfFile.id && pdfFile.pages.length > 0 && (
                                        <div className="border-t border-green-200 p-3 bg-white">
                                            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                                                {pdfFile.pages.map((page) => (
                                                    <div key={page.pageNumber} className="relative group">
                                                        <img
                                                            src={page.dataUrl}
                                                            alt={`Page ${page.pageNumber}`}
                                                            className="w-full h-auto rounded border border-gray-200"
                                                        />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                                                            <button
                                                                onClick={() => downloadSinglePage(pdfFile.name, page)}
                                                                className="p-2 bg-white rounded-lg text-gray-700 hover:bg-gray-100"
                                                            >
                                                                <Download className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                                                            {page.pageNumber}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        {completedCount > 0 && (
                            <span className="flex items-center gap-1">
                                <Check className="w-4 h-4 text-green-500" />
                                {completedCount} file selesai, {totalPages} halaman total
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {completedCount > 0 && (
                            <button
                                onClick={downloadAllAsZip}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                Download Semua (ZIP)
                            </button>
                        )}
                        {pendingCount > 0 && (
                            <button
                                onClick={handleConvertAll}
                                disabled={isConverting}
                                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isConverting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Mengkonversi...
                                    </>
                                ) : (
                                    <>
                                        <FileImage className="w-4 h-4" />
                                        Konversi ({pendingCount})
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
