import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Upload, Save, Type, Calendar, Trash2, Eye, Award, Trophy, Medal, Users, Send, Mail, Check, AlertTriangle, X } from 'lucide-react';
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

export default function CertificateDesigner({ eventId, initialConfig, onSave }) {
  // Active certificate type tab
  const [activeCertType, setActiveCertType] = useState('participation');
  
  // Per-type state: { [certType]: { pdfData, templateUrl, mapping } }
  const [configs, setConfigs] = useState({});
  
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pageWidth, setPageWidth] = useState(0);
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
      let fetchUrl = url;
      
      // For Cloudinary URLs, use the backend proxy to avoid 401 on raw file delivery
      if (url && (url.includes('cloudinary.com') || url.startsWith('r2://'))) {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        fetchUrl = `${apiUrl}/admin/events/${eventId}/certificates/template?type=${certType}`;
      } else if (url && !url.startsWith('http') && !url.startsWith('data:')) {
        // For local URLs, use the API base
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const baseUrl = apiUrl.replace(/\/api$/, '');
        fetchUrl = `${baseUrl}${url}`;
      }

      // Use api instance for proxy endpoint (includes auth headers), plain fetch for others
      let blob;
      if (fetchUrl.includes('/certificates/template')) {
        const response = await api.get(fetchUrl.replace(/^.*\/api/, ''), { responseType: 'blob' });
        blob = new Blob([response.data], { type: 'application/pdf' });
      } else {
        const response = await fetch(fetchUrl, { mode: 'cors' });
        if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`);
        blob = await response.blob();
      }
      
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
      
      if (!fullUrl) {
        console.error('Upload succeeded but no URL returned. Response:', res.data);
        toast.error('Upload succeeded but server returned no URL. Try re-uploading.');
        // Keep the local preview (pdfData) so the user can still test via data URL
        return;
      }
      
      updateActiveConfig({ templateUrl: fullUrl });
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
      
      // Check if we got a JSON error response disguised as blob
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || 'Server returned an error');
      }
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      toast.success('Test certificate generated!', { id: 'test-cert' });
    } catch (error) {
      console.error('Test certificate error:', error);
      // Handle blob error responses from axios
      let errorMessage = 'Failed to generate test certificate';
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // Could not parse error blob
        }
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      console.error('Test certificate error detail:', errorMessage);
      toast.error(errorMessage, { id: 'test-cert' });
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
    <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-2">
            <Award className="text-blue-400" size={24} />
            Certificate Studio
          </h2>
          <p className="text-gray-400 text-sm mt-1">Design and distribute beautiful certificates</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Send Certificates Button */}
          <button
            onClick={() => { setSendingType(activeCertType); setSendModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl transition-all shadow-lg shadow-emerald-500/20 font-medium text-sm"
          >
            <Send size={16} />
            <span>Distribute</span>
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl cursor-pointer transition-all font-medium text-sm">
            <Upload size={16} />
            <span>{uploading ? 'Uploading...' : 'Upload Template'}</span>
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium text-sm ${
              (activeConfig.templateUrl || activeConfig.pdfData) && currentMapping.length > 0
                ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-white' 
                : 'bg-white/5 border border-white/5 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Eye size={16} />
            <span>Preview</span>
          </button>
          <button 
            onClick={handleSave}
            disabled={!activeConfig.pdfData || currentMapping.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium text-sm shadow-lg ${
              activeConfig.pdfData && currentMapping.length > 0 
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white shadow-blue-500/25' 
                : 'bg-white/5 border border-white/5 text-gray-500 cursor-not-allowed shadow-none'
            }`}
          >
            <Save size={16} />
            <span>Save Design</span>
          </button>
        </div>
      </div>

      {/* Certificate Type Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 bg-black/20 p-1.5 rounded-2xl border border-white/5">
        {CERTIFICATE_TYPES.map(type => {
          const isActive = activeCertType === type.id;
          const hasConfig = configs[type.id]?.templateUrl;
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => { setActiveCertType(type.id); setSelectedFieldId(null); setPdfError(null); }}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                isActive
                  ? `${typeColorClasses[type.id].bg} text-white shadow-lg scale-[1.02]`
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} className={isActive ? 'animate-pulse' : ''} />
              <span>{type.label}</span>
              {hasConfig && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1 shadow-[0_0_5px_rgba(52,211,153,0.5)]"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Type Description */}
      <div className={`mb-6 px-4 py-3 rounded-xl ${colors.bgLight} border ${colors.border} flex items-center gap-3`}>
        <div className={`p-2 rounded-lg ${colors.bg} bg-opacity-20`}>
          {React.createElement(CERTIFICATE_TYPES.find(t => t.id === activeCertType)?.icon || Award, { size: 20, className: colors.text })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Controls */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">1</div>
              <h3 className="text-sm font-semibold text-gray-200">Select Field</h3>
            </div>
            <div className="space-y-2">
              {AVAILABLE_FIELDS.map(field => {
                const isPlaced = currentMapping.some(m => m.fieldId === field.id);
                const isSelected = selectedFieldId === field.id;
                
                return (
                  <button
                    key={field.id}
                    onClick={() => setSelectedFieldId(field.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-200 group ${
                      isSelected 
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.15)] scale-[1.02]' 
                        : isPlaced
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <field.icon size={16} className={isSelected ? 'text-blue-400' : isPlaced ? 'text-emerald-400' : 'text-gray-500 group-hover:text-gray-300'} />
                      <span className="text-sm font-medium">{field.label}</span>
                    </div>
                    {isPlaced && <Check size={14} className="text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold">2</div>
              <h3 className="text-sm font-semibold text-gray-200">Place on PDF</h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed pl-8">
              Click anywhere on the certificate preview to place the selected field.
            </p>
          </div>

          {currentMapping.length > 0 && (
            <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
               <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Placed Fields</h3>
               <ul className="space-y-2">
                 {currentMapping.map((m, idx) => (
                   <li key={idx} className="flex justify-between items-center text-sm bg-white/5 border border-white/5 p-2.5 rounded-xl group">
                     <span className="text-gray-300 flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                       {getFieldName(m.fieldId)}
                     </span>
                     <button onClick={() => removeField(m.fieldId)} className="text-gray-500 hover:text-red-400 hover:bg-red-400/10 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                       <Trash2 size={14} />
                     </button>
                   </li>
                 ))}
               </ul>
            </div>
          )}
        </div>

        {/* PDF Preview Area */}
        <div className="lg:col-span-3 bg-black/40 rounded-2xl border border-white/10 min-h-[400px] flex items-center justify-center relative overflow-hidden group" ref={containerRef}>
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50"></div>
          
          {!activeConfig.pdfData && !uploading ? (
            <div className="text-center z-10 p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm max-w-sm w-full mx-4 transition-transform group-hover:scale-105">
              <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3 group-hover:rotate-6 transition-transform">
                <Upload size={32} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Upload Template</h3>
              <p className="text-sm text-gray-400 mb-6">Upload a PDF template for <strong className="text-gray-200">{CERTIFICATE_TYPES.find(t => t.id === activeCertType)?.label}</strong></p>
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors">
                Browse Files
              </button>
            </div>
          ) : uploading && !activeConfig.pdfData ? (
            <div className="text-center z-10">
              <div className="relative w-16 h-16 mx-auto mb-4">
                <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="text-blue-400 font-medium animate-pulse">Processing template...</p>
            </div>
          ) : pdfError ? (
            <div className="text-center z-10 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl max-w-sm mx-4">
              <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle size={24} />
              </div>
              <p className="text-red-300 mb-4">{pdfError}</p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition-colors text-sm font-medium"
              >
                Try uploading again
              </button>
            </div>
          ) : (
            <div 
              className="relative cursor-crosshair z-10 shadow-2xl shadow-black/50 rounded-lg overflow-hidden transition-transform duration-500 hover:scale-[1.01]"
              onClick={handlePdfClick}
              style={{ display: 'inline-block' }}
            >
               <Document
                file={activeConfig.pdfData}
                onLoadSuccess={() => {
                  setPdfError(null);
                }}
                onLoadError={(error) => {
                  console.error('PDF load error:', error);
                  setPdfError('Failed to render PDF. The file may be corrupted.');
                }}
                loading={
                  <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                    <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3"></div>
                    <span className="text-sm">Rendering PDF...</span>
                  </div>
                }
                error={<div className="text-red-400 p-8 bg-red-500/10 rounded-lg">Failed to load PDF preview.</div>}
              >
                <Page 
                  pageNumber={1} 
                  width={pageWidth > 0 ? Math.min(pageWidth - 48, 800) : 600} 
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="bg-white"
                />
              </Document>
              
              {/* Markers Overlay */}
              {currentMapping.map((m) => (
                <div
                  key={m.fieldId}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-xl pointer-events-none whitespace-nowrap z-10 flex items-center gap-1.5 backdrop-blur-md border border-white/20 ${colors.bg} bg-opacity-90`}
                  style={{
                    left: `${m.x * 100}%`,
                    top: `${m.y * 100}%`,
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                  <span className="font-medium tracking-wide">{getFieldName(m.fieldId)}</span>
                  {/* Pointer triangle */}
                  <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${colors.bg}`}></div>
                </div>
              ))}
              
              {/* Ghost Marker for current selection */}
              {selectedFieldId && (
                <div className="absolute inset-0 bg-blue-500/5 z-0 pointer-events-none border-2 border-blue-500/30 border-dashed">
                  <div className="absolute top-4 left-4 bg-blue-500/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-white animate-ping"></div>
                    Click anywhere to place <strong>{getFieldName(selectedFieldId)}</strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Send Certificates Modal */}
      {sendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-gray-900 rounded-3xl p-6 w-full max-w-lg border border-white/10 shadow-2xl transform transition-all">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                  <Mail size={20} />
                </div>
                Distribute Certificates
              </h3>
              <button onClick={() => { setSendModalOpen(false); setSendEmails(''); }} className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-xl">
                <X size={20} />
              </button>
            </div>

            {/* Type Selector */}
            <div className="mb-6">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Select Type to Send</label>
              <div className="grid grid-cols-2 gap-3">
                {CERTIFICATE_TYPES.map(type => {
                  const Icon = type.icon;
                  const hasConfig = configs[type.id]?.templateUrl;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setSendingType(type.id)}
                      disabled={!hasConfig}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl text-sm font-medium transition-all border ${
                        sendingType === type.id
                          ? `${typeColorClasses[type.id].bg} border-transparent text-white shadow-lg scale-[1.02]`
                          : hasConfig
                          ? 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                          : 'bg-black/20 border-white/5 text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      <Icon size={24} className={sendingType === type.id ? 'text-white' : hasConfig ? 'text-gray-400' : 'text-gray-600'} />
                      <span>{type.label}</span>
                      {!hasConfig && <span className="text-[10px] text-red-400/70 bg-red-400/10 px-2 py-0.5 rounded-full mt-1">No template</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Info message */}
            <div className="mb-6 text-sm text-gray-300 bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex gap-3 items-start">
              <div className="mt-0.5 text-blue-400"><Users size={16} /></div>
              <div>
                {sendingType === 'participation' ? (
                  <p>This will automatically generate and email participation certificates to <strong className="text-white">all checked-in attendees</strong>.</p>
                ) : (
                  <p>Enter the email addresses of the prize recipients below. They will receive the <strong className="text-white">{CERTIFICATE_TYPES.find(t => t.id === sendingType)?.label}</strong> certificate.</p>
                )}
              </div>
            </div>

            {/* Email input for prize certificates */}
            {['first_prize', 'second_prize', 'third_prize'].includes(sendingType) && (
              <div className="mb-6">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Recipient Emails</label>
                <textarea
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none"
                  rows={4}
                  placeholder={"winner@example.com\nrunnerup@example.com"}
                  value={sendEmails}
                  onChange={(e) => setSendEmails(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-2 pl-1">Separate multiple emails with commas or new lines.</p>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2 border-t border-white/5">
              <button
                onClick={() => { setSendModalOpen(false); setSendEmails(''); }}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSendCertificates}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 font-medium text-sm"
              >
                <Send size={16} />
                Send Certificates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
