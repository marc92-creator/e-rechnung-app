'use client';

import { useState, useCallback, ChangeEvent, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FileText, Plus, Trash2, Download, CheckCircle2, Building2, User,
  Receipt, ShoppingCart, Shield, Sparkles, Zap, Copy,
  FileSpreadsheet, Printer, FilePlus, X, AlertTriangle, Archive,
  Loader2, FileDown, Settings, RotateCcw, Send, Banknote, Search,
  ChevronRight, Clock, MoreVertical, Users, Package, FileCheck,
  ArrowRightLeft
} from 'lucide-react';
import {
  db, type ArchivedInvoice, type InvoiceData, type InvoiceStatus,
  type InvoiceNumberSettings, generateInvoiceNumber, getNextInvoiceNumber,
  checkDuplicateInvoiceNumber, migrateFromLocalStorage, getDefaultSettings,
  generateOfferNumber, getNextOfferNumber, getDefaultOfferSettings,
  saveCustomer, saveArticle
} from '@/lib/db';
import type {
  Position, Verkaeufer, Kaeufer, Rechnung, Summen, ToastMessage,
  PositionTyp, DocumentType, OfferStatus, Customer, Article, ValidationResult
} from '@/lib/types';
import {
  TYP_OPTIONS, EINHEIT_OPTIONS, UST_OPTIONS, EINHEIT_MAP,
  STATUS_CONFIG, OFFER_STATUS_CONFIG, DOCUMENT_TYPE_CONFIG
} from '@/lib/types';
import { validateXRechnung, validateFormBasic, calculateProgress } from '@/lib/validation';
import { generateXRechnungXML } from '@/lib/xrechnung';
import { generateZUGFeRDXML, createZUGFeRDPDF } from '@/lib/zugferd';
import { CustomerModal, customerToKaeufer, kaeuferToCustomer } from '@/components/CustomerModal';
import { ArticleModal, articleToPosition, positionToArticle } from '@/components/ArticleModal';
import { ValidationModal } from '@/components/ValidationModal';
import { InvoicePreview } from '@/components/InvoicePreview';
import { ExportDropdown } from '@/components/ExportDropdown';
import { UpgradeModal } from '@/components/UpgradeModal';
import { SettingsModal } from '@/components/SettingsModal';
import { usePro } from '@/lib/usePro';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'e-rechnung-formdata';

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
        type === 'error' ? 'bg-red-600 text-white' :
        type === 'warning' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-white'
      }`}
    >
      {type === 'success' && <CheckCircle2 className="w-5 h-5" />}
      {type === 'error' && <AlertTriangle className="w-5 h-5" />}
      {type === 'warning' && <AlertTriangle className="w-5 h-5" />}
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
  const colorClasses: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-100 text-blue-600',
    emerald: 'bg-emerald-100 text-emerald-600'
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${colorClasses[config.color] || colorClasses.slate} ${
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
    }`}>
      {config.label}
    </span>
  );
}

