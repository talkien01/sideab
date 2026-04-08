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
