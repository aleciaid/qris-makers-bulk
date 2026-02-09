import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Save, RotateCcw, Move, Square, Plus, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { OCRRegion, DEFAULT_OCR_SETTINGS } from '../utils/ocrExtractor';

// Multi-sample calibration - each sample has its own image and regions
export interface SampleCalibration {
    image: string | null;
    subtitleRegion: OCRRegion;
    footerCodeRegion: OCRRegion;
}

interface RegionCalibrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    subtitleRegion: OCRRegion;
    footerCodeRegion: OCRRegion;
    initialImage: string | null;  // Sample 1 image
    sample2Image: string | null;  // Sample 2 image
    sample2SubtitleRegion: OCRRegion;
    sample2FooterCodeRegion: OCRRegion;
    onSave: (
        subtitle: OCRRegion,
        footer: OCRRegion,
        image: string | null,
        sample2Subtitle: OCRRegion,
        sample2Footer: OCRRegion,
        sample2Image: string | null
    ) => void;
}

type RegionType = 'subtitle' | 'footerCode';
type SampleType = 1 | 2;

interface DragState {
    isDragging: boolean;
    isResizing: boolean;
    region: RegionType | null;
    startX: number;
    startY: number;
    startRegion: OCRRegion | null;
}

const REGION_COLORS = {
    subtitle: { bg: 'rgba(239, 68, 68, 0.3)', border: '#EF4444', label: 'Subtitle (Merah)' },
    footerCode: { bg: 'rgba(59, 130, 246, 0.3)', border: '#3B82F6', label: 'Footer Code (Biru)' }
};

