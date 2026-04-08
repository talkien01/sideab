import { useState, useEffect } from 'react';
import * as storage from './storage';
import * as api from './api';

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [beneficiaries, setBeneficiaries] = useState<storage.Beneficiary[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<storage.Delivery[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setBeneficiaries(storage.getBeneficiaries());
    setPendingDeliveries(storage.getPendingDeliveries());
  };

  const handleSync = async () => {
    if (pendingDeliveries.length === 0) {
      alert('No hay registros pendientes para sincronizar.');
      return;
    }

    setSyncing(true);
    setProgress(10);
    try {
      const token = storage.getToken();
      if (!token) throw new Error('No hay sesión activa');

      // Filter: only sync records WITH photos
      const validDeliveries = pendingDeliveries.filter(d => 
        d.evidencePhotoCloudUrl && (d.evidencePhotoCloudUrl.startsWith('data:') || d.evidencePhotoCloudUrl.startsWith('http'))
      );

      if (validDeliveries.length === 0) {
        alert('No hay registros con fotografía válida para sincronizar. Por favor, captura la evidencia primero.');
        setSyncing(false);
        return;
      }

      if (validDeliveries.length < pendingDeliveries.length) {
        if (!confirm(`Se detectaron ${pendingDeliveries.length - validDeliveries.length} registros sin fotografía. Solo se sincronizarán los registros completos. ¿Continuar?`)) {
          setSyncing(false);
          return;
        }
      }

      // Logic for pushing batch
      setProgress(40);
      
      const deliveriesToPush = [];
      const totalToSync = validDeliveries.length;
      const syncedIds: string[] = [];
      
      for (let i = 0; i < totalToSync; i++) {
        const delivery = validDeliveries[i];
        
        // If there is a local photo (base64/dataURL), upload it first
        if (delivery.evidencePhotoCloudUrl && delivery.evidencePhotoCloudUrl.startsWith('data:')) {
          try {
            // Convert dataURL to File object for upload
            const res = await fetch(delivery.evidencePhotoCloudUrl);
            const blob = await res.blob();
            const file = new File([blob], `evidence-${delivery.beneficiaryFolio}.jpg`, { type: 'image/jpeg' });
            
            const uploadRes = await api.uploadPhoto(token, file);
            delivery.evidencePhotoCloudUrl = uploadRes.url; // Update with server URL
          } catch (e) {
            console.error("Failed to upload photo for", delivery.beneficiaryFolio, e);
            continue; // Skip this one if upload fails
          }
        }
        deliveriesToPush.push(delivery);
        syncedIds.push(delivery.id);
        setProgress(40 + Math.floor((i / totalToSync) * 30));
      }

      await api.pushDeliveries(token, deliveriesToPush);
      
      setProgress(85);
      // After push, pull fresh data to ensure status is updated from server
      const syncData = await api.pullBeneficiaries(token);
      storage.saveBeneficiaries(syncData.beneficiaries);
      
      // IMPORTANT: Only clear the ones that were synced
      storage.removeDeliveriesByIds(syncedIds);
      
      setProgress(100);
      setTimeout(() => {
        setSyncing(false);
        setProgress(0);
        loadData();
      }, 500);
    } catch (err: any) {
      alert(`Error al sincronizar: ${err.message}`);
      setSyncing(false);
      setProgress(0);
    }
  };

  const totalToday = beneficiaries.filter(b => b.deliveryStatus === 'DELIVERED').length;
  const pendingCount = pendingDeliveries.length;

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-24">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-[#000666] shadow-lg flex justify-between items-center px-4 h-16">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
          <span className="text-lg font-black text-white tracking-widest uppercase font-['Public_Sans']">SIDEAB</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onLogout} className="text-white text-xs font-bold uppercase tracking-widest hover:underline">Salir</button>
          <span className="material-symbols-outlined text-blue-200">cloud_off</span>
        </div>
      </header>

      <main className="mt-20 px-4 max-w-4xl mx-auto space-y-6">
        {/* Sync Toast */}
        {pendingCount > 0 && !syncing && (
          <div className="fixed bottom-24 inset-x-0 mx-auto z-40 w-fit bg-primary-container/90 backdrop-blur-xl border border-white/10 px-8 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce">
            <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_12px_#88d982]"></div>
            <span className="text-white text-xs font-bold tracking-widest uppercase">Listo para sincronizar {pendingCount} elementos</span>
          </div>
        )}

        {/* Hero Sync Section */}
        <section className="bg-surface-container-low rounded-xl p-6 relative overflow-hidden mt-8">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold text-primary tracking-tight">Estatus Operativo</h1>
              <p className="text-on-surface-variant font-medium">Estado de conexión: <span className={navigator.onLine ? "text-secondary font-bold" : "text-error font-bold"}>{navigator.onLine ? "En Línea" : "Modo Local"}</span></p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button 
                disabled={syncing || pendingCount === 0}
                onClick={handleSync}
                className="bg-gradient-to-b from-primary to-primary-container text-white font-bold py-3 px-8 rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <span className={`material-symbols-outlined ${syncing ? 'animate-spin' : ''}`}>sync</span>
                {syncing ? 'Sincronizando...' : 'Sincronizar Datos'}
              </button>
              <p className="text-label text-xs font-bold uppercase tracking-widest text-[#343d96]">{pendingCount} registros pendientes</p>
            </div>
          </div>
          
          {(syncing || progress > 0) && (
            <div className="mt-6">
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm font-bold text-primary">Progreso de Carga</span>
                <span className="text-sm font-bold text-primary">{progress}%</span>
              </div>
              <div className="h-3 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-secondary transition-all duration-300 rounded-full shadow-[0_0_8px_rgba(27,109,36,0.4)]" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}
        </section>

        {/* Summary Bento Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface-container-highest p-5 rounded-xl flex flex-col justify-between h-32 border-l-4 border-primary">
            <span className="text-xs font-bold uppercase tracking-tighter text-on-surface-variant">Entregas Realizadas</span>
            <span className="text-4xl font-black text-primary">{totalToday}</span>
          </div>
          <div className="bg-surface-container-highest p-5 rounded-xl flex flex-col justify-between h-32 border-l-4 border-[#380b00]">
            <span className="text-xs font-bold uppercase tracking-tighter text-on-surface-variant">Pendiente Sincronización</span>
            <span className="text-4xl font-black text-[#380b00]">{pendingCount}</span>
          </div>
        </section>

        {/* History Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center border-b border-outline-variant/15 pb-2">
            <h2 className="text-xl font-bold text-primary tracking-tight">Registros de Beneficiarios</h2>
            <span className="text-xs font-semibold text-on-surface-variant bg-surface-container-low px-3 py-1 rounded-full uppercase tracking-widest">Padrón Local</span>
          </div>

          <div className="space-y-3">
            {beneficiaries.map((b) => (
              <div key={b.folio} className="bg-[#ffffff] p-4 rounded-xl flex items-center justify-between group hover:bg-surface-container-low transition-colors duration-200 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden ${b.deliveryStatus === 'DELIVERED' ? 'bg-secondary/10' : 'bg-surface-container'}`}>
                    {b.photoUrl ? (
                      <img src={b.photoUrl.startsWith('/') ? `http://10.29.128.94:3001${b.photoUrl}` : b.photoUrl} className="w-full h-full object-cover" alt="Thumbnail" />
                    ) : (
                      <span className={`material-symbols-outlined ${b.deliveryStatus === 'DELIVERED' ? 'text-secondary' : 'text-outline'}`}>
                        {b.deliveryStatus === 'DELIVERED' ? 'check_circle' : 'person'}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-on-surface leading-tight">{b.fullName}</p>
                    <p className="text-xs text-on-surface-variant font-medium">{b.folio} • {b.programName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                    b.deliveryStatus === 'DELIVERED' ? 'text-[#217128] bg-[#a0f399]' : 'text-outline-variant bg-surface-container'
                  }`}>
                    {b.deliveryStatus === 'DELIVERED' ? 'Entregado' : 'Pendiente'}
                  </span>
                  
                  {b.deliveryStatus === 'DELIVERED' && (
                    <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { if(confirm(`¿Desea editar la entrega de ${b.folio}? Se borrará la foto actual.`)) { storage.removeDelivery(b.folio); loadData(); } }}
                        className="p-1.5 hover:bg-primary/10 text-primary rounded-lg transition-colors"
                        title="Editar entrega"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button 
                        onClick={() => { if(confirm(`¿Desea ELIMINAR el registro de ${b.folio}?`)) { storage.removeDelivery(b.folio); loadData(); } }}
                        className="p-1.5 hover:bg-error/10 text-error rounded-lg transition-colors"
                        title="Borrar registro"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
