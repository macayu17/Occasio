import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Upload, Save, Type, Calendar, Trash2 } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const AVAILABLE_FIELDS = [
  { id: 'userName', label: 'Attendee Name', icon: Type },
  { id: 'eventName', label: 'Event Name', icon: Type },
  { id: 'date', label: 'Event Date', icon: Calendar },
  { id: 'qrCode', label: 'Verification QR', icon: Type }, // Placeholder for future
];

export default function CertificateDesigner({ eventId, initialConfig, onClose }) {
  const [file, setFile] = useState(null);
  const [templateUrl, setTemplateUrl] = useState(initialConfig?.templateUrl || null);
  const [mapping, setMapping] = useState(initialConfig?.mapping || []);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pageWidth, setPageWidth] = useState(0);
  const [numPages, setNumPages] = useState(null);

  const containerRef = useRef(null);

  useEffect(() => {
    // Resize observer or simple effect to get container width
    if (containerRef.current) {
      setPageWidth(containerRef.current.clientWidth);
    }
  }, []);

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/admin/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Construct full URL if it's a relative path
      let fullUrl = res.data.url;
      if (fullUrl && !fullUrl.startsWith('http')) {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const baseUrl = apiUrl.replace(/\/api$/, '');
        fullUrl = `${baseUrl}${fullUrl}`;
      }
      
      console.log('Template URL:', fullUrl);
      setTemplateUrl(fullUrl);
      setMapping([]); // Reset mapping on new template
      toast.success('Template uploaded');
    } catch (error) {
      console.error(error);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handlePdfClick = (e) => {
    if (!selectedFieldId || !templateUrl) return;

    const rect = e.target.getBoundingClientRect();
    
    // Calculate percentage based coordinates to be responsive-ish
    // But for PDF generation (pdf-lib), we usually need PostScript points (72 DPI).
    // Let's store raw relative coordinates (0-1) and scale them during generation.
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Remove existing mapping for this field if any
    const newMapping = mapping.filter(m => m.fieldId !== selectedFieldId);

    newMapping.push({
      fieldId: selectedFieldId,
      x,
      y,
      fontSize: 12,
      color: '#000000',
      font: 'Helvetica'
    });

    setMapping(newMapping);
    setSelectedFieldId(null); // Deselect after placing
  };

  const handleSave = async () => {
    try {
      await api.put(`/admin/events/${eventId}`, {
        certificateEnabled: true,
        certificateTemplateUrl: templateUrl,
        certificateMapping: mapping
      });
      toast.success('Certificate configuration saved!');
      if(onClose) onClose();
    } catch (error) {
      toast.error('Failed to save configuration');
    }
  };

  const removeField = (fieldId) => {
    setMapping(mapping.filter(m => m.fieldId !== fieldId));
  };

  function getFieldName(id) {
    return AVAILABLE_FIELDS.find(f => f.id === id)?.label || id;
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Certificate Designer</h2>
        <div className="flex gap-2">
           <label className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer transition-colors">
            <Upload size={18} />
            <span>{uploading ? 'Uploading...' : 'Upload PDF Template'}</span>
            <input 
              type="file" 
              accept="application/pdf"
              className="hidden" 
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-[#E23744] hover:bg-[#c92a37] text-white rounded-lg transition-colors"
          >
            <Save size={18} />
            <span>Save Config</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Controls */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-gray-700/50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Available Fields</h3>
            <div className="space-y-2">
              {AVAILABLE_FIELDS.map(field => {
                const isPlaced = mapping.some(m => m.fieldId === field.id);
                const isSelected = selectedFieldId === field.id;
                
                return (
                  <button
                    key={field.id}
                    onClick={() => setSelectedFieldId(field.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                      isSelected 
                        ? 'bg-[#E23744]/20 border-[#E23744] text-white shadow-[0_0_10px_rgba(226,55,68,0.3)]' 
                        : isPlaced
                        ? 'bg-green-900/20 border-green-700 text-green-100'
                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <field.icon size={16} />
                      <span className="text-sm font-medium">{field.label}</span>
                    </div>
                    {isPlaced && <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded">Placed</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Click a field above, then click on the PDF to place it.
            </p>
          </div>

          {mapping.length > 0 && (
            <div className="bg-gray-700/50 p-4 rounded-lg">
               <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Placed Fields</h3>
               <ul className="space-y-2">
                 {mapping.map((m, idx) => (
                   <li key={idx} className="flex justify-between items-center text-sm bg-gray-800 p-2 rounded">
                     <span>{getFieldName(m.fieldId)}</span>
                     <button onClick={() => removeField(m.fieldId)} className="text-red-400 hover:text-red-300">
                       <Trash2 size={14} />
                     </button>
                   </li>
                 ))}
               </ul>
            </div>
          )}
        </div>

        {/* PDF Preview Area */}
        <div className="md:col-span-3 bg-gray-900 rounded-lg border border-dashed border-gray-700 min-h-[500px] flex items-center justify-center relative overflow-hidden" ref={containerRef}>
          {!templateUrl ? (
            <div className="text-center text-gray-500">
              <Upload size={48} className="mx-auto mb-4 opacity-50" />
              <p>Upload a PDF Certificate Template to start</p>
            </div>
          ) : (
            <div className="relative group cursor-crosshair">
               <Document
                file={templateUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={<div className="animate-pulse text-white">Loading PDF...</div>}
                error={<div className="text-red-500">Failed to load PDF. Check URL/CORS.</div>}
              >
                <div onClick={handlePdfClick} className="relative inline-block">
                  <Page 
                    pageNumber={1} 
                    width={pageWidth > 0 ? pageWidth - 48 : 600} 
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                  
                  {/* Markers Overlay */}
                  {mapping.map((m) => (
                    <div
                      key={m.fieldId}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 bg-[#E23744] text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap z-10"
                      style={{
                        left: `${m.x * 100}%`,
                        top: `${m.y * 100}%`,
                      }}
                    >
                      {getFieldName(m.fieldId)}
                    </div>
                  ))}
                  
                   {/* Ghost Marker for current selection */}
                   {selectedFieldId && (
                     <div className="absolute top-0 left-0 w-full h-full bg-black/10 z-0 pointer-events-none border-2 border-[#E23744] animate-pulse"></div>
                   )}
                </div>
              </Document>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
