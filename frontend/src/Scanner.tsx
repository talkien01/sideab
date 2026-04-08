import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import * as storage from './storage';

export default function Scanner() {
  const [folioInput, setFolioInput] = useState('');
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<storage.Beneficiary | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerId = "qr-reader";

  // --- QR SCANNER LOGIC ---
  const handleFolioMatch = (folio: string) => {
    setErrorMessage('');
    const beneficiaries = storage.getBeneficiaries();
    const found = beneficiaries.find(b => b.folio === folio.toUpperCase().trim());

    if (!found) {
      setErrorMessage(`Folio ${folio} no encontrado en el padrón local.`);
      return;
    }

    if (found.approvalStatus !== 'APPROVED') {
      setErrorMessage('Este beneficiario no cuenta con aprobación vigente.');
      return;
    }

    if (found.deliveryStatus === 'DELIVERED') {
      setErrorMessage('Este beneficio ya ha sido entregado previamente.');
      return;
    }

    setSelectedBeneficiary(found);
    stopScanner();
  };

  const startScanner = async () => {
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerId);
      }
      const config = { fps: 10 };
      await scannerRef.current.start(
        { facingMode: "environment" }, 
        config, 
        (decodedText) => handleFolioMatch(decodedText),
        undefined 
      );
      setCameraError('');
    } catch (err: any) {
      console.error("Camera error:", err);
      setCameraError("No se pudo acceder a la cámara. Verifique los permisos.");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        console.warn("Stopping scanner failed", e);
      }
    }
  };

  // --- PHOTO CAPTURE LOGIC ---
  const startPhotoCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera for photo:", err);
    }
  };

  const stopPhotoCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedPhoto(dataUrl);
        stopPhotoCamera();
      }
    }
  };

  useEffect(() => {
    if (!selectedBeneficiary && !success) {
      startScanner();
    }
    return () => {
      stopScanner();
    };
  }, [selectedBeneficiary, success]);

  useEffect(() => {
    if (isCapturing && !capturedPhoto) {
      startPhotoCamera();
    }
    return () => stopPhotoCamera();
  }, [isCapturing, capturedPhoto]);

  // --- FINAL REGISTRATION ---
  const handleConfirmDelivery = () => {
    if (!selectedBeneficiary || !capturedPhoto || capturedPhoto.length < 100) {
      alert('Error: No se ha capturado una fotografía de evidencia válida.');
      return;
    }
    const user = storage.getUser();
    
    const newDelivery: storage.Delivery = {
      id: crypto.randomUUID(),
      beneficiaryFolio: selectedBeneficiary.folio,
      operatorId: user?.id || 'UNKNOWN',
      scannedAt: new Date().toISOString(),
      deviceId: navigator.userAgent,
      location: '0,0',
      evidencePhotoCloudUrl: capturedPhoto, // Store local dataUrl
      integrityHash: 'HASH_REAL_' + selectedBeneficiary.folio,
      synced: false
    };

    storage.savePendingDelivery(newDelivery);
    setCapturedPhoto(null);
    setIsCapturing(false);
    // After delivery, the UI will automatically show missingDocs if any
    if (missingDocs.length === 0) {
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setSelectedBeneficiary(null);
        setFolioInput('');
      }, 2000);
    }
  };

  // --- EXPEDIENTE CAPTURE LOGIC ---

  const [capturingDocId, setCapturingDocId] = useState<string | null>(null);
  const [capturingDocName, setCapturingDocName] = useState<string | null>(null);

  const getMissingDocs = (beneficiary: storage.Beneficiary) => {
    const programs = storage.getPrograms();
    const allDocs = storage.getDocuments();
    // Filter docs already on server for this beneficiary
    const myDocs = allDocs.filter(d => d.beneficiary_folio === beneficiary.folio);
    // Find the program
    const program = programs.find(p => p.name === beneficiary.programName);
    if (!program) return [];
    // Return doc types not yet present in myDocs
    return program.docTypes.filter(dt => !myDocs.some(md => md.doc_type_id === dt.id));
  };

  const missingDocs = selectedBeneficiary ? getMissingDocs(selectedBeneficiary) : [];

  const handleDocumentCapture = (dtId: string, dtName: string) => {
    setCapturingDocId(dtId);
    setCapturingDocName(dtName);
    setIsCapturing(true);
  };

  const handleConfirmDocument = () => {
    if (!selectedBeneficiary || !capturedPhoto || !capturingDocId) return;
    
    const newDoc: storage.PendingDocument = {
      id: crypto.randomUUID(),
      beneficiary_folio: selectedBeneficiary.folio,
      program_id: storage.getPrograms().find(p => p.name === selectedBeneficiary.programName)?.id || 'UNKNOWN',
      doc_type_id: capturingDocId,
      doc_type_name: capturingDocName || 'Documento',
      photoData: capturedPhoto
    };

    storage.savePendingDocument(newDoc);
    setCapturedPhoto(null);
    setIsCapturing(false);
    setCapturingDocId(null);
    setCapturingDocName(null);
    // UI will re-render and missingDocs will update
  };

  return (
    <div className="bg-surface font-body text-on-surface antialiased overflow-hidden min-h-screen">
      <header className="fixed top-0 w-full z-50 bg-[#000666] flex justify-between items-center px-4 h-16 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-white">security</span>
          <h1 className="font-['Public_Sans'] font-bold tracking-tight text-white text-lg tracking-widest uppercase">SIDEAB</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-blue-800 transition-colors scale-95 active:duration-150">
            <span className="material-symbols-outlined text-white">{navigator.onLine ? 'cloud_done' : 'cloud_off'}</span>
          </button>
        </div>
      </header>

      <main className="relative h-screen w-full flex items-center justify-center">
        {/* QR Scanner Container */}
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
          <div id={scannerId} className="w-full h-full min-w-full min-h-full object-cover"></div>
        </div>

        {/* Overlay UI: Scan Mode */}
        {!selectedBeneficiary && !success && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
            <div className="relative">
              <div 
                className="w-64 h-64 md:w-80 md:h-80 border-2 border-white/50 rounded-xl relative overflow-hidden" 
                style={{ boxShadow: '0 0 0 100vmax rgba(0, 0, 0, 0.4)' }}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-secondary shadow-[0_0_15px_#1b6d24] opacity-80" style={{ animation: 'scan 3s infinite ease-in-out' }}></div>
              </div>
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-secondary rounded-tl-lg"></div>
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-secondary rounded-tr-lg"></div>
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-secondary rounded-bl-lg"></div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-secondary rounded-br-lg"></div>
            </div>

            <div className="mt-8 px-6 py-4 bg-primary-container/90 backdrop-blur-md rounded-xl border border-white/20 w-80 shadow-2xl pointer-events-auto">
              <p className="text-white font-semibold text-xs text-center uppercase tracking-widest mb-3">
                {cameraError ? 'Modo Manual' : 'Escáner QR Activo'}
              </p>
              <div className="flex gap-2">
                <input 
                  type="text" value={folioInput} onChange={(e) => setFolioInput(e.target.value)}
                  placeholder="O ingrese folio manualmente"
                  className="w-full bg-white/10 border-none text-white p-2 rounded-lg text-sm placeholder:text-white/40 focus:ring-1 focus:ring-white"
                />
                <button onClick={() => handleFolioMatch(folioInput)} className="bg-secondary text-white p-2 rounded-lg hover:bg-secondary-container">
                  <span className="material-symbols-outlined">send</span>
                </button>
              </div>
              {(errorMessage || cameraError) && <p className="text-error-container text-[10px] mt-2 font-bold uppercase">{errorMessage || cameraError}</p>}
            </div>
          </div>
        )}

        {/* Modal: Beneficiary & Doc Capture Flow */}
        {selectedBeneficiary && !success && (
          <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-surface rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
              <div className="bg-primary p-4 text-white">
                <p className="text-[10px] uppercase font-bold tracking-widest opacity-70">Beneficiario Validado</p>
                <h2 className="text-xl font-black">{selectedBeneficiary.fullName}</h2>
              </div>
              
              <div className="p-6 space-y-4 overflow-y-auto">
                {/* 1. DELIVERY MODE */}
                {!isCapturing && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div><p className="text-on-surface-variant font-bold uppercase">Folio</p><p className="font-bold text-primary">{selectedBeneficiary.folio}</p></div>
                      <div><p className="text-on-surface-variant font-bold uppercase">Programa</p><p className="font-bold text-primary">{selectedBeneficiary.programName}</p></div>
                    </div>

                    <div className="border-t border-surface-variant pt-4">
                      {selectedBeneficiary.deliveryStatus === 'PENDING' ? (
                        <button onClick={() => setIsCapturing(true)} className="w-full bg-primary-container text-white py-4 rounded-xl flex items-center justify-center gap-2 font-bold uppercase tracking-widest">
                          <span className="material-symbols-outlined">photo_camera</span> Capturar Entrega
                        </button>
                      ) : (
                        <div className="bg-green-100 rounded-xl p-3 flex items-center gap-2 text-green-700 font-bold text-xs uppercase tracking-tighter">
                          <span className="material-symbols-outlined">check_circle</span> Entrega Registrada
                        </div>
                      )}
                    </div>

                    {/* 2. EXPEDIENTE CHECKLIST */}
                    {missingDocs.length > 0 && (
                      <div className="border-t border-surface-variant pt-4 space-y-3">
                        <p className="text-[10px] uppercase font-black tracking-widest text-[#cf5913]">Documentos Faltantes ({missingDocs.length})</p>
                        <div className="space-y-2">
                          {missingDocs.map(dt => (
                            <button key={dt.id} onClick={() => handleDocumentCapture(dt.id, dt.name)}
                              className="w-full bg-white border-2 border-dashed border-gray-300 rounded-xl p-3 flex items-center justify-between group hover:border-primary transition-colors text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-gray-400 group-hover:text-primary">upload_file</span>
                                <span className="text-xs font-bold text-gray-600">{dt.name}</span>
                              </div>
                              <span className="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 transition-opacity">photo_camera</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {missingDocs.length === 0 && selectedBeneficiary.deliveryStatus === 'DELIVERED' && (
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                         <span className="material-symbols-outlined text-blue-400">task_alt</span>
                         <p className="text-xs font-bold text-blue-600 mt-1 uppercase tracking-widest">Expediente Completo</p>
                         <button onClick={() => setSelectedBeneficiary(null)} className="mt-2 w-full bg-blue-600 text-white py-2 rounded-xl text-xs font-bold">TERMINAR</button>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. CAMERA INTERFACE */}
                {isCapturing && (
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-center text-primary uppercase">
                      Capturando: {capturingDocName || 'Evidencia de Entrega'}
                    </p>
                    <div className="aspect-square bg-black rounded-xl relative overflow-hidden flex items-center justify-center border-2 border-primary">
                      {capturedPhoto ? (
                        <img src={capturedPhoto} className="w-full h-full object-cover" alt="Capture" />
                      ) : (
                        <>
                          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                          <div className="absolute inset-0 border-2 border-white/20 m-6 rounded-lg pointer-events-none"></div>
                        </>
                      )}
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {capturedPhoto ? (
                      <div className="flex gap-2">
                        <button onClick={() => setCapturedPhoto(null)} className="flex-1 bg-surface-variant text-on-surface-variant py-3 rounded-xl font-bold uppercase text-xs">Reintentar</button>
                        <button onClick={capturingDocId ? handleConfirmDocument : handleConfirmDelivery} 
                          className="flex-[2] bg-secondary text-white py-3 rounded-xl font-bold uppercase text-xs flex items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-sm">check</span> {capturingDocId ? 'Guardar Documento' : 'Confirmar Entrega'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <button onClick={takePhoto} className="w-full bg-secondary text-white py-4 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                          <span className="material-symbols-outlined">camera</span> DISPARAR
                        </button>
                        <button onClick={() => { setIsCapturing(false); setCapturingDocId(null); setCapturedPhoto(null); }} 
                          className="w-full text-xs font-bold text-outline text-center uppercase py-2">Cancelar</button>
                      </div>
                    )}
                  </div>
                )}
                
                {!isCapturing && <button onClick={() => { setSelectedBeneficiary(null); }} className="w-full text-center text-[10px] font-bold text-outline uppercase py-4 border-t border-gray-100 mt-4">Cerrar</button>}
              </div>
            </div>
          </div>
        )}

        {/* Success Feedback */}
        {success && (
          <div className="absolute inset-0 z-40 bg-secondary flex flex-col items-center justify-center text-white p-6 text-center animate-fade-in">
            <span className="material-symbols-outlined text-8xl mb-4 animate-bounce">verified_user</span>
            <h2 className="text-3xl font-black uppercase tracking-tighter">Entrega Registrada</h2>
            <p className="font-bold opacity-80 mt-2">La información se sincronizará automáticamente al detectar conexión.</p>
          </div>
        )}
      </main>

      <style>{`
        @keyframes scan { 0%, 100% { top: 0%; } 50% { top: 100%; } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        #qr-reader { border: none !important; background: black !important; width: 100% !important; height: 100% !important; display: flex !important; align-items: center !important; justify-content: center !important; }
        #qr-reader video { width: 100vw !important; height: 100vh !important; object-fit: cover !important; }
        #qr-reader__scan_region { width: 100% !important; height: 100% !important; }
        #qr-reader img, #qr-reader__dashboard { display: none !important; }
      `}</style>
    </div>
  );
}
