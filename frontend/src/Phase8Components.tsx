import { useState } from 'react';
import * as api from './api';

// ─── Expediente Drawer ───────────────────────────────────────────────────────
export function ExpedienteDrawer({ data, onClose }: { data: any; onClose: () => void }) {
  const { beneficiary, documents, deliveries, customValues } = data;
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-xl z-[95] bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#000666] px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Expediente</p>
            <h2 className="text-lg font-black text-white">{beneficiary.fullName}</h2>
            <p className="text-xs text-white/60 font-mono">{beneficiary.folio}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Datos básicos */}
          <div className="p-6 border-b border-gray-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Datos del Beneficiario</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Programa', value: beneficiary.programName },
                { label: 'Edad', value: `${beneficiary.age} años` },
                { label: 'Teléfono', value: beneficiary.phone || '—' },
                { label: 'Estatus', value: beneficiary.deliveryStatus === 'DELIVERED' ? '✓ Entregado' : '○ Pendiente' },
              ].map(f => (
                <div key={f.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{f.label}</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{f.value}</p>
                </div>
              ))}
              {customValues?.map((cv: any) => (
                <div key={cv.field_key} className="bg-blue-50 rounded-xl p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">{cv.field_key}</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{cv.value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">{beneficiary.address || 'Sin dirección'}</p>
          </div>

          {/* Documentos */}
          <div className="p-6 border-b border-gray-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Documentos del Expediente ({documents?.length || 0})
            </p>
            {documents?.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <span className="material-symbols-outlined text-amber-400 text-3xl">folder_open</span>
                <p className="text-xs font-bold text-amber-600 mt-1">Sin documentos capturados</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {documents.map((doc: any) => (
                  <button key={doc.id} onClick={() => setSelectedDoc(doc.file_url)}
                    className="relative aspect-square rounded-xl overflow-hidden border-2 border-gray-200 hover:border-[#000666] transition-colors group"
                  >
                    <img src={doc.file_url} alt={doc.doc_type_name} className="w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-[9px] font-black text-white uppercase tracking-wide leading-tight">{doc.doc_type_name}</p>
                      <p className="text-[8px] text-white/60">{new Date(doc.uploaded_at).toLocaleDateString('es-MX')}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Historial de entregas */}
          <div className="p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              Historial de Entregas ({deliveries?.length || 0})
            </p>
            {deliveries?.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Sin entregas registradas</p>
            ) : (
              <div className="space-y-3">
                {deliveries.map((d: any) => (
                  <div key={d.id} className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-green-600 text-sm">check_circle</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-800">
                        {d.cycle_name || 'Sin ciclo'} {d.period ? `(${d.period})` : ''}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {new Date(d.scannedAt).toLocaleString('es-MX')} · Operador: {d.operatorId}
                      </p>
                    </div>
                    {d.evidencePhotoCloudUrl && (
                      <button onClick={() => setSelectedDoc(d.evidencePhotoCloudUrl)}
                        className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                        <img src={d.evidencePhotoCloudUrl} className="w-full h-full object-cover" alt="ev" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document fullscreen viewer */}
      {selectedDoc && (
        <div className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setSelectedDoc(null)}>
          <button className="absolute top-4 right-4 text-white text-4xl">&times;</button>
          <img src={selectedDoc} className="max-w-full max-h-full rounded-xl object-contain" alt="doc" />
        </div>
      )}
    </>
  );
}

// ─── Programs Panel ──────────────────────────────────────────────────────────
export function ProgramsPanel({ programs, token, onRefresh }: {
  programs: any[]; token: string; onRefresh: () => void;
}) {
  const [view, setView] = useState<'list' | 'new'>('list');
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<any | null>(null);
  const [newCycleName, setNewCycleName] = useState('');
  const [newCyclePeriod, setNewCyclePeriod] = useState('');
  const [cycleMsg, setCycleMsg] = useState('');

  // New program form state
  const [form, setForm] = useState({ name: '', institution: '', description: '' });
  const [docTypes, setDocTypes] = useState<{ name: string; is_required: boolean }[]>([
    { name: 'INE Anverso', is_required: true },
    { name: 'INE Reverso', is_required: true },
    { name: 'CURP', is_required: true },
    { name: 'Comprobante de Domicilio', is_required: false },
  ]);
  const [customFields, setCustomFields] = useState<{ field_key: string; field_label: string; field_type: string; is_required: boolean }[]>([
    { field_key: 'curp', field_label: 'CURP', field_type: 'text', is_required: true },
  ]);
  const [successMsg, setSuccessMsg] = useState('');

  const addDocType = () => setDocTypes(prev => [...prev, { name: '', is_required: true }]);
  const addCustomField = () => setCustomFields(prev => [...prev, { field_key: '', field_label: '', field_type: 'text', is_required: false }]);

  const handleSaveProgram = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      await api.createProgram(token, { ...form, docTypes, customFields });
      setSuccessMsg('¡Programa creado exitosamente!');
      await onRefresh();
      setTimeout(() => { setView('list'); setStep(1); setSuccessMsg(''); }, 1500);
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCycle = async (programId: string) => {
    if (!newCycleName) return;
    try {
      await api.createCycle(token, { program_id: programId, name: newCycleName, period: newCyclePeriod });
      setCycleMsg('Ciclo creado');
      setNewCycleName(''); setNewCyclePeriod('');
      await onRefresh();
      // Refresh selected program detail
      const updated = await api.getProgram(token, programId);
      setSelectedProgram(updated);
      setTimeout(() => setCycleMsg(''), 2000);
    } catch (e: any) { alert(e.message); }
  };

  const handleCycleStatus = async (cycleId: string, currentStatus: string, programId: string) => {
    const next = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    await api.updateCycleStatus(token, cycleId, next as any);
    const updated = await api.getProgram(token, programId);
    setSelectedProgram(updated);
  };

  // Program detail view
  if (selectedProgram) return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedProgram(null)} className="text-primary flex items-center gap-1 text-xs font-bold hover:underline">
          <span className="material-symbols-outlined text-sm">arrow_back</span> Volver
        </button>
        <h2 className="text-xl font-black text-primary">{selectedProgram.name}</h2>
        <span className={`text-[10px] font-black px-2 py-1 rounded-full ${selectedProgram.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {selectedProgram.status === 'ACTIVE' ? '● Activo' : '○ Archivado'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Document Types */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-outline-variant/10">
          <h3 className="text-sm font-black text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">description</span> Documentos Requeridos
          </h3>
          <div className="space-y-2">
            {selectedProgram.docTypes?.map((dt: any) => (
              <div key={dt.id} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${dt.is_required ? 'bg-red-400' : 'bg-gray-300'}`} />
                <span className="font-bold text-gray-700">{dt.name}</span>
                {dt.is_required && <span className="text-[9px] text-red-400 font-bold uppercase">Obligatorio</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Custom Fields */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-outline-variant/10">
          <h3 className="text-sm font-black text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">tune</span> Campos Personalizados
          </h3>
          <div className="space-y-2">
            {selectedProgram.customFields?.map((cf: any) => (
              <div key={cf.id} className="flex items-center gap-2 text-xs">
                <span className="material-symbols-outlined text-gray-400 text-sm">
                  {cf.field_type === 'number' ? 'pin' : cf.field_type === 'date' ? 'calendar_today' : 'text_fields'}
                </span>
                <span className="font-bold text-gray-700">{cf.field_label}</span>
                <span className="text-[9px] text-gray-400">({cf.field_type})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cycles */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-outline-variant/10">
          <h3 className="text-sm font-black text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">refresh</span> Ciclos de Entrega
          </h3>
          <div className="space-y-2 mb-4">
            {selectedProgram.cycles?.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-700">{c.name}</p>
                  <p className="text-[9px] text-gray-400">{c.period}</p>
                </div>
                <button onClick={() => handleCycleStatus(c.id, c.status, selectedProgram.id)}
                  className={`text-[9px] font-black px-2 py-1 rounded-full transition-colors ${
                    c.status === 'OPEN' ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600' : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700'
                  }`}>
                  {c.status === 'OPEN' ? '● ABIERTO' : '○ CERRADO'}
                </button>
              </div>
            ))}
          </div>
          {cycleMsg && <p className="text-xs font-bold text-green-600 mb-2">{cycleMsg}</p>}
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <input type="text" placeholder="Nombre del ciclo (Ej: Abril 2026)" value={newCycleName}
              onChange={e => setNewCycleName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary" />
            <input type="month" value={newCyclePeriod} onChange={e => setNewCyclePeriod(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary" />
            <button onClick={() => handleAddCycle(selectedProgram.id)}
              className="w-full bg-primary text-white text-xs font-bold py-2 rounded-xl hover:bg-primary-container transition-colors flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-sm">add</span> Agregar Ciclo
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // New program wizard
  if (view === 'new') return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => { setView('list'); setStep(1); }} className="text-primary flex items-center gap-1 text-xs font-bold hover:underline">
          <span className="material-symbols-outlined text-sm">arrow_back</span> Cancelar
        </button>
        <h2 className="text-xl font-black text-primary">Nuevo Programa de Apoyo</h2>
      </div>
      {/* Step indicators */}
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? 'bg-primary' : 'bg-gray-200'}`} />
        ))}
      </div>
      <div className="bg-white rounded-3xl shadow-sm border border-outline-variant/10 overflow-hidden">
        {successMsg ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-green-500 text-5xl">check_circle</span>
            <p className="text-lg font-black text-green-600 mt-3">{successMsg}</p>
          </div>
        ) : step === 1 ? (
          <div className="p-8 space-y-5">
            <div>
              <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-4">Paso 1 de 3 — Información del Programa</p>
              {[
                { label: 'Nombre del Programa *', key: 'name', placeholder: 'Ej: Apoyo Alimentario 2026' },
                { label: 'Institución / Dependencia', key: 'institution', placeholder: 'Ej: DIF Municipal' },
                { label: 'Descripción', key: 'description', placeholder: 'Descripción breve del programa' },
              ].map(f => (
                <div key={f.key} className="mb-4">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">{f.label}</label>
                  <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              ))}
            </div>
            <button disabled={!form.name} onClick={() => setStep(2)}
              className="w-full bg-primary text-white font-bold py-3 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2">
              Siguiente <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        ) : step === 2 ? (
          <div className="p-8 space-y-5">
            <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-2">Paso 2 de 3 — Documentos a Recolectar</p>
            <p className="text-xs text-gray-500 mb-4">Define qué documentos el operador deberá capturar para cada beneficiario.</p>
            <div className="space-y-3">
              {docTypes.map((dt, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input value={dt.name} onChange={e => setDocTypes(prev => prev.map((d, j) => j === i ? { ...d, name: e.target.value } : d))}
                    placeholder="Nombre del documento"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary" />
                  <label className="flex items-center gap-1 text-xs font-bold text-gray-600 whitespace-nowrap cursor-pointer">
                    <input type="checkbox" checked={dt.is_required}
                      onChange={e => setDocTypes(prev => prev.map((d, j) => j === i ? { ...d, is_required: e.target.checked } : d))}
                      className="w-4 h-4 accent-primary" />
                    Obligatorio
                  </label>
                  <button onClick={() => setDocTypes(prev => prev.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 transition-colors">
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addDocType} className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
              <span className="material-symbols-outlined text-sm">add</span> Agregar tipo de documento
            </button>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-2xl text-sm">← Atrás</button>
              <button onClick={() => setStep(3)} className="flex-1 bg-primary text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2">
                Siguiente <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 space-y-5">
            <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-2">Paso 3 de 3 — Campos del Padrón</p>
            <p className="text-xs text-gray-500 mb-4">Campos extra que necesitas registrar por beneficiario (además del folio, nombre, edad, etc.)</p>
            <div className="space-y-3">
              {customFields.map((cf, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={cf.field_label} onChange={e => setCustomFields(prev => prev.map((f, j) => j === i ? { ...f, field_label: e.target.value, field_key: e.target.value.toLowerCase().replace(/\s+/g,'_') } : f))}
                    placeholder="Etiqueta (Ej: CURP)"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary" />
                  <select value={cf.field_type} onChange={e => setCustomFields(prev => prev.map((f, j) => j === i ? { ...f, field_type: e.target.value } : f))}
                    className="border border-gray-200 rounded-xl px-2 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="text">Texto</option>
                    <option value="number">Número</option>
                    <option value="date">Fecha</option>
                  </select>
                  <button onClick={() => setCustomFields(prev => prev.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600"><span className="material-symbols-outlined text-sm">delete</span></button>
                </div>
              ))}
            </div>
            <button onClick={addCustomField} className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
              <span className="material-symbols-outlined text-sm">add</span> Agregar campo
            </button>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(2)} className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-2xl text-sm">← Atrás</button>
              <button onClick={handleSaveProgram} disabled={saving}
                className="flex-1 bg-[#1b6d24] text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? 'Guardando...' : <><span className="material-symbols-outlined text-sm">check</span> Crear Programa</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Programs list
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-primary">Programas de Apoyo</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">Configura la estructura de cada programa: documentos requeridos y campos del padrón.</p>
        </div>
        <button onClick={() => setView('new')}
          className="bg-primary text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-primary-container transition-colors">
          <span className="material-symbols-outlined text-sm">add</span> NUEVO PROGRAMA
        </button>
      </div>

      {programs.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center shadow-sm border border-outline-variant/10">
          <span className="material-symbols-outlined text-5xl text-gray-300">folder_special</span>
          <p className="text-lg font-black text-gray-400 mt-3">No hay programas configurados</p>
          <p className="text-xs text-gray-400 mt-1">Crea el primer programa para comenzar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {programs.map((p: any) => (
            <button key={p.id} onClick={async () => {
                const detail = await api.getProgram(storage.getToken() || '', p.id);
                setSelectedProgram(detail);
              }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-outline-variant/10 text-left hover:shadow-md hover:border-primary/30 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-2xl">folder_special</span>
                </div>
                <span className={`text-[10px] font-black px-2 py-1 rounded-full ${p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {p.status === 'ACTIVE' ? '● Activo' : '○ Archivado'}
                </span>
              </div>
              <p className="font-black text-on-surface text-base leading-tight">{p.name}</p>
              <p className="text-xs text-on-surface-variant mt-1">{p.institution}</p>
              <div className="flex gap-4 mt-4 text-[10px] font-bold text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">description</span> {p.docTypesCount} docs
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">tune</span> {p.customFieldsCount} campos
                </span>
                <span className={`flex items-center gap-1 ${p.openCycles > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className="material-symbols-outlined text-sm">refresh</span> {p.openCycles} ciclo{p.openCycles !== 1 ? 's' : ''} abierto{p.openCycles !== 1 ? 's' : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Import storage for token access inside standalone components
import * as storage from './storage';
