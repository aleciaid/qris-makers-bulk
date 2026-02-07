import React, { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';
import { Printer, Trash2, Settings, Image as ImageIcon, X, Edit2, Upload, CheckCircle, XCircle, Loader2, Crosshair } from 'lucide-react';
import { QRCard } from './components/QRCard';
import { RegionCalibrationModal } from './components/RegionCalibrationModal';
import { parseQRIS } from './utils/qrisParser';
import { extractQRISFields, OCRSettings, DEFAULT_OCR_SETTINGS, OCRRegion } from './utils/ocrExtractor';

interface QRData {
  id: string;
  title: string;
  subtitle: string;
  nmid: string;
  qrContent: string;
  footerCode: string;
  nominal: string;
}

interface BulkEntry extends QRData {
  fileName: string;
  status: 'success' | 'failed';
  errorMessage?: string;
}

const INITIAL_ENTRY: Partial<QRData> = {
  title: '',
  subtitle: '',
  nmid: '',
  qrContent: '',
  footerCode: '',
  nominal: 'Rp. '
};

function App() {
  const [data, setData] = useState<QRData[]>([]);
  const [view, setView] = useState<'editor' | 'preview'>('editor');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<Partial<QRData>>(INITIAL_ENTRY);
  const [isEditing, setIsEditing] = useState(false);

  // Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Bulk Upload State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkEntries, setBulkEntries] = useState<BulkEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);

  // Settings with localStorage support
  const [defaultSubtitle, setDefaultSubtitle] = useState('');
  const [defaultFooterCode, setDefaultFooterCode] = useState('');
  const [cardWidth, setCardWidth] = useState(12); // in cm
  const [cardHeight, setCardHeight] = useState(9.5); // in cm
  const [qrScale, setQrScale] = useState(1); // 0.6 - 1.4, default 1
  const [fontSize, setFontSize] = useState(14); // 10 - 20px, default 14px
  const [gapSize, setGapSize] = useState(5); // gap in mm between cards

  // Position offsets (in px)
  const [headerOffset, setHeaderOffset] = useState(0); // positive = down, negative = up
  const [footerOffset, setFooterOffset] = useState(0); // positive = up, negative = down

  // Color settings
  const [titleColor, setTitleColor] = useState('#000000'); // black
  const [subtitleColor, setSubtitleColor] = useState('#333333'); // dark gray
  const [nmidColor, setNmidColor] = useState('#0066cc'); // blue
  const [footerCodeColor, setFooterCodeColor] = useState('#0066cc'); // blue
  const [nominalColor, setNominalColor] = useState('#000000'); // black

  // OCR Auto-detect settings (Nominal is taken from QRIS code, not OCR)
  const [enableAutoDetect, setEnableAutoDetect] = useState(true);
  const [subtitleRegion, setSubtitleRegion] = useState<OCRRegion>(DEFAULT_OCR_SETTINGS.subtitleRegion);
  const [footerCodeRegion, setFooterCodeRegion] = useState<OCRRegion>(DEFAULT_OCR_SETTINGS.footerCodeRegion);
  const [calibrationImage, setCalibrationImage] = useState<string | null>(null); // Base64 image for calibration preview
  const [isOCRProcessing, setIsOCRProcessing] = useState(false);
  const [isCalibrationModalOpen, setIsCalibrationModalOpen] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('qris-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.defaultSubtitle !== undefined) setDefaultSubtitle(settings.defaultSubtitle);
        if (settings.defaultFooterCode !== undefined) setDefaultFooterCode(settings.defaultFooterCode);
        if (settings.cardWidth !== undefined) setCardWidth(settings.cardWidth);
        if (settings.cardHeight !== undefined) setCardHeight(settings.cardHeight);
        if (settings.qrScale !== undefined) setQrScale(settings.qrScale);
        if (settings.fontSize !== undefined) setFontSize(settings.fontSize);
        if (settings.gapSize !== undefined) setGapSize(settings.gapSize);
        if (settings.headerOffset !== undefined) setHeaderOffset(settings.headerOffset);
        if (settings.footerOffset !== undefined) setFooterOffset(settings.footerOffset);
        if (settings.titleColor !== undefined) setTitleColor(settings.titleColor);
        if (settings.subtitleColor !== undefined) setSubtitleColor(settings.subtitleColor);
        if (settings.nmidColor !== undefined) setNmidColor(settings.nmidColor);
        if (settings.footerCodeColor !== undefined) setFooterCodeColor(settings.footerCodeColor);
        if (settings.nominalColor !== undefined) setNominalColor(settings.nominalColor);

        // OCR settings - check version for backwards compatibility
        // v2+: Has region settings; v3+: Has calibration image
        if (settings.ocrSettingsVersion >= 2) {
          // Load saved OCR regions (compatible with v2 and v3)
          if (settings.enableAutoDetect !== undefined) setEnableAutoDetect(settings.enableAutoDetect);
          if (settings.subtitleRegion !== undefined) setSubtitleRegion(settings.subtitleRegion);
          if (settings.footerCodeRegion !== undefined) setFooterCodeRegion(settings.footerCodeRegion);
          // Load calibration image (v3+)
          if (settings.calibrationImage !== undefined) setCalibrationImage(settings.calibrationImage);
        } else {
          // Version mismatch - use new defaults, but keep enableAutoDetect preference
          console.log('OCR settings version mismatch, resetting to new defaults');
          if (settings.enableAutoDetect !== undefined) setEnableAutoDetect(settings.enableAutoDetect);
          // Keep default regions (already set to new values in state initialization)
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = () => {
    const settings = {
      defaultSubtitle,
      defaultFooterCode,
      cardWidth,
      cardHeight,
      qrScale,
      fontSize,
      gapSize,
      headerOffset,
      footerOffset,
      titleColor,
      subtitleColor,
      nmidColor,
      footerCodeColor,
      nominalColor,
      // OCR settings
      enableAutoDetect,
      subtitleRegion,
      footerCodeRegion,
      calibrationImage,  // Saved calibration image
      ocrSettingsVersion: 3  // Version 3: Added calibration image support
    };
    localStorage.setItem('qris-settings', JSON.stringify(settings));
    alert('Pengaturan berhasil disimpan!');
  };

  // Export settings as JSON file
  const exportSettings = () => {
    const settings = {
      defaultSubtitle,
      defaultFooterCode,
      cardWidth,
      cardHeight,
      qrScale,
      fontSize,
      gapSize,
      headerOffset,
      footerOffset,
      titleColor,
      subtitleColor,
      nmidColor,
      footerCodeColor,
      nominalColor,
      // OCR settings
      enableAutoDetect,
      subtitleRegion,
      footerCodeRegion,
      calibrationImage,  // Include calibration image (base64)
      ocrSettingsVersion: 3,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qris-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import settings from JSON file
  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target?.result as string);
        if (settings.defaultSubtitle !== undefined) setDefaultSubtitle(settings.defaultSubtitle);
        if (settings.defaultFooterCode !== undefined) setDefaultFooterCode(settings.defaultFooterCode);
        if (settings.cardWidth !== undefined) setCardWidth(settings.cardWidth);
        if (settings.cardHeight !== undefined) setCardHeight(settings.cardHeight);
        if (settings.qrScale !== undefined) setQrScale(settings.qrScale);
        if (settings.fontSize !== undefined) setFontSize(settings.fontSize);
        if (settings.gapSize !== undefined) setGapSize(settings.gapSize);
        if (settings.headerOffset !== undefined) setHeaderOffset(settings.headerOffset);
        if (settings.footerOffset !== undefined) setFooterOffset(settings.footerOffset);
        if (settings.titleColor !== undefined) setTitleColor(settings.titleColor);
        if (settings.subtitleColor !== undefined) setSubtitleColor(settings.subtitleColor);
        if (settings.nmidColor !== undefined) setNmidColor(settings.nmidColor);
        if (settings.footerCodeColor !== undefined) setFooterCodeColor(settings.footerCodeColor);
        if (settings.nominalColor !== undefined) setNominalColor(settings.nominalColor);
        // OCR settings
        if (settings.enableAutoDetect !== undefined) setEnableAutoDetect(settings.enableAutoDetect);
        if (settings.subtitleRegion !== undefined) setSubtitleRegion(settings.subtitleRegion);
        if (settings.footerCodeRegion !== undefined) setFooterCodeRegion(settings.footerCodeRegion);
        if (settings.calibrationImage !== undefined) setCalibrationImage(settings.calibrationImage);
        alert('Pengaturan berhasil diimpor!');
      } catch (err) {
        alert('Gagal mengimpor pengaturan. File tidak valid.');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  // Calculate grid layout based on card dimensions and gap
  // A4 Landscape: 297mm x 210mm = 29.7cm x 21cm
  const gapCm = gapSize / 10; // convert mm to cm
  const cols = Math.floor((29.7 + gapCm) / (cardWidth + gapCm));
  const rows = Math.floor((21 + gapCm) / (cardHeight + gapCm));
  const cardsPerPage = cols * rows;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const settingsFileInputRef = useRef<HTMLInputElement>(null);

  // Get current OCR settings
  const getOCRSettings = (): OCRSettings => ({
    enableAutoDetect,
    subtitleRegion,
    footerCodeRegion
  });

  // --- Process Single Image ---
  const processImage = (file: File): Promise<BulkEntry | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) {
            resolve({
              id: Date.now().toString() + Math.random(),
              title: '',
              subtitle: '',
              nmid: '',
              qrContent: '',
              footerCode: '',
              nominal: '',
              fileName: file.name,
              status: 'failed',
              errorMessage: 'Canvas context not available'
            });
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          context.drawImage(img, 0, 0);

          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            const parsed = parseQRIS(code.data);

            // Auto-detect using OCR if enabled
            let detectedSubtitle = defaultSubtitle;
            let detectedFooterCode = defaultFooterCode;
            let detectedNominal = parsed.amount || 'Rp. ';

            if (enableAutoDetect) {
              try {
                const ocrSettings = getOCRSettings();
                const ocrResult = await extractQRISFields(img, ocrSettings);

                // Use OCR results if they're not empty, otherwise fallback to defaults
                // Note: Nominal is always taken from QRIS code, not OCR
                if (ocrResult.subtitle) detectedSubtitle = ocrResult.subtitle;
                if (ocrResult.footerCode) detectedFooterCode = ocrResult.footerCode;
              } catch (err) {
                console.warn('OCR extraction failed, using defaults:', err);
              }
            }

            resolve({
              id: Date.now().toString() + Math.random(),
              title: parsed.merchantName || 'RETRIBUSI PARKIR',
              subtitle: detectedSubtitle,
              nmid: parsed.nmid || '',
              qrContent: code.data,
              footerCode: detectedFooterCode,
              nominal: detectedNominal,
              fileName: file.name,
              status: 'success'
            });
          } else {
            resolve({
              id: Date.now().toString() + Math.random(),
              title: '',
              subtitle: '',
              nmid: '',
              qrContent: '',
              footerCode: '',
              nominal: '',
              fileName: file.name,
              status: 'failed',
              errorMessage: 'QR Code tidak terdeteksi'
            });
          }
        };
        img.onerror = () => {
          resolve({
            id: Date.now().toString() + Math.random(),
            title: '',
            subtitle: '',
            nmid: '',
            qrContent: '',
            footerCode: '',
            nominal: '',
            fileName: file.name,
            status: 'failed',
            errorMessage: 'Gagal memuat gambar'
          });
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        resolve({
          id: Date.now().toString() + Math.random(),
          title: '',
          subtitle: '',
          nmid: '',
          qrContent: '',
          footerCode: '',
          nominal: '',
          fileName: file.name,
          status: 'failed',
          errorMessage: 'Gagal membaca file'
        });
      };
      reader.readAsDataURL(file);
    });
  };

  // --- Bulk Upload Handler ---
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setTotalFiles(files.length);
    setProcessedCount(0);
    setBulkEntries([]);
    setIsBulkModalOpen(true);

    const results: BulkEntry[] = [];

    for (let i = 0; i < files.length; i++) {
      const result = await processImage(files[i]);
      if (result) {
        results.push(result);
        setProcessedCount(i + 1);
        setBulkEntries([...results]);
      }
    }

    setIsProcessing(false);
    e.target.value = '';
  };

  // --- Save All Bulk Entries ---
  const handleSaveAllBulk = () => {
    const successEntries = bulkEntries.filter(entry => entry.status === 'success');
    const newData: QRData[] = successEntries.map(({ fileName, status, errorMessage, ...rest }) => rest);
    setData(prev => [...prev, ...newData]);
    closeBulkModal();
  };

  // --- Remove Bulk Entry ---
  const handleRemoveBulkEntry = (id: string) => {
    setBulkEntries(prev => prev.filter(entry => entry.id !== id));
  };

  // --- Close Bulk Modal ---
  const closeBulkModal = () => {
    setIsBulkModalOpen(false);
    setBulkEntries([]);
    setProcessedCount(0);
    setTotalFiles(0);
  };

  // --- Single Image Upload Handler ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOCRProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          setIsOCRProcessing(false);
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          const parsed = parseQRIS(code.data);

          // Auto-detect using OCR if enabled
          let detectedSubtitle = defaultSubtitle;
          let detectedFooterCode = defaultFooterCode;
          let detectedNominal = parsed.amount || 'Rp. ';

          if (enableAutoDetect) {
            try {
              const ocrSettings = getOCRSettings();
              const ocrResult = await extractQRISFields(img, ocrSettings);

              // Note: Nominal is always taken from QRIS code, not OCR
              if (ocrResult.subtitle) detectedSubtitle = ocrResult.subtitle;
              if (ocrResult.footerCode) detectedFooterCode = ocrResult.footerCode;
            } catch (err) {
              console.warn('OCR extraction failed, using defaults:', err);
            }
          }

          setCurrentEntry({
            id: Date.now().toString(),
            title: parsed.merchantName || 'RETRIBUSI PARKIR',
            subtitle: detectedSubtitle,
            nmid: parsed.nmid || '',
            qrContent: code.data,
            footerCode: detectedFooterCode,
            nominal: detectedNominal,
          });
          setIsEditing(false);
          setIsModalOpen(true);
        } else {
          alert("QR Code could not be detected. Please try a clearer image.");
        }
        setIsOCRProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveEntry = () => {
    if (!currentEntry.title || !currentEntry.qrContent) {
      alert("Title and QR Content are required!");
      return;
    }
    const newRow = currentEntry as QRData;
    if (isEditing) {
      setData(prev => prev.map(row => row.id === newRow.id ? newRow : row));
    } else {
      setData(prev => [...prev, newRow]);
    }
    closeModal();
  };

  const handleEditRow = (row: QRData) => {
    setCurrentEntry(row);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentEntry(INITIAL_ENTRY);
    setIsEditing(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this item?')) setData(d => d.filter(r => r.id !== id));
  }

  const print = () => {
    window.print();
  };

  // Helper to chunk data into pages based on cardsPerPage
  const pages = [];
  for (let i = 0; i < data.length; i += cardsPerPage) {
    pages.push(data.slice(i, i + cardsPerPage));
  }
  // If no data, show at least one empty page for preview
  if (pages.length === 0) pages.push([]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">

      {/* Header - No Print */}
      <header className="bg-white shadow-sm border-b border-gray-200 p-4 no-print sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <ImageImageIcon className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800 leading-tight">QRIS Generator</h1>
              <p className="text-xs text-gray-500">Scan &bull; Edit &bull; Print</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
              <button
                onClick={() => setView('editor')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'editor' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Editor
              </button>
              <button
                onClick={() => setView('preview')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'preview' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Preview
              </button>
            </div>

            {view === 'preview' && (
              <button
                onClick={print}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-6 print:p-0 flex flex-col">

        {/* EDITOR VIEW */}
        <div className={`${view === 'editor' ? 'block' : 'hidden'} max-w-7xl mx-auto w-full space-y-6 no-print`}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Single Upload Button */}
            <div className="md:col-span-1">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" disabled={isOCRProcessing} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isOCRProcessing}
                className={`w-full h-full min-h-[160px] border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all group ${isOCRProcessing
                  ? 'border-gray-300 bg-gray-50 cursor-wait'
                  : 'border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-500'
                  }`}
              >
                <div className={`bg-white p-3 rounded-full shadow-sm mb-3 transition-transform ${isOCRProcessing ? '' : 'group-hover:scale-110'}`}>
                  {isOCRProcessing ? (
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  ) : (
                    <ImageImageIcon className="w-8 h-8 text-blue-600" />
                  )}
                </div>
                <span className="text-base font-semibold text-blue-800">
                  {isOCRProcessing ? 'Memproses...' : 'Scan QR Image'}
                </span>
                <span className="text-xs text-blue-600 mt-1">
                  {isOCRProcessing && enableAutoDetect ? 'Auto-Detect OCR aktif' : 'Single file'}
                </span>
              </button>
            </div>

            {/* Bulk Upload Button */}
            <div className="md:col-span-1">
              <input type="file" accept="image/*" ref={bulkFileInputRef} onChange={handleBulkUpload} multiple className="hidden" />
              <button onClick={() => bulkFileInputRef.current?.click()} className="w-full h-full min-h-[160px] border-2 border-dashed border-green-300 bg-green-50 hover:bg-green-100 hover:border-green-500 rounded-xl p-6 flex flex-col items-center justify-center transition-all group">
                <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform"><Upload className="w-8 h-8 text-green-600" /></div>
                <span className="text-base font-semibold text-green-800">Bulk Upload</span>
                <span className="text-xs text-green-600 mt-1">Multiple files</span>
              </button>
            </div>
            {/* Settings Button */}
            <div className="md:col-span-2">
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="w-full h-full min-h-[160px] border-2 border-dashed border-purple-300 bg-purple-50 hover:bg-purple-100 hover:border-purple-500 rounded-xl p-6 flex flex-col items-center justify-center transition-all group"
              >
                <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                  <Settings className="w-8 h-8 text-purple-600" />
                </div>
                <span className="text-base font-semibold text-purple-800">Pengaturan</span>
                <span className="text-xs text-purple-600 mt-1">
                  {cardWidth}×{cardHeight}cm • {cols}×{rows} grid • {cardsPerPage} kartu/halaman
                </span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-700">Generated Cards ({data.length})</h3>
            </div>
            {data.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {data.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-3 flex gap-3 relative group hover:border-blue-400 bg-white">
                    <div className="w-16 h-16 bg-gray-100 flex-shrink-0 flex items-center justify-center p-1 border font-mono text-[10px] text-center overflow-hidden">QR</div>
                    <div className="flex-grow min-w-0">
                      <h4 className="font-bold text-sm text-gray-800 truncate">{item.title}</h4>
                      <p className="text-xs text-gray-500 truncate mt-1">{item.nmid}</p>
                    </div>
                    <div className="flex flex-col gap-1 justify-center ml-2 border-l pl-2 border-gray-100">
                      <button onClick={() => handleEditRow(item)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="p-8 text-center text-gray-400">List is empty.</div>}
          </div>
        </div>

        {/* PRINT PREVIEW VIEW */}
        <div className={`${view === 'preview' ? 'flex' : 'hidden'} flex-col items-center justify-start min-h-full print:block`}>

          {/* Preview Header (Screen Only) */}
          <div className="text-center mb-8 no-print mt-4">
            <h2 className="text-xl font-extrabold text-[#111827]">Preview A4 Landscape</h2>
            <p className="text-sm text-gray-500 mt-1">Layout {cols}×{rows} grid, ukuran per kotak {cardWidth}×{cardHeight}cm</p>
          </div>

          {/* A4 PAGES */}
          {pages.map((pageData, pageIndex) => (
            <div
              key={pageIndex}
              className="print-page bg-white shadow-2xl mx-auto mb-10 overflow-hidden relative box-border"
              style={{
                width: '297mm',
                height: '210mm',
                padding: `${gapSize / 2}mm`,
                margin: '0 auto 40px auto'
              }}
            >
              {/* Grid container with gap */}
              <div
                className="w-full h-full grid place-items-center"
                style={{
                  gridTemplateColumns: `repeat(${cols}, ${cardWidth}cm)`,
                  gridTemplateRows: `repeat(${rows}, ${cardHeight}cm)`,
                  gap: `${gapSize}mm`,
                  justifyContent: 'center',
                  alignContent: 'center'
                }}
              >
                {Array.from({ length: cardsPerPage }).map((_, slotIndex) => {
                  const item = pageData[slotIndex];
                  return (
                    <div key={slotIndex} className="flex items-center justify-center">
                      {item ? (
                        <QRCard
                          {...item}
                          cardWidth={cardWidth}
                          cardHeight={cardHeight}
                          qrScale={qrScale}
                          fontSize={fontSize}
                          headerOffset={headerOffset}
                          footerOffset={footerOffset}
                          titleColor={titleColor}
                          subtitleColor={subtitleColor}
                          nmidColor={nmidColor}
                          footerCodeColor={footerCodeColor}
                          nominalColor={nominalColor}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 no-print">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-gray-800">{isEditing ? 'Edit QR Card' : 'New QR Scan'}</h3>
              <button onClick={closeModal}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Title</label>
                <input type="text" className="w-full border rounded px-3 py-2" value={currentEntry.title} onChange={e => setCurrentEntry({ ...currentEntry, title: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Subtitle</label>
                <input type="text" className="w-full border rounded px-3 py-2" value={currentEntry.subtitle} onChange={e => setCurrentEntry({ ...currentEntry, subtitle: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-gray-500 uppercase">NMID</label><input type="text" className="w-full border rounded px-3 py-2" value={currentEntry.nmid} onChange={e => setCurrentEntry({ ...currentEntry, nmid: e.target.value })} /></div>
                <div><label className="text-xs font-bold text-gray-500 uppercase">Nominal</label><input type="text" className="w-full border rounded px-3 py-2" value={currentEntry.nominal} onChange={e => setCurrentEntry({ ...currentEntry, nominal: e.target.value })} /></div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Footer Code</label>
                <input type="text" className="w-full border rounded px-3 py-2" value={currentEntry.footerCode} onChange={e => setCurrentEntry({ ...currentEntry, footerCode: e.target.value })} />
              </div>
            </div>
            <div className="p-4 bg-gray-50 flex justify-end gap-2">
              <button onClick={closeModal} className="px-4 py-2 rounded text-gray-600 hover:bg-gray-200">Cancel</button>
              <button onClick={handleSaveEntry} className="px-6 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* BULK UPLOAD MODAL */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 no-print">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-green-500 to-green-600">
              <div className="flex items-center gap-3">
                <Upload className="w-6 h-6 text-white" />
                <div>
                  <h3 className="font-bold text-white">Bulk Upload QRIS</h3>
                  {isProcessing ? (
                    <p className="text-green-100 text-sm">Memproses {processedCount} dari {totalFiles} file...</p>
                  ) : (
                    <p className="text-green-100 text-sm">{bulkEntries.filter(e => e.status === 'success').length} berhasil, {bulkEntries.filter(e => e.status === 'failed').length} gagal</p>
                  )}
                </div>
              </div>
              <button onClick={closeBulkModal} className="text-white hover:bg-white/20 p-1 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress Bar */}
            {isProcessing && (
              <div className="px-4 py-2 bg-gray-50 border-b">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                  <div className="flex-1">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300"
                        style={{ width: `${(processedCount / totalFiles) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-600">{Math.round((processedCount / totalFiles) * 100)}%</span>
                </div>
              </div>
            )}

            {/* Results List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {bulkEntries.length === 0 && !isProcessing && (
                <div className="text-center text-gray-400 py-8">Tidak ada file yang diproses</div>
              )}
              {bulkEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${entry.status === 'success'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                    }`}
                >
                  {entry.status === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${entry.status === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                      {entry.fileName}
                    </p>
                    {entry.status === 'success' ? (
                      <p className="text-xs text-green-600 truncate">{entry.title} • NMID: {entry.nmid}</p>
                    ) : (
                      <p className="text-xs text-red-500">{entry.errorMessage}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveBulkEntry(entry.id)}
                    className={`p-1.5 rounded hover:bg-opacity-20 ${entry.status === 'success'
                      ? 'text-green-600 hover:bg-green-600'
                      : 'text-red-500 hover:bg-red-500'
                      }`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-gray-50 border-t flex items-center justify-between gap-3">
              <div className="text-sm text-gray-500">
                {bulkEntries.filter(e => e.status === 'success').length > 0 && (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    {bulkEntries.filter(e => e.status === 'success').length} siap disimpan
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={closeBulkModal}
                  className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-200 font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveAllBulk}
                  disabled={isProcessing || bulkEntries.filter(e => e.status === 'success').length === 0}
                  className="px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Simpan Semua ({bulkEntries.filter(e => e.status === 'success').length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 no-print">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-500 to-purple-600">
              <div className="flex items-center gap-3">
                <Settings className="w-6 h-6 text-white" />
                <div>
                  <h3 className="font-bold text-white">Pengaturan</h3>
                  <p className="text-purple-100 text-sm">Kustomisasi tampilan kartu QRIS</p>
                </div>
              </div>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-white hover:bg-white/20 p-1 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* OCR Auto-Detect Settings */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">🔍 Auto-Detect (OCR)</h4>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold text-gray-800">Auto-Detect dari Gambar</p>
                      <p className="text-xs text-gray-500 mt-0.5">Ekstrak Subtitle, Footer Code, dan Nominal secara otomatis</p>
                    </div>
                    <button
                      onClick={() => setEnableAutoDetect(!enableAutoDetect)}
                      className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${enableAutoDetect ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${enableAutoDetect ? 'translate-x-7' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {enableAutoDetect && (
                    <div className="space-y-4 pt-3 border-t border-blue-200">
                      {/* Visual Calibration Button */}
                      <button
                        onClick={() => {
                          setIsSettingsModalOpen(false);
                          setIsCalibrationModalOpen(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
                      >
                        <Crosshair className="w-5 h-5" />
                        <span className="font-semibold">🎯 Kalibrasi Visual</span>
                      </button>
                      <p className="text-xs text-center text-gray-500">Gambar area OCR langsung di gambar QRIS contoh</p>

                      {/* Saved Calibration Image Preview */}
                      {calibrationImage && (
                        <div className="bg-white rounded-lg p-3 border border-purple-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-700 uppercase">📷 Gambar Kalibrasi Tersimpan</span>
                            <button
                              onClick={() => setCalibrationImage(null)}
                              className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                            >
                              ✕ Hapus
                            </button>
                          </div>
                          <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: '3/4', maxHeight: '150px' }}>
                            <img
                              src={calibrationImage}
                              alt="Calibration preview"
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1 text-center">Gambar ini akan tersimpan bersama pengaturan OCR</p>
                        </div>
                      )}

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="bg-blue-50 px-2 text-gray-500">atau atur manual</span>
                        </div>
                      </div>

                      <p className="text-xs text-gray-600 italic">Atur koordinat area deteksi (persentase dari gambar). Posisi harus sesuai dengan template gambar QRIS Anda.</p>

                      {/* Subtitle Region (RED - sesuai marking user) */}
                      <div className="bg-white rounded-lg p-3 border border-red-100">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-3 h-3 rounded-full bg-red-500"></span>
                          <label className="text-xs font-bold text-gray-700 uppercase">Area Subtitle (Kotak Merah)</label>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">X (%)</label>
                            <input
                              type="number" min="0" max="100" step="1"
                              value={subtitleRegion.x}
                              onChange={e => setSubtitleRegion({ ...subtitleRegion, x: Number(e.target.value) })}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-red-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">Y (%)</label>
                            <input
                              type="number" min="0" max="100" step="1"
                              value={subtitleRegion.y}
                              onChange={e => setSubtitleRegion({ ...subtitleRegion, y: Number(e.target.value) })}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-red-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">Lebar (%)</label>
                            <input
                              type="number" min="0" max="100" step="1"
                              value={subtitleRegion.width}
                              onChange={e => setSubtitleRegion({ ...subtitleRegion, width: Number(e.target.value) })}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-red-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">Tinggi (%)</label>
                            <input
                              type="number" min="0" max="100" step="1"
                              value={subtitleRegion.height}
                              onChange={e => setSubtitleRegion({ ...subtitleRegion, height: Number(e.target.value) })}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-red-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer Code Region (BLUE - sesuai marking user) */}
                      <div className="bg-white rounded-lg p-3 border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                          <label className="text-xs font-bold text-gray-700 uppercase">Area Footer Code (Kotak Biru)</label>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">X (%)</label>
                            <input
                              type="number" min="0" max="100" step="1"
                              value={footerCodeRegion.x}
                              onChange={e => setFooterCodeRegion({ ...footerCodeRegion, x: Number(e.target.value) })}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">Y (%)</label>
                            <input
                              type="number" min="0" max="100" step="1"
                              value={footerCodeRegion.y}
                              onChange={e => setFooterCodeRegion({ ...footerCodeRegion, y: Number(e.target.value) })}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">Lebar (%)</label>
                            <input
                              type="number" min="0" max="100" step="1"
                              value={footerCodeRegion.width}
                              onChange={e => setFooterCodeRegion({ ...footerCodeRegion, width: Number(e.target.value) })}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 mb-0.5 block">Tinggi (%)</label>
                            <input
                              type="number" min="0" max="100" step="1"
                              value={footerCodeRegion.height}
                              onChange={e => setFooterCodeRegion({ ...footerCodeRegion, height: Number(e.target.value) })}
                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Info about Nominal */}
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-3 h-3 rounded-full bg-green-500"></span>
                          <label className="text-xs font-bold text-gray-700 uppercase">Nominal</label>
                        </div>
                        <p className="text-xs text-gray-500 italic">
                          ✓ Nominal diambil langsung dari data QRIS code (tag 54), bukan dari OCR
                        </p>
                      </div>

                      {/* Reset to Default */}
                      <button
                        onClick={() => {
                          setSubtitleRegion(DEFAULT_OCR_SETTINGS.subtitleRegion);
                          setFooterCodeRegion(DEFAULT_OCR_SETTINGS.footerCodeRegion);
                        }}
                        className="w-full py-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        ↻ Reset ke Nilai Default
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Default Values */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">📝 Nilai Default (Fallback)</h4>
                <p className="text-xs text-gray-500 mb-3">Digunakan jika Auto-Detect dimatikan atau gagal mendeteksi</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block uppercase">Subtitle</label>
                    <input type="text" placeholder="e.g. STN AGUNG UTRR2" value={defaultSubtitle} onChange={e => setDefaultSubtitle(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block uppercase">Footer Value</label>
                    <input type="text" placeholder="e.g. PRK-SDPC3-R4" value={defaultFooterCode} onChange={e => setDefaultFooterCode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                </div>
              </div>

              {/* Card Size Settings */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">📐 Ukuran Kartu</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block uppercase">Lebar Kartu (cm)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="8"
                        max="14"
                        step="0.5"
                        value={cardWidth}
                        onChange={e => setCardWidth(Number(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded min-w-[50px] text-center">{cardWidth}cm</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block uppercase">Tinggi Kartu (cm)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="7"
                        max="14"
                        step="0.5"
                        value={cardHeight}
                        onChange={e => setCardHeight(Number(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                      />
                      <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-1 rounded min-w-[50px] text-center">{cardHeight}cm</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block uppercase">Gap Antar Kartu (mm)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="15"
                        step="1"
                        value={gapSize}
                        onChange={e => setGapSize(Number(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-600"
                      />
                      <span className="text-sm font-bold text-pink-600 bg-pink-50 px-2 py-1 rounded min-w-[50px] text-center">{gapSize}mm</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 text-center">
                    <span className="font-semibold">Layout:</span> {cols}×{rows} = <span className="font-bold text-blue-600">{cardsPerPage} kartu/halaman</span>
                  </p>
                </div>
              </div>

              {/* QR & Text Size Settings */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">🔍 Ukuran Konten</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block uppercase">Ukuran QR Code</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.6"
                        max="1.4"
                        step="0.1"
                        value={qrScale}
                        onChange={e => setQrScale(Number(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                      <span className="text-sm font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded min-w-[50px] text-center">{Math.round(qrScale * 100)}%</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block uppercase">Ukuran Teks (px)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="10"
                        max="20"
                        step="1"
                        value={fontSize}
                        onChange={e => setFontSize(Number(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                      />
                      <span className="text-sm font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded min-w-[50px] text-center">{fontSize}px</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Position Settings */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">📍 Posisi Teks</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block uppercase">Header (Title, NMID)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-20"
                        max="20"
                        step="1"
                        value={headerOffset}
                        onChange={e => setHeaderOffset(Number(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded min-w-[50px] text-center">{headerOffset}px</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block uppercase">Footer (Nominal)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-20"
                        max="20"
                        step="1"
                        value={footerOffset}
                        onChange={e => setFooterOffset(Number(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                      />
                      <span className="text-sm font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded min-w-[50px] text-center">{footerOffset}px</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Color Settings */}
              <div>
                <h4 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">🎨 Warna Teks</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Title</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={titleColor}
                        onChange={e => setTitleColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                      />
                      <span className="text-xs text-gray-500">{titleColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Subtitle</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={subtitleColor}
                        onChange={e => setSubtitleColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                      />
                      <span className="text-xs text-gray-500">{subtitleColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">NMID</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={nmidColor}
                        onChange={e => setNmidColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                      />
                      <span className="text-xs text-gray-500">{nmidColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Footer Code</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={footerCodeColor}
                        onChange={e => setFooterCodeColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                      />
                      <span className="text-xs text-gray-500">{footerCodeColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Nominal</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={nominalColor}
                        onChange={e => setNominalColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                      />
                      <span className="text-xs text-gray-500">{nominalColor}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-gray-50 border-t flex items-center justify-between gap-3">
              <input
                type="file"
                ref={settingsFileInputRef}
                onChange={importSettings}
                accept=".json"
                className="hidden"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => settingsFileInputRef.current?.click()}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  📥 Import
                </button>
                <button
                  onClick={exportSettings}
                  className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  📤 Export
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-200 font-medium transition-colors"
                >
                  Tutup
                </button>
                <button
                  onClick={() => { saveSettings(); setIsSettingsModalOpen(false); }}
                  className="px-6 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-medium transition-colors flex items-center gap-2"
                >
                  💾 Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Region Calibration Modal */}
      <RegionCalibrationModal
        isOpen={isCalibrationModalOpen}
        onClose={() => setIsCalibrationModalOpen(false)}
        subtitleRegion={subtitleRegion}
        footerCodeRegion={footerCodeRegion}
        initialImage={calibrationImage}
        onSave={(subtitle, footer, image) => {
          setSubtitleRegion(subtitle);
          setFooterCodeRegion(footer);
          setCalibrationImage(image);
        }}
      />
    </div>
  );
}

// Icon wrapper
const ImageImageIcon = ({ className }: { className?: string }) => <ImageIcon className={className} />;

export default App;


