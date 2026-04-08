export interface Beneficiary {
  folio: string;
  fullName: string;
  age: number;
  address: string;
  phone: string;
  programName: string;
  approvalStatus: string;
  deliveryStatus: string;
  updatedAt: string;
  photoUrl?: string;
}

export interface Delivery {
  id: string;
  beneficiaryFolio: string;
  operatorId: string;
  scannedAt: string;
  deviceId: string;
  location: string;
  evidencePhotoCloudUrl: string;
  integrityHash: string;
  synced: boolean;
}

const KEYS = {
  BENEFICIARIES: 'sideab_beneficiaries',
  PENDING_DELIVERIES: 'sideab_pending_deliveries',
  TOKEN: 'sideab_token',
  USER: 'sideab_user'
};

export const saveToken = (token: string) => localStorage.setItem(KEYS.TOKEN, token);
export const getToken = () => localStorage.getItem(KEYS.TOKEN);
export const saveUser = (user: any) => localStorage.setItem(KEYS.USER, JSON.stringify(user));
export const getUser = () => {
  const user = localStorage.getItem(KEYS.USER);
  return user ? JSON.parse(user) : null;
};

export const saveBeneficiaries = (beneficiaries: Beneficiary[]) => {
  localStorage.setItem(KEYS.BENEFICIARIES, JSON.stringify(beneficiaries));
};

export const getBeneficiaries = (): Beneficiary[] => {
  const data = localStorage.getItem(KEYS.BENEFICIARIES);
  return data ? JSON.parse(data) : [];
};

export const savePendingDelivery = (delivery: Delivery) => {
  const existing = getPendingDeliveries();
  existing.push(delivery);
  localStorage.setItem(KEYS.PENDING_DELIVERIES, JSON.stringify(existing));
  
  // Update local beneficiary status
  const beneficiaries = getBeneficiaries();
  const index = beneficiaries.findIndex(b => b.folio === delivery.beneficiaryFolio);
  if (index !== -1) {
    beneficiaries[index].deliveryStatus = 'DELIVERED';
    beneficiaries[index].photoUrl = delivery.evidencePhotoCloudUrl;
    saveBeneficiaries(beneficiaries);
  }
};

export const getPendingDeliveries = (): Delivery[] => {
  const data = localStorage.getItem(KEYS.PENDING_DELIVERIES);
  return data ? JSON.parse(data) : [];
};

export const clearPendingDeliveries = () => {
  localStorage.removeItem(KEYS.PENDING_DELIVERIES);
};

export const removeDeliveriesByIds = (ids: string[]) => {
  const pending = getPendingDeliveries();
  const filtered = pending.filter(d => !ids.includes(d.id));
  localStorage.setItem(KEYS.PENDING_DELIVERIES, JSON.stringify(filtered));
};

export const removeDelivery = (folio: string) => {
  // 1. Remove from pending deliveries
  const pending = getPendingDeliveries();
  const filtered = pending.filter(d => d.beneficiaryFolio !== folio);
  localStorage.setItem(KEYS.PENDING_DELIVERIES, JSON.stringify(filtered));

  // 2. Reset beneficiary status
  const beneficiaries = getBeneficiaries();
  const index = beneficiaries.findIndex(b => b.folio === folio);
  if (index !== -1) {
    beneficiaries[index].deliveryStatus = 'PENDING';
    delete beneficiaries[index].photoUrl;
    saveBeneficiaries(beneficiaries);
  }
};

export const logout = () => {
  localStorage.clear();
};
