import React, { useState, useRef } from 'react';
import jsQR from 'jsqr';
import { Printer, Trash2, Settings, Image as ImageIcon, X, Edit2 } from 'lucide-react';
import { QRCard } from './components/QRCard';
import { parseQRIS } from './utils/qrisParser';

interface QRData {
  id: string;
  title: string;
  subtitle: string;
  nmid: string;
  qrContent: string;
  footerCode: string;
  nominal: string;
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

  // Defaults
  const [defaultSubtitle, setDefaultSubtitle] = useState('');
  const [defaultFooterCode, setDefaultFooterCode] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          const parsed = parseQRIS(code.data);
          setCurrentEntry({
            id: Date.now().toString(),
            title: parsed.merchantName || 'RETRIBUSI PARKIR',
            subtitle: defaultSubtitle,
            nmid: parsed.nmid || '',
            qrContent: code.data,
            footerCode: defaultFooterCode,
            nominal: parsed.amount || 'Rp. ',
          });
          setIsEditing(false);
          setIsModalOpen(true);
        } else {
          alert("QR Code could not be detected. Please try a clearer image.");
        }
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

  // Helper to chunk data into pages of 6
  const pages = [];
  for (let i = 0; i < data.length; i += 6) {
    pages.push(data.slice(i, i + 6));
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
            <div className="md:col-span-1">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="w-full h-full min-h-[160px] border-2 border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-500 rounded-xl p-6 flex flex-col items-center justify-center transition-all group">
                <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform"><ImageImageIcon className="w-8 h-8 text-blue-600" /></div>
                <span className="text-base font-semibold text-blue-800">Scan QR Image</span>
              </button>
            </div>
            <div className="md:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><Settings className="w-24 h-24" /></div>
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Settings className="w-4 h-4" /> Default Manual Values</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block uppercase">Subtitle</label>
                  <input type="text" placeholder="e.g. STN AGUNG UTRR2" value={defaultSubtitle} onChange={e => setDefaultSubtitle(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block uppercase">Footer Value</label>
                  <input type="text" placeholder="e.g. PRK-SDPC3-R4" value={defaultFooterCode} onChange={e => setDefaultFooterCode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
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
            <p className="text-sm text-gray-500 mt-1">Layout 3&times;2 grid, ukuran per kotak 9&times;9cm</p>
          </div>

          {/* A4 PAGES */}
          {pages.map((pageData, pageIndex) => (
            <div key={pageIndex} className="bg-white shadow-2xl print:shadow-none w-[297mm] h-[210mm] mx-auto mb-10 overflow-hidden relative print:m-0 print:w-full print:h-full print:break-after-page box-border py-[3mm]">
              {/* 3x2 Grid - With vertical gap between rows */}
              <div className="w-full h-full grid grid-cols-3 grid-rows-2 gap-y-[6mm]">
                {Array.from({ length: 6 }).map((_, slotIndex) => {
                  const item = pageData[slotIndex];
                  return (
                    <div key={slotIndex} className="flex items-center justify-center">
                      {item ? <QRCard {...item} /> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* EDIT MODAL (Keep as is) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 no-print">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-gray-800">{isEditing ? 'Edit QR Card' : 'New QR Scan'}</h3>
              <button onClick={closeModal}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Simplified Inputs for brevity in this replace block, logic remains same */}
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
    </div>
  );
}

// Icon wrapper
const ImageImageIcon = ({ className }: { className?: string }) => <ImageIcon className={className} />;

export default App;
