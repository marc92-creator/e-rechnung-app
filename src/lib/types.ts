// ============================================================================
// SHARED TYPES
// ============================================================================

export type PositionTyp = 'L' | 'M' | 'F' | 'S';
export type InvoiceStatus = 'draft' | 'sent' | 'paid';
export type DocumentType = 'invoice' | 'offer';
export type OfferStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export interface Position {
  id: string;
  bezeichnung: string;
  typ: PositionTyp;
  menge: number;
  einheit: string;
  preis: number;
  ust: number;
}

export interface Verkaeufer {
  firma: string;
  strasse: string;
  plz: string;
  ort: string;
  ustId: string;
  steuernummer: string;
  iban: string;
  bic: string;
  bank: string;
  handelsregister: string;
  telefon: string;
  email: string;
}

export interface Kaeufer {
  firma: string;
  strasse: string;
  plz: string;
  ort: string;
  ustId: string;
  ansprechpartner: string;
  email: string;
  kundennummer: string;
}

export interface Rechnung {
  nummer: string;
  datum: string;
  faelligkeit: string;
  leistungszeitraum: string;
  art: string;
  leitwegId: string;
  bestellnummer: string;
}

export interface FormState {
  rechnung: Rechnung;
  verkaeufer: Verkaeufer;
  kaeufer: Kaeufer;
  positionen: Position[];
}

export interface Summen {
  netto: number;
  lohn: number;
  material: number;
  ust19: number;
  ust7: number;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface InvoiceData {
  rechnung: Rechnung;
  verkaeufer: Verkaeufer;
  kaeufer: Kaeufer;
  positionen: Position[];
}

export interface ArchivedInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  totalGross: number;
  status: InvoiceStatus;
  documentType: DocumentType;
  offerStatus?: OfferStatus;
  relatedOfferId?: string;
  validUntil?: string;
  createdAt: Date;
  updatedAt: Date;
  data: InvoiceData;
}

export interface Customer {
  id: string;
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  email?: string;
  phone?: string;
  customerNumber?: string;
  vatId?: string;
  leitwegId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Article {
  id: string;
  name: string;
  description?: string;
  type: PositionTyp;
  unit: string;
  unitPrice: number;
  vatRate: number;
  articleNumber?: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceNumberSettings {
  id: string;
  prefix: string;
  separator: string;
  yearFormat: '4' | '2';
  numberLength: number;
  resetOnYearChange: boolean;
  lastYear: number;
  lastNumber: number;
}

export interface OfferNumberSettings {
  id: string;
  prefix: string;
  separator: string;
  yearFormat: '4' | '2';
  numberLength: number;
  resetOnYearChange: boolean;
  lastYear: number;
  lastNumber: number;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  infos: ValidationMessage[];
}

export interface ValidationMessage {
  code: string;
  field?: string;
  message: string;
  severity: ValidationSeverity;
  btNumber?: string; // EN16931 Business Term Number
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const EINHEIT_OPTIONS = ['Std', 'Stk', 'm', 'm²', 'm³', 'kg', 'Tag', 'Ltr', 'psch'];

export const UST_OPTIONS = [
  { value: 19, label: '19%' },
  { value: 7, label: '7%' },
  { value: 0, label: '0%' }
];

export const EINHEIT_MAP: Record<string, string> = {
  'Std': 'HUR',
  'Stk': 'H87',
  'm': 'MTR',
  'm²': 'MTK',
  'm³': 'MTQ',
  'kg': 'KGM',
  'Tag': 'DAY',
  'Ltr': 'LTR',
  'psch': 'LS'
};

export const TYP_OPTIONS: { value: PositionTyp; label: string; color: string }[] = [
  { value: 'L', label: 'Lohn', color: 'blue' },
  { value: 'M', label: 'Material', color: 'amber' },
  { value: 'F', label: 'Fahrt', color: 'purple' },
  { value: 'S', label: 'Sonst.', color: 'slate' }
];

export const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: 'Entwurf', color: 'slate' },
  sent: { label: 'Gesendet', color: 'blue' },
  paid: { label: 'Bezahlt', color: 'emerald' }
};

export const OFFER_STATUS_CONFIG: Record<OfferStatus, { label: string; color: string }> = {
  draft: { label: 'Entwurf', color: 'slate' },
  sent: { label: 'Gesendet', color: 'blue' },
  accepted: { label: 'Angenommen', color: 'emerald' },
  rejected: { label: 'Abgelehnt', color: 'red' }
};

export const DOCUMENT_TYPE_CONFIG: Record<DocumentType, { label: string; prefix: string }> = {
  invoice: { label: 'Rechnung', prefix: 'RE' },
  offer: { label: 'Angebot', prefix: 'ANG' }
};
