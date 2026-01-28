'use client';

import { useState, useCallback, ChangeEvent, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FileText, Plus, Trash2, Download, CheckCircle2, Building2, User,
  Receipt, ShoppingCart, Shield, Sparkles, Zap, Copy,
  FileSpreadsheet, Printer, FilePlus, X, AlertTriangle, Archive,
  Loader2, FileDown, Settings, RotateCcw, Send, Banknote, Search,
  ChevronRight, Clock, MoreVertical
} from 'lucide-react';
import {
  db, type ArchivedInvoice, type InvoiceData, type InvoiceStatus,
  type InvoiceNumberSettings, generateInvoiceNumber, getNextInvoiceNumber,
  checkDuplicateInvoiceNumber, migrateFromLocalStorage, getDefaultSettings
} from '@/lib/db';

// ============================================================================
// TYPES
// ============================================================================

type PositionTyp = 'L' | 'M' | 'F' | 'S';

interface Position {
  id: string;
  bezeichnung: string;
  typ: PositionTyp;
  menge: number;
  einheit: string;
  preis: number;
  ust: number;
}

interface Verkaeufer {
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

interface Kaeufer {
  firma: string;
  strasse: string;
  plz: string;
  ort: string;
  ustId: string;
  ansprechpartner: string;
  email: string;
  kundennummer: string;
}

interface Rechnung {
  nummer: string;
  datum: string;
  faelligkeit: string;
  leistungszeitraum: string;
  art: string;
  leitwegId: string;
  bestellnummer: string;
}

interface FormState {
  rechnung: Rechnung;
  verkaeufer: Verkaeufer;
  kaeufer: Kaeufer;
  positionen: Position[];
}

interface Summen {
  netto: number;
  lohn: number;
  material: number;
  ust19: number;
  ust7: number;
}

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'e-rechnung-formdata';

const EINHEIT_OPTIONS = ['Std', 'Stk', 'm', 'm²', 'm³', 'kg', 'Tag', 'Ltr', 'psch'];
const UST_OPTIONS = [{ value: 19, label: '19%' }, { value: 7, label: '7%' }, { value: 0, label: '0%' }];

const EINHEIT_MAP: Record<string, string> = {
  'Std': 'HUR', 'Stk': 'H87', 'm': 'MTR', 'm²': 'MTK',
  'm³': 'MTQ', 'kg': 'KGM', 'Tag': 'DAY', 'Ltr': 'LTR', 'psch': 'LS'
};

const TYP_OPTIONS: { value: PositionTyp; label: string; color: string }[] = [
  { value: 'L', label: 'Lohn', color: 'blue' },
  { value: 'M', label: 'Material', color: 'amber' },
  { value: 'F', label: 'Fahrt', color: 'purple' },
  { value: 'S', label: 'Sonst.', color: 'slate' }
];

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; icon: typeof FileText }> = {
  draft: { label: 'Entwurf', color: 'slate', icon: FileText },
  sent: { label: 'Gesendet', color: 'blue', icon: Send },
  paid: { label: 'Bezahlt', color: 'emerald', icon: Banknote }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatCurrency = (value: number): string =>
  value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
};

