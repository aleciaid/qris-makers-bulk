import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Save, RotateCcw, Move, Square } from 'lucide-react';
import { OCRRegion, DEFAULT_OCR_SETTINGS } from '../utils/ocrExtractor';

interface RegionCalibrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    subtitleRegion: OCRRegion;
    footerCodeRegion: OCRRegion;
    initialImage: string | null;  // Previously saved calibration image
    onSave: (subtitle: OCRRegion, footer: OCRRegion, image: string | null) => void;
}

type RegionType = 'subtitle' | 'footerCode';

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
    onSave
}) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
    const [activeRegion, setActiveRegion] = useState<RegionType>('subtitle');
    const [isDrawMode, setIsDrawMode] = useState(false);

    const [subtitleRegion, setSubtitleRegion] = useState<OCRRegion>(initialSubtitle);
    const [footerCodeRegion, setFooterCodeRegion] = useState<OCRRegion>(initialFooter);

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

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setSubtitleRegion(initialSubtitle);
            setFooterCodeRegion(initialFooter);
            // Load previously saved calibration image if exists
            if (initialImage) {
                setImageUrl(initialImage);
                // Get dimensions of saved image
                const img = new Image();
                img.onload = () => {
                    setImageDimensions({ width: img.width, height: img.height });
                };
                img.src = initialImage;
            }
        }
    }, [isOpen, initialSubtitle, initialFooter, initialImage]);

    const getRegion = useCallback((type: RegionType): OCRRegion => {
        switch (type) {
            case 'subtitle': return subtitleRegion;
            case 'footerCode': return footerCodeRegion;
        }
    }, [subtitleRegion, footerCodeRegion]);

    const setRegion = useCallback((type: RegionType, region: OCRRegion) => {
        switch (type) {
            case 'subtitle': setSubtitleRegion(region); break;
            case 'footerCode': setFooterCodeRegion(region); break;
        }
    }, []);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                setImageDimensions({ width: img.width, height: img.height });
                setImageUrl(event.target?.result as string);
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
        if (!imageUrl) return;
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
        setSubtitleRegion(DEFAULT_OCR_SETTINGS.subtitleRegion);
        setFooterCodeRegion(DEFAULT_OCR_SETTINGS.footerCodeRegion);
    };

    const handleSave = () => {
        onSave(subtitleRegion, footerCodeRegion, imageUrl);
        onClose();
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

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-indigo-600">
                    <div>
                        <h2 className="text-xl font-bold text-white">🎯 Kalibrasi Area OCR</h2>
                        <p className="text-purple-200 text-sm">Gambar dan atur area deteksi langsung di gambar</p>
                    </div>
                    <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    {!imageUrl ? (
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
                                <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Square className="w-8 h-8 text-purple-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">Upload Gambar QRIS Contoh</h3>
                                <p className="text-gray-500 text-sm mb-4">Upload gambar untuk mengatur area deteksi OCR</p>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                                >
                                    Pilih Gambar
                                </button>
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

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-sm text-purple-600 hover:text-purple-800"
                                >
                                    Ganti Gambar
                                </button>
                            </div>

                            {/* Image Container */}
                            <div
                                ref={containerRef}
                                className="relative bg-gray-200 rounded-lg overflow-hidden select-none"
                                style={{
                                    aspectRatio: imageDimensions.width && imageDimensions.height
                                        ? `${imageDimensions.width}/${imageDimensions.height}`
                                        : '3/4',
                                    maxHeight: '500px',
                                    cursor: isDrawMode ? 'crosshair' : 'default'
                                }}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                            >
                                <img
                                    src={imageUrl}
                                    alt="Calibration"
                                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                                    draggable={false}
                                />

                                {/* Region Boxes */}
                                {renderRegionBox('subtitle', subtitleRegion)}
                                {renderRegionBox('footerCode', footerCodeRegion)}
                            </div>

                            {/* Instructions */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-sm text-blue-800">
                                    <strong>Cara Penggunaan:</strong><br />
                                    • <strong>Mode Pindah:</strong> Klik dan geser kotak untuk memindahkan, atau geser sudut kanan bawah untuk mengubah ukuran<br />
                                    • <strong>Mode Gambar:</strong> Klik dan geser di gambar untuk menggambar area baru untuk region yang aktif
                                </p>
                            </div>

                            {/* Info about Nominal */}
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <p className="text-sm text-green-800">
                                    <strong>ℹ️ Catatan:</strong> Nominal diambil langsung dari data QRIS code (tag 54), bukan dari OCR gambar.
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
                        Reset ke Default
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
                            Simpan
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
