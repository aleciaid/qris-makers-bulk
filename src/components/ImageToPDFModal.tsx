import React, { useState, useRef, useCallback } from 'react';
import { X, ImagePlus, Download, Trash2, Loader2, ArrowUp, ArrowDown, FileText, GripVertical } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface ImageFile {
    id: string;
    file: File;
    name: string;
    dataUrl: string;
    width: number;
    height: number;
}

interface ImageToPDFModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type PageSize = 'a4' | 'a3' | 'letter' | 'legal';
type Orientation = 'portrait' | 'landscape';
type ImageFit = 'fit' | 'fill' | 'stretch';

const PAGE_SIZES: Record<PageSize, { label: string; width: number; height: number }> = {
    a4: { label: 'A4 (210 × 297 mm)', width: 210, height: 297 },
    a3: { label: 'A3 (297 × 420 mm)', width: 297, height: 420 },
    letter: { label: 'Letter (216 × 279 mm)', width: 215.9, height: 279.4 },
    legal: { label: 'Legal (216 × 356 mm)', width: 215.9, height: 355.6 },
};

export const ImageToPDFModal: React.FC<ImageToPDFModalProps> = ({ isOpen, onClose }) => {
    const [images, setImages] = useState<ImageFile[]>([]);
    const [pageSize, setPageSize] = useState<PageSize>('a4');
    const [orientation, setOrientation] = useState<Orientation>('portrait');
    const [margin, setMargin] = useState(10); // mm
    const [imageFit, setImageFit] = useState<ImageFit>('fit');
    const [quality, setQuality] = useState(0.92);
    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfFileName, setPdfFileName] = useState('converted');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadImage = (file: File): Promise<ImageFile> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    resolve({
                        id: crypto.randomUUID(),
                        file,
                        name: file.name,
                        dataUrl: e.target?.result as string,
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                    });
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target?.result as string;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newImages: ImageFile[] = [];
        for (const file of Array.from(files)) {
            if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) continue;
            try {
                const imageFile = await loadImage(file);
                newImages.push(imageFile);
            } catch (err) {
                console.error(`Failed to load ${file.name}:`, err);
            }
        }

        setImages(prev => [...prev, ...newImages]);
        e.target.value = '';
    };

    const removeImage = (id: string) => {
        setImages(prev => prev.filter(img => img.id !== id));
    };

    const moveImage = (index: number, direction: 'up' | 'down') => {
        setImages(prev => {
            const newArr = [...prev];
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= newArr.length) return prev;
            [newArr[index], newArr[newIndex]] = [newArr[newIndex], newArr[index]];
            return newArr;
        });
    };

    const clearAll = () => {
        setImages([]);
    };

    const generatePDF = useCallback(async () => {
        if (images.length === 0) return;
        setIsGenerating(true);

        try {
            const pageDef = PAGE_SIZES[pageSize];
            const pageW = orientation === 'portrait' ? pageDef.width : pageDef.height;
            const pageH = orientation === 'portrait' ? pageDef.height : pageDef.width;

            const pdf = new jsPDF({
                orientation,
                unit: 'mm',
                format: [pageW, pageH],
            });

            for (let i = 0; i < images.length; i++) {
                if (i > 0) pdf.addPage();

                const img = images[i];
                const availW = pageW - margin * 2;
                const availH = pageH - margin * 2;

                let drawW: number, drawH: number, drawX: number, drawY: number;

                if (imageFit === 'stretch') {
                    drawW = availW;
                    drawH = availH;
                    drawX = margin;
                    drawY = margin;
                } else if (imageFit === 'fill') {
                    const imgRatio = img.width / img.height;
                    const pageRatio = availW / availH;
                    if (imgRatio > pageRatio) {
                        drawH = availH;
                        drawW = drawH * imgRatio;
                    } else {
                        drawW = availW;
                        drawH = drawW / imgRatio;
                    }
                    drawX = margin + (availW - drawW) / 2;
                    drawY = margin + (availH - drawH) / 2;
                } else {
                    // fit
                    const imgRatio = img.width / img.height;
                    const pageRatio = availW / availH;
                    if (imgRatio > pageRatio) {
                        drawW = availW;
                        drawH = drawW / imgRatio;
                    } else {
                        drawH = availH;
                        drawW = drawH * imgRatio;
                    }
                    drawX = margin + (availW - drawW) / 2;
                    drawY = margin + (availH - drawH) / 2;
                }

                // Determine format from file type
                const format = img.file.type === 'image/png' ? 'PNG' : 'JPEG';

                // Compress image via canvas for JPEG
                let imgData = img.dataUrl;
                if (format === 'JPEG' && quality < 1) {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        const tempImg = new Image();
                        await new Promise<void>((resolve) => {
                            tempImg.onload = () => {
                                ctx.drawImage(tempImg, 0, 0);
                                imgData = canvas.toDataURL('image/jpeg', quality);
                                resolve();
                            };
                            tempImg.src = img.dataUrl;
                        });
                    }
                }

                pdf.addImage(imgData, format, drawX, drawY, drawW, drawH);
            }

            pdf.save(`${pdfFileName || 'converted'}.pdf`);
        } catch (err) {
            console.error('PDF generation failed:', err);
            alert('Gagal membuat PDF. Silakan coba lagi.');
        }

        setIsGenerating(false);
    }, [images, pageSize, orientation, margin, imageFit, quality, pdfFileName]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 no-print">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-emerald-500 to-teal-500">
                    <div className="flex items-center gap-3">
                        <ImagePlus className="w-6 h-6 text-white" />
                        <div>
                            <h3 className="font-bold text-white">Image to PDF Converter</h3>
                            <p className="text-emerald-100 text-sm">Konversi JPG/PNG/JPEG ke PDF</p>
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
                        <h4 className="text-sm font-bold text-gray-700 uppercase mb-3">⚙️ Pengaturan PDF</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Page Size */}
                            <div>
                                <label className="text-xs font-semibold text-gray-600 mb-1 block">Ukuran Halaman</label>
                                <select
                                    value={pageSize}
                                    onChange={(e) => setPageSize(e.target.value as PageSize)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                >
                                    {Object.entries(PAGE_SIZES).map(([key, val]) => (
                                        <option key={key} value={key}>{val.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Orientation */}
                            <div>
                                <label className="text-xs font-semibold text-gray-600 mb-1 block">Orientasi</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setOrientation('portrait')}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${orientation === 'portrait'
                                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                                            : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                                            }`}
                                    >
                                        📄 Portrait
                                    </button>
                                    <button
                                        onClick={() => setOrientation('landscape')}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${orientation === 'landscape'
                                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                                            : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                                            }`}
                                    >
                                        🖼️ Landscape
                                    </button>
                                </div>
                            </div>

                            {/* Image Fit */}
                            <div>
                                <label className="text-xs font-semibold text-gray-600 mb-1 block">Mode Gambar</label>
                                <select
                                    value={imageFit}
                                    onChange={(e) => setImageFit(e.target.value as ImageFit)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                >
                                    <option value="fit">Fit (Pas dalam halaman)</option>
                                    <option value="fill">Fill (Isi halaman penuh)</option>
                                    <option value="stretch">Stretch (Rentangkan)</option>
                                </select>
                            </div>

                            {/* Margin */}
                            <div>
                                <label className="text-xs font-semibold text-gray-600 mb-1 block">Margin (mm)</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min="0"
                                        max="30"
                                        step="1"
                                        value={margin}
                                        onChange={(e) => setMargin(Number(e.target.value))}
                                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                    <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded min-w-[50px] text-center">
                                        {margin}mm
                                    </span>
                                </div>
                            </div>

                            {/* Quality */}
                            <div>
                                <label className="text-xs font-semibold text-gray-600 mb-1 block">Kualitas JPEG</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min="0.3"
                                        max="1"
                                        step="0.01"
                                        value={quality}
                                        onChange={(e) => setQuality(Number(e.target.value))}
                                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                    <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded min-w-[50px] text-center">
                                        {Math.round(quality * 100)}%
                                    </span>
                                </div>
                            </div>

                            {/* File Name */}
                            <div>
                                <label className="text-xs font-semibold text-gray-600 mb-1 block">Nama File</label>
                                <div className="flex items-center">
                                    <input
                                        type="text"
                                        value={pdfFileName}
                                        onChange={(e) => setPdfFileName(e.target.value)}
                                        placeholder="nama file"
                                        className="flex-1 border border-gray-300 rounded-l-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                    <span className="bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg px-3 py-2 text-sm text-gray-500">.pdf</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Upload Area */}
                    <div className="border-2 border-dashed border-emerald-300 bg-emerald-50 rounded-xl p-6">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                            multiple
                            className="hidden"
                        />
                        <div className="text-center">
                            <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                                <ImagePlus className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Upload Gambar</h3>
                            <p className="text-gray-500 text-sm mb-4">Pilih file JPG, JPEG, atau PNG (bisa multiple)</p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium"
                            >
                                🖼️ Pilih Gambar
                            </button>
                        </div>
                    </div>

                    {/* Image List */}
                    {images.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-gray-700">
                                    🖼️ Daftar Gambar ({images.length} file)
                                </h4>
                                <button
                                    onClick={clearAll}
                                    className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                >
                                    Hapus Semua
                                </button>
                            </div>

                            <div className="space-y-2">
                                {images.map((img, index) => (
                                    <div
                                        key={img.id}
                                        className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-emerald-300 transition-all group"
                                    >
                                        {/* Drag indicator */}
                                        <div className="text-gray-300 flex-shrink-0">
                                            <GripVertical className="w-4 h-4" />
                                        </div>

                                        {/* Page number */}
                                        <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <span className="text-sm font-bold text-emerald-700">{index + 1}</span>
                                        </div>

                                        {/* Thumbnail */}
                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                                            <img
                                                src={img.dataUrl}
                                                alt={img.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-800 text-sm truncate">{img.name}</p>
                                            <p className="text-xs text-gray-500">{img.width} × {img.height}px • {(img.file.size / 1024).toFixed(1)} KB</p>
                                        </div>

                                        {/* Move buttons */}
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => moveImage(index, 'up')}
                                                disabled={index === 0}
                                                className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <ArrowUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => moveImage(index, 'down')}
                                                disabled={index === images.length - 1}
                                                className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <ArrowDown className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Remove */}
                                        <button
                                            onClick={() => removeImage(img.id)}
                                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                        {images.length > 0 && (
                            <span className="flex items-center gap-1">
                                <FileText className="w-4 h-4 text-emerald-500" />
                                {images.length} gambar → {images.length} halaman PDF
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {images.length > 0 && (
                            <button
                                onClick={generatePDF}
                                disabled={isGenerating}
                                className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Membuat PDF...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4" />
                                        Download PDF
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
