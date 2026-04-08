import { useState, useEffect, useMemo } from 'react';
import * as api from './api';
import * as storage from './storage';
import { ProgramsPanel, ExpedienteDrawer } from './Phase8Components';

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

const COLORS = ['#000666', '#1b6d24', '#343d96', '#88d982', '#002159'];

export default function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [stats, setStats] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'deliveries' | 'import' | 'operators' | 'programs'>('dashboard');
  const [deliveriesSubView, setDeliveriesSubView] = useState<'padron' | 'entregas'>('entregas');
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [importing, setImporting] = useState(false);

  // Phase 8 state
  const [programs, setPrograms] = useState<any[]>([]);
  const [expediente, setExpediente] = useState<any | null>(null);
  const [expedienteLoading, setExpedienteLoading] = useState(false);

  // Filters for deliveries
  const [filterProgram, setFilterProgram] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Filters for padron
  const [padronSearch, setPadronSearch] = useState('');
  const [padronProgram, setPadronProgram] = useState('');
  const [padronStatus, setPadronStatus] = useState('');
  const [padronSort, setPadronSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'fullName', dir: 'asc' });

  // New operator form
  const [newUser, setNewUser] = useState({ id: '', name: '', password: '', role: 'OPERATOR' });
  const [userStatus, setUserStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = storage.getToken();
      if (!token) return;
      
      const [statsResult, deliveriesResult, usersResult, beneficiariesResult, programsResult] = await Promise.allSettled([
        api.getStats(token),
        api.getAdminDeliveries(token),
        api.getUsers(token),
        api.getAdminBeneficiaries(token),
        api.getPrograms(token),
      ]);
      
      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      if (deliveriesResult.status === 'fulfilled') setDeliveries(deliveriesResult.value);
      if (usersResult.status === 'fulfilled') setUsers(usersResult.value);
      if (beneficiariesResult.status === 'fulfilled') setBeneficiaries(beneficiariesResult.value);
      if (programsResult.status === 'fulfilled') setPrograms(programsResult.value);
    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter(d => {
      const matchProgram = !filterProgram || d.programName === filterProgram;
      const matchDate = !filterDate || d.scannedAt.startsWith(filterDate);
      const matchSearch = !filterSearch || 
        d.fullName?.toLowerCase().includes(filterSearch.toLowerCase()) ||
        d.beneficiaryFolio?.toLowerCase().includes(filterSearch.toLowerCase());
      return matchProgram && matchDate && matchSearch;
    });
  }, [deliveries, filterProgram, filterDate, filterSearch]);

  // Filtered + sorted padron
  const filteredPadron = useMemo(() => {
    let result = beneficiaries.filter(b => {
      const matchSearch = !padronSearch ||
        b.fullName?.toLowerCase().includes(padronSearch.toLowerCase()) ||
        b.folio?.toLowerCase().includes(padronSearch.toLowerCase());
      const matchProgram = !padronProgram || b.programName === padronProgram;
      const matchStatus = !padronStatus || b.deliveryStatus === padronStatus;
      return matchSearch && matchProgram && matchStatus;
    });
    result = [...result].sort((a, b) => {
      const va = (a[padronSort.field] || '').toString().toLowerCase();
      const vb = (b[padronSort.field] || '').toString().toLowerCase();
      return padronSort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return result;
  }, [beneficiaries, padronSearch, padronProgram, padronStatus, padronSort]);

  const toggleSort = (field: string) => {
    setPadronSort(prev => ({
      field,
      dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const uniquePrograms = useMemo(() => [...new Set(deliveries.map(d => d.programName))], [deliveries]);
  const allPrograms = useMemo(() => [...new Set(beneficiaries.map((b: any) => b.programName))], [beneficiaries]);

  const downloadCSVTemplate = (type: 'beneficiarios' | 'programas') => {
    let headers = '';
    let rows = '';
    let filename = '';

    if (type === 'beneficiarios') {
      headers = 'folio,fullName,age,address,phone,programName\n';
      rows = 'FOL-TEST-001,Juan Pérez,30,Calle Falsa 123,555-1234,General\n';
      filename = 'plantilla_beneficiarios.csv';
    } else {
      headers = 'name,institution,description\n';
      rows = 'Salud en tu Colonia,Secretaría de Salud,Atención médica domiciliaria\n';
      filename = 'plantilla_programas.csv';
    }

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'beneficiarios' | 'programas' = 'beneficiarios') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportStatus(null);
    const inputRef = event.target;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',');
      
      const data = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',');
        const obj: any = {};
        headers.forEach((header, i) => {
          obj[header.trim()] = values[i]?.trim();
        });
        return obj;
      });

      try {
        const token = storage.getToken();
        if (!token) throw new Error('No token provided');
        
        if (type === 'beneficiarios') {
          await api.importBeneficiaries(token, data);
          setImportStatus({ type: 'success', message: `¡Éxito! Se importaron ${data.length} beneficiarios.` });
        } else {
          await api.importPrograms(token, data);
          setImportStatus({ type: 'success', message: `¡Éxito! Se importaron ${data.length} programas de apoyo.` });
        }
        
        await fetchData();
        inputRef.value = '';
        setTimeout(() => setActiveTab('dashboard'), 2500);
      } catch (err: any) {
        setImportStatus({ type: 'error', message: 'Error al importar: ' + err.message });
      } finally {
        setImporting(false);
      }
    };
    reader.onerror = () => {
      setImportStatus({ type: 'error', message: 'Error al leer el archivo.' });
      setImporting(false);
    };
    reader.readAsText(file);
  };

  const handleExportExcel = () => {
    const token = storage.getToken();
    if (!token) return;
    // Open backend export URL — server returns Content-Disposition: attachment
    // which the browser downloads natively with the correct filename and extension
    window.open(`/api/admin/export?token=${encodeURIComponent(token)}`, '_blank');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserStatus(null);
    try {
      const token = storage.getToken();
      if (!token) return;
      await api.createUser(token, newUser);
      setUserStatus({ type: 'success', message: `Operador "${newUser.name}" creado exitosamente.` });
      setNewUser({ id: '', name: '', password: '', role: 'OPERATOR' });
      const usersData = await api.getUsers(token);
      setUsers(usersData);
    } catch (err: any) {
      setUserStatus({ type: 'error', message: err.message });
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar al operador "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      const token = storage.getToken();
      if (!token) return;
      await api.deleteUser(token, id);
      const usersData = await api.getUsers(token);
      setUsers(usersData);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const openExpediente = async (folio: string) => {
    setExpedienteLoading(true);
    try {
      const token = storage.getToken();
      if (!token) return;
      const data = await api.getExpediente(token, folio);
      setExpediente(data);
    } catch (e) {
      console.error(e);
    } finally {
      setExpedienteLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-surface flex-col gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Cargando datos...</p>
    </div>
  );

  return (
    <div className="bg-[#f4f4f8] text-on-surface min-h-screen pb-20">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#000666] shadow-lg flex justify-between items-center px-6 h-16">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-white text-3xl">admin_panel_settings</span>
          <span className="text-xl font-black text-white tracking-widest uppercase font-['Public_Sans']">SIDEAB ADMIN</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/10 p-1 rounded-xl gap-0.5">
            {(['dashboard', 'deliveries', 'programs', 'import', 'operators'] as const).map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)} 
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all uppercase tracking-widest ${activeTab === tab ? 'bg-white text-primary shadow-sm' : 'text-white/60 hover:text-white'}`}
              >
                {tab === 'dashboard' ? 'Resumen' : tab === 'deliveries' ? 'Mesa de Control' : tab === 'programs' ? 'Programas' : tab === 'import' ? 'Carga Masiva' : 'Operadores'}
              </button>
            ))}
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors pl-3 border-l border-white/20"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Salir
          </button>
        </div>
      </header>

      <main className="mt-24 px-6 max-w-7xl mx-auto">

        {/* ─────────────── DASHBOARD ─────────────── */}
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Total Beneficiarios', value: stats.totalBeneficiaries, color: 'text-primary' },
                { label: 'Entregas Realizadas', value: stats.deliveredCount, color: 'text-secondary' },
                { label: '% Avance Global', value: `${stats.totalBeneficiaries > 0 ? Math.round((stats.deliveredCount / stats.totalBeneficiaries) * 100) : 0}%`, color: 'text-[#343d96]' },
              ].map(card => (
                <div key={card.label} className="bg-white p-6 rounded-3xl shadow-sm border border-outline-variant/10">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">{card.label}</p>
                  <p className={`text-5xl font-black ${card.color}`}>{card.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-outline-variant/10 h-96">
                <h3 className="text-sm font-black uppercase tracking-widest mb-6 text-primary">Avance por Programa</h3>
                <ResponsiveContainer width="100%" height="80%">
                  <BarChart data={stats.byProgram} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} stroke="#f0f0f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="programName" type="category" width={150} tick={{ fontSize: 10, fontWeight: 700 }} />
                    <Tooltip cursor={{ fill: '#f8f9fa' }} />
                    <Bar dataKey="count" fill={COLORS[2]} radius={[0, 10, 10, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-outline-variant/10 h-96">
                <h3 className="text-sm font-black uppercase tracking-widest mb-6 text-primary">Distribución de Entrega</h3>
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Entregados', value: stats.deliveredCount },
                        { name: 'Pendientes', value: stats.totalBeneficiaries - stats.deliveredCount }
                      ]}
                      innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                    >
                      <Cell fill={COLORS[1]} />
                      <Cell fill="#e0e0e0" />
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" align="center" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────── MESA DE CONTROL ─────────────── */}
        {activeTab === 'deliveries' && (
          <div className="bg-white rounded-3xl shadow-sm border border-outline-variant/10 overflow-hidden animate-fade-in">
            
            {/* Sub-view toggle */}
            <div className="p-6 border-b border-outline-variant/10 flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-primary">Mesa de Control</h2>
                <div className="flex bg-[#f4f4f8] p-1 rounded-xl">
                  <button
                    onClick={() => setDeliveriesSubView('padron')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${deliveriesSubView === 'padron' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}
                  >
                    <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">groups</span> Padrón Completo</span>
                  </button>
                  <button
                    onClick={() => setDeliveriesSubView('entregas')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${deliveriesSubView === 'entregas' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}
                  >
                    <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sm">verified</span> Entregas Registradas</span>
                  </button>
                </div>
              </div>

              {/* Actions for current view */}
              {deliveriesSubView === 'entregas' && (
                <button onClick={handleExportExcel}
                  className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-primary-container transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">download</span> EXPORTAR EXCEL
                </button>
              )}
              {deliveriesSubView === 'padron' && (
                <button
                  onClick={() => {
                    const token = storage.getToken();
                    if (!token) return;
                    const p = new URLSearchParams({
                      token,
                      search: padronSearch,
                      program: padronProgram,
                      status: padronStatus,
                      sortBy: padronSort.field,
                      sortDir: padronSort.dir,
                    });
                    window.open(`/api/admin/export/padron?${p.toString()}`, '_blank');
                  }}
                  className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-primary-container transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">download</span> EXPORTAR PADRÓN ({filteredPadron.length})
                </button>
              )}
            </div>

            {/* ── PADRÓN VIEW ── */}
            {deliveriesSubView === 'padron' && (
              <>
                <div className="p-4 border-b border-outline-variant/10 flex flex-wrap gap-3 bg-[#f9f9fc]">
                  <input type="text" placeholder="Buscar nombre o folio..." value={padronSearch}
                    onChange={e => setPadronSearch(e.target.value)}
                    className="border border-outline-variant/20 rounded-xl px-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary w-52 bg-white"
                  />
                  <select value={padronProgram} onChange={e => setPadronProgram(e.target.value)}
                    className="border border-outline-variant/20 rounded-xl px-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  >
                    <option value="">Todos los programas</option>
                    {allPrograms.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select value={padronStatus} onChange={e => setPadronStatus(e.target.value)}
                    className="border border-outline-variant/20 rounded-xl px-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  >
                    <option value="">Todos los estatus</option>
                    <option value="PENDING">Pendientes</option>
                    <option value="DELIVERED">Entregados</option>
                  </select>
                  {(padronSearch || padronProgram || padronStatus) && (
                    <button onClick={() => { setPadronSearch(''); setPadronProgram(''); setPadronStatus(''); }}
                      className="text-xs font-bold text-error px-3 py-2 rounded-xl hover:bg-error/10 transition-colors"
                    >Limpiar</button>
                  )}
                  <span className="ml-auto text-[10px] font-bold text-on-surface-variant uppercase self-center tracking-widest">
                    {filteredPadron.length} beneficiarios {filteredPadron.length !== beneficiaries.length ? `(de ${beneficiaries.length})` : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-surface-container-low">
                      <tr>
                        {[
                          { label: 'Estatus', field: 'deliveryStatus' },
                          { label: 'Folio', field: 'folio' },
                          { label: 'Nombre Completo', field: 'fullName' },
                          { label: 'Programa', field: 'programName' },
                          { label: 'Edad', field: null },
                          { label: 'Teléfono', field: null },
                          { label: 'Dirección', field: null },
                          { label: 'Fecha Entrega', field: null },
                          { label: 'Expediente', field: null },
                        ].map(col => (
                          <th key={col.label}
                            onClick={() => col.field && toggleSort(col.field)}
                            className={`px-5 py-4 text-[9px] font-black uppercase text-on-surface-variant tracking-widest whitespace-nowrap select-none ${
                              col.field ? 'cursor-pointer hover:text-primary' : ''
                            }`}
                          >
                            <span className="flex items-center gap-1">
                              {col.label}
                              {col.field && padronSort.field === col.field && (
                                <span className="material-symbols-outlined text-[10px]">
                                  {padronSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                                </span>
                              )}
                              {col.field && padronSort.field !== col.field && (
                                <span className="material-symbols-outlined text-[10px] opacity-30">unfold_more</span>
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {filteredPadron.length === 0 ? (
                        <tr><td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant text-sm font-bold">No se encontraron beneficiarios</td></tr>
                      ) : filteredPadron.map(b => (
                        <tr key={b.folio} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-5 py-3">
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${
                              b.deliveryStatus === 'DELIVERED'
                                ? 'bg-secondary/10 text-secondary'
                                : 'bg-amber-50 text-amber-600'
                            }`}>
                              {b.deliveryStatus === 'DELIVERED' ? '✓ Entregado' : '○ Pendiente'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[10px] font-mono font-bold text-primary">{b.folio}</td>
                          <td className="px-5 py-3 text-xs font-bold text-on-surface">{b.fullName}</td>
                          <td className="px-5 py-3">
                            <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-lg">{b.programName}</span>
                          </td>
                          <td className="px-5 py-3 text-[10px] font-bold text-on-surface-variant">{b.age} años</td>
                          <td className="px-5 py-3 text-[10px] font-bold text-on-surface-variant">{b.phone || '—'}</td>
                          <td className="px-5 py-3 text-[10px] text-on-surface-variant max-w-[160px] truncate">{b.address || '—'}</td>
                          <td className="px-5 py-3 text-[10px] font-bold text-on-surface-variant">
                            {b.scannedAt ? new Date(b.scannedAt).toLocaleDateString('es-MX') : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <button
                              onClick={() => openExpediente(b.folio)}
                              disabled={expedienteLoading}
                              className="text-[10px] font-black text-primary flex items-center gap-1 hover:underline disabled:opacity-40"
                            >
                              <span className="material-symbols-outlined text-sm">folder_open</span>
                              Ver
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── ENTREGAS VIEW ── */}
            {deliveriesSubView === 'entregas' && (
              <>
                <div className="p-4 border-b border-outline-variant/10 flex flex-wrap gap-3 bg-[#f9f9fc]">
                  <input type="text" placeholder="Buscar nombre o folio..." value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    className="border border-outline-variant/20 rounded-xl px-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary w-52 bg-white"
                  />
                  <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)}
                    className="border border-outline-variant/20 rounded-xl px-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  >
                    <option value="">Todos los programas</option>
                    {uniquePrograms.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                    className="border border-outline-variant/20 rounded-xl px-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                  />
                  {(filterSearch || filterProgram || filterDate) && (
                    <button onClick={() => { setFilterSearch(''); setFilterProgram(''); setFilterDate(''); }}
                      className="text-xs font-bold text-error px-3 py-2 rounded-xl hover:bg-error/10 transition-colors"
                    >Limpiar</button>
                  )}
                  <span className="ml-auto text-[10px] font-bold text-on-surface-variant uppercase self-center tracking-widest">
                    {filteredDeliveries.length} registros {filteredDeliveries.length !== deliveries.length ? `(de ${deliveries.length})` : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-surface-container-low">
                      <tr>
                        {['Beneficiario', 'Folio', 'Fecha / Hora', 'Operador', 'Dispositivo', 'Evidencia'].map(h => (
                          <th key={h} className="px-6 py-4 text-[10px] font-black uppercase text-on-surface-variant tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {filteredDeliveries.length === 0 ? (
                        <tr><td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant text-sm font-bold">No se encontraron registros</td></tr>
                      ) : filteredDeliveries.map(d => (
                        <tr key={d.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-xs font-bold text-on-surface">{d.fullName}</p>
                            <p className="text-[10px] text-on-surface-variant font-medium uppercase">{d.programName}</p>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono font-bold text-primary">{d.beneficiaryFolio}</td>
                          <td className="px-6 py-4 text-[10px] font-bold text-on-surface-variant">{new Date(d.scannedAt).toLocaleString('es-MX')}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{d.operatorId.charAt(0)}</span>
                              <span className="text-[10px] font-bold text-on-surface">{d.operatorId}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-bold text-on-surface-variant">
                              {d.deviceId?.includes('Android') ? '📱 Android' : d.deviceId?.includes('iPhone') ? '📱 iPhone' : '💻 PC'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {d.evidencePhotoCloudUrl ? (
                              <button onClick={() => setSelectedPhoto(d.evidencePhotoCloudUrl)}
                                className="w-10 h-10 rounded-lg overflow-hidden border border-outline-variant/30 hover:scale-110 transition-transform"
                              >
                                <img src={d.evidencePhotoCloudUrl} className="w-full h-full object-cover" alt="Thumb" />
                              </button>
                            ) : <span className="text-[10px] font-bold text-error uppercase bg-red-50 px-2 py-1 rounded-lg">Sin Foto</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ─────────────── CARGA MASIVA ─────────────── */}
        {activeTab === 'import' && (
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in pt-10">
            {/* Import Card */}
            <div className="space-y-6">
              {importStatus && (
                <div className={`p-5 rounded-2xl flex items-center gap-4 text-left border ${
                  importStatus.type === 'success' ? 'bg-secondary/10 border-secondary/30 text-secondary' : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  <span className="material-symbols-outlined text-3xl">
                    {importStatus.type === 'success' ? 'check_circle' : 'error'}
                  </span>
                  <div>
                    <p className="font-black text-sm">{importStatus.type === 'success' ? '¡Éxito!' : 'Error'}</p>
                    <p className="text-xs font-medium mt-0.5">{importStatus.message}</p>
                  </div>
                </div>
              )}
              
              <div className="bg-white p-10 rounded-[40px] shadow-2xl border-2 border-dashed border-outline-variant/30 flex flex-col items-center text-center">
                <span className="material-symbols-outlined text-6xl text-primary mb-6">
                  {importing ? 'hourglass_top' : 'upload_file'}
                </span>
                <h2 className="text-2xl font-black text-primary mb-2">Importar Datos</h2>
                <p className="text-sm text-on-surface-variant mb-8 max-w-xs">Seleccione el tipo de información que desea cargar masivamente al sistema.</p>
                
                <div className="grid grid-cols-1 gap-3 w-full">
                  <label className={`text-white font-bold py-4 px-6 rounded-2xl shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2 ${
                    importing ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-container active:scale-95'
                  }`}>
                    <span className="material-symbols-outlined text-sm">person_add</span> IMPORTAR BENEFICIARIOS
                    <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFileUpload(e, 'beneficiarios')} disabled={importing} />
                  </label>
                  
                  <label className={`text-primary font-bold py-4 px-6 rounded-2xl border-2 border-primary cursor-pointer transition-all flex items-center justify-center gap-2 ${
                    importing ? 'opacity-30 cursor-not-allowed' : 'hover:bg-primary/5 active:scale-95'
                  }`}>
                    <span className="material-symbols-outlined text-sm">folder_special</span> IMPORTAR PROGRAMAS
                    <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFileUpload(e, 'programas')} disabled={importing} />
                  </label>
                </div>
              </div>
            </div>

            {/* Toolkit Card */}
            <div className="bg-surface-container-low rounded-[40px] p-8 space-y-6">
              <h3 className="text-lg font-black text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">construction</span> Kit de Herramientas Operativas
              </h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Utilice estas plantillas para asegurar que sus archivos CSV tengan el formato correcto y se vinculen adecuadamente.
              </p>
              
              <div className="space-y-3">
                <button onClick={() => downloadCSVTemplate('beneficiarios')}
                  className="w-full bg-white p-4 rounded-2xl flex items-center justify-between group hover:bg-primary/5 transition-colors border border-outline-variant/20 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">download</span>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-on-surface">Plantilla de Beneficiarios</p>
                      <p className="text-[10px] text-on-surface-variant">CSV con folio, nombre y programa</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                </button>

                <button onClick={() => downloadCSVTemplate('programas')}
                  className="w-full bg-white p-4 rounded-2xl flex items-center justify-between group hover:bg-primary/5 transition-colors border border-outline-variant/20 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined">download</span>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-on-surface">Plantilla de Programas</p>
                      <p className="text-[10px] text-on-surface-variant">CSV para configuración masiva</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                </button>
              </div>

              <div className="pt-4 border-t border-outline-variant/20">
                <p className="text-[10px] font-black uppercase text-primary mb-3">Recursos de Apoyo</p>
                <div className="bg-primary/5 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">menu_book</span>
                    <p className="text-[10px] font-bold text-on-surface leading-tight">MANUAL OPERATIVO DE CONFIGURACIÓN FASE 8</p>
                  </div>
                  <span className="text-[9px] font-black text-primary px-2 py-0.5 rounded-lg bg-primary/10">DISPONIBLE</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────── OPERADORES ─────────────── */}
        {activeTab === 'operators' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            {/* User List */}
            <div className="bg-white rounded-3xl shadow-sm border border-outline-variant/10 overflow-hidden">
              <div className="p-6 border-b border-outline-variant/10">
                <h2 className="text-xl font-black text-primary">Usuarios del Sistema</h2>
                <p className="text-xs text-on-surface-variant mt-1">{users.length} usuarios registrados</p>
              </div>
              <div className="divide-y divide-outline-variant/10">
                {users.map(u => (
                  <div key={u.id} className="px-6 py-4 flex items-center justify-between group hover:bg-surface-container-low transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${u.role === 'ADMIN' ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-on-surface">{u.name}</p>
                        <p className="text-[10px] text-on-surface-variant font-mono">{u.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${u.role === 'ADMIN' ? 'bg-primary/10 text-primary' : 'bg-surface-container text-outline'}`}>
                        {u.role}
                      </span>
                      <button 
                        onClick={() => handleDeleteUser(u.id, u.name)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-error/10 text-error rounded-lg transition-all"
                        title="Eliminar operador"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Create User Form */}
            <div className="bg-white rounded-3xl shadow-sm border border-outline-variant/10 overflow-hidden">
              <div className="p-6 border-b border-outline-variant/10">
                <h2 className="text-xl font-black text-primary">Nuevo Operador</h2>
                <p className="text-xs text-on-surface-variant mt-1">Registrar un nuevo usuario en el sistema</p>
              </div>
              <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                {userStatus && (
                  <div className={`p-4 rounded-xl flex items-center gap-3 text-sm border ${
                    userStatus.type === 'success' ? 'bg-secondary/10 border-secondary/20 text-secondary' : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    <span className="material-symbols-outlined">{userStatus.type === 'success' ? 'check_circle' : 'error'}</span>
                    <span className="font-bold text-xs">{userStatus.message}</span>
                  </div>
                )}
                {[
                  { label: 'ID de Acceso', key: 'id', placeholder: 'Ej: OP-QUERETARO-01', type: 'text' },
                  { label: 'Nombre Completo', key: 'name', placeholder: 'Nombre del operador', type: 'text' },
                  { label: 'Contraseña', key: 'password', placeholder: '••••••••', type: 'password' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">{field.label}</label>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={(newUser as any)[field.key]}
                      onChange={e => setNewUser(prev => ({ ...prev, [field.key]: e.target.value }))}
                      required
                      className="w-full border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Rol</label>
                  <select value={newUser.role} onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="OPERATOR">Operador de Campo</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-primary-container transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  CREAR OPERADOR
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* ─── PROGRAMAS TAB ─── (rendered outside main to allow full-height layout) */}
      {activeTab === 'programs' && (
        <main className="pt-24 px-6 pb-20 max-w-7xl mx-auto space-y-6 animate-fade-in">
          <ProgramsPanel
            programs={programs}
            token={storage.getToken() || ''}
            onRefresh={fetchData}
          />
        </main>
      )}

      {/* Expediente Drawer */}
      {expediente && (
        <ExpedienteDrawer
          data={expediente}
          onClose={() => setExpediente(null)}
        />
      )}

      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <button onClick={() => setSelectedPhoto(null)} className="absolute top-6 right-6 text-white text-4xl font-light">&times;</button>
          <img src={selectedPhoto} className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl border-4 border-white" alt="Evidence Large" />
        </div>
      )}
    </div>
  );
}
