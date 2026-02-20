import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Upload, Save, Type, Calendar, Trash2, Eye, Award, Trophy, Medal, Users, Send, Mail } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const CERTIFICATE_TYPES = [
  { id: 'participation', label: 'Participation', icon: Users, color: 'blue', description: 'For all checked-in attendees' },
  { id: 'first_prize', label: '1st Prize', icon: Trophy, color: 'yellow', description: 'Gold — Winner' },
  { id: 'second_prize', label: '2nd Prize', icon: Medal, color: 'gray', description: 'Silver — Runner-up' },
  { id: 'third_prize', label: '3rd Prize', icon: Award, color: 'orange', description: 'Bronze — Second runner-up' },
];

const AVAILABLE_FIELDS = [
  { id: 'userName', label: 'Attendee Name', icon: Type },
  { id: 'eventName', label: 'Event Name', icon: Type },
  { id: 'date', label: 'Event Date', icon: Calendar },
  { id: 'certificateType', label: 'Certificate Type', icon: Award },
  { id: 'rank', label: 'Rank / Prize', icon: Trophy },
  { id: 'qrCode', label: 'Verification QR', icon: Type },
];

export default function CertificateDesigner({ eventId, initialConfig, onClose, onSave }) {
  // Active certificate type tab
  const [activeCertType, setActiveCertType] = useState('participation');
  
  // Per-type state: { [certType]: { pdfData, templateUrl, mapping } }
  const [configs, setConfigs] = useState({});
  
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pageWidth, setPageWidth] = useState(0);
  const [numPages, setNumPages] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendEmails, setSendEmails] = useState('');
  const [sendingType, setSendingType] = useState('participation');

  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Current active config helpers
  const activeConfig = configs[activeCertType] || { pdfData: null, templateUrl: null, mapping: [] };
  
  const updateActiveConfig = (updates) => {
    setConfigs(prev => ({
      ...prev,
      [activeCertType]: { ...prev[activeCertType] || { pdfData: null, templateUrl: null, mapping: [] }, ...updates }
    }));
  };

  useEffect(() => {
    if (containerRef.current) {
      setPageWidth(containerRef.current.clientWidth);
    }
    const handleResize = () => {
      if (containerRef.current) {
        setPageWidth(containerRef.current.clientWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load existing certificate configs from backend
  useEffect(() => {
    loadCertificateConfigs();
  }, [eventId]);

  const loadCertificateConfigs = async () => {
    try {
      const response = await api.get(`/admin/events/${eventId}/certificates/config`);
      const { configs: serverConfigs } = response.data;
      
      if (serverConfigs && Object.keys(serverConfigs).length > 0) {
        const loadedConfigs = {};
        for (const [type, config] of Object.entries(serverConfigs)) {
          loadedConfigs[type] = {
            templateUrl: config.templateUrl || null,
            mapping: config.mapping || [],
            pdfData: null,
            enabled: config.enabled !== false
          };
          // Load PDF preview if URL exists
          if (config.templateUrl) {
            loadPdfFromUrl(config.templateUrl, type);
          }
        }
        setConfigs(prev => ({ ...prev, ...loadedConfigs }));
      } else if (initialConfig?.templateUrl) {
        // Fallback: load legacy config as participation
        setConfigs(prev => ({
          ...prev,
          participation: {
            templateUrl: initialConfig.templateUrl,
            mapping: initialConfig.mapping || [],
            pdfData: null,
            enabled: true
          }
        }));
        if (initialConfig.templateUrl) {
          loadPdfFromUrl(initialConfig.templateUrl, 'participation');
        }
      }
    } catch (error) {
      console.error('Failed to load certificate configs:', error);
      // Fallback to initialConfig
      if (initialConfig?.templateUrl) {
        setConfigs({
          participation: {
            templateUrl: initialConfig.templateUrl,
            mapping: initialConfig.mapping || [],
            pdfData: null,
            enabled: true
          }
        });
        loadPdfFromUrl(initialConfig.templateUrl, 'participation');
      }
    }
  };

  const loadPdfFromUrl = async (url, certType) => {
    try {
      // For local URLs, use the API base
      let fetchUrl = url;
      if (url && !url.startsWith('http') && !url.startsWith('data:')) {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const baseUrl = apiUrl.replace(/\/api$/, '');
        fetchUrl = `${baseUrl}${url}`;
      }

      const response = await fetch(fetchUrl, { mode: 'cors' });
      if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      
      setConfigs(prev => ({
        ...prev,
        [certType]: { ...prev[certType] || { templateUrl: url, mapping: [] }, pdfData: dataUrl }
      }));
    } catch (error) {
      console.error(`Error loading PDF for ${certType}:`, error);
    }
  };

  const blobToDataUrl = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const getFieldName = (id) => {
    return AVAILABLE_FIELDS.find(f => f.id === id)?.label || id;
  };

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    // Show local preview immediately
    try {
      const dataUrl = await blobToDataUrl(selectedFile);
      updateActiveConfig({ pdfData: dataUrl });
      setPdfError(null);
    } catch (error) {
      console.error('Error reading file:', error);
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/admin/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      let fullUrl = res.data.url;
      console.log('Template URL:', fullUrl);
      updateActiveConfig({ templateUrl: fullUrl, mapping: [] });
      toast.success('Template uploaded');
    } catch (error) {
      console.error(error);
      toast.error('Upload failed');
      updateActiveConfig({ pdfData: null });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePdfClick = (e) => {
    if (!selectedFieldId) {
      toast.error('Please select a field first');
      return;
    }
    if (!activeConfig.pdfData) {
      toast.error('Please upload a PDF template first');
      return;
    }

    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const newMapping = (activeConfig.mapping || []).filter(m => m.fieldId !== selectedFieldId);
    newMapping.push({
      fieldId: selectedFieldId,
      x,
      y,
      fontSize: 14,
      color: '#000000',
      bold: selectedFieldId === 'userName' || selectedFieldId === 'rank',
      font: 'Helvetica'
    });

    updateActiveConfig({ mapping: newMapping });
    const placedFieldName = getFieldName(selectedFieldId);
    setSelectedFieldId(null);
    toast.success(`${placedFieldName} placed!`);
  };

  const handleSave = async () => {
    const cfg = activeConfig;
    if (!cfg.templateUrl && !cfg.pdfData) {
      toast.error('Please upload a template first');
      return;
    }

    try {
      // Use the new typed config endpoint
      await api.put(`/admin/events/${eventId}/certificates/config`, {
        certificateType: activeCertType,
        templateUrl: cfg.templateUrl,
        mapping: cfg.mapping,
        enabled: true
      });

      // Also save legacy fields for backward compatibility
      if (activeCertType === 'participation') {
        await api.put(`/admin/events/${eventId}`, {
          certificateEnabled: true,
          certificateTemplateUrl: cfg.templateUrl,
          certificateMapping: cfg.mapping
        });
      }

      toast.success(`${CERTIFICATE_TYPES.find(t => t.id === activeCertType)?.label} certificate config saved!`);
      if (onSave) onSave();
    } catch (error) {
      toast.error('Failed to save configuration');
    }
  };

  const handleTestCertificate = async () => {
    const cfg = activeConfig;
    const template = cfg.templateUrl || cfg.pdfData;
    if (!template || (cfg.mapping || []).length === 0) {
      toast.error('Please upload a template and place at least one field');
      return;
    }

    try {
      toast.loading('Generating test certificate...', { id: 'test-cert' });
      
      const response = await api.post(
        `/admin/events/${eventId}/certificates/test`,
        { templateUrl: template, mapping: cfg.mapping, certificateType: activeCertType },
        { responseType: 'blob' }
      );
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      toast.success('Test certificate generated!', { id: 'test-cert' });
    } catch (error) {
      console.error('Test certificate error:', error);
      toast.error('Failed to generate test certificate', { id: 'test-cert' });
    }
  };

  const handleSendCertificates = async () => {
    const certType = sendingType;
    const cfg = configs[certType];
    
    if (!cfg?.templateUrl) {
      toast.error(`No template configured for ${CERTIFICATE_TYPES.find(t => t.id === certType)?.label}. Upload and save a template first.`);
      return;
    }

    const isPrize = ['first_prize', 'second_prize', 'third_prize'].includes(certType);
    const emailList = isPrize ? sendEmails.split(/[,\n]+/).map(e => e.trim()).filter(Boolean) : [];

    if (isPrize && emailList.length === 0) {
      toast.error('Please enter at least one recipient email');
      return;
    }

    try {
      toast.loading('Sending certificates...', { id: 'send-cert' });
      
      const payload = {
        certificateType: certType,
        ...(isPrize ? { recipientEmails: emailList } : {})
      };

      const response = await api.post(`/admin/events/${eventId}/certificates`, payload);
      
      toast.success(response.data.message || `Certificates sent!`, { id: 'send-cert' });
      setSendModalOpen(false);
      setSendEmails('');
    } catch (error) {
      console.error('Send certificates error:', error);
      toast.error(error.response?.data?.error || 'Failed to send certificates', { id: 'send-cert' });
    }
  };

  const removeField = (fieldId) => {
    updateActiveConfig({ mapping: (activeConfig.mapping || []).filter(m => m.fieldId !== fieldId) });
  };

  const currentMapping = activeConfig.mapping || [];

  // Color classes based on certificate type
  const typeColorClasses = {
    participation: { bg: 'bg-blue-600', bgHover: 'hover:bg-blue-500', ring: 'ring-blue-500', text: 'text-blue-400', bgLight: 'bg-blue-900/20', border: 'border-blue-700' },
    first_prize: { bg: 'bg-yellow-600', bgHover: 'hover:bg-yellow-500', ring: 'ring-yellow-500', text: 'text-yellow-400', bgLight: 'bg-yellow-900/20', border: 'border-yellow-700' },
    second_prize: { bg: 'bg-gray-500', bgHover: 'hover:bg-gray-400', ring: 'ring-gray-400', text: 'text-gray-300', bgLight: 'bg-gray-700/20', border: 'border-gray-500' },
    third_prize: { bg: 'bg-orange-600', bgHover: 'hover:bg-orange-500', ring: 'ring-orange-500', text: 'text-orange-400', bgLight: 'bg-orange-900/20', border: 'border-orange-700' },
  };
  const colors = typeColorClasses[activeCertType] || typeColorClasses.participation;

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Certificate Designer</h2>
        <div className="flex gap-2">
          {/* Send Certificates Button */}
          <button
            onClick={() => { setSendingType(activeCertType); setSendModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
          >
            <Send size={18} />
            <span>Send Certificates</span>
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg cursor-pointer transition-colors">
            <Upload size={18} />
            <span>{uploading ? 'Uploading...' : 'Upload PDF Template'}</span>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="application/pdf"
              className="hidden" 
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          <button 
            onClick={handleTestCertificate}
            disabled={(!activeConfig.templateUrl && !activeConfig.pdfData) || currentMapping.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              (activeConfig.templateUrl || activeConfig.pdfData) && currentMapping.length > 0
                ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Eye size={18} />
            <span>Test</span>
          </button>
          <button 
            onClick={handleSave}
            disabled={!activeConfig.pdfData || currentMapping.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeConfig.pdfData && currentMapping.length > 0 
                ? 'bg-[#E23744] hover:bg-[#c92a37] text-white' 
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save size={18} />
            <span>Save Config</span>
          </button>
        </div>
      </div>

      {/* Certificate Type Tabs */}
      <div className="flex gap-2 mb-6 bg-gray-900/50 p-2 rounded-xl">
        {CERTIFICATE_TYPES.map(type => {
          const isActive = activeCertType === type.id;
          const hasConfig = configs[type.id]?.templateUrl;
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => { setActiveCertType(type.id); setSelectedFieldId(null); setPdfError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? `${typeColorClasses[type.id].bg} text-white shadow-lg`
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <Icon size={18} />
              <span>{type.label}</span>
              {hasConfig && !isActive && (
                <span className="w-2 h-2 rounded-full bg-green-400 ml-1"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Type Description */}
      <div className={`mb-4 px-4 py-2 rounded-lg ${colors.bgLight} border ${colors.border}`}>
        <p className={`text-sm ${colors.text}`}>
          {CERTIFICATE_TYPES.find(t => t.id === activeCertType)?.description}
          {['first_prize', 'second_prize', 'third_prize'].includes(activeCertType) && (
            <span className="text-gray-400 ml-2">— Send to specific recipients via email</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Controls */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-gray-700/50 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Available Fields</h3>
            <div className="space-y-2">
              {AVAILABLE_FIELDS.map(field => {
                const isPlaced = currentMapping.some(m => m.fieldId === field.id);
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

          {currentMapping.length > 0 && (
            <div className="bg-gray-700/50 p-4 rounded-lg">
               <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Placed Fields</h3>
               <ul className="space-y-2">
                 {currentMapping.map((m, idx) => (
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
          {!activeConfig.pdfData && !uploading ? (
            <div className="text-center text-gray-500">
              <Upload size={48} className="mx-auto mb-4 opacity-50" />
              <p>Upload a PDF Certificate Template for<br/><strong className="text-gray-400">{CERTIFICATE_TYPES.find(t => t.id === activeCertType)?.label}</strong></p>
            </div>
          ) : uploading && !activeConfig.pdfData ? (
            <div className="text-center text-gray-400">
              <div className="animate-spin w-12 h-12 border-4 border-[#E23744] border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>Uploading template...</p>
            </div>
          ) : pdfError ? (
            <div className="text-center text-red-400">
              <p>{pdfError}</p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Try uploading again
              </button>
            </div>
          ) : (
            <div 
              className="relative cursor-crosshair"
              onClick={handlePdfClick}
              style={{ display: 'inline-block' }}
            >
               <Document
                file={activeConfig.pdfData}
                onLoadSuccess={({ numPages: n }) => {
                  setNumPages(n);
                  setPdfError(null);
                }}
                onLoadError={(error) => {
                  console.error('PDF load error:', error);
                  setPdfError('Failed to render PDF. The file may be corrupted.');
                }}
                loading={<div className="animate-pulse text-white p-8">Loading PDF...</div>}
                error={<div className="text-red-500 p-8">Failed to load PDF preview.</div>}
              >
                <Page 
                  pageNumber={1} 
                  width={pageWidth > 0 ? Math.min(pageWidth - 48, 800) : 600} 
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
              
              {/* Markers Overlay */}
              {currentMapping.map((m) => (
                <div
                  key={m.fieldId}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap z-10 ${colors.bg}`}
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
                <div className={`absolute top-0 left-0 w-full h-full bg-[#E23744]/10 z-0 pointer-events-none border-2 border-[#E23744] border-dashed`}></div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Send Certificates Modal */}
      {sendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-lg border border-gray-700 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Mail size={22} />
              Send Certificates
            </h3>

            {/* Type Selector */}
            <div className="mb-4">
              <label className="text-sm text-gray-400 mb-2 block">Certificate Type</label>
              <div className="grid grid-cols-2 gap-2">
                {CERTIFICATE_TYPES.map(type => {
                  const Icon = type.icon;
                  const hasConfig = configs[type.id]?.templateUrl;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setSendingType(type.id)}
                      disabled={!hasConfig}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        sendingType === type.id
                          ? `${typeColorClasses[type.id].bg} text-white`
                          : hasConfig
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <Icon size={16} />
                      {type.label}
                      {!hasConfig && <span className="text-xs text-gray-600 ml-auto">No template</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Info message */}
            <div className="mb-4 text-sm text-gray-400 bg-gray-900 p-3 rounded-lg">
              {sendingType === 'participation' ? (
                <p>This will send participation certificates to <strong className="text-white">all checked-in attendees</strong>.</p>
              ) : (
                <p>Enter the email addresses of the prize recipients below.</p>
              )}
            </div>

            {/* Email input for prize certificates */}
            {['first_prize', 'second_prize', 'third_prize'].includes(sendingType) && (
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">Recipient Emails (comma or newline separated)</label>
                <textarea
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder={"winner@example.com\nrunnerup@example.com"}
                  value={sendEmails}
                  onChange={(e) => setSendEmails(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setSendModalOpen(false); setSendEmails(''); }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendCertificates}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Send size={16} />
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