function DocumentTypeBadge({ type }: { type: DocumentType }) {
  const config = DOCUMENT_TYPE_CONFIG[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
      type === 'invoice' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
    }`}>
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

function ArchiveModal({ isOpen, onClose, onLoad, onDuplicate, onDelete, onStatusChange, onConvertToInvoice, invoices, searchTerm, setSearchTerm, filterType, setFilterType }: {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (invoice: ArchivedInvoice) => void;
  onDuplicate: (invoice: ArchivedInvoice) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: InvoiceStatus) => void;
  onConvertToInvoice: (invoice: ArchivedInvoice) => void;
  invoices: ArchivedInvoice[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterType: 'all' | DocumentType;
  setFilterType: (type: 'all' | DocumentType) => void;
}) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || inv.documentType === filterType;
    return matchesSearch && matchesType;
  });

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
              <h2 className="text-lg font-semibold text-slate-900">Dokument-Archiv</h2>
              <p className="text-sm text-slate-500">{invoices.length} Dokumente</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Search & Filter */}
        <div className="p-4 border-b border-slate-100 space-y-3">
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

          {/* Type Filter */}
          <div className="flex gap-1">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterType === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Alle
            </button>
            <button
              onClick={() => setFilterType('invoice')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterType === 'invoice' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              Rechnungen
            </button>
            <button
              onClick={() => setFilterType('offer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterType === 'offer' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
              }`}
            >
              Angebote
            </button>
          </div>
        </div>

        {/* Invoice List */}
        <div className="max-h-[50vh] overflow-y-auto">
          {filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Archive className="w-12 h-12 text-slate-200 mb-4" />
              <p className="text-slate-500 text-sm">
                {searchTerm ? 'Keine Dokumente gefunden' : 'Noch keine Dokumente archiviert'}
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
                        <DocumentTypeBadge type={invoice.documentType || 'invoice'} />
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
                          {invoice.documentType === 'offer' && (
                            <button
                              onClick={() => { onConvertToInvoice(invoice); setMenuOpen(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
                            >
                              <ArrowRightLeft className="w-4 h-4" /> Als Rechnung
                            </button>
                          )}
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

function NumberSettingsModal({ isOpen, onClose, settings, onSave, documentType }: {
  isOpen: boolean;
  onClose: () => void;
  settings: InvoiceNumberSettings;
  onSave: (settings: InvoiceNumberSettings) => void;
  documentType: DocumentType;
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
          <h3 className="text-lg font-semibold text-slate-900">
            {documentType === 'invoice' ? 'Rechnungsnummer' : 'Angebotsnummer'}-Format
          </h3>
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Home() {
  const today = new Date().toISOString().split('T')[0];
  const in14Days = addDays(today, 14);

  // Document Type State
  const [documentType, setDocumentType] = useState<DocumentType>('invoice');

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
  const [archiveFilterType, setArchiveFilterType] = useState<'all' | DocumentType>('all');
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Number Settings
  const [showNumberSettings, setShowNumberSettings] = useState(false);
  const [numberSettings, setNumberSettings] = useState<InvoiceNumberSettings>(getDefaultSettings());
  const [offerSettings, setOfferSettings] = useState<InvoiceNumberSettings>(getDefaultOfferSettings());
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  // Modal States
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [selectCustomerMode, setSelectCustomerMode] = useState(false);
  const [selectArticleMode, setSelectArticleMode] = useState(false);

  // PDF Generation
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Pro/License System
  const pro = usePro();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<'invoice-limit' | 'customer-limit' | 'article-limit' | 'zugferd' | 'offers' | 'general'>('general');

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
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
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
      const invSettings = await db.settings.get('invoice-number-settings');
      if (invSettings) {
        setNumberSettings(invSettings as InvoiceNumberSettings);
      }
      const offSettings = await db.settings.get('offer-number-settings');
      if (offSettings) {
        setOfferSettings(offSettings as InvoiceNumberSettings);
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
        const data = JSON.parse(saved);
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
  const errors = validateFormBasic(rechnung, verkaeufer, kaeufer, positionen);
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
    const newNumber = documentType === 'invoice'
      ? await generateInvoiceNumber()
      : await generateOfferNumber();
    setRechnung(prev => ({ ...prev, nummer: newNumber }));
    showToast(`${documentType === 'invoice' ? 'Rechnungsnummer' : 'Angebotsnummer'} generiert`, 'success');
  }, [showToast, documentType]);

  // Reset form
  const resetForm = useCallback(async () => {
    const nextNumber = documentType === 'invoice'
      ? await getNextInvoiceNumber()
      : await getNextOfferNumber();
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
    showToast(`Neue${documentType === 'invoice' ? 's Dokument' : 's Angebot'} erstellt`, 'info');
  }, [today, in14Days, showToast, documentType]);

  // Save to archive
  const saveToArchive = useCallback(async (saveAsNew = false) => {
    const invoiceData: InvoiceData = { rechnung, verkaeufer, kaeufer, positionen };

    if (currentInvoiceId && !saveAsNew) {
      await db.invoices.update(currentInvoiceId, {
        invoiceNumber: rechnung.nummer || 'Entwurf',
        customerName: kaeufer.firma || 'Unbekannt',
        totalGross: brutto,
        documentType,
        updatedAt: new Date(),
        data: invoiceData
      });
      setHasUnsavedChanges(false);
      showToast('Dokument aktualisiert', 'success');
    } else {
      // Check invoice limit for new invoices (only for invoices, not offers)
      if (documentType === 'invoice' && !pro.canCreateInvoice) {
        setUpgradeReason('invoice-limit');
        pro.showUpgradeModal();
        return;
      }

      const newId = crypto.randomUUID();
      await db.invoices.add({
        id: newId,
        invoiceNumber: rechnung.nummer || 'Entwurf',
        customerName: kaeufer.firma || 'Unbekannt',
        totalGross: brutto,
        status: 'draft',
        documentType,
        createdAt: new Date(),
        updatedAt: new Date(),
        data: invoiceData
      });
      setCurrentInvoiceId(newId);
      setHasUnsavedChanges(false);

      // Increment invoice count for free users
      if (documentType === 'invoice') {
        pro.incrementInvoiceCount();
      }

      showToast('Dokument im Archiv gespeichert', 'success');
    }
  }, [rechnung, verkaeufer, kaeufer, positionen, brutto, currentInvoiceId, showToast, documentType, pro]);

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
    setDocumentType(invoice.documentType || 'invoice');
    setCurrentInvoiceId(invoice.id);
    setHasUnsavedChanges(false);
    setShowArchive(false);
    showToast(`${invoice.documentType === 'offer' ? 'Angebot' : 'Rechnung'} ${invoice.invoiceNumber} geladen`, 'success');
  }, [hasUnsavedChanges, showToast]);

  const confirmLoadFromArchive = useCallback(() => {
    if (showUnsavedWarning) {
      setRechnung(showUnsavedWarning.data.rechnung);
      setVerkaeufer(showUnsavedWarning.data.verkaeufer);
      setKaeufer(showUnsavedWarning.data.kaeufer);
      setPositionen(showUnsavedWarning.data.positionen);
      setDocumentType(showUnsavedWarning.documentType || 'invoice');
      setCurrentInvoiceId(showUnsavedWarning.id);
      setHasUnsavedChanges(false);
      setShowArchive(false);
      setShowUnsavedWarning(null);
      showToast(`Dokument ${showUnsavedWarning.invoiceNumber} geladen`, 'success');
    }
  }, [showUnsavedWarning, showToast]);

  // Duplicate invoice
  const duplicateInvoice = useCallback(async (invoice: ArchivedInvoice) => {
    const nextNumber = invoice.documentType === 'offer'
      ? await generateOfferNumber()
      : await generateInvoiceNumber();
    setRechnung({ ...invoice.data.rechnung, nummer: nextNumber, datum: today, faelligkeit: in14Days });
    setVerkaeufer(invoice.data.verkaeufer);
    setKaeufer(invoice.data.kaeufer);
    setPositionen(invoice.data.positionen.map(p => ({ ...p, id: generateId() })));
    setDocumentType(invoice.documentType || 'invoice');
    setCurrentInvoiceId(null);
    setHasUnsavedChanges(true);
    setShowArchive(false);
    showToast('Dokument dupliziert', 'success');
  }, [today, in14Days, showToast]);

  // Convert offer to invoice
  const convertOfferToInvoice = useCallback(async (offer: ArchivedInvoice) => {
    const nextNumber = await generateInvoiceNumber();
    setRechnung({
      ...offer.data.rechnung,
      nummer: nextNumber,
      datum: today,
      faelligkeit: in14Days,
      art: '380 - Rechnung'
    });
    setVerkaeufer(offer.data.verkaeufer);
    setKaeufer(offer.data.kaeufer);
    setPositionen(offer.data.positionen.map(p => ({ ...p, id: generateId() })));
    setDocumentType('invoice');
    setCurrentInvoiceId(null);
    setHasUnsavedChanges(true);
    setShowArchive(false);
    showToast('Angebot in Rechnung umgewandelt', 'success');
  }, [today, in14Days, showToast]);

  // Delete from archive
  const deleteFromArchive = useCallback(async (id: string) => {
    await db.invoices.delete(id);
    if (currentInvoiceId === id) {
      setCurrentInvoiceId(null);
    }
    setShowDeleteConfirm(null);
    showToast('Dokument gelöscht', 'info');
  }, [currentInvoiceId, showToast]);

  // Update invoice status
  const updateInvoiceStatus = useCallback(async (id: string, status: InvoiceStatus) => {
    await db.invoices.update(id, { status, updatedAt: new Date() });
    showToast(`Status geändert: ${STATUS_CONFIG[status].label}`, 'success');
  }, [showToast]);

  // Save number settings
  const saveNumberSettings = useCallback(async (settings: InvoiceNumberSettings) => {
    await db.settings.put(settings);
    if (documentType === 'invoice') {
      setNumberSettings(settings);
    } else {
      setOfferSettings(settings);
    }
    showToast('Einstellungen gespeichert', 'success');
  }, [showToast, documentType]);

  // Customer selection handler
  const handleCustomerSelect = useCallback((customer: Customer) => {
    const kaeuferData = customerToKaeufer(customer);
    setKaeufer(kaeuferData);
    if (customer.leitwegId) {
      setRechnung(prev => ({ ...prev, leitwegId: customer.leitwegId! }));
    }
    setSelectCustomerMode(false);
    showToast(`Kunde "${customer.name}" übernommen`, 'success');
  }, [showToast]);

  // Save current buyer as customer
  const saveCurrentBuyerAsCustomer = useCallback(async () => {
    if (!kaeufer.firma) {
      showToast('Bitte zuerst Kundendaten eingeben', 'error');
      return;
    }
    const customerData = kaeuferToCustomer(kaeufer, rechnung.leitwegId);
    const customer: Customer = {
      ...customerData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await saveCustomer(customer);
    showToast('Kunde gespeichert', 'success');
  }, [kaeufer, rechnung.leitwegId, showToast]);

  // Article selection handler
  const handleArticleSelect = useCallback((article: Article) => {
    const positionData = articleToPosition(article);
    setPositionen(prev => [...prev, { ...positionData, id: generateId() }]);
    setSelectArticleMode(false);
    showToast(`Artikel "${article.name}" hinzugefügt`, 'success');
  }, [showToast]);

  // Save position as article
  const savePositionAsArticle = useCallback(async (position: Position) => {
    if (!position.bezeichnung) {
      showToast('Position hat keine Bezeichnung', 'error');
      return;
    }
    const articleData = positionToArticle(position);
    const article: Article = {
      ...articleData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await saveArticle(article);
    showToast('Artikel gespeichert', 'success');
  }, [showToast]);

  // Validation
  const runValidation = useCallback(() => {
    const result = validateXRechnung(rechnung, verkaeufer, kaeufer, positionen);
    setValidationResult(result);
    setShowValidationModal(true);
  }, [rechnung, verkaeufer, kaeufer, positionen]);

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
    setDocumentType('invoice');
    showToast('Demo-Daten geladen', 'success');
  }, [today, in14Days, showToast]);

  const copyXML = useCallback(async () => {
    const xml = generateXRechnungXML(rechnung, verkaeufer, kaeufer, positionen, documentType);
    await navigator.clipboard.writeText(xml);
    showToast('XRechnung in Zwischenablage kopiert', 'success');
  }, [rechnung, verkaeufer, kaeufer, positionen, documentType, showToast]);

  const downloadXML = useCallback(() => {
    setAttemptedExport(true);
    if (!isValid) {
      showToast('Bitte alle Pflichtfelder ausfüllen', 'error');
      return;
    }
    const xml = generateXRechnungXML(rechnung, verkaeufer, kaeufer, positionen, documentType);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `XRechnung_${rechnung.nummer || 'Entwurf'}_${today}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('XRechnung wurde gespeichert', 'success');
  }, [isValid, rechnung, verkaeufer, kaeufer, positionen, today, showToast, documentType]);

  // PDF Export - Professional DIN 5008 layout using jsPDF directly
  const downloadPDF = useCallback(async () => {
    setAttemptedExport(true);
    if (!isValid) {
      showToast('Bitte alle Pflichtfelder ausfüllen', 'error');
      return;
    }

    setIsGeneratingPdf(true);

    try {
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // A4: 210mm x 297mm, margins: 20mm
      const pageWidth = 210;
      const pageHeight = 297;
      const marginLeft = 20;
      const marginRight = 20;
      const marginTop = 20;
      const contentWidth = pageWidth - marginLeft - marginRight;

      // Helper functions
      const formatCurrency = (val: number) => val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const formatDate = (dateStr: string) => {
        if (!dateStr) return '—';
        const [y, m, d] = dateStr.split('-');
        return `${d}.${m}.${y}`;
      };

      const isOffer = documentType === 'offer';
      const docTitle = isOffer ? 'ANGEBOT' : 'RECHNUNG';
      const numberLabel = isOffer ? 'Angebots-Nr.:' : 'Rechnungs-Nr.:';
      const dateLabel2 = isOffer ? 'Gültig bis:' : 'Fällig bis:';
      const endDate = rechnung.faelligkeit;

      let y = marginTop;

      // === ABSENDER-RÜCKSENDEZEILE (klein, grau) ===
      doc.setFontSize(7);
      doc.setTextColor(156, 163, 175); // gray-400
      doc.setFont('helvetica', 'normal');
      const senderLine = `${verkaeufer.firma || 'Firma'} · ${verkaeufer.strasse || 'Straße'} · ${verkaeufer.plz} ${verkaeufer.ort}`;
      doc.text(senderLine, marginLeft, y);
      y += 6;

      // === ADRESSFELD + DOKUMENTTITEL ===
      const addressStartY = y;

      // Empfänger-Block (links, 85mm breit)
      doc.setFontSize(11);
      doc.setTextColor(17, 24, 39); // gray-900
      doc.setFont('helvetica', 'bold');
      doc.text(kaeufer.firma || '—', marginLeft, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81); // gray-700
      if (kaeufer.ansprechpartner) {
        doc.text(kaeufer.ansprechpartner, marginLeft, y);
        y += 4.5;
      }
      doc.text(kaeufer.strasse || '—', marginLeft, y);
      y += 4.5;
      doc.text(`${kaeufer.plz} ${kaeufer.ort}`, marginLeft, y);

      // Dokumenttitel rechts (RECHNUNG / ANGEBOT)
      doc.setFontSize(22);
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.text(docTitle, pageWidth - marginRight, addressStartY + 2, { align: 'right' });

      // Rechnungsdaten rechts als Tabelle
      let infoY = addressStartY + 12;
      doc.setFontSize(9);

      const drawInfoRow = (label: string, value: string, bold = false) => {
        doc.setTextColor(107, 114, 128); // gray-500
        doc.setFont('helvetica', 'normal');
        doc.text(label, pageWidth - marginRight - 45, infoY);
        doc.setTextColor(17, 24, 39);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.text(value, pageWidth - marginRight, infoY, { align: 'right' });
        infoY += 4.5;
      };

      drawInfoRow(numberLabel, rechnung.nummer || '—', true);
      drawInfoRow('Datum:', formatDate(rechnung.datum));
      if (rechnung.leistungszeitraum) {
        drawInfoRow(isOffer ? 'Zeitraum:' : 'Leistungszeitraum:', rechnung.leistungszeitraum);
      }
      if (kaeufer.kundennummer) {
        drawInfoRow('Kunden-Nr.:', kaeufer.kundennummer);
      }
      drawInfoRow(dateLabel2, formatDate(endDate), true);

      y = Math.max(y, infoY) + 12;

      // === BETREFFZEILE ===
      doc.setFontSize(11);
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      const subject = isOffer
        ? `Angebot für ${rechnung.leistungszeitraum ? `geplante Leistungen – ${rechnung.leistungszeitraum}` : 'angebotene Leistungen'}`
        : `Rechnung für erbrachte Leistungen${rechnung.leistungszeitraum ? ` – ${rechnung.leistungszeitraum}` : ''}`;
      doc.text(subject, marginLeft, y);
      y += 10;

      // === POSITIONEN-TABELLE ===
      const colPos = marginLeft;
      const colDesc = marginLeft + 12;
      const colQty = marginLeft + 110;
      const colPrice = marginLeft + 130;
      const colTotal = pageWidth - marginRight;

      // Table Header
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.setFont('helvetica', 'bold');
      doc.text('Pos', colPos, y);
      doc.text('Beschreibung', colDesc, y);
      doc.text('Menge', colQty, y, { align: 'right' });
      doc.text('E-Preis', colPrice, y, { align: 'right' });
      doc.text('Betrag', colTotal, y, { align: 'right' });
      y += 2;

      // Header line
      doc.setDrawColor(17, 24, 39);
      doc.setLineWidth(0.5);
      doc.line(marginLeft, y, pageWidth - marginRight, y);
      y += 5;

      // Table rows
      doc.setFont('helvetica', 'normal');
      const filteredPositions = positionen.filter(p => p.bezeichnung);
      filteredPositions.forEach((pos, idx) => {
        doc.setTextColor(107, 114, 128);
        doc.text(String(idx + 1), colPos, y);

        doc.setTextColor(17, 24, 39);
        // Wrap long descriptions
        const descLines = doc.splitTextToSize(pos.bezeichnung, 90);
        doc.text(descLines, colDesc, y);

        doc.setTextColor(55, 65, 81);
        doc.text(`${pos.menge} ${pos.einheit}`, colQty, y, { align: 'right' });
        doc.text(`${formatCurrency(pos.preis)} €`, colPrice, y, { align: 'right' });

        doc.setTextColor(17, 24, 39);
        doc.setFont('helvetica', 'bold');
        doc.text(`${formatCurrency(pos.menge * pos.preis)} €`, colTotal, y, { align: 'right' });
        doc.setFont('helvetica', 'normal');

        const rowHeight = Math.max(descLines.length * 4, 5);
        y += rowHeight;

        // Row separator line
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.2);
        doc.line(marginLeft, y - 1, pageWidth - marginRight, y - 1);
        y += 3;
      });

      y += 5;

      // === SUMMEN-BLOCK (rechtsbündig) ===
      const sumStartX = pageWidth - marginRight - 60;
      const sumValueX = pageWidth - marginRight;

      doc.setFontSize(9);
      const drawSumRow = (label: string, value: string, bold = false, topLine = false) => {
        if (topLine) {
          doc.setDrawColor(17, 24, 39);
          doc.setLineWidth(0.5);
          doc.line(sumStartX, y - 1, sumValueX, y - 1);
          y += 2;
        }
        doc.setTextColor(75, 85, 99);
        doc.setFont('helvetica', 'normal');
        doc.text(label, sumStartX, y);
        doc.setTextColor(17, 24, 39);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.text(value, sumValueX, y, { align: 'right' });
        y += 5;
      };

      drawSumRow('Nettobetrag:', `${formatCurrency(summen.netto)} €`);
      if (summen.ust19 > 0) {
        drawSumRow('+ USt 19%:', `${formatCurrency(summen.ust19)} €`);
      }
      if (summen.ust7 > 0) {
        drawSumRow('+ USt 7%:', `${formatCurrency(summen.ust7)} €`);
      }

      // Gesamtbetrag with top line
      doc.setFontSize(11);
      drawSumRow('Gesamtbetrag:', `${formatCurrency(brutto)} €`, true, true);
      doc.setFontSize(9);

      y += 5;

      // === §35a EStG BOX (nur bei Rechnung) ===
      if (!isOffer && (summen.lohn > 0 || summen.material > 0)) {
        doc.setDrawColor(209, 213, 219);
        doc.setLineWidth(0.3);
        doc.roundedRect(marginLeft, y, contentWidth, 14, 2, 2, 'S');

        y += 4;
        doc.setFontSize(8);
        doc.setTextColor(55, 65, 81);
        doc.setFont('helvetica', 'bold');
        doc.text('Ausweisung gemäß §35a EStG (Handwerkerleistungen):', marginLeft + 3, y);
        y += 4;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(75, 85, 99);
        doc.text(`Lohnkosten: `, marginLeft + 3, y);
        doc.setTextColor(17, 24, 39);
        doc.setFont('helvetica', 'bold');
        doc.text(`${formatCurrency(summen.lohn)} €`, marginLeft + 25, y);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(75, 85, 99);
        doc.text(`Materialkosten: `, marginLeft + 55, y);
        doc.setTextColor(17, 24, 39);
        doc.setFont('helvetica', 'bold');
        doc.text(`${formatCurrency(summen.material)} €`, marginLeft + 82, y);

        y += 10;
      }

      y += 5;

      // === SCHLUSSTEXT ===
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.setFont('helvetica', 'normal');
      if (isOffer) {
        doc.text(`Dieses Angebot ist gültig bis zum ${formatDate(endDate)}.`, marginLeft, y);
        y += 4;
        doc.text('Bei Fragen stehen wir Ihnen gerne zur Verfügung. Wir freuen uns auf Ihre Beauftragung!', marginLeft, y);
      } else {
        doc.text(`Bitte überweisen Sie den Rechnungsbetrag bis zum ${formatDate(rechnung.faelligkeit)} auf das unten angegebene Konto.`, marginLeft, y);
        y += 4;
        doc.text('Vielen Dank für Ihren Auftrag!', marginLeft, y);
      }

      // === FUSSZEILE (3-spaltig, am unteren Rand) ===
      const footerY = pageHeight - 25;
      const colWidth = contentWidth / 3;

      // Trennlinie
      doc.setDrawColor(209, 213, 219);
      doc.setLineWidth(0.3);
      doc.line(marginLeft, footerY - 5, pageWidth - marginRight, footerY - 5);

      doc.setFontSize(7);

      // Spalte 1: Kontakt
      let footerCol1Y = footerY;
      doc.setTextColor(55, 65, 81);
      doc.setFont('helvetica', 'bold');
      doc.text(verkaeufer.firma || '', marginLeft, footerCol1Y);
      footerCol1Y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(verkaeufer.strasse || '', marginLeft, footerCol1Y);
      footerCol1Y += 3;
      doc.text(`${verkaeufer.plz} ${verkaeufer.ort}`, marginLeft, footerCol1Y);
      footerCol1Y += 3;
      if (verkaeufer.telefon) {
        doc.text(`Tel: ${verkaeufer.telefon}`, marginLeft, footerCol1Y);
        footerCol1Y += 3;
      }
      if (verkaeufer.email) {
        doc.text(verkaeufer.email, marginLeft, footerCol1Y);
      }

      // Spalte 2: Bankverbindung
      let footerCol2Y = footerY;
      const col2X = marginLeft + colWidth;
      doc.setTextColor(55, 65, 81);
      doc.setFont('helvetica', 'bold');
      doc.text('Bankverbindung', col2X, footerCol2Y);
      footerCol2Y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      if (verkaeufer.iban) {
        doc.text(`IBAN: ${verkaeufer.iban}`, col2X, footerCol2Y);
        footerCol2Y += 3;
      }
      if (verkaeufer.bic) {
        doc.text(`BIC: ${verkaeufer.bic}`, col2X, footerCol2Y);
        footerCol2Y += 3;
      }
      if (verkaeufer.bank) {
        doc.text(verkaeufer.bank, col2X, footerCol2Y);
      }

      // Spalte 3: Steuerdaten
      let footerCol3Y = footerY;
      const col3X = marginLeft + colWidth * 2;
      doc.setTextColor(55, 65, 81);
      doc.setFont('helvetica', 'bold');
      doc.text('Steuerdaten', col3X, footerCol3Y);
      footerCol3Y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      if (verkaeufer.ustId) {
        doc.text(`USt-IdNr.: ${verkaeufer.ustId}`, col3X, footerCol3Y);
        footerCol3Y += 3;
      }
      if (verkaeufer.steuernummer) {
        doc.text(`St.-Nr.: ${verkaeufer.steuernummer}`, col3X, footerCol3Y);
        footerCol3Y += 3;
      }
      if (verkaeufer.handelsregister) {
        doc.text(verkaeufer.handelsregister, col3X, footerCol3Y);
      }

      // Watermark for free users
      if (!pro.isPro) {
        doc.setFontSize(8);
        doc.setTextColor(180, 180, 180);
        doc.setFont('helvetica', 'normal');
        doc.text('Erstellt mit e-rechnung-app.de', pageWidth - marginRight, pageHeight - 8, { align: 'right' });
      }

      // Save PDF
      const filename = `${isOffer ? 'Angebot' : 'Rechnung'}-${rechnung.nummer || 'Entwurf'}-${today}.pdf`;
      doc.save(filename);

      showToast('PDF wurde erstellt', 'success');
    } catch (error) {
      console.error('PDF generation failed:', error);
      showToast('PDF-Erstellung fehlgeschlagen', 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [isValid, rechnung, verkaeufer, kaeufer, positionen, summen, brutto, documentType, today, showToast, pro.isPro]);

  // ZUGFeRD Export - Professional DIN 5008 layout with embedded XML
  const downloadZUGFeRD = useCallback(async () => {
    setAttemptedExport(true);
    if (!isValid) {
      showToast('Bitte alle Pflichtfelder ausfüllen', 'error');
      return;
    }

    setIsGeneratingPdf(true);

    try {
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // A4: 210mm x 297mm, margins: 20mm
      const pageWidth = 210;
      const pageHeight = 297;
      const marginLeft = 20;
      const marginRight = 20;
      const marginTop = 20;
      const contentWidth = pageWidth - marginLeft - marginRight;

      // Helper functions
      const formatCurrency = (val: number) => val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const formatDate = (dateStr: string) => {
        if (!dateStr) return '—';
        const [y, m, d] = dateStr.split('-');
        return `${d}.${m}.${y}`;
      };

      const isOffer = documentType === 'offer';
      const docTitle = isOffer ? 'ANGEBOT' : 'RECHNUNG';
      const numberLabel = isOffer ? 'Angebots-Nr.:' : 'Rechnungs-Nr.:';
      const dateLabel2 = isOffer ? 'Gültig bis:' : 'Fällig bis:';
      const endDate = rechnung.faelligkeit;

      let y = marginTop;

      // === ABSENDER-RÜCKSENDEZEILE ===
      doc.setFontSize(7);
      doc.setTextColor(156, 163, 175);
      doc.setFont('helvetica', 'normal');
      const senderLine = `${verkaeufer.firma || 'Firma'} · ${verkaeufer.strasse || 'Straße'} · ${verkaeufer.plz} ${verkaeufer.ort}`;
      doc.text(senderLine, marginLeft, y);
      y += 6;

      // === ADRESSFELD + DOKUMENTTITEL ===
      const addressStartY = y;

      doc.setFontSize(11);
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.text(kaeufer.firma || '—', marginLeft, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      if (kaeufer.ansprechpartner) {
        doc.text(kaeufer.ansprechpartner, marginLeft, y);
        y += 4.5;
      }
      doc.text(kaeufer.strasse || '—', marginLeft, y);
      y += 4.5;
      doc.text(`${kaeufer.plz} ${kaeufer.ort}`, marginLeft, y);

      doc.setFontSize(22);
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.text(docTitle, pageWidth - marginRight, addressStartY + 2, { align: 'right' });

      let infoY = addressStartY + 12;
      doc.setFontSize(9);

      const drawInfoRow = (label: string, value: string, bold = false) => {
        doc.setTextColor(107, 114, 128);
        doc.setFont('helvetica', 'normal');
        doc.text(label, pageWidth - marginRight - 45, infoY);
        doc.setTextColor(17, 24, 39);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.text(value, pageWidth - marginRight, infoY, { align: 'right' });
        infoY += 4.5;
      };

      drawInfoRow(numberLabel, rechnung.nummer || '—', true);
      drawInfoRow('Datum:', formatDate(rechnung.datum));
      if (rechnung.leistungszeitraum) {
        drawInfoRow(isOffer ? 'Zeitraum:' : 'Leistungszeitraum:', rechnung.leistungszeitraum);
      }
      if (kaeufer.kundennummer) {
        drawInfoRow('Kunden-Nr.:', kaeufer.kundennummer);
      }
      drawInfoRow(dateLabel2, formatDate(endDate), true);

      y = Math.max(y, infoY) + 12;

      // === BETREFFZEILE ===
      doc.setFontSize(11);
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      const subject = isOffer
        ? `Angebot für ${rechnung.leistungszeitraum ? `geplante Leistungen – ${rechnung.leistungszeitraum}` : 'angebotene Leistungen'}`
        : `Rechnung für erbrachte Leistungen${rechnung.leistungszeitraum ? ` – ${rechnung.leistungszeitraum}` : ''}`;
      doc.text(subject, marginLeft, y);
      y += 10;

      // === POSITIONEN-TABELLE ===
      const colPos = marginLeft;
      const colDesc = marginLeft + 12;
      const colQty = marginLeft + 110;
      const colPrice = marginLeft + 130;
      const colTotal = pageWidth - marginRight;

      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.setFont('helvetica', 'bold');
      doc.text('Pos', colPos, y);
      doc.text('Beschreibung', colDesc, y);
      doc.text('Menge', colQty, y, { align: 'right' });
      doc.text('E-Preis', colPrice, y, { align: 'right' });
      doc.text('Betrag', colTotal, y, { align: 'right' });
      y += 2;

      doc.setDrawColor(17, 24, 39);
      doc.setLineWidth(0.5);
      doc.line(marginLeft, y, pageWidth - marginRight, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      const filteredPositions = positionen.filter(p => p.bezeichnung);
      filteredPositions.forEach((pos, idx) => {
        doc.setTextColor(107, 114, 128);
        doc.text(String(idx + 1), colPos, y);

        doc.setTextColor(17, 24, 39);
        const descLines = doc.splitTextToSize(pos.bezeichnung, 90);
        doc.text(descLines, colDesc, y);

        doc.setTextColor(55, 65, 81);
        doc.text(`${pos.menge} ${pos.einheit}`, colQty, y, { align: 'right' });
        doc.text(`${formatCurrency(pos.preis)} €`, colPrice, y, { align: 'right' });

        doc.setTextColor(17, 24, 39);
        doc.setFont('helvetica', 'bold');
        doc.text(`${formatCurrency(pos.menge * pos.preis)} €`, colTotal, y, { align: 'right' });
        doc.setFont('helvetica', 'normal');

        const rowHeight = Math.max(descLines.length * 4, 5);
        y += rowHeight;

        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.2);
        doc.line(marginLeft, y - 1, pageWidth - marginRight, y - 1);
        y += 3;
      });

      y += 5;

      // === SUMMEN-BLOCK ===
      const sumStartX = pageWidth - marginRight - 60;
      const sumValueX = pageWidth - marginRight;

      doc.setFontSize(9);
      const drawSumRow = (label: string, value: string, bold = false, topLine = false) => {
        if (topLine) {
          doc.setDrawColor(17, 24, 39);
          doc.setLineWidth(0.5);
          doc.line(sumStartX, y - 1, sumValueX, y - 1);
          y += 2;
        }
        doc.setTextColor(75, 85, 99);
        doc.setFont('helvetica', 'normal');
        doc.text(label, sumStartX, y);
        doc.setTextColor(17, 24, 39);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.text(value, sumValueX, y, { align: 'right' });
        y += 5;
      };

      drawSumRow('Nettobetrag:', `${formatCurrency(summen.netto)} €`);
      if (summen.ust19 > 0) {
        drawSumRow('+ USt 19%:', `${formatCurrency(summen.ust19)} €`);
      }
      if (summen.ust7 > 0) {
        drawSumRow('+ USt 7%:', `${formatCurrency(summen.ust7)} €`);
      }

      doc.setFontSize(11);
      drawSumRow('Gesamtbetrag:', `${formatCurrency(brutto)} €`, true, true);
      doc.setFontSize(9);

      y += 5;

      // === §35a EStG BOX ===
      if (!isOffer && (summen.lohn > 0 || summen.material > 0)) {
        doc.setDrawColor(209, 213, 219);
        doc.setLineWidth(0.3);
        doc.roundedRect(marginLeft, y, contentWidth, 14, 2, 2, 'S');

        y += 4;
        doc.setFontSize(8);
        doc.setTextColor(55, 65, 81);
        doc.setFont('helvetica', 'bold');
        doc.text('Ausweisung gemäß §35a EStG (Handwerkerleistungen):', marginLeft + 3, y);
        y += 4;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(75, 85, 99);
        doc.text(`Lohnkosten: `, marginLeft + 3, y);
        doc.setTextColor(17, 24, 39);
        doc.setFont('helvetica', 'bold');
        doc.text(`${formatCurrency(summen.lohn)} €`, marginLeft + 25, y);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(75, 85, 99);
        doc.text(`Materialkosten: `, marginLeft + 55, y);
        doc.setTextColor(17, 24, 39);
        doc.setFont('helvetica', 'bold');
        doc.text(`${formatCurrency(summen.material)} €`, marginLeft + 82, y);

        y += 10;
      }

      y += 5;

      // === SCHLUSSTEXT ===
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.setFont('helvetica', 'normal');
      if (isOffer) {
        doc.text(`Dieses Angebot ist gültig bis zum ${formatDate(endDate)}.`, marginLeft, y);
        y += 4;
        doc.text('Bei Fragen stehen wir Ihnen gerne zur Verfügung. Wir freuen uns auf Ihre Beauftragung!', marginLeft, y);
      } else {
        doc.text(`Bitte überweisen Sie den Rechnungsbetrag bis zum ${formatDate(rechnung.faelligkeit)} auf das unten angegebene Konto.`, marginLeft, y);
        y += 4;
        doc.text('Vielen Dank für Ihren Auftrag!', marginLeft, y);
      }

      // === FUSSZEILE ===
      const footerY = pageHeight - 25;
      const colWidth = contentWidth / 3;

      doc.setDrawColor(209, 213, 219);
      doc.setLineWidth(0.3);
      doc.line(marginLeft, footerY - 5, pageWidth - marginRight, footerY - 5);

      doc.setFontSize(7);

      let footerCol1Y = footerY;
      doc.setTextColor(55, 65, 81);
      doc.setFont('helvetica', 'bold');
      doc.text(verkaeufer.firma || '', marginLeft, footerCol1Y);
      footerCol1Y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(verkaeufer.strasse || '', marginLeft, footerCol1Y);
      footerCol1Y += 3;
      doc.text(`${verkaeufer.plz} ${verkaeufer.ort}`, marginLeft, footerCol1Y);
      footerCol1Y += 3;
      if (verkaeufer.telefon) {
        doc.text(`Tel: ${verkaeufer.telefon}`, marginLeft, footerCol1Y);
        footerCol1Y += 3;
      }
      if (verkaeufer.email) {
        doc.text(verkaeufer.email, marginLeft, footerCol1Y);
      }

      let footerCol2Y = footerY;
      const col2X = marginLeft + colWidth;
      doc.setTextColor(55, 65, 81);
      doc.setFont('helvetica', 'bold');
      doc.text('Bankverbindung', col2X, footerCol2Y);
      footerCol2Y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      if (verkaeufer.iban) {
        doc.text(`IBAN: ${verkaeufer.iban}`, col2X, footerCol2Y);
        footerCol2Y += 3;
      }
      if (verkaeufer.bic) {
        doc.text(`BIC: ${verkaeufer.bic}`, col2X, footerCol2Y);
        footerCol2Y += 3;
      }
      if (verkaeufer.bank) {
        doc.text(verkaeufer.bank, col2X, footerCol2Y);
      }

      let footerCol3Y = footerY;
      const col3X = marginLeft + colWidth * 2;
      doc.setTextColor(55, 65, 81);
      doc.setFont('helvetica', 'bold');
      doc.text('Steuerdaten', col3X, footerCol3Y);
      footerCol3Y += 3;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      if (verkaeufer.ustId) {
        doc.text(`USt-IdNr.: ${verkaeufer.ustId}`, col3X, footerCol3Y);
        footerCol3Y += 3;
      }
      if (verkaeufer.steuernummer) {
        doc.text(`St.-Nr.: ${verkaeufer.steuernummer}`, col3X, footerCol3Y);
        footerCol3Y += 3;
      }
      if (verkaeufer.handelsregister) {
        doc.text(verkaeufer.handelsregister, col3X, footerCol3Y);
      }

      // Get PDF as ArrayBuffer for ZUGFeRD embedding
      const pdfBytes = doc.output('arraybuffer');

      // Embed ZUGFeRD XML
      const zugferdPdfBytes = await createZUGFeRDPDF(
        new Uint8Array(pdfBytes),
        rechnung,
        verkaeufer,
        kaeufer,
        positionen
      );

      // Download
      const blob = new Blob([zugferdPdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ZUGFeRD-${rechnung.nummer || 'Entwurf'}-${today}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      showToast('ZUGFeRD-PDF wurde erstellt', 'success');
    } catch (error) {
      console.error('ZUGFeRD generation failed:', error);
      showToast('ZUGFeRD-Erstellung fehlgeschlagen', 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [isValid, rechnung, verkaeufer, kaeufer, positionen, summen, brutto, documentType, today, showToast]);

  // Export handler
  const handleExport = useCallback((format: 'xrechnung' | 'zugferd' | 'pdf') => {
    // Gate ZUGFeRD for Pro users
    if (format === 'zugferd' && !pro.canUseZUGFeRD) {
      setUpgradeReason('zugferd');
      pro.showUpgradeModal();
      return;
    }

    switch (format) {
      case 'xrechnung':
        downloadXML();
        break;
      case 'zugferd':
        downloadZUGFeRD();
        break;
      case 'pdf':
        downloadPDF();
        break;
    }
  }, [downloadXML, downloadZUGFeRD, downloadPDF, pro]);

  const handlePrint = useCallback(() => {
    setActiveTab('vorschau');
    setTimeout(() => window.print(), 100);
  }, []);

  // Switch document type
  const switchDocumentType = useCallback(async (type: DocumentType) => {
    // Gate offers for Pro users
    if (type === 'offer' && !pro.canUseOffers) {
      setUpgradeReason('offers');
      pro.showUpgradeModal();
      return;
    }

    setDocumentType(type);
    if (!rechnung.nummer) {
      const nextNumber = type === 'invoice'
        ? await getNextInvoiceNumber()
        : await getNextOfferNumber();
      setRechnung(prev => ({
        ...prev,
        nummer: nextNumber,
        art: type === 'invoice' ? '380 - Rechnung' : '310 - Angebot'
      }));
    }
  }, [rechnung.nummer, pro]);

  const currentSettings = documentType === 'invoice' ? numberSettings : offerSettings;

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
            title="Neues Dokument?"
            message="Alle eingegebenen Daten werden unwiderruflich gelöscht."
            onConfirm={resetForm}
            onCancel={() => setShowResetConfirm(false)}
          />
        )}
        {showDeleteConfirm && (
          <ConfirmDialog
            title="Dokument löschen?"
            message="Dieses Dokument wird unwiderruflich aus dem Archiv gelöscht."
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
            onConvertToInvoice={convertOfferToInvoice}
            invoices={invoices}
            searchTerm={archiveSearchTerm}
            setSearchTerm={setArchiveSearchTerm}
            filterType={archiveFilterType}
            setFilterType={setArchiveFilterType}
          />
        )}
      </AnimatePresence>

      {/* Number Settings Modal */}
      <AnimatePresence>
        {showNumberSettings && (
          <NumberSettingsModal
            isOpen={showNumberSettings}
            onClose={() => setShowNumberSettings(false)}
            settings={currentSettings}
            onSave={saveNumberSettings}
            documentType={documentType}
          />
        )}
      </AnimatePresence>

      {/* Customer Modal */}
      <AnimatePresence>
        {showCustomerModal && (
          <CustomerModal
            isOpen={showCustomerModal}
            onClose={() => { setShowCustomerModal(false); setSelectCustomerMode(false); }}
            onSelect={selectCustomerMode ? handleCustomerSelect : undefined}
            showToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* Article Modal */}
      <AnimatePresence>
        {showArticleModal && (
          <ArticleModal
            isOpen={showArticleModal}
            onClose={() => { setShowArticleModal(false); setSelectArticleMode(false); }}
            onSelect={selectArticleMode ? handleArticleSelect : undefined}
            showToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* Validation Modal */}
      <AnimatePresence>
        {showValidationModal && validationResult && (
          <ValidationModal
            isOpen={showValidationModal}
            onClose={() => setShowValidationModal(false)}
            result={validationResult}
          />
        )}
      </AnimatePresence>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={pro.isUpgradeModalOpen}
        onClose={pro.hideUpgradeModal}
        onActivateLicense={pro.activateLicense}
        remainingInvoices={pro.remainingInvoices === Infinity ? 999 : pro.remainingInvoices}
        invoicesThisMonth={pro.invoicesThisMonth}
        triggerReason={upgradeReason}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        isPro={pro.isPro}
        licenseKey={pro.licenseKey}
        activatedAt={pro.activatedAt}
        expiresAt={pro.expiresAt}
        invoicesThisMonth={pro.invoicesThisMonth}
        maxInvoicesPerMonth={pro.maxInvoicesPerMonth}
        onActivateLicense={pro.activateLicense}
        onDeactivateLicense={pro.deactivateLicense}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <motion.div whileHover={{ scale: 1.05, rotate: 5 }}
                className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <FileText className="w-5 h-5 text-white" />
              </motion.div>
              <div className="flex items-center gap-2">
                <div>
                  <h1 className="text-lg font-semibold text-slate-900 tracking-tight">E-Rechnung</h1>
                  <p className="text-xs text-slate-500 -mt-0.5">Handwerk Edition</p>
                </div>
                {pro.isPro && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full shadow-sm">
                    Pro
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Customers Button */}
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowCustomerModal(true)}
                className="hidden md:flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-slate-600 hover:bg-slate-100 transition-all"
                title="Kundenstammdaten">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Kunden</span>
              </motion.button>

              {/* Articles Button */}
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowArticleModal(true)}
                className="hidden md:flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-slate-600 hover:bg-slate-100 transition-all"
                title="Artikelstammdaten">
                <Package className="w-4 h-4" />
                <span className="text-sm font-medium">Artikel</span>
              </motion.button>

              {/* Archive Button */}
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowArchive(true)}
                className="relative flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-slate-600 hover:bg-slate-100 transition-all"
                title="Archiv">
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
                title="Neues Dokument">
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

              {/* Settings */}
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowSettingsModal(true)}
                className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl text-slate-500 hover:bg-slate-100 transition-all flex items-center justify-center"
                title="Einstellungen">
                <Settings className="w-4 h-4" />
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
        {/* Document Type Toggle & Status Card */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 print:hidden">
          {/* Document Type Toggle */}
          <div className="flex gap-1 bg-slate-200/50 p-1 rounded-xl w-fit">
            <button
              onClick={() => switchDocumentType('invoice')}
              className={`relative px-4 py-2 min-h-[40px] rounded-lg font-medium text-sm transition-all ${
                documentType === 'invoice' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {documentType === 'invoice' && (
                <motion.div layoutId="docType" className="absolute inset-0 bg-white shadow-sm rounded-lg"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Receipt className="w-4 h-4" />
                Rechnung
              </span>
            </button>
            <button
              onClick={() => switchDocumentType('offer')}
              className={`relative px-4 py-2 min-h-[40px] rounded-lg font-medium text-sm transition-all ${
                documentType === 'offer' ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {documentType === 'offer' && (
                <motion.div layoutId="docType" className="absolute inset-0 bg-white shadow-sm rounded-lg"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Angebot
              </span>
            </button>
          </div>

          {/* Status Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className={`flex-1 p-4 rounded-2xl flex items-center gap-4 border transition-all ${
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
                {isValid ? 'XRechnung, ZUGFeRD & PDF können erstellt werden' :
                  attemptedExport && errors.length > 0 ? `Fehlend: ${errors.slice(0, 3).join(', ')}` : 'Füllen Sie die Pflichtfelder aus'}
              </p>
            </div>
            {isValid && (
              <>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={runValidation}
                  className="hidden sm:flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-blue-700 hover:bg-blue-100 transition-all">
                  <FileCheck className="w-4 h-4" />
                  Prüfen
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={copyXML}
                  className="hidden sm:flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-all">
                  <Copy className="w-4 h-4" />
                  Kopieren
                </motion.button>
              </>
            )}
            <button onClick={fillExampleData} className="sm:hidden p-2.5 min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </button>
          </motion.div>
        </div>

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
                  <h2 className="text-base font-semibold text-slate-900">
                    {documentType === 'invoice' ? 'Rechnungsdaten' : 'Angebotsdaten'}
                  </h2>
                  {currentInvoiceId && (
                    <span className="ml-auto text-xs text-slate-400">ID: {currentInvoiceId.slice(0, 8)}...</span>
                  )}
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <FormInput
                      label={documentType === 'invoice' ? 'Rechnungsnummer' : 'Angebotsnummer'}
                      value={rechnung.nummer}
                      onChange={handleRechnungChange('nummer')}
                      onBlur={() => markTouched('rechnung.nummer')}
                      required
                      showError={shouldShowError('rechnung.nummer')}
                      placeholder={documentType === 'invoice' ? 'RE-2026-0001' : 'ANG-2026-0001'}
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
                  <FormInput label="Datum" type="date" value={rechnung.datum} onChange={handleRechnungChange('datum')}
                    onBlur={() => markTouched('rechnung.datum')} required showError={shouldShowError('rechnung.datum')} />
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">
                      {documentType === 'invoice' ? 'Fälligkeitsdatum' : 'Gültig bis'} {!faelligkeitManuallySet && <span className="text-xs text-blue-500">(+14 Tage)</span>}
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
                  <div className="px-5 py-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm"><User className="w-4 h-4 text-white" /></div>
                      <h2 className="text-base font-semibold text-slate-900">Kunde</h2>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setSelectCustomerMode(true); setShowCustomerModal(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition-colors"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Stammdaten
                      </button>
                      {kaeufer.firma && (
                        <button
                          onClick={saveCurrentBuyerAsCustomer}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                          Speichern
                        </button>
                      )}
                    </div>
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
                    <FormInput label="Leitweg-ID" value={rechnung.leitwegId} onChange={handleRechnungChange('leitwegId')} placeholder="04011000-12345-12" />
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSelectArticleMode(true); setShowArticleModal(true); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors"
                    >
                      <Package className="w-4 h-4" />
                      Katalog
                    </button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={addPosition}
                      className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
                      <Plus className="w-4 h-4" />Position
                    </motion.button>
                  </div>
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
                              <div className="flex items-center justify-between mb-2">
                                <TypPillSelector value={pos.typ} onChange={(typ) => updatePosition(pos.id, { typ })} />
                                {isComplete && (
                                  <button
                                    onClick={() => savePositionAsArticle(pos)}
                                    className="text-xs text-slate-500 hover:text-amber-600 transition-colors"
                                    title="Als Artikel speichern"
                                  >
                                    Als Artikel speichern
                                  </button>
                                )}
                              </div>
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
                    documentType={documentType}
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
              {/* Validation Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={runValidation}
                className="hidden sm:flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl font-medium text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200"
              >
                <FileCheck className="w-4 h-4" />
                Prüfen
              </motion.button>

              {/* Export Dropdown */}
              <ExportDropdown
                isValid={isValid}
                isGeneratingPdf={isGeneratingPdf}
                onExport={handleExport}
              />
            </div>
          </div>

          {/* Mini Footer Info - Desktop */}
          <div className="hidden lg:flex items-center justify-center gap-4 pb-2 -mt-1">
            <p className="text-xs text-slate-400">XRechnung 3.0 · ZUGFeRD 2.2 · EN 16931 konform</p>
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
          @page {
            size: A4;
            margin: 0;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body > div > *:not(main),
          header,
          footer,
          nav,
          .print\\:hidden,
          button,
          [role="button"] {
            display: none !important;
          }

          main {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }

          .invoice-paper {
            box-shadow: none !important;
            margin: 0 !important;
            padding: 15mm !important;
            width: 100% !important;
            min-height: auto !important;
            background: white !important;
          }

          .invoice-paper * {
            color: black !important;
          }

          .invoice-paper .text-gray-400,
          .invoice-paper .text-gray-500,
          .invoice-paper .text-gray-600,
          .invoice-paper .text-gray-700 {
            color: #374151 !important;
          }

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