const formatDateShort = (date: Date): string => {
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const addDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const escapeXML = (str: string): string =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const isValidEmail = (email: string): boolean =>
  !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidPLZ = (plz: string): boolean =>
  !plz || /^\d{5}$/.test(plz);

const generateId = (): string => Date.now().toString() + Math.random().toString(36).slice(2);

// ============================================================================
// INITIAL STATE FACTORIES
// ============================================================================

const createInitialRechnung = (today: string, in14Days: string): Rechnung => ({
  nummer: '', datum: today, faelligkeit: in14Days, leistungszeitraum: '',
  art: '380 - Rechnung', leitwegId: '', bestellnummer: ''
});

const createInitialVerkaeufer = (): Verkaeufer => ({
  firma: '', strasse: '', plz: '', ort: '', ustId: '', steuernummer: '',
  iban: '', bic: '', bank: '', handelsregister: '', telefon: '', email: ''
});

const createInitialKaeufer = (): Kaeufer => ({
  firma: '', strasse: '', plz: '', ort: '', ustId: '',
  ansprechpartner: '', email: '', kundennummer: ''
});

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

const calculateSummen = (positionen: Position[]): Summen => {
  return positionen.reduce((acc, pos) => {
    if (pos.bezeichnung && pos.menge > 0 && pos.preis > 0) {
      const betrag = pos.menge * pos.preis;
      acc.netto += betrag;
      if (pos.typ === 'L') acc.lohn += betrag;
      if (pos.typ === 'M') acc.material += betrag;
      if (pos.ust === 19) acc.ust19 += betrag * 0.19;
      if (pos.ust === 7) acc.ust7 += betrag * 0.07;
    }
    return acc;
  }, { netto: 0, lohn: 0, material: 0, ust19: 0, ust7: 0 });
};

const validateForm = (rechnung: Rechnung, verkaeufer: Verkaeufer, kaeufer: Kaeufer, positionen: Position[]): string[] => {
  const errors: string[] = [];
  if (!rechnung.nummer) errors.push('Rechnungsnummer');
  if (!rechnung.datum) errors.push('Rechnungsdatum');
  if (!verkaeufer.firma) errors.push('Ihre Firma');
  if (!verkaeufer.strasse) errors.push('Ihre Straße');
  if (!verkaeufer.plz || !verkaeufer.ort) errors.push('Ihre PLZ/Ort');
  if (!verkaeufer.ustId && !verkaeufer.steuernummer) errors.push('USt-ID oder Steuernummer');
  if (!kaeufer.firma) errors.push('Kunde: Firma');
  if (!kaeufer.strasse) errors.push('Kunde: Straße');
  if (!kaeufer.plz || !kaeufer.ort) errors.push('Kunde: PLZ/Ort');
  if (!positionen.some(p => p.bezeichnung && p.menge > 0 && p.preis > 0)) errors.push('Mind. 1 Position');
  return errors;
};

const calculateProgress = (rechnung: Rechnung, verkaeufer: Verkaeufer, kaeufer: Kaeufer, positionen: Position[]): number => {
  let filled = 0;
  if (rechnung.nummer) filled++;
  if (rechnung.datum) filled++;
  if (verkaeufer.firma) filled++;
  if (verkaeufer.strasse) filled++;
  if (verkaeufer.plz && verkaeufer.ort) filled++;
  if (verkaeufer.ustId || verkaeufer.steuernummer) filled++;
  if (kaeufer.firma) filled++;
  if (kaeufer.strasse) filled++;
  if (kaeufer.plz && kaeufer.ort) filled++;
  if (positionen.some(p => p.bezeichnung && p.menge > 0 && p.preis > 0)) filled++;
  return Math.round((filled / 10) * 100);
};

// ============================================================================
// XML GENERATOR
// ============================================================================

const generateXRechnungXML = (rechnung: Rechnung, verkaeufer: Verkaeufer, kaeufer: Kaeufer, positionen: Position[]): string => {
  let netto19 = 0, netto7 = 0, netto0 = 0;

  positionen.forEach(pos => {
    if (pos.bezeichnung && pos.menge > 0 && pos.preis > 0) {
      const betrag = pos.menge * pos.preis;
      if (pos.ust === 19) netto19 += betrag;
      else if (pos.ust === 7) netto7 += betrag;
      else netto0 += betrag;
    }
  });

  const nettoGesamt = netto19 + netto7 + netto0;
  const ust19 = netto19 * 0.19;
  const ust7 = netto7 * 0.07;
  const brutto = nettoGesamt + ust19 + ust7;

  let positionenXML = '';
  let posNr = 0;
  positionen.forEach(pos => {
    if (pos.bezeichnung && pos.menge > 0 && pos.preis > 0) {
      posNr++;
      const betrag = pos.menge * pos.preis;
      positionenXML += `
    <cac:InvoiceLine>
        <cbc:ID>${posNr}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="${EINHEIT_MAP[pos.einheit] || 'H87'}">${pos.menge.toFixed(2)}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="EUR">${betrag.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:Item>
            <cbc:Name>${escapeXML(pos.bezeichnung)}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>${pos.ust}</cbc:Percent>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price><cbc:PriceAmount currencyID="EUR">${pos.preis.toFixed(2)}</cbc:PriceAmount></cac:Price>
    </cac:InvoiceLine>`;
    }
  });

  let taxSubtotals = '';
  if (netto19 > 0) {
    taxSubtotals += `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="EUR">${netto19.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="EUR">${ust19.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>19</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>
        </cac:TaxSubtotal>`;
  }
  if (netto7 > 0) {
    taxSubtotals += `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="EUR">${netto7.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="EUR">${ust7.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>7</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>
        </cac:TaxSubtotal>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
    <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
    <cbc:ID>${escapeXML(rechnung.nummer)}</cbc:ID>
    <cbc:IssueDate>${rechnung.datum}</cbc:IssueDate>
    ${rechnung.faelligkeit ? `<cbc:DueDate>${rechnung.faelligkeit}</cbc:DueDate>` : ''}
    <cbc:InvoiceTypeCode>${rechnung.art.substring(0, 3)}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
    <cbc:BuyerReference>${rechnung.leitwegId || 'n/a'}</cbc:BuyerReference>
    <cac:AccountingSupplierParty><cac:Party>
        <cac:PostalAddress>
            <cbc:StreetName>${escapeXML(verkaeufer.strasse)}</cbc:StreetName>
            <cbc:CityName>${escapeXML(verkaeufer.ort)}</cbc:CityName>
            <cbc:PostalZone>${escapeXML(verkaeufer.plz)}</cbc:PostalZone>
            <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
        </cac:PostalAddress>
        ${verkaeufer.ustId ? `<cac:PartyTaxScheme><cbc:CompanyID>${escapeXML(verkaeufer.ustId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}
        <cac:PartyLegalEntity><cbc:RegistrationName>${escapeXML(verkaeufer.firma)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party></cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty><cac:Party>
        <cac:PostalAddress>
            <cbc:StreetName>${escapeXML(kaeufer.strasse)}</cbc:StreetName>
            <cbc:CityName>${escapeXML(kaeufer.ort)}</cbc:CityName>
            <cbc:PostalZone>${escapeXML(kaeufer.plz)}</cbc:PostalZone>
            <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
        </cac:PostalAddress>
        ${kaeufer.ustId ? `<cac:PartyTaxScheme><cbc:CompanyID>${escapeXML(kaeufer.ustId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}
        <cac:PartyLegalEntity><cbc:RegistrationName>${escapeXML(kaeufer.firma)}</cbc:RegistrationName></cac:PartyLegalEntity>
    </cac:Party></cac:AccountingCustomerParty>
    ${verkaeufer.iban ? `<cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode><cac:PayeeFinancialAccount><cbc:ID>${verkaeufer.iban.replace(/\s/g, '')}</cbc:ID></cac:PayeeFinancialAccount></cac:PaymentMeans>` : ''}
    <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">${(ust19 + ust7).toFixed(2)}</cbc:TaxAmount>${taxSubtotals}</cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="EUR">${nettoGesamt.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="EUR">${nettoGesamt.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="EUR">${brutto.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="EUR">${brutto.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>${positionenXML}
</Invoice>`;
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function Toast({ message, type, onClose }: { message: string; type: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg ${
        type === 'success' ? 'bg-emerald-600 text-white' :
        type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'
      }`}
    >
      {type === 'success' && <CheckCircle2 className="w-5 h-5" />}
      {type === 'error' && <AlertTriangle className="w-5 h-5" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 p-1 hover:bg-white/20 rounded">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel, confirmText = 'Ja, zurücksetzen', confirmColor = 'red' }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
  confirmText?: string; confirmColor?: 'red' | 'blue' | 'emerald';
}) {
  const colorClasses = {
    red: 'bg-red-600 hover:bg-red-700',
    blue: 'bg-blue-600 hover:bg-blue-700',
    emerald: 'bg-emerald-600 hover:bg-emerald-700'
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm mx-4"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            confirmColor === 'red' ? 'bg-red-100' : confirmColor === 'blue' ? 'bg-blue-100' : 'bg-emerald-100'
          }`}>
            <AlertTriangle className={`w-5 h-5 ${
              confirmColor === 'red' ? 'text-red-600' : confirmColor === 'blue' ? 'text-blue-600' : 'text-emerald-600'
            }`} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        </div>
        <p className="text-slate-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2.5 min-h-[44px] rounded-xl text-slate-600 hover:bg-slate-100 font-medium">
            Abbrechen
          </button>
          <button onClick={onConfirm} className={`px-4 py-2.5 min-h-[44px] rounded-xl text-white font-medium ${colorClasses[confirmColor]}`}>
            {confirmText}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="h-1 bg-slate-100 w-full overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  );
}

function FormInput({ label, value, onChange, onBlur, required = false, showError = false, type = 'text',
  placeholder = '', className = '', validate, suffix }: {
  label: string; value: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void; required?: boolean; showError?: boolean; type?: string;
  placeholder?: string; className?: string; validate?: (v: string) => boolean; suffix?: React.ReactNode;
}) {
  const hasError = showError && required && !value;
  const hasValidationError = validate && value && !validate(value);

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-600 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          className={`w-full min-h-[44px] h-11 px-4 ${suffix ? 'pr-12' : ''} rounded-xl border text-slate-900 text-base placeholder:text-slate-400 transition-all duration-200 ease-out outline-none ring-1 ring-transparent ${
            hasError || hasValidationError
              ? 'bg-red-50 border-red-300 focus:bg-white focus:border-red-500 focus:ring-red-500/30 focus:shadow-sm'
              : 'bg-slate-50/80 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500/20 focus:shadow-sm'
          }`}
        />
        {suffix && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            {suffix}
          </div>
        )}
      </div>
      {hasValidationError && <p className="text-xs text-red-500 mt-1">Ungültiges Format</p>}
    </div>
  );
}

function TypPillSelector({ value, onChange }: { value: PositionTyp; onChange: (typ: PositionTyp) => void }) {
  const colorClasses: Record<string, { active: string; inactive: string }> = {
    blue: { active: 'bg-blue-500 text-white shadow-sm', inactive: 'text-blue-600 hover:bg-blue-50' },
    amber: { active: 'bg-amber-500 text-white shadow-sm', inactive: 'text-amber-600 hover:bg-amber-50' },
    purple: { active: 'bg-purple-500 text-white shadow-sm', inactive: 'text-purple-600 hover:bg-purple-50' },
    slate: { active: 'bg-slate-500 text-white shadow-sm', inactive: 'text-slate-600 hover:bg-slate-100' }
  };

  return (
    <div className="flex gap-1 mb-2">
      {TYP_OPTIONS.map(opt => (
        <motion.button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`px-3 py-1.5 min-h-[32px] rounded-full text-xs font-medium transition-colors duration-200 ${
            value === opt.value ? colorClasses[opt.color].active : colorClasses[opt.color].inactive
          }`}
        >
          {opt.label}
        </motion.button>
      ))}
    </div>
  );
}

function StatusBadge({ status, size = 'md' }: { status: InvoiceStatus; size?: 'sm' | 'md' }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const colorClasses: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-100 text-blue-600',
    emerald: 'bg-emerald-100 text-emerald-600'
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${colorClasses[config.color] || colorClasses.slate} ${
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
    }`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {config.label}
    </span>
  );
}

function EmptyState({ onAddPosition }: { onAddPosition: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-6">
        <FileSpreadsheet className="w-10 h-10 text-slate-300" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-2">Starten Sie Ihre Rechnung</h3>
      <p className="text-sm text-slate-500 text-center mb-6 max-w-xs">
        Fügen Sie Ihre erste Position hinzu, um mit der Rechnungserstellung zu beginnen.
      </p>
      <motion.button onClick={onAddPosition} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800">
        <Plus className="w-4 h-4" />
        Erste Position hinzufügen
      </motion.button>
    </motion.div>
  );
}

function ArchiveModal({ isOpen, onClose, onLoad, onDuplicate, onDelete, onStatusChange, invoices, searchTerm, setSearchTerm }: {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (invoice: ArchivedInvoice) => void;
  onDuplicate: (invoice: ArchivedInvoice) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: InvoiceStatus) => void;
  invoices: ArchivedInvoice[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const filteredInvoices = invoices.filter(inv =>
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/50 backdrop-blur-sm pt-20 px-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: -20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: -20 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mb-20"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Archive className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Rechnungsarchiv</h2>
              <p className="text-sm text-slate-500">{invoices.length} Rechnungen</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Suchen nach Nummer oder Kunde..."
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>
        </div>

        {/* Invoice List */}
        <div className="max-h-[50vh] overflow-y-auto">
          {filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Archive className="w-12 h-12 text-slate-200 mb-4" />
              <p className="text-slate-500 text-sm">
                {searchTerm ? 'Keine Rechnungen gefunden' : 'Noch keine Rechnungen archiviert'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredInvoices.map(invoice => (
                <div
                  key={invoice.id}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group"
                >
                  <button
                    onClick={() => onLoad(invoice)}
                    className="flex-1 flex items-center gap-4 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-900 truncate">{invoice.invoiceNumber}</span>
                        <StatusBadge status={invoice.status} size="sm" />
                      </div>
                      <p className="text-sm text-slate-500 truncate">{invoice.customerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900 tabular-nums">{formatCurrency(invoice.totalGross)} €</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {formatDateShort(new Date(invoice.updatedAt))}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </button>

                  {/* Actions Menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === invoice.id ? null : invoice.id);
                      }}
                      className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>

                    <AnimatePresence>
                      {menuOpen === invoice.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-10"
                        >
                          <button
                            onClick={() => { onDuplicate(invoice); setMenuOpen(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <Copy className="w-4 h-4" /> Duplizieren
                          </button>
                          <div className="border-t border-slate-100 my-1" />
                          <p className="px-3 py-1 text-xs text-slate-400 font-medium">Status ändern</p>
                          {(['draft', 'sent', 'paid'] as InvoiceStatus[]).map(status => (
                            <button
                              key={status}
                              onClick={() => { onStatusChange(invoice.id, status); setMenuOpen(null); }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${
                                invoice.status === status ? 'text-blue-600 bg-blue-50' : 'text-slate-700'
                              }`}
                            >
                              <StatusBadge status={status} size="sm" />
                            </button>
                          ))}
                          <div className="border-t border-slate-100 my-1" />
                          <button
                            onClick={() => { onDelete(invoice.id); setMenuOpen(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" /> Löschen
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function InvoiceNumberSettings({ isOpen, onClose, settings, onSave }: {
  isOpen: boolean;
  onClose: () => void;
  settings: InvoiceNumberSettings;
  onSave: (settings: InvoiceNumberSettings) => void;
}) {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const previewNumber = `${localSettings.prefix}${localSettings.separator}${
    localSettings.yearFormat === '4' ? new Date().getFullYear() : new Date().getFullYear().toString().slice(-2)
  }${localSettings.separator}${(localSettings.lastNumber + 1).toString().padStart(localSettings.numberLength, '0')}`;

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Rechnungsnummer-Format</h3>
        </div>

        <div className="space-y-4">
          {/* Preview */}
          <div className="p-4 rounded-xl bg-slate-100 text-center">
            <p className="text-xs text-slate-500 mb-1">Vorschau nächste Nummer</p>
            <p className="text-xl font-bold text-slate-900 font-mono">{previewNumber}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Präfix</label>
              <input
                type="text"
                value={localSettings.prefix}
                onChange={e => setLocalSettings(s => ({ ...s, prefix: e.target.value }))}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Trennzeichen</label>
              <input
                type="text"
                value={localSettings.separator}
                onChange={e => setLocalSettings(s => ({ ...s, separator: e.target.value }))}
                maxLength={1}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Jahr-Format</label>
              <select
                value={localSettings.yearFormat}
                onChange={e => setLocalSettings(s => ({ ...s, yearFormat: e.target.value as '4' | '2' }))}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 cursor-pointer focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              >
                <option value="4">4-stellig (2026)</option>
                <option value="2">2-stellig (26)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Nummernlänge</label>
              <select
                value={localSettings.numberLength}
                onChange={e => setLocalSettings(s => ({ ...s, numberLength: parseInt(e.target.value) }))}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 cursor-pointer focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              >
                <option value={3}>3-stellig (001)</option>
                <option value={4}>4-stellig (0001)</option>
                <option value={5}>5-stellig (00001)</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={localSettings.resetOnYearChange}
              onChange={e => setLocalSettings(s => ({ ...s, resetOnYearChange: e.target.checked }))}
              className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">Bei Jahreswechsel auf 1 zurücksetzen</span>
          </label>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2.5 min-h-[44px] rounded-xl text-slate-600 hover:bg-slate-100 font-medium">
            Abbrechen
          </button>
          <button
            onClick={() => { onSave(localSettings); onClose(); }}
            className="px-4 py-2.5 min-h-[44px] rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            Speichern
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function InvoicePreview({ rechnung, verkaeufer, kaeufer, positionen, summen, brutto, previewRef }: {
  rechnung: Rechnung; verkaeufer: Verkaeufer; kaeufer: Kaeufer;
  positionen: Position[]; summen: Summen; brutto: number; previewRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={previewRef}
      className="bg-white mx-auto invoice-paper"
      style={{ width: '210mm', minHeight: '297mm', padding: '20mm', boxSizing: 'border-box' }}
    >
      {/* Absender-Rücksendezeile */}
      <p className="text-[9px] text-gray-400 underline decoration-gray-300 underline-offset-2 mb-2 print:text-gray-500 print:no-underline">
        {verkaeufer.firma || 'Firma'} · {verkaeufer.strasse || 'Straße'} · {verkaeufer.plz} {verkaeufer.ort}
      </p>

      {/* Adressfeld + Infoblock */}
      <div className="flex justify-between items-start" style={{ minHeight: '35mm' }}>
        <div style={{ width: '85mm' }}>
          <p className="font-semibold text-gray-900 text-[11pt]">{kaeufer.firma || '—'}</p>
          {kaeufer.ansprechpartner && <p className="text-gray-700 text-[10pt]">{kaeufer.ansprechpartner}</p>}
          <p className="text-gray-700 text-[10pt]">{kaeufer.strasse || '—'}</p>
          <p className="text-gray-700 text-[10pt]">{kaeufer.plz} {kaeufer.ort}</p>
        </div>
        <div className="text-right" style={{ width: '70mm' }}>
          <p className="text-[22pt] font-black text-gray-900 tracking-tight leading-none mb-3">RECHNUNG</p>
          <table className="ml-auto text-[9pt]">
            <tbody>
              <tr><td className="text-gray-500 pr-3 py-0.5 text-left">Rechnungs-Nr.:</td><td className="text-gray-900 font-medium tabular-nums text-right">{rechnung.nummer || '—'}</td></tr>
              <tr><td className="text-gray-500 pr-3 py-0.5 text-left">Datum:</td><td className="text-gray-900 tabular-nums text-right">{formatDate(rechnung.datum)}</td></tr>
              {rechnung.leistungszeitraum && <tr><td className="text-gray-500 pr-3 py-0.5 text-left">Leistungszeitraum:</td><td className="text-gray-900 text-right">{rechnung.leistungszeitraum}</td></tr>}
              {kaeufer.kundennummer && <tr><td className="text-gray-500 pr-3 py-0.5 text-left">Kunden-Nr.:</td><td className="text-gray-900 tabular-nums text-right">{kaeufer.kundennummer}</td></tr>}
              <tr><td className="text-gray-500 pr-3 py-0.5 text-left">Fällig bis:</td><td className="text-gray-900 font-medium tabular-nums text-right">{formatDate(rechnung.faelligkeit)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Betreffzeile */}
      <div style={{ marginTop: '12mm', marginBottom: '6mm' }}>
        <p className="text-[11pt] text-gray-900 font-semibold">
          Rechnung für erbrachte Leistungen{rechnung.leistungszeitraum && ` – ${rechnung.leistungszeitraum}`}
        </p>
      </div>

      {/* Positionen-Tabelle */}
      <table className="w-full text-[9pt]" style={{ marginBottom: '8mm' }}>
        <thead>
          <tr className="border-b-2 border-gray-900">
            <th className="text-left py-2 font-semibold text-gray-700 w-8">Pos</th>
            <th className="text-left py-2 font-semibold text-gray-700">Beschreibung</th>
            <th className="text-right py-2 font-semibold text-gray-700 w-14">Menge</th>
            <th className="text-right py-2 font-semibold text-gray-700 w-16">E-Preis</th>
            <th className="text-right py-2 font-semibold text-gray-700 w-18">Betrag</th>
          </tr>
        </thead>
        <tbody>
          {positionen.filter(p => p.bezeichnung).map((pos, idx) => (
            <tr key={pos.id} className="border-b border-gray-200">
              <td className="py-2 text-gray-500 tabular-nums align-top">{idx + 1}</td>
              <td className="py-2 text-gray-900 align-top">{pos.bezeichnung}</td>
              <td className="py-2 text-right text-gray-700 tabular-nums align-top">{pos.menge} {pos.einheit}</td>
              <td className="py-2 text-right text-gray-700 tabular-nums align-top">{formatCurrency(pos.preis)} €</td>
              <td className="py-2 text-right text-gray-900 font-medium tabular-nums align-top">{formatCurrency(pos.menge * pos.preis)} €</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summenblock */}
      <div className="flex justify-end" style={{ marginBottom: '8mm' }}>
        <div style={{ width: '65mm' }}>
          <table className="w-full text-[9pt]">
            <tbody>
              <tr><td className="py-1 text-gray-600">Nettobetrag:</td><td className="py-1 text-right text-gray-900 tabular-nums font-medium">{formatCurrency(summen.netto)} €</td></tr>
              {summen.ust19 > 0 && <tr><td className="py-1 text-gray-600">+ USt 19%:</td><td className="py-1 text-right text-gray-700 tabular-nums">{formatCurrency(summen.ust19)} €</td></tr>}
              {summen.ust7 > 0 && <tr><td className="py-1 text-gray-600">+ USt 7%:</td><td className="py-1 text-right text-gray-700 tabular-nums">{formatCurrency(summen.ust7)} €</td></tr>}
              <tr className="border-t-2 border-gray-900">
                <td className="py-2 text-gray-900 font-bold text-[11pt]">Gesamtbetrag:</td>
                <td className="py-2 text-right text-gray-900 font-black text-[13pt] tabular-nums">{formatCurrency(brutto)} €</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* §35a Ausweisung */}
      {(summen.lohn > 0 || summen.material > 0) && (
        <div className="border border-gray-300 rounded p-3 text-[8pt]" style={{ marginBottom: '8mm' }}>
          <p className="font-semibold text-gray-700 mb-1">Ausweisung gemäß §35a EStG (Handwerkerleistungen):</p>
          <div className="flex gap-6 text-gray-600">
            <span>Lohnkosten: <strong className="text-gray-900 tabular-nums">{formatCurrency(summen.lohn)} €</strong></span>
            <span>Materialkosten: <strong className="text-gray-900 tabular-nums">{formatCurrency(summen.material)} €</strong></span>
          </div>
        </div>
      )}

      {/* Zahlungshinweis */}
      <div className="text-[9pt] text-gray-700" style={{ marginBottom: '12mm' }}>
        <p>Bitte überweisen Sie den Rechnungsbetrag bis zum <strong>{formatDate(rechnung.faelligkeit)}</strong> auf das unten angegebene Konto.</p>
        <p className="mt-1">Vielen Dank für Ihren Auftrag!</p>
      </div>

      {/* Spacer */}
      <div style={{ minHeight: '15mm' }} />

      {/* Footer */}
      <div className="border-t border-gray-300 pt-4 mt-auto">
        <div className="grid grid-cols-3 gap-4 text-[8pt] text-gray-500">
          <div>
            <p className="font-semibold text-gray-700 mb-1">{verkaeufer.firma}</p>
            <p>{verkaeufer.strasse}</p>
            <p>{verkaeufer.plz} {verkaeufer.ort}</p>
            {verkaeufer.telefon && <p>Tel: {verkaeufer.telefon}</p>}
            {verkaeufer.email && <p>{verkaeufer.email}</p>}
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1">Bankverbindung</p>
            {verkaeufer.iban && <p>IBAN: {verkaeufer.iban}</p>}
            {verkaeufer.bic && <p>BIC: {verkaeufer.bic}</p>}
            {verkaeufer.bank && <p>{verkaeufer.bank}</p>}
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1">Steuerdaten</p>
            {verkaeufer.ustId && <p>USt-IdNr.: {verkaeufer.ustId}</p>}
            {verkaeufer.steuernummer && <p>St.-Nr.: {verkaeufer.steuernummer}</p>}
            {verkaeufer.handelsregister && <p>{verkaeufer.handelsregister}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Home() {
  const today = new Date().toISOString().split('T')[0];
  const in14Days = addDays(today, 14);

  // State
  const [activeTab, setActiveTab] = useState<'eingabe' | 'vorschau'>('eingabe');
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [attemptedExport, setAttemptedExport] = useState(false);
  const [faelligkeitManuallySet, setFaelligkeitManuallySet] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState<ArchivedInvoice | null>(null);

  // Archive State
  const [showArchive, setShowArchive] = useState(false);
  const [archiveSearchTerm, setArchiveSearchTerm] = useState('');
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Invoice Number Settings
  const [showNumberSettings, setShowNumberSettings] = useState(false);
  const [numberSettings, setNumberSettings] = useState<InvoiceNumberSettings>(getDefaultSettings());
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  // PDF Generation
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Form State
  const [rechnung, setRechnung] = useState<Rechnung>(() => createInitialRechnung(today, in14Days));
  const [verkaeufer, setVerkaeufer] = useState<Verkaeufer>(createInitialVerkaeufer);
  const [kaeufer, setKaeufer] = useState<Kaeufer>(createInitialKaeufer);
  const [positionen, setPositionen] = useState<Position[]>([]);

  // Refs
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Live Query for invoices
  const invoices = useLiveQuery(() => db.invoices.orderBy('updatedAt').reverse().toArray(), []) ?? [];

  // Toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Initialize: Migrate and load settings
  useEffect(() => {
    const init = async () => {
      await migrateFromLocalStorage();
      const settings = await db.settings.get('invoice-number-settings');
      if (settings) {
        setNumberSettings(settings);
      }
      setIsLoaded(true);
    };
    init();
  }, []);

  // Load from localStorage for backward compatibility
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data: FormState = JSON.parse(saved);
        if (data.rechnung) setRechnung(data.rechnung);
        if (data.verkaeufer) setVerkaeufer(data.verkaeufer);
        if (data.kaeufer) setKaeufer(data.kaeufer);
        if (data.positionen) setPositionen(data.positionen);
      }
    } catch (e) {
      console.error('Failed to load:', e);
    }
  }, [isLoaded]);

  // Auto-save with debounce
  useEffect(() => {
    if (!isLoaded) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ rechnung, verkaeufer, kaeufer, positionen }));
        setHasUnsavedChanges(true);
      } catch (e) {
        console.error('Failed to save:', e);
      }
    }, 500);

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [rechnung, verkaeufer, kaeufer, positionen, isLoaded]);

  // Auto-calculate due date
  useEffect(() => {
    if (!faelligkeitManuallySet && rechnung.datum) {
      setRechnung(prev => ({ ...prev, faelligkeit: addDays(prev.datum, 14) }));
    }
  }, [rechnung.datum, faelligkeitManuallySet]);

  // Check for duplicate invoice number
  useEffect(() => {
    const checkDuplicate = async () => {
      if (rechnung.nummer) {
        const isDuplicate = await checkDuplicateInvoiceNumber(rechnung.nummer, currentInvoiceId ?? undefined);
        setDuplicateWarning(isDuplicate);
      } else {
        setDuplicateWarning(false);
      }
    };
    checkDuplicate();
  }, [rechnung.nummer, currentInvoiceId]);

  // Computed values
  const summen = calculateSummen(positionen);
  const brutto = summen.netto + summen.ust19 + summen.ust7;
  const errors = validateForm(rechnung, verkaeufer, kaeufer, positionen);
  const isValid = errors.length === 0;
  const progress = calculateProgress(rechnung, verkaeufer, kaeufer, positionen);

  // Handlers
  const markTouched = useCallback((field: string) => {
    setTouchedFields(prev => new Set(prev).add(field));
  }, []);

  const shouldShowError = useCallback((field: string) => attemptedExport || touchedFields.has(field), [attemptedExport, touchedFields]);

  const handleRechnungChange = useCallback((field: keyof Rechnung) => (e: ChangeEvent<HTMLInputElement>) => {
    setRechnung(prev => ({ ...prev, [field]: e.target.value }));
  }, []);

  const handleVerkaeuferChange = useCallback((field: keyof Verkaeufer) => (e: ChangeEvent<HTMLInputElement>) => {
    setVerkaeufer(prev => ({ ...prev, [field]: e.target.value }));
  }, []);

  const handleKaeuferChange = useCallback((field: keyof Kaeufer) => (e: ChangeEvent<HTMLInputElement>) => {
    setKaeufer(prev => ({ ...prev, [field]: e.target.value }));
  }, []);

  const addPosition = useCallback(() => {
    setPositionen(prev => [...prev, { id: generateId(), bezeichnung: '', typ: 'L', menge: 1, einheit: 'Std', preis: 0, ust: 19 }]);
  }, []);

  const removePosition = useCallback((id: string) => {
    setPositionen(prev => prev.filter(p => p.id !== id));
  }, []);

  const updatePosition = useCallback((id: string, updates: Partial<Position>) => {
    setPositionen(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  // Auto-generate invoice number
  const autoGenerateNumber = useCallback(async () => {
    const newNumber = await generateInvoiceNumber();
    setRechnung(prev => ({ ...prev, nummer: newNumber }));
    showToast('Rechnungsnummer generiert', 'success');
  }, [showToast]);

  // Reset form
  const resetForm = useCallback(async () => {
    const nextNumber = await getNextInvoiceNumber();
    setRechnung({ ...createInitialRechnung(today, in14Days), nummer: nextNumber });
    setVerkaeufer(createInitialVerkaeufer());
    setKaeufer(createInitialKaeufer());
    setPositionen([]);
    setTouchedFields(new Set());
    setAttemptedExport(false);
    setFaelligkeitManuallySet(false);
    setCurrentInvoiceId(null);
    setHasUnsavedChanges(false);
    localStorage.removeItem(STORAGE_KEY);
    setShowResetConfirm(false);
    showToast('Neue Rechnung erstellt', 'info');
  }, [today, in14Days, showToast]);

  // Save to archive
  const saveToArchive = useCallback(async (saveAsNew = false) => {
    const invoiceData: InvoiceData = { rechnung, verkaeufer, kaeufer, positionen };

    if (currentInvoiceId && !saveAsNew) {
      // Update existing
      await db.invoices.update(currentInvoiceId, {
        invoiceNumber: rechnung.nummer || 'Entwurf',
        customerName: kaeufer.firma || 'Unbekannt',
        totalGross: brutto,
        updatedAt: new Date(),
        data: invoiceData
      });
      setHasUnsavedChanges(false);
      showToast('Rechnung aktualisiert', 'success');
    } else {
      // Create new
      const newId = crypto.randomUUID();
      await db.invoices.add({
        id: newId,
        invoiceNumber: rechnung.nummer || 'Entwurf',
        customerName: kaeufer.firma || 'Unbekannt',
        totalGross: brutto,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
        data: invoiceData
      });
      setCurrentInvoiceId(newId);
      setHasUnsavedChanges(false);
      showToast('Rechnung im Archiv gespeichert', 'success');
    }
  }, [rechnung, verkaeufer, kaeufer, positionen, brutto, currentInvoiceId, showToast]);

  // Load from archive
  const loadFromArchive = useCallback((invoice: ArchivedInvoice) => {
    if (hasUnsavedChanges) {
      setShowUnsavedWarning(invoice);
      return;
    }
    setRechnung(invoice.data.rechnung);
    setVerkaeufer(invoice.data.verkaeufer);
    setKaeufer(invoice.data.kaeufer);
    setPositionen(invoice.data.positionen);
    setCurrentInvoiceId(invoice.id);
    setHasUnsavedChanges(false);
    setShowArchive(false);
    showToast(`Rechnung ${invoice.invoiceNumber} geladen`, 'success');
  }, [hasUnsavedChanges, showToast]);

  const confirmLoadFromArchive = useCallback(() => {
    if (showUnsavedWarning) {
      setRechnung(showUnsavedWarning.data.rechnung);
      setVerkaeufer(showUnsavedWarning.data.verkaeufer);
      setKaeufer(showUnsavedWarning.data.kaeufer);
      setPositionen(showUnsavedWarning.data.positionen);
      setCurrentInvoiceId(showUnsavedWarning.id);
      setHasUnsavedChanges(false);
      setShowArchive(false);
      setShowUnsavedWarning(null);
      showToast(`Rechnung ${showUnsavedWarning.invoiceNumber} geladen`, 'success');
    }
  }, [showUnsavedWarning, showToast]);

  // Duplicate invoice
  const duplicateInvoice = useCallback(async (invoice: ArchivedInvoice) => {
    const nextNumber = await generateInvoiceNumber();
    setRechnung({ ...invoice.data.rechnung, nummer: nextNumber, datum: today, faelligkeit: in14Days });
    setVerkaeufer(invoice.data.verkaeufer);
    setKaeufer(invoice.data.kaeufer);
    setPositionen(invoice.data.positionen.map(p => ({ ...p, id: generateId() })));
    setCurrentInvoiceId(null);
    setHasUnsavedChanges(true);
    setShowArchive(false);
    showToast('Rechnung dupliziert', 'success');
  }, [today, in14Days, showToast]);

  // Delete from archive
  const deleteFromArchive = useCallback(async (id: string) => {
    await db.invoices.delete(id);
    if (currentInvoiceId === id) {
      setCurrentInvoiceId(null);
    }
    setShowDeleteConfirm(null);
    showToast('Rechnung gelöscht', 'info');
  }, [currentInvoiceId, showToast]);

  // Update invoice status
  const updateInvoiceStatus = useCallback(async (id: string, status: InvoiceStatus) => {
    await db.invoices.update(id, { status, updatedAt: new Date() });
    showToast(`Status geändert: ${STATUS_CONFIG[status].label}`, 'success');
  }, [showToast]);

  // Save number settings
  const saveNumberSettings = useCallback(async (settings: InvoiceNumberSettings) => {
    await db.settings.put(settings);
    setNumberSettings(settings);
    showToast('Einstellungen gespeichert', 'success');
  }, [showToast]);

  const fillExampleData = useCallback(() => {
    setRechnung({
      nummer: `RE-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(4, '0')}`,
      datum: today, faelligkeit: in14Days, leistungszeitraum: today.slice(0, 7),
      art: '380 - Rechnung', leitwegId: '', bestellnummer: ''
    });
    setVerkaeufer({
      firma: 'Müller Elektrotechnik GmbH', strasse: 'Handwerkerweg 15', plz: '80331', ort: 'München',
      ustId: 'DE123456789', steuernummer: '143/123/12345', iban: 'DE89 3704 0044 0532 0130 00',
      bic: 'COBADEFFXXX', bank: 'Commerzbank', handelsregister: 'HRB 12345 München',
      telefon: '089 123456', email: 'info@mueller-elektro.de'
    });
    setKaeufer({
      firma: 'Hausverwaltung Schmidt & Partner', strasse: 'Kundenplatz 7', plz: '80333', ort: 'München',
      ustId: 'DE987654321', ansprechpartner: 'Frau Weber', email: 'buchhaltung@schmidt-hv.de', kundennummer: 'K-2024-0042'
    });
    setPositionen([
      { id: '1', bezeichnung: 'Elektroinstallation Küche komplett', typ: 'L', menge: 8, einheit: 'Std', preis: 65, ust: 19 },
      { id: '2', bezeichnung: 'Kabel NYM-J 3x2,5', typ: 'M', menge: 50, einheit: 'm', preis: 2.80, ust: 19 },
      { id: '3', bezeichnung: 'Steckdosen & Schalter (Gira)', typ: 'M', menge: 12, einheit: 'Stk', preis: 18.50, ust: 19 },
      { id: '4', bezeichnung: 'Anfahrt München-Innenstadt', typ: 'F', menge: 1, einheit: 'psch', preis: 35, ust: 19 }
    ]);
    showToast('Demo-Daten geladen', 'success');
  }, [today, in14Days, showToast]);

  const copyXML = useCallback(async () => {
    const xml = generateXRechnungXML(rechnung, verkaeufer, kaeufer, positionen);
    await navigator.clipboard.writeText(xml);
    showToast('XRechnung in Zwischenablage kopiert', 'success');
  }, [rechnung, verkaeufer, kaeufer, positionen, showToast]);

  const downloadXML = useCallback(() => {
    setAttemptedExport(true);
    if (!isValid) {
      showToast('Bitte alle Pflichtfelder ausfüllen', 'error');
      return;
    }
    const xml = generateXRechnungXML(rechnung, verkaeufer, kaeufer, positionen);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `XRechnung_${rechnung.nummer || 'Entwurf'}_${today}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('XRechnung wurde gespeichert', 'success');
  }, [isValid, rechnung, verkaeufer, kaeufer, positionen, today, showToast]);

  // PDF Export
  const downloadPDF = useCallback(async () => {
    setAttemptedExport(true);
    if (!isValid) {
      showToast('Bitte alle Pflichtfelder ausfüllen', 'error');
      return;
    }

    setIsGeneratingPdf(true);
    setActiveTab('vorschau');

    // Wait for tab switch and render
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      const element = previewRef.current;
      if (!element) {
        throw new Error('Preview element not found');
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Rechnung-${rechnung.nummer || 'Entwurf'}-${today}.pdf`);

      showToast('PDF wurde erstellt', 'success');
    } catch (error) {
      console.error('PDF generation failed:', error);
      showToast('PDF-Erstellung fehlgeschlagen', 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [isValid, rechnung.nummer, today, showToast]);

  const handlePrint = useCallback(() => {
    setActiveTab('vorschau');
    setTimeout(() => window.print(), 100);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 print:bg-white print:min-h-0">
      {/* Toast Container */}
      <div className="fixed bottom-20 lg:bottom-4 right-4 z-[90] flex flex-col gap-2 print:hidden">
        <AnimatePresence>
          {toasts.map(toast => (
            <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
          ))}
        </AnimatePresence>
      </div>

      {/* Dialogs */}
      <AnimatePresence>
        {showResetConfirm && (
          <ConfirmDialog
            title="Neue Rechnung?"
            message="Alle eingegebenen Daten werden unwiderruflich gelöscht."
            onConfirm={resetForm}
            onCancel={() => setShowResetConfirm(false)}
          />
        )}
        {showDeleteConfirm && (
          <ConfirmDialog
            title="Rechnung löschen?"
            message="Diese Rechnung wird unwiderruflich aus dem Archiv gelöscht."
            confirmText="Ja, löschen"
            onConfirm={() => deleteFromArchive(showDeleteConfirm)}
            onCancel={() => setShowDeleteConfirm(null)}
          />
        )}
        {showUnsavedWarning && (
          <ConfirmDialog
            title="Ungespeicherte Änderungen"
            message="Sie haben ungespeicherte Änderungen. Möchten Sie trotzdem fortfahren?"
            confirmText="Fortfahren"
            confirmColor="blue"
            onConfirm={confirmLoadFromArchive}
            onCancel={() => setShowUnsavedWarning(null)}
          />
        )}
      </AnimatePresence>

      {/* Archive Modal */}
      <AnimatePresence>
        {showArchive && (
          <ArchiveModal
            isOpen={showArchive}
            onClose={() => setShowArchive(false)}
            onLoad={loadFromArchive}
            onDuplicate={duplicateInvoice}
            onDelete={(id) => setShowDeleteConfirm(id)}
            onStatusChange={updateInvoiceStatus}
            invoices={invoices}
            searchTerm={archiveSearchTerm}
            setSearchTerm={setArchiveSearchTerm}
          />
        )}
      </AnimatePresence>

      {/* Invoice Number Settings Modal */}
      <AnimatePresence>
        {showNumberSettings && (
          <InvoiceNumberSettings
            isOpen={showNumberSettings}
            onClose={() => setShowNumberSettings(false)}
            settings={numberSettings}
            onSave={saveNumberSettings}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <motion.div whileHover={{ scale: 1.05, rotate: 5 }}
                className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <FileText className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900 tracking-tight">E-Rechnung</h1>
                <p className="text-xs text-slate-500 -mt-0.5">Handwerk Edition</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Archive Button */}
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowArchive(true)}
                className="relative flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-slate-600 hover:bg-slate-100 transition-all"
                title="Rechnungsarchiv">
                <Archive className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">Archiv</span>
                {invoices.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                    {invoices.length}
                  </span>
                )}
              </motion.button>

              {/* New Invoice Button */}
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-slate-600 hover:bg-slate-100 transition-all"
                title="Neue Rechnung erstellen">
                <FilePlus className="w-4 h-4" />
                <span className="hidden sm:inline text-sm font-medium">Neu</span>
              </motion.button>

              {/* Print */}
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={handlePrint} className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl text-slate-500 hover:bg-slate-100 transition-all flex items-center justify-center" title="Drucken">
                <Printer className="w-4 h-4" />
              </motion.button>

              {/* Demo */}
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={fillExampleData}
                className="hidden sm:flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all">
                <Sparkles className="w-4 h-4" />
                Demo
              </motion.button>

              {/* Save to Archive Button */}
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => saveToArchive()}
                className={`hidden lg:flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all ${
                  hasUnsavedChanges ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title={currentInvoiceId ? 'Änderungen speichern' : 'Im Archiv speichern'}>
                {hasUnsavedChanges && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />}
                Speichern
              </motion.button>
            </div>
          </div>
        </div>
        <ProgressBar progress={progress} />
      </header>

      {/* Privacy Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100/50 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center justify-center gap-2 text-sm text-blue-700">
            <Shield className="w-4 h-4" />
            <span><span className="font-medium">100% lokal</span> · Keine Cloud · Auto-Save aktiv</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-36 print:p-0 print:max-w-none print:pb-0 print:mx-0">
        {/* Status Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-4 rounded-2xl flex items-center gap-4 border transition-all print:hidden ${
            isValid ? 'bg-emerald-50/80 border-emerald-200' : 'bg-white border-slate-200'
          }`}>
          {isValid ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </motion.div>
          ) : (
            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-slate-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className={`font-semibold ${isValid ? 'text-emerald-900' : 'text-slate-700'}`}>
              {isValid ? 'Bereit zum Export!' : `${progress}% ausgefüllt`}
            </p>
            <p className={`text-sm ${isValid ? 'text-emerald-700' : 'text-slate-500'}`}>
              {isValid ? 'XRechnung & PDF können erstellt werden' :
                attemptedExport && errors.length > 0 ? `Fehlend: ${errors.slice(0, 3).join(', ')}` : 'Füllen Sie die Pflichtfelder aus'}
            </p>
          </div>
          {isValid && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={copyXML}
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-all">
              <Copy className="w-4 h-4" />
              Kopieren
            </motion.button>
          )}
          <button onClick={fillExampleData} className="sm:hidden p-2.5 min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </button>
        </motion.div>

        {/* Tab Toggle */}
        <div className="flex gap-1 mb-6 bg-slate-200/50 p-1 rounded-xl w-fit print:hidden">
          {(['eingabe', 'vorschau'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`relative px-5 py-2.5 min-h-[44px] rounded-lg font-medium text-sm transition-all ${activeTab === tab ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
              {activeTab === tab && (
                <motion.div layoutId="activeTab" className="absolute inset-0 bg-white shadow-sm rounded-lg"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
              )}
              <span className="relative z-10">{tab === 'eingabe' ? 'Eingabe' : 'Vorschau'}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'eingabe' ? (
            <motion.div key="eingabe" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-5 print:hidden">

              {/* Rechnungsdaten */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-shadow duration-300 hover:shadow-md">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Receipt className="w-4 h-4 text-slate-600" /></div>
                  <h2 className="text-base font-semibold text-slate-900">Rechnungsdaten</h2>
                  {currentInvoiceId && (
                    <span className="ml-auto text-xs text-slate-400">Archiv-ID: {currentInvoiceId.slice(0, 8)}...</span>
                  )}
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <FormInput
                      label="Rechnungsnummer"
                      value={rechnung.nummer}
                      onChange={handleRechnungChange('nummer')}
                      onBlur={() => markTouched('rechnung.nummer')}
                      required
                      showError={shouldShowError('rechnung.nummer')}
                      placeholder="RE-2026-0001"
                      suffix={
                        <div className="flex">
                          <button
                            onClick={autoGenerateNumber}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Auto-generieren"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowNumberSettings(true)}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            title="Einstellungen"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>
                      }
                    />
                    {duplicateWarning && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Nummer bereits vergeben
                      </p>
                    )}
                  </div>
                  <FormInput label="Rechnungsdatum" type="date" value={rechnung.datum} onChange={handleRechnungChange('datum')}
                    onBlur={() => markTouched('rechnung.datum')} required showError={shouldShowError('rechnung.datum')} />
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">
                      Fälligkeitsdatum {!faelligkeitManuallySet && <span className="text-xs text-blue-500">(+14 Tage)</span>}
                    </label>
                    <input type="date" value={rechnung.faelligkeit}
                      onChange={e => { setFaelligkeitManuallySet(true); setRechnung(prev => ({ ...prev, faelligkeit: e.target.value })); }}
                      className="w-full min-h-[44px] h-11 px-4 rounded-xl border border-slate-200/80 bg-slate-50/80 text-slate-900 text-base transition-all duration-200 outline-none ring-1 ring-transparent hover:border-slate-300 hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500/20 focus:shadow-sm" />
                  </div>
                  <FormInput label="Leistungszeitraum" value={rechnung.leistungszeitraum} onChange={handleRechnungChange('leistungszeitraum')} placeholder="Januar 2026" />
                </div>
              </section>

              {/* Verkäufer & Käufer Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Verkäufer */}
                <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-shadow duration-300 hover:shadow-md">
                  <div className="px-5 py-3 border-b border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shadow-sm"><Building2 className="w-4 h-4 text-white" /></div>
                    <h2 className="text-base font-semibold text-slate-900">Ihre Firma</h2>
                  </div>
                  <div className="p-5 space-y-4">
                    <FormInput label="Firmenname" value={verkaeufer.firma} onChange={handleVerkaeuferChange('firma')}
                      onBlur={() => markTouched('verkaeufer.firma')} required showError={shouldShowError('verkaeufer.firma')} placeholder="Mustermann Elektro GmbH" />
                    <FormInput label="Straße & Hausnummer" value={verkaeufer.strasse} onChange={handleVerkaeuferChange('strasse')}
                      onBlur={() => markTouched('verkaeufer.strasse')} required showError={shouldShowError('verkaeufer.strasse')} placeholder="Handwerkerstraße 42" />
                    <div className="grid grid-cols-3 gap-3">
                      <FormInput label="PLZ" value={verkaeufer.plz} onChange={handleVerkaeuferChange('plz')}
                        onBlur={() => markTouched('verkaeufer.plz')} required showError={shouldShowError('verkaeufer.plz')} placeholder="12345" validate={isValidPLZ} />
                      <FormInput label="Ort" value={verkaeufer.ort} onChange={handleVerkaeuferChange('ort')}
                        onBlur={() => markTouched('verkaeufer.ort')} required showError={shouldShowError('verkaeufer.ort')} placeholder="München" className="col-span-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormInput label="USt-IdNr." value={verkaeufer.ustId} onChange={handleVerkaeuferChange('ustId')}
                        onBlur={() => markTouched('verkaeufer.ustId')} required={!verkaeufer.steuernummer}
                        showError={shouldShowError('verkaeufer.ustId') && !verkaeufer.steuernummer} placeholder="DE123456789" />
                      <FormInput label="Steuernummer" value={verkaeufer.steuernummer} onChange={handleVerkaeuferChange('steuernummer')} placeholder="143/123/12345" />
                    </div>
                    <FormInput label="IBAN" value={verkaeufer.iban} onChange={handleVerkaeuferChange('iban')} placeholder="DE89 3704 0044 0532 0130 00" />
                    <div className="grid grid-cols-2 gap-3">
                      <FormInput label="Bank" value={verkaeufer.bank} onChange={handleVerkaeuferChange('bank')} placeholder="Sparkasse" />
                      <FormInput label="Handelsregister" value={verkaeufer.handelsregister} onChange={handleVerkaeuferChange('handelsregister')} placeholder="HRB 12345" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormInput label="Telefon" value={verkaeufer.telefon} onChange={handleVerkaeuferChange('telefon')} placeholder="089 123456" />
                      <FormInput label="E-Mail" value={verkaeufer.email} onChange={handleVerkaeuferChange('email')} placeholder="info@firma.de" validate={isValidEmail} />
                    </div>
                  </div>
                </section>

                {/* Käufer */}
                <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-shadow duration-300 hover:shadow-md">
                  <div className="px-5 py-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm"><User className="w-4 h-4 text-white" /></div>
                    <h2 className="text-base font-semibold text-slate-900">Kunde</h2>
                  </div>
                  <div className="p-5 space-y-4">
                    <FormInput label="Firma / Name" value={kaeufer.firma} onChange={handleKaeuferChange('firma')}
                      onBlur={() => markTouched('kaeufer.firma')} required showError={shouldShowError('kaeufer.firma')} placeholder="Kunde GmbH" />
                    <FormInput label="Straße & Hausnummer" value={kaeufer.strasse} onChange={handleKaeuferChange('strasse')}
                      onBlur={() => markTouched('kaeufer.strasse')} required showError={shouldShowError('kaeufer.strasse')} placeholder="Kundenstraße 1" />
                    <div className="grid grid-cols-3 gap-3">
                      <FormInput label="PLZ" value={kaeufer.plz} onChange={handleKaeuferChange('plz')}
                        onBlur={() => markTouched('kaeufer.plz')} required showError={shouldShowError('kaeufer.plz')} placeholder="54321" validate={isValidPLZ} />
                      <FormInput label="Ort" value={kaeufer.ort} onChange={handleKaeuferChange('ort')}
                        onBlur={() => markTouched('kaeufer.ort')} required showError={shouldShowError('kaeufer.ort')} placeholder="Kundenstadt" className="col-span-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormInput label="Kunden-Nr." value={kaeufer.kundennummer} onChange={handleKaeuferChange('kundennummer')} placeholder="K-2024-001" />
                      <FormInput label="USt-IdNr." value={kaeufer.ustId} onChange={handleKaeuferChange('ustId')} placeholder="DE987654321" />
                    </div>
                    <FormInput label="Ansprechpartner" value={kaeufer.ansprechpartner} onChange={handleKaeuferChange('ansprechpartner')} placeholder="Frau Müller" />
                    <FormInput label="E-Mail" type="email" value={kaeufer.email} onChange={handleKaeuferChange('email')} placeholder="rechnung@kunde.de" validate={isValidEmail} />
                  </div>
                </section>
              </div>

              {/* Positionen */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-shadow duration-300 hover:shadow-md">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><ShoppingCart className="w-4 h-4 text-slate-600" /></div>
                    <h2 className="text-base font-semibold text-slate-900">Leistungen & Positionen</h2>
                  </div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={addPosition}
                    className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
                    <Plus className="w-4 h-4" />Position
                  </motion.button>
                </div>
                <div className="p-5">
                  {positionen.length === 0 ? <EmptyState onAddPosition={addPosition} /> : (
                    <div className="space-y-3">
                      <AnimatePresence>
                        {positionen.map((pos) => {
                          const netto = pos.menge * pos.preis;
                          const isComplete = pos.bezeichnung && pos.menge > 0 && pos.preis > 0;
                          return (
                            <motion.div key={pos.id} initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -20 }} layout transition={{ duration: 0.2 }}
                              className={`p-4 rounded-xl border transition-all duration-200 ${isComplete ? 'border-emerald-200/80 bg-emerald-50/40 shadow-sm shadow-emerald-100' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50/80 hover:border-slate-300'}`}>
                              <TypPillSelector value={pos.typ} onChange={(typ) => updatePosition(pos.id, { typ })} />
                              <div className="grid grid-cols-12 gap-2">
                                <div className="col-span-12 lg:col-span-5">
                                  <input type="text" value={pos.bezeichnung} onChange={e => updatePosition(pos.id, { bezeichnung: e.target.value })}
                                    placeholder="Leistungsbeschreibung..."
                                    className="w-full min-h-[44px] h-10 px-3 rounded-lg border border-slate-200/80 bg-slate-50/80 text-slate-900 text-sm placeholder:text-slate-400 transition-all duration-200 outline-none ring-1 ring-transparent hover:border-slate-300 hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500/20 focus:shadow-sm" />
                                </div>
                                <div className="col-span-4 lg:col-span-1">
                                  <input type="number" value={pos.menge} onChange={e => updatePosition(pos.id, { menge: parseFloat(e.target.value) || 0 })}
                                    min="0" step="0.5"
                                    className="w-full min-h-[44px] h-10 px-2 rounded-lg border border-slate-200/80 bg-slate-50/80 text-slate-900 text-sm text-center tabular-nums transition-all duration-200 outline-none ring-1 ring-transparent hover:border-slate-300 hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500/20 focus:shadow-sm" />
                                </div>
                                <div className="col-span-4 lg:col-span-1">
                                  <select value={pos.einheit} onChange={e => updatePosition(pos.id, { einheit: e.target.value })}
                                    className="w-full min-h-[44px] h-10 px-2 rounded-lg border border-slate-200/80 bg-slate-50/80 text-slate-900 text-sm transition-all duration-200 outline-none cursor-pointer ring-1 ring-transparent hover:border-slate-300 hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500/20 focus:shadow-sm">
                                    {EINHEIT_OPTIONS.map(e => <option key={e}>{e}</option>)}
                                  </select>
                                </div>
                                <div className="col-span-4 lg:col-span-2">
                                  <div className="relative">
                                    <input type="number" value={pos.preis} onChange={e => updatePosition(pos.id, { preis: parseFloat(e.target.value) || 0 })}
                                      min="0" step="0.01" placeholder="0,00"
                                      className="w-full min-h-[44px] h-10 px-2 pr-6 rounded-lg border border-slate-200/80 bg-slate-50/80 text-slate-900 text-sm text-right tabular-nums transition-all duration-200 outline-none ring-1 ring-transparent hover:border-slate-300 hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500/20 focus:shadow-sm" />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">€</span>
                                  </div>
                                </div>
                                <div className="col-span-6 lg:col-span-1">
                                  <select value={pos.ust} onChange={e => updatePosition(pos.id, { ust: parseInt(e.target.value) })}
                                    className="w-full min-h-[44px] h-10 px-2 rounded-lg border border-slate-200/80 bg-slate-50/80 text-slate-900 text-sm text-center transition-all duration-200 outline-none cursor-pointer ring-1 ring-transparent hover:border-slate-300 hover:bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500/20 focus:shadow-sm">
                                    {UST_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                </div>
                                <div className="col-span-6 lg:col-span-2 flex items-center justify-end gap-2">
                                  <span className="font-semibold text-slate-900 tabular-nums text-sm">{formatCurrency(netto)} €</span>
                                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => removePosition(pos.id)}
                                    aria-label="Position löschen"
                                    className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 flex items-center justify-center">
                                    <Trash2 className="w-4 h-4" />
                                  </motion.button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </section>
            </motion.div>
          ) : (
            /* Vorschau Tab - Mobile scrollable container */
            <motion.div key="vorschau" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="print:block">
              {/* Mobile: Scrollable container for A4 preview */}
              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 print:overflow-visible print:mx-0 print:px-0">
                <div className="bg-slate-200 rounded-2xl p-4 min-w-[240mm] md:min-w-0 print:bg-transparent print:p-0 print:rounded-none print:min-w-0">
                  <InvoicePreview
                    rechnung={rechnung}
                    verkaeufer={verkaeufer}
                    kaeufer={kaeufer}
                    positionen={positionen}
                    summen={summen}
                    brutto={brutto}
                    previewRef={previewRef}
                  />
                </div>
              </div>
              {/* Mobile hint */}
              <p className="text-center text-xs text-slate-400 mt-3 md:hidden print:hidden">
                Wischen Sie horizontal, um das gesamte Dokument zu sehen
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Unified Sticky Action Bar - Desktop & Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)] print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 py-3 lg:py-4">
            {/* Summen - Links */}
            <div className="flex items-center gap-6">
              {/* Mobile: Nur Brutto */}
              <div className="lg:hidden">
                <p className="text-xs text-slate-500 mb-0.5">Gesamtbetrag</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{formatCurrency(brutto)} €</p>
              </div>

              {/* Desktop: Netto, MwSt, Brutto */}
              <div className="hidden lg:flex items-center gap-8">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Netto</p>
                  <p className="text-lg font-semibold text-slate-700 tabular-nums">{formatCurrency(summen.netto)} €</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">MwSt.</p>
                  <p className="text-lg font-semibold text-slate-700 tabular-nums">{formatCurrency(summen.ust19 + summen.ust7)} €</p>
                </div>
                <div className="pl-4 border-l-2 border-slate-200">
                  <p className="text-xs text-slate-500 mb-0.5">Brutto</p>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">{formatCurrency(brutto)} €</p>
                </div>
              </div>
            </div>

            {/* Action Buttons - Rechts */}
            <div className="flex items-center gap-2 lg:gap-3">
              {/* PDF Export Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={downloadPDF}
                disabled={isGeneratingPdf}
                className={`flex items-center gap-2 px-4 lg:px-5 py-2.5 lg:py-3 min-h-[44px] lg:min-h-[48px] rounded-xl font-medium text-sm transition-all ${
                  isValid
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">PDF</span>
              </motion.button>

              {/* Primary XML Export Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={downloadXML}
                className={`flex items-center gap-2 px-5 lg:px-6 py-3 min-h-[48px] rounded-xl font-semibold text-sm lg:text-base transition-all ${
                  isValid
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-600/30'
                    : 'bg-slate-200 text-slate-500 cursor-pointer hover:bg-slate-300'
                }`}
              >
                <Download className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="hidden sm:inline">XRechnung</span>
                <span className="sm:hidden">XML</span>
              </motion.button>
            </div>
          </div>

          {/* Mini Footer Info - Desktop */}
          <div className="hidden lg:flex items-center justify-center gap-4 pb-2 -mt-1">
            <p className="text-xs text-slate-400">XRechnung 3.0 · EN 16931 konform</p>
            <span className="text-slate-300">·</span>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Shield className="w-3 h-3" />
              100% lokal · Auto-Save
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles - Comprehensive */}
      <style jsx global>{`
        @media print {
          /* Page setup - no browser chrome */
          @page {
            size: A4;
            margin: 0;
          }

          /* Reset everything */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide everything except invoice */
          body > div > *:not(main),
          header,
          footer,
          nav,
          .print\\:hidden,
          button,
          [role="button"] {
            display: none !important;
          }

          /* Show main content */
          main {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }

          /* Invoice paper styles */
          .invoice-paper {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 15mm !important;
            width: 100% !important;
            min-height: auto !important;
            background: white !important;
          }

          /* Ensure black text */
          .invoice-paper * {
            color: black !important;
          }

          .invoice-paper .text-gray-400,
          .invoice-paper .text-gray-500,
          .invoice-paper .text-gray-600,
          .invoice-paper .text-gray-700 {
            color: #374151 !important;
          }

          /* Borders for print */
          .invoice-paper .border-gray-200,
          .invoice-paper .border-gray-300 {
            border-color: #9ca3af !important;
          }

          .invoice-paper .border-gray-900 {
            border-color: black !important;
          }
        }
      `}</style>
    </div>
  );
}
