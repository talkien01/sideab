const API_URL = '/api';

export const login = async (operator_id: string, password: string) => {
  const response = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operator_id, password }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al iniciar sesión');
  }
  return response.json();
};

export const pullBeneficiaries = async (token: string) => {
  const response = await fetch(`${API_URL}/sync/pull`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Error al descargar padrón');
  return response.json();
};

export const pushDeliveries = async (token: string, deliveries: any[]) => {
  const response = await fetch(`${API_URL}/sync/push`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify(deliveries),
  });
  if (!response.ok) throw new Error('Error al sincronizar entregas');
  return response.json();
};

export const uploadPhoto = async (token: string, file: File) => {
  const formData = new FormData();
  formData.append('photo', file);
  const response = await fetch(`${API_URL}/upload/evidence`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });
  if (!response.ok) throw new Error('Error al subir foto');
  return response.json();
};

export const getStats = async (token: string) => {
  const response = await fetch(`${API_URL}/admin/stats`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Error al obtener estadísticas');
  return response.json();
};

export const getAdminDeliveries = async (token: string) => {
  const response = await fetch(`${API_URL}/admin/deliveries`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Error al obtener entregas');
  return response.json();
};

export const getAdminBeneficiaries = async (token: string) => {
  const response = await fetch(`${API_URL}/admin/beneficiaries`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Error al obtener padrón');
  return response.json();
};

export const importBeneficiaries = async (token: string, data: any[]) => {
  const response = await fetch(`${API_URL}/admin/import`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al importar beneficiarios');
  return response.json();
};

export const getUsers = async (token: string) => {
  const response = await fetch(`${API_URL}/admin/users`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Error al obtener usuarios');
  return response.json();
};

export const createUser = async (token: string, user: { id: string; name: string; password: string; role: string }) => {
  const response = await fetch(`${API_URL}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(user),
  });
  if (!response.ok) { const err = await response.json(); throw new Error(err.error); }
  return response.json();
};

export const deleteUser = async (token: string, id: string) => {
  const response = await fetch(`${API_URL}/admin/users/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) { const err = await response.json(); throw new Error(err.error); }
  return response.json();
};

// ── PHASE 8: PROGRAMS ────────────────────────────────────────────────────────

export const importPrograms = async (token: string, programs: any[]) => {
  const res = await fetch(`${API_URL}/admin/programs/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(programs)
  });
  if (!res.ok) throw new Error('Error al importar programas');
  return res.json();
};

export const getPrograms = async (token: string) => {
  const r = await fetch(`${API_URL}/admin/programs`, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!r.ok) throw new Error('Error al obtener programas');
  return r.json();
};

export const getProgram = async (token: string, id: string) => {
  const r = await fetch(`${API_URL}/admin/programs/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!r.ok) throw new Error('Error al obtener programa');
  return r.json();
};

export const createProgram = async (token: string, data: any) => {
  const r = await fetch(`${API_URL}/admin/programs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
  return r.json();
};

export const updateProgramStatus = async (token: string, id: string, status: string) => {
  const r = await fetch(`${API_URL}/admin/programs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) throw new Error('Error al actualizar programa');
  return r.json();
};

export const createCycle = async (token: string, data: { program_id: string; name: string; period: string }) => {
  const r = await fetch(`${API_URL}/admin/cycles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
  return r.json();
};

export const updateCycleStatus = async (token: string, id: string, status: 'OPEN' | 'CLOSED') => {
  const r = await fetch(`${API_URL}/admin/cycles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) throw new Error('Error al actualizar ciclo');
  return r.json();
};

export const uploadDocument = async (token: string, file: File, meta: {
  beneficiary_folio: string; program_id: string; doc_type_id?: string; doc_type_name: string;
}) => {
  const form = new FormData();
  form.append('photo', file);
  Object.entries(meta).forEach(([k, v]) => form.append(k, v));
  const r = await fetch(`${API_URL}/upload/document`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  });
  if (!r.ok) throw new Error('Error al subir documento');
  return r.json();
};

export const getExpediente = async (token: string, folio: string) => {
  const r = await fetch(`${API_URL}/admin/beneficiaries/${folio}/expediente`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!r.ok) throw new Error('Error al obtener expediente');
  return r.json();
};

export const validateDocumentOCR = async (token: string, photo: File, folio: string) => {
  const formData = new FormData();
  formData.append('photo', photo);
  formData.append('folio', folio);

  const res = await fetch(`${API_URL}/ocr/validate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error en validación OCR');
  }
  return res.json();
};
