import { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, XCircle, Loader } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import jsQR from 'jsqr';

export default function ScannerPage() {
  const [scanning, setScanning] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [scanningActive, setScanningActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const lastScanRef = useRef(0);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
      console.log('Requesting camera access...');
      setScanning(true);
      setVerificationResult(null);
      setVideoReady(false);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      console.log('Camera access granted, stream:', stream);
      console.log('Video tracks:', stream.getVideoTracks());

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Wait for metadata to load
        videoRef.current.onloadedmetadata = async () => {
          console.log('Video metadata loaded');
          console.log('Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
          
          try {
            await videoRef.current.play();
            console.log('Video playing successfully');
            setVideoReady(true);
            
            // Start scanning after a short delay
            setTimeout(() => {
              setScanningActive(true);
              scanIntervalRef.current = setInterval(() => {
                scanQRCode();
              }, 100); // Scan every 100ms for faster detection
            }, 500);
          } catch (playError) {
            console.error('Video play error:', playError);
          }
        };

        videoRef.current.onerror = (e) => {
          console.error('Video element error:', e);
        };
      }
    } catch (error) {
      console.error('Camera access error:', error);
      toast.error('Failed to access camera. Please allow camera permissions.');
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
    setVideoReady(false);
    setScanningActive(false);
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || loading || !videoReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
      // Throttle to prevent duplicate scans
      const now = Date.now();
      if (now - lastScanRef.current < 1000) return; // Minimum 1 second between scans
      
      // Set canvas size to match video
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      
      const context = canvas.getContext('2d', { willReadFrequently: true });
      
      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get image data
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Scan for QR code with more permissive settings
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });

      if (code && code.data) {
        lastScanRef.current = now;
        console.log('QR Code detected:', code.data);
        setScanningActive(false);
        verifyTicket(code.data);
      }
    }
  };

  const verifyTicket = async (qrData) => {
    if (loading) return;
    
    setLoading(true);
    stopScanning();

    try {
      const response = await api.post('/tickets/verify', {
        qrPayload: qrData
      });

      setVerificationResult({
        valid: true,
        alreadyScanned: false,
        ...response.data
      });

      toast.success('Valid ticket! Attendee checked in.');
    } catch (error) {
      const errorData = error.response?.data;
      
      setVerificationResult({
        valid: false,
        alreadyScanned: errorData?.alreadyScanned || false,
        error: errorData?.error || 'Invalid ticket',
        scannedAt: errorData?.scannedAt,
        attendee: errorData?.attendee
      });

      if (errorData?.alreadyScanned) {
        toast.error('This ticket was already scanned!');
      } else {
        toast.error(errorData?.error || 'Invalid ticket');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntry = async () => {
    const qrData = prompt('Enter QR code data manually:');
    if (qrData) {
      verifyTicket(qrData);
    }
  };

  const resetScanner = () => {
    setVerificationResult(null);
    startScanning();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Ticket Scanner</h1>
          <p className="text-gray-400 text-sm">Scan attendee tickets for check-in</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Camera View */}
        {!verificationResult && (
          <div className="bg-gray-800 rounded-xl overflow-hidden mb-6">
            <div className="relative aspect-video bg-gray-900">
              {scanning ? (
                <div className="w-full h-full relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover bg-black"
                    style={{ display: 'block' }}
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  {/* Loading state */}
                  {!videoReady && (
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                      <div className="text-center">
                        <Loader className="animate-spin text-primary-500 mx-auto mb-2" size={48} />
                        <p className="text-white">Initializing camera...</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Scanning overlay */}
                  {videoReady && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className={`border-4 rounded-lg w-64 h-64 relative transition-colors ${
                        scanningActive ? 'border-primary-500 animate-pulse' : 'border-gray-500'
                      }`}>
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <p className={`text-white text-sm px-3 py-1 rounded ${
                            scanningActive ? 'bg-primary-500 bg-opacity-70' : 'bg-black bg-opacity-50'
                          }`}>
                            {scanningActive ? '🔍 Scanning...' : 'Position QR code in frame'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {loading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <Loader className="animate-spin text-white" size={48} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Camera size={64} className="text-gray-500" />
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-6 space-y-4">
              {!scanning ? (
                <button
                  onClick={startScanning}
                  className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <Camera size={24} />
                  <span>Start Scanning</span>
                </button>
              ) : (
                <button
                  onClick={stopScanning}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors"
                >
                  Stop Scanning
                </button>
              )}

              <button
                onClick={handleManualEntry}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Manual Entry
              </button>
            </div>
          </div>
        )}

        {/* Verification Result */}
        {verificationResult && (
          <div className={`rounded-xl p-8 mb-6 ${
            verificationResult.valid 
              ? 'bg-green-900 border-2 border-green-500' 
              : verificationResult.alreadyScanned
              ? 'bg-yellow-900 border-2 border-yellow-500'
              : 'bg-red-900 border-2 border-red-500'
          }`}>
            <div className="flex flex-col items-center text-center">
              {verificationResult.valid ? (
                <>
                  <CheckCircle size={80} className="text-green-400 mb-4" />
                  <h2 className="text-3xl font-bold mb-2">Valid Ticket!</h2>
                  <p className="text-green-200 mb-6">Attendee checked in successfully</p>
                </>
              ) : verificationResult.alreadyScanned ? (
                <>
                  <XCircle size={80} className="text-yellow-400 mb-4" />
                  <h2 className="text-3xl font-bold mb-2">Already Checked In</h2>
                  <p className="text-yellow-200 mb-6">This ticket was already scanned</p>
                  {verificationResult.scannedAt && (
                    <p className="text-yellow-300 text-sm mb-4">
                      Scanned at: {new Date(verificationResult.scannedAt).toLocaleString()}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <XCircle size={80} className="text-red-400 mb-4" />
                  <h2 className="text-3xl font-bold mb-2">Invalid Ticket</h2>
                  <p className="text-red-200 mb-6">{verificationResult.error}</p>
                </>
              )}

              {(verificationResult.ticket?.attendee || verificationResult.attendee) && (
                <div className="bg-gray-800 rounded-lg p-6 w-full text-left space-y-3">
                  <h3 className="font-semibold text-xl mb-4">Attendee Details</h3>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between border-b border-gray-700 pb-2">
                      <span className="text-gray-400">Name:</span>
                      <span className="font-medium">
                        {(verificationResult.ticket?.attendee || verificationResult.attendee).name || 'N/A'}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-gray-700 pb-2">
                      <span className="text-gray-400">Email:</span>
                      <span className="font-medium">
                        {(verificationResult.ticket?.attendee || verificationResult.attendee).email || 'N/A'}
                      </span>
                    </div>

                    {verificationResult.ticket?.event && (
                      <>
                        <div className="flex justify-between border-b border-gray-700 pb-2">
                          <span className="text-gray-400">Event:</span>
                          <span className="font-medium">
                            {verificationResult.ticket.event.title}
                          </span>
                        </div>

                        <div className="flex justify-between border-b border-gray-700 pb-2">
                          <span className="text-gray-400">Location:</span>
                          <span className="font-medium">
                            {verificationResult.ticket.event.location}
                          </span>
                        </div>
                      </>
                    )}

                    {verificationResult.ticket?.id && (
                      <div className="flex justify-between border-b border-gray-700 pb-2">
                        <span className="text-gray-400">Ticket ID:</span>
                        <span className="font-medium text-xs">
                          {verificationResult.ticket.id.substring(0, 8).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={resetScanner}
                className="mt-6 bg-white text-gray-900 font-semibold py-3 px-8 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Scan Next Ticket
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="font-semibold text-lg mb-4">Instructions</h3>
          <ul className="space-y-2 text-gray-300">
            <li>• Click "Start Scanning" to activate camera</li>
            <li>• Point camera at QR code on ticket</li>
            <li>• Wait for automatic verification</li>
            <li>• Green result = Valid ticket (allow entry)</li>
            <li>• Red result = Invalid ticket (deny entry)</li>
            <li>• Use "Manual Entry" if camera is not available</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
