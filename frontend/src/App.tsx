import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import Scanner from './Scanner';
import AdminPanel from './AdminPanel';
import * as api from './api';
import * as storage from './storage';

function App() {
  const [operatorId, setOperatorId] = useState('');
  const [password, setPassword] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isAuthenticated, setIsAuthenticated] = useState(!!storage.getToken());
  const [activeTab, setActiveTab] = useState<'scanner' | 'history' | 'sync'>('history');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isOffline) {
        // Simple offline login check if user was already logged in once
        const storedUser = storage.getUser();
        if (storedUser && storedUser.id === operatorId) {
          setIsAuthenticated(true);
        } else {
          setError('Debe iniciar sesión en línea al menos una vez.');
        }
      } else {
        const data = await api.login(operatorId, password);
        storage.saveToken(data.token);
        storage.saveUser(data.user);
        
        // Initial sync
        const syncData = await api.pullBeneficiaries(data.token);
        storage.saveBeneficiaries(syncData.beneficiaries);
        
        setIsAuthenticated(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    storage.logout();
    setIsAuthenticated(false);
  };

  const user = storage.getUser();
  const isAdmin = user?.role === 'ADMIN';

  if (isAuthenticated) {
    if (isAdmin) {
      return <AdminPanel onLogout={handleLogout} />;
    }
    
    return (
      <div className="bg-surface text-on-surface min-h-screen pb-24">
        {activeTab === 'history' && <Dashboard onLogout={handleLogout} />}
        {activeTab === 'scanner' && <Scanner />}
        {activeTab === 'sync' && <Dashboard onLogout={handleLogout} />} 

        {/* Global BottomNavBar */}
        <nav className="fixed bottom-0 w-full z-50 border-t border-[#C6C5D4]/15 bg-[#FBF8FF] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] flex justify-around items-center h-20 pb-safe">
          <button 
            onClick={() => setActiveTab('scanner')} 
            className={`flex flex-col items-center justify-center transition-all duration-300 w-full h-full ${activeTab === 'scanner' ? 'text-[#1A237E] bg-primary/10' : 'text-[#5A5D6B] hover:bg-[#E2E1ED]'}`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'scanner' ? "'FILL' 1" : "'FILL' 0" }}>qr_code_scanner</span>
            <span className="font-['Inter'] text-[10px] font-semibold uppercase tracking-wider mt-1">Escanear</span>
          </button>

          <button 
            onClick={() => setActiveTab('history')} 
            className={`flex flex-col items-center justify-center transition-all duration-300 w-full h-full ${activeTab === 'history' ? 'text-[#1A237E] bg-primary/10' : 'text-[#5A5D6B] hover:bg-[#E2E1ED]'}`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'history' ? "'FILL' 1" : "'FILL' 0" }}>history</span>
            <span className="font-['Inter'] text-[10px] font-semibold uppercase tracking-wider mt-1">Historial</span>
          </button>

          <button 
            onClick={() => setActiveTab('sync')} 
            className="flex flex-col items-center justify-center bg-[#1A237E] text-white rounded-xl px-5 py-1.5 mx-2 w-full active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>sync</span>
            <span className="font-['Inter'] text-[10px] font-semibold uppercase tracking-wider mt-1">Sincronizar</span>
          </button>
        </nav>
      </div>
    );
  }

  return (
    <div className="bg-surface font-body text-on-surface selection:bg-primary-container selection:text-white min-h-screen flex flex-col">
      {/* Top Status Bar (Offline Indicator) */}
      {isOffline && (
        <div className="fixed top-0 left-0 w-full z-[100] flex justify-center p-4">
          <div className="glass-offline px-6 py-2 rounded-full flex items-center gap-3 shadow-lg border border-white/10">
            <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_off</span>
            <span className="text-white text-xs font-bold uppercase tracking-widest font-label">Modo sin Conexión</span>
          </div>
        </div>
      )}

      {/* Main Content Canvas */}
      <main className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Branding Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary mb-6 shadow-xl">
              <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
            </div>
            <h1 className="font-headline font-black text-3xl text-primary tracking-tight uppercase leading-none">Sistema de Entrega a Beneficiarios</h1>
            <p className="mt-3 text-on-surface-variant font-black tracking-widest uppercase text-xl">SIDEAB</p>
            <p className="mt-1 text-on-surface-variant font-medium tracking-wide uppercase text-xs">Portal de Operaciones de Campo</p>
          </div>

          {/* Login Container */}
          <div className="bg-surface-container-low rounded-xl overflow-hidden shadow-2xl relative">
            <div className="h-2 bg-gradient-to-r from-primary to-primary-container w-full"></div>
            
            <form onSubmit={handleLogin} className="p-8 space-y-6">
              {error && (
                <div className="bg-error-container text-on-error-container p-3 rounded-lg text-xs font-bold uppercase text-center">
                  {error}
                </div>
              )}
              <div className="space-y-4">
                <div className="group">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-tighter mb-2 ml-1" htmlFor="operator_id">ID de Operador</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 material-symbols-outlined text-outline text-xl group-focus-within:text-primary transition-colors">badge</span>
                    <input 
                      disabled={loading}
                      className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest border-none rounded-lg ring-0 focus:ring-2 focus:ring-primary text-on-surface font-semibold placeholder:text-outline/50 transition-all opacity-disabled" 
                      id="operator_id" 
                      placeholder="Ingrese su ID de sistema" 
                      type="text" 
                      value={operatorId}
                      onChange={(e) => setOperatorId(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="group">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-tighter mb-2 ml-1" htmlFor="password">Contraseña de Seguridad</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 material-symbols-outlined text-outline text-xl group-focus-within:text-primary transition-colors">lock</span>
                    <input 
                      disabled={loading}
                      className="w-full pl-12 pr-4 py-4 bg-surface-container-lowest border-none rounded-lg ring-0 focus:ring-2 focus:ring-primary text-on-surface font-semibold placeholder:text-outline/50 transition-all opacity-disabled" 
                      id="password" 
                      placeholder="••••••••" 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary-container text-white font-headline font-extrabold text-lg py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50" 
                  type="submit"
                >
                  <span>{loading ? 'INGRESANDO...' : 'INGRESAR'}</span>
                  {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
                </button>
              </div>

              <p className="text-[10px] text-on-surface-variant/70 text-center uppercase tracking-widest leading-relaxed font-label px-4">
                Solo personal autorizado. Todas las actividades son registradas y monitoreadas criptográficamente.
              </p>
            </form>
          </div>

          <div className="mt-8 flex justify-between items-center px-2">
            <a className="text-xs font-bold text-primary-container hover:underline tracking-tight uppercase" href="#">¿Olvidó sus Credenciales?</a>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-error' : 'bg-secondary'}`}></div>
              <span className="text-[10px] font-bold text-on-secondary-container uppercase tracking-widest">
                {isOffline ? 'Modo Local' : 'Red Verificada'}
              </span>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full bg-surface-container-highest/30 py-8 px-6 mt-auto z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 flex items-center justify-center bg-on-surface rounded-lg">
              <span className="material-symbols-outlined text-surface text-2xl">account_balance</span>
            </div>
            <div>
              <p className="font-headline font-extrabold text-sm text-on-surface tracking-tight uppercase leading-none">Secretaría de la Juventud</p>
              <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-[0.2em] mt-1">Poder Ejecutivo del Estado de Querétaro</p>
            </div>
          </div>
          <div className="flex flex-col items-center md:items-end gap-1">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">V.2.4.0-ESTABLE (ENCRIPTADO)</p>
            <div className="flex gap-4 mt-2">
              <span className="text-[9px] text-outline font-label uppercase tracking-tighter">Arquitectura: Edge-Core v4</span>
              <span className="text-[9px] text-outline font-label uppercase tracking-tighter">Región: Querétaro, MX</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
