import { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, XCircle, Loader, QrCode } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

export default function ScannerPage() {
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    setVerificationResult(null);
    setScannerActive(true);

    // Wait for DOM to update
    setTimeout(() => {
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      html5QrCodeRef.current = new Html5Qrcode("qr-reader");

      html5QrCodeRef.current.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          console.log('QR Code detected:', decodedText);
          stopScanner();
          verifyTicket(decodedText);
        },
        (errorMessage) => {
          // Ignore errors - they're just "no QR found" messages
        }
      ).catch((err) => {
        console.error('Error starting scanner:', err);
        // Try with user-facing camera if environment fails
        html5QrCodeRef.current.start(
          { facingMode: "user" },
          config,
          (decodedText) => {
            console.log('QR Code detected:', decodedText);
            stopScanner();
            verifyTicket(decodedText);
          },
          (errorMessage) => { }
        ).catch((err2) => {
          console.error('Error with both cameras:', err2);
          toast.error('Could not access camera. Please use Manual Entry.');
          setScannerActive(false);
        });
      });
    }, 100);
  };

  const stopScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().then(() => {
        html5QrCodeRef.current.clear();
      }).catch(() => { });
    }
    setScannerActive(false);
  };

  const verifyTicket = async (qrData) => {
    if (loading) return;

    setLoading(true);

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
        error: errorData?.error || 'Invalid ticket or server error',
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
    const qrData = prompt('Paste the QR code data (JSON from ticket):');
    if (qrData && qrData.trim()) {
      verifyTicket(qrData.trim());
    }
  };

  const resetScanner = () => {
    setVerificationResult(null);
    startScanner();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="text-primary-400" />
            Ticket Scanner
          </h1>
          <p className="text-gray-400 text-sm">Scan attendee tickets for check-in</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Camera View */}
        {!verificationResult && (
          <div className="bg-gray-800 rounded-xl overflow-hidden mb-6">
            <div className="relative bg-gray-900 min-h-[300px]">
              {scannerActive ? (
                <div id="qr-reader" className="w-full"></div>
              ) : (
                <div className="w-full h-64 flex items-center justify-center">
                  <Camera size={64} className="text-gray-500" />
                </div>
              )}

              {loading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <Loader className="animate-spin text-white" size={48} />
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-6 space-y-4">
              {!scannerActive ? (
                <button
                  onClick={startScanner}
                  className="w-full bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <Camera size={24} />
                  <span>Start Camera Scanner</span>
                </button>
              ) : (
                <button
                  onClick={stopScanner}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors"
                >
                  Stop Scanning
                </button>
              )}

              <button
                onClick={handleManualEntry}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                📝 Manual Entry (Paste QR Data)
              </button>
            </div>
          </div>
        )}

        {/* Verification Result */}
        {verificationResult && (
          <div className={`rounded-xl p-8 mb-6 ${verificationResult.valid
              ? 'bg-green-900 border-2 border-green-500'
              : verificationResult.alreadyScanned
                ? 'bg-yellow-900 border-2 border-yellow-500'
                : 'bg-red-900 border-2 border-red-500'
            }`}>
            <div className="flex flex-col items-center text-center">
              {verificationResult.valid ? (
                <>
                  <CheckCircle size={80} className="text-green-400 mb-4" />
                  <h2 className="text-3xl font-bold mb-2">✅ Valid Ticket!</h2>
                  <p className="text-green-200 mb-6">Attendee checked in successfully</p>
                </>
              ) : verificationResult.alreadyScanned ? (
                <>
                  <XCircle size={80} className="text-yellow-400 mb-4" />
                  <h2 className="text-3xl font-bold mb-2">⚠️ Already Checked In</h2>
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
                  <h2 className="text-3xl font-bold mb-2">❌ Invalid Ticket</h2>
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
          <h3 className="font-semibold text-lg mb-4">📋 Instructions</h3>
          <ul className="space-y-2 text-gray-300">
            <li>• Click "Start Camera Scanner" to activate camera</li>
            <li>• Point camera at QR code on ticket</li>
            <li>• Wait for automatic detection and verification</li>
            <li>• <span className="text-green-400">Green</span> = Valid ticket (allow entry)</li>
            <li>• <span className="text-yellow-400">Yellow</span> = Already scanned (ask questions)</li>
            <li>• <span className="text-red-400">Red</span> = Invalid ticket (deny entry)</li>
            <li>• Use "Manual Entry" if camera doesn't work</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