export const RegionCalibrationModal: React.FC<RegionCalibrationModalProps> = ({
    isOpen,
    onClose,
    subtitleRegion: initialSubtitle,
    footerCodeRegion: initialFooter,
    initialImage,
    sample2Image: initialSample2Image,
    sample2SubtitleRegion: initialSample2Subtitle,
    sample2FooterCodeRegion: initialSample2Footer,
    onSave
}) => {
    // Current active sample tab
    const [activeSample, setActiveSample] = useState<SampleType>(1);

    // Sample 1 state
    const [imageUrl1, setImageUrl1] = useState<string | null>(null);
    const [imageDimensions1, setImageDimensions1] = useState({ width: 0, height: 0 });
    const [subtitleRegion1, setSubtitleRegion1] = useState<OCRRegion>(initialSubtitle);
    const [footerCodeRegion1, setFooterCodeRegion1] = useState<OCRRegion>(initialFooter);

    // Sample 2 state
    const [imageUrl2, setImageUrl2] = useState<string | null>(null);
    const [imageDimensions2, setImageDimensions2] = useState({ width: 0, height: 0 });
    const [subtitleRegion2, setSubtitleRegion2] = useState<OCRRegion>(initialSample2Subtitle);
    const [footerCodeRegion2, setFooterCodeRegion2] = useState<OCRRegion>(initialSample2Footer);

    const [activeRegion, setActiveRegion] = useState<RegionType>('subtitle');
    const [isDrawMode, setIsDrawMode] = useState(false);

    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        isResizing: false,
        region: null,
        startX: 0,
        startY: 0,
        startRegion: null
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get current sample's values
    const getCurrentImageUrl = () => activeSample === 1 ? imageUrl1 : imageUrl2;
    const getCurrentDimensions = () => activeSample === 1 ? imageDimensions1 : imageDimensions2;
    const getCurrentSubtitleRegion = () => activeSample === 1 ? subtitleRegion1 : subtitleRegion2;
    const getCurrentFooterCodeRegion = () => activeSample === 1 ? footerCodeRegion1 : footerCodeRegion2;

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            // Sample 1
            setSubtitleRegion1(initialSubtitle);
            setFooterCodeRegion1(initialFooter);
            if (initialImage) {
                setImageUrl1(initialImage);
                const img = new Image();
                img.onload = () => {
                    setImageDimensions1({ width: img.width, height: img.height });
                };
                img.src = initialImage;
            } else {
                setImageUrl1(null);
            }

            // Sample 2
            setSubtitleRegion2(initialSample2Subtitle);
            setFooterCodeRegion2(initialSample2Footer);
            if (initialSample2Image) {
                setImageUrl2(initialSample2Image);
                const img = new Image();
                img.onload = () => {
                    setImageDimensions2({ width: img.width, height: img.height });
                };
                img.src = initialSample2Image;
            } else {
                setImageUrl2(null);
            }
        }
    }, [isOpen, initialSubtitle, initialFooter, initialImage, initialSample2Subtitle, initialSample2Footer, initialSample2Image]);

    const getRegion = useCallback((type: RegionType): OCRRegion => {
        if (activeSample === 1) {
            switch (type) {
                case 'subtitle': return subtitleRegion1;
                case 'footerCode': return footerCodeRegion1;
            }
        } else {
            switch (type) {
                case 'subtitle': return subtitleRegion2;
                case 'footerCode': return footerCodeRegion2;
            }
        }
    }, [activeSample, subtitleRegion1, footerCodeRegion1, subtitleRegion2, footerCodeRegion2]);

    const setRegion = useCallback((type: RegionType, region: OCRRegion) => {
        if (activeSample === 1) {
            switch (type) {
                case 'subtitle': setSubtitleRegion1(region); break;
                case 'footerCode': setFooterCodeRegion1(region); break;
            }
        } else {
            switch (type) {
                case 'subtitle': setSubtitleRegion2(region); break;
                case 'footerCode': setFooterCodeRegion2(region); break;
            }
        }
    }, [activeSample]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                if (activeSample === 1) {
                    setImageDimensions1({ width: img.width, height: img.height });
                    setImageUrl1(event.target?.result as string);
                } else {
                    setImageDimensions2({ width: img.width, height: img.height });
                    setImageUrl2(event.target?.result as string);
                }
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const getMousePosition = (e: React.MouseEvent): { x: number; y: number } => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!getCurrentImageUrl()) return;
        e.preventDefault();

        const pos = getMousePosition(e);

        if (isDrawMode) {
            // Start drawing new region
            setDragState({
                isDragging: false,
                isResizing: true,
                region: activeRegion,
                startX: pos.x,
                startY: pos.y,
                startRegion: { x: pos.x, y: pos.y, width: 0, height: 0 }
            });
            setRegion(activeRegion, { x: pos.x, y: pos.y, width: 0, height: 0 });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragState.isResizing && !dragState.isDragging) return;
        if (!dragState.region || !dragState.startRegion) return;

        const pos = getMousePosition(e);

        if (dragState.isResizing && isDrawMode) {
            // Drawing mode - resize from start point
            const minX = Math.min(dragState.startX, pos.x);
            const minY = Math.min(dragState.startY, pos.y);
            const maxX = Math.max(dragState.startX, pos.x);
            const maxY = Math.max(dragState.startY, pos.y);

            setRegion(dragState.region, {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            });
        } else if (dragState.isDragging) {
            // Move mode
            const deltaX = pos.x - dragState.startX;
            const deltaY = pos.y - dragState.startY;

            const newX = Math.max(0, Math.min(100 - dragState.startRegion.width, dragState.startRegion.x + deltaX));
            const newY = Math.max(0, Math.min(100 - dragState.startRegion.height, dragState.startRegion.y + deltaY));

            setRegion(dragState.region, {
                ...dragState.startRegion,
                x: newX,
                y: newY
            });
        }
    };

    const handleMouseUp = () => {
        setDragState({
            isDragging: false,
            isResizing: false,
            region: null,
            startX: 0,
            startY: 0,
            startRegion: null
        });
    };

    const handleRegionMouseDown = (e: React.MouseEvent, type: RegionType) => {
        if (isDrawMode) return;
        e.preventDefault();
        e.stopPropagation();

        const pos = getMousePosition(e);
        setActiveRegion(type);

        setDragState({
            isDragging: true,
            isResizing: false,
            region: type,
            startX: pos.x,
            startY: pos.y,
            startRegion: { ...getRegion(type) }
        });
    };

    const handleResizeMouseDown = (e: React.MouseEvent, type: RegionType) => {
        if (isDrawMode) return;
        e.preventDefault();
        e.stopPropagation();

        const region = getRegion(type);
        setActiveRegion(type);

        setDragState({
            isDragging: false,
            isResizing: true,
            region: type,
            startX: region.x,
            startY: region.y,
            startRegion: { ...region }
        });
    };

    const handleReset = () => {
        if (activeSample === 1) {
            setSubtitleRegion1(DEFAULT_OCR_SETTINGS.subtitleRegion);
            setFooterCodeRegion1(DEFAULT_OCR_SETTINGS.footerCodeRegion);
        } else {
            setSubtitleRegion2(DEFAULT_OCR_SETTINGS.subtitleRegion);
            setFooterCodeRegion2(DEFAULT_OCR_SETTINGS.footerCodeRegion);
        }
    };

    const handleRemoveImage = () => {
        if (activeSample === 1) {
            setImageUrl1(null);
            setImageDimensions1({ width: 0, height: 0 });
        } else {
            setImageUrl2(null);
            setImageDimensions2({ width: 0, height: 0 });
        }
    };

    const handleSave = () => {
        onSave(
            subtitleRegion1,
            footerCodeRegion1,
            imageUrl1,
            subtitleRegion2,
            footerCodeRegion2,
            imageUrl2
        );
        onClose();
    };

    const copySample1ToSample2 = () => {
        setSubtitleRegion2({ ...subtitleRegion1 });
        setFooterCodeRegion2({ ...footerCodeRegion1 });
    };

    const renderRegionBox = (type: RegionType, region: OCRRegion) => {
        const colors = REGION_COLORS[type];
        const isActive = activeRegion === type;

        return (
            <div
                key={type}
                className={`absolute cursor-move transition-shadow ${isActive ? 'z-20' : 'z-10'}`}
                style={{
                    left: `${region.x}%`,
                    top: `${region.y}%`,
                    width: `${region.width}%`,
                    height: `${region.height}%`,
                    backgroundColor: colors.bg,
                    border: `2px ${isActive ? 'solid' : 'dashed'} ${colors.border}`,
                    boxShadow: isActive ? `0 0 0 2px white, 0 0 0 4px ${colors.border}` : 'none'
                }}
                onMouseDown={(e) => handleRegionMouseDown(e, type)}
            >
                {/* Label */}
                <div
                    className="absolute -top-6 left-0 px-1 py-0.5 text-[10px] font-bold text-white whitespace-nowrap rounded"
                    style={{ backgroundColor: colors.border }}
                >
                    {colors.label}
                </div>

                {/* Resize handle */}
                <div
                    className="absolute -bottom-1 -right-1 w-4 h-4 cursor-se-resize rounded-sm"
                    style={{ backgroundColor: colors.border }}
                    onMouseDown={(e) => handleResizeMouseDown(e, type)}
                />
            </div>
        );
    };

    if (!isOpen) return null;

    const currentImageUrl = getCurrentImageUrl();
    const currentDimensions = getCurrentDimensions();
    const currentSubtitleRegion = getCurrentSubtitleRegion();
    const currentFooterCodeRegion = getCurrentFooterCodeRegion();

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-indigo-600">
                    <div>
                        <h2 className="text-xl font-bold text-white">🎯 Kalibrasi Area OCR - Multi Sample</h2>
                        <p className="text-purple-200 text-sm">Atur 2 sample gambar untuk fallback otomatis</p>
                    </div>
                    <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Sample Tabs */}
                <div className="flex bg-gray-100 border-b">
                    <button
                        onClick={() => setActiveSample(1)}
                        className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 font-medium transition-colors ${activeSample === 1
                                ? 'bg-white text-purple-600 border-b-2 border-purple-600'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <ImageIcon className="w-4 h-4" />
                        Sample 1 (Utama)
                        {imageUrl1 && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
                    </button>
                    <button
                        onClick={() => setActiveSample(2)}
                        className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 font-medium transition-colors ${activeSample === 2
                                ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Plus className="w-4 h-4" />
                        Sample 2 (Fallback)
                        {imageUrl2 && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    {/* Fallback info */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-700">
                            <strong>Multi Sample Fallback:</strong> Jika Subtitle atau Footer tidak terdeteksi dari Sample 1,
                            sistem akan otomatis mencoba Sample 2. Jika keduanya gagal, akan muncul peringatan.
                        </div>
                    </div>

                    {!currentImageUrl ? (
                        /* Upload Area */
                        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                                accept="image/*"
                                className="hidden"
                            />
                            <div className="text-center">
                                <div className={`${activeSample === 1 ? 'bg-purple-100' : 'bg-indigo-100'} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4`}>
                                    <Square className={`w-8 h-8 ${activeSample === 1 ? 'text-purple-600' : 'text-indigo-600'}`} />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                                    Upload Gambar QRIS - Sample {activeSample}
                                </h3>
                                <p className="text-gray-500 text-sm mb-4">
                                    {activeSample === 1
                                        ? 'Sample utama untuk deteksi OCR'
                                        : 'Sample cadangan jika sample 1 gagal mendeteksi'}
                                </p>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`px-6 py-2 text-white rounded-lg transition-colors ${activeSample === 1
                                            ? 'bg-purple-600 hover:bg-purple-700'
                                            : 'bg-indigo-600 hover:bg-indigo-700'
                                        }`}
                                >
                                    Pilih Gambar
                                </button>
                                {activeSample === 2 && imageUrl1 && (
                                    <button
                                        onClick={copySample1ToSample2}
                                        className="block mx-auto mt-3 text-sm text-indigo-600 hover:text-indigo-800"
                                    >
                                        📋 Salin region dari Sample 1
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Toolbar */}
                            <div className="flex items-center justify-between bg-gray-100 rounded-lg p-3">
                                <div className="flex items-center gap-4">
                                    {/* Mode Toggle */}
                                    <div className="flex bg-white rounded-lg p-1 shadow-sm">
                                        <button
                                            onClick={() => setIsDrawMode(false)}
                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!isDrawMode ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                                                }`}
                                        >
                                            <Move className="w-4 h-4" />
                                            Pindah
                                        </button>
                                        <button
                                            onClick={() => setIsDrawMode(true)}
                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isDrawMode ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                                                }`}
                                        >
                                            <Square className="w-4 h-4" />
                                            Gambar
                                        </button>
                                    </div>

                                    {/* Active Region Selector */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">Area aktif:</span>
                                        <div className="flex bg-white rounded-lg p-1 shadow-sm">
                                            {(['subtitle', 'footerCode'] as RegionType[]).map((type) => (
                                                <button
                                                    key={type}
                                                    onClick={() => setActiveRegion(type)}
                                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeRegion === type
                                                        ? 'text-white'
                                                        : 'text-gray-600 hover:bg-gray-100'
                                                        }`}
                                                    style={{
                                                        backgroundColor: activeRegion === type ? REGION_COLORS[type].border : 'transparent'
                                                    }}
                                                >
                                                    {type === 'subtitle' ? 'Subtitle' : 'Footer'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="text-sm text-purple-600 hover:text-purple-800"
                                    >
                                        Ganti Gambar
                                    </button>
                                    <button
                                        onClick={handleRemoveImage}
                                        className="text-sm text-red-500 hover:text-red-700"
                                    >
                                        ✕ Hapus
                                    </button>
                                </div>
                            </div>

                            {/* Image Container */}
                            <div
                                ref={containerRef}
                                className="relative bg-gray-200 rounded-lg overflow-hidden select-none"
                                style={{
                                    aspectRatio: currentDimensions.width && currentDimensions.height
                                        ? `${currentDimensions.width}/${currentDimensions.height}`
                                        : '3/4',
                                    maxHeight: '400px',
                                    cursor: isDrawMode ? 'crosshair' : 'default'
                                }}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                            >
                                <img
                                    src={currentImageUrl}
                                    alt="Calibration"
                                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                    draggable={false}
                                />

                                {/* Region Boxes */}
                                {renderRegionBox('subtitle', currentSubtitleRegion)}
                                {renderRegionBox('footerCode', currentFooterCodeRegion)}
                            </div>

                            {/* Instructions */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-sm text-blue-800">
                                    <strong>Cara Penggunaan:</strong><br />
                                    • <strong>Mode Pindah:</strong> Klik dan geser kotak untuk memindahkan, atau geser sudut kanan bawah untuk mengubah ukuran<br />
                                    • <strong>Mode Gambar:</strong> Klik dan geser di gambar untuk menggambar area baru untuk region yang aktif
                                </p>
                            </div>

                            {/* Coordinates Display */}
                            <div className="grid grid-cols-2 gap-3">
                                {(['subtitle', 'footerCode'] as RegionType[]).map((type) => {
                                    const region = getRegion(type);
                                    const colors = REGION_COLORS[type];
                                    return (
                                        <div
                                            key={type}
                                            className="bg-gray-50 rounded-lg p-3 border"
                                            style={{ borderColor: colors.border }}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <span
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: colors.border }}
                                                />
                                                <span className="text-xs font-bold text-gray-700 uppercase">{colors.label}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                                                <span>X: {region.x.toFixed(1)}%</span>
                                                <span>Y: {region.y.toFixed(1)}%</span>
                                                <span>W: {region.width.toFixed(1)}%</span>
                                                <span>H: {region.height.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Copy from Sample 1 button (only for Sample 2) */}
                            {activeSample === 2 && imageUrl1 && (
                                <button
                                    onClick={copySample1ToSample2}
                                    className="w-full py-2 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors"
                                >
                                    📋 Salin Region dari Sample 1
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Reset Sample {activeSample}
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                            <Save className="w-4 h-4" />
                            Simpan Semua
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
