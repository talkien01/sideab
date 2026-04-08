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
  PENDING_DOCUMENTS: 'sideab_pending_documents',
  PROGRAMS: 'sideab_programs',
  DOCUMENTS: 'sideab_documents',
  TOKEN: 'sideab_token',
  USER: 'sideab_user'
};

export interface Program {
  id: string;
  name: string;
  institution?: string;
  docTypes: { id: string; name: string; is_required: boolean }[];
  customFields: { field_key: string; field_label: string; field_type: string; is_required: boolean }[];
}

export interface DocumentSummary {
  id: string;
  beneficiary_folio: string;
  doc_type_id: string;
}

export interface PendingDocument {
  id: string;
  beneficiary_folio: string;
  program_id: string;
  doc_type_id: string;
  doc_type_name: string;
  photoData: string;
}

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

export const savePrograms = (programs: Program[]) => {
  localStorage.setItem(KEYS.PROGRAMS, JSON.stringify(programs));
};

export const getPrograms = (): Program[] => {
  const data = localStorage.getItem(KEYS.PROGRAMS);
  return data ? JSON.parse(data) : [];
};

export const saveDocuments = (documents: DocumentSummary[]) => {
  localStorage.setItem(KEYS.DOCUMENTS, JSON.stringify(documents));
};

export const getDocuments = (): DocumentSummary[] => {
  const data = localStorage.getItem(KEYS.DOCUMENTS);
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

export const savePendingDocument = (doc: PendingDocument) => {
  const existing = getPendingDocuments();
  existing.push(doc);
  localStorage.setItem(KEYS.PENDING_DOCUMENTS, JSON.stringify(existing));

  // Add to local documents summary so UI updates
  const docs = getDocuments();
  docs.push({ id: doc.id, beneficiary_folio: doc.beneficiary_folio, doc_type_id: doc.doc_type_id });
  saveDocuments(docs);
};

export const getPendingDocuments = (): PendingDocument[] => {
  const data = localStorage.getItem(KEYS.PENDING_DOCUMENTS);
  return data ? JSON.parse(data) : [];
};

export const removePendingDocumentsByIds = (ids: string[]) => {
  const items = getPendingDocuments();
  const filtered = items.filter(i => !ids.includes(i.id));
  localStorage.setItem(KEYS.PENDING_DOCUMENTS, JSON.stringify(filtered));
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

