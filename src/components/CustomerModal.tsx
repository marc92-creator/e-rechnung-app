'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  X, Search, Plus, Edit2, Trash2, Users, Building2, MapPin, Mail, Phone,
  ChevronRight, Save, AlertTriangle
} from 'lucide-react';
import { db, saveCustomer, deleteCustomer } from '@/lib/db';
import type { Customer, Kaeufer } from '@/lib/types';

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (customer: Customer) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function CustomerModal({ isOpen, onClose, onSelect, showToast }: CustomerModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Live query for customers
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), []) ?? [];

  // Filter customers based on search
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.customerNumber && c.customerNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
    c.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setEditingCustomer(null);
      setIsCreating(false);
      setShowDeleteConfirm(null);
    }
  }, [isOpen]);

  const handleCreateNew = () => {
    const newCustomer: Customer = {
      id: crypto.randomUUID(),
      name: '',
      street: '',
      postalCode: '',
      city: '',
      country: 'DE',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setEditingCustomer(newCustomer);
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!editingCustomer) return;

    if (!editingCustomer.name || !editingCustomer.street || !editingCustomer.postalCode || !editingCustomer.city) {
      showToast('Bitte alle Pflichtfelder ausfüllen', 'error');
      return;
    }

    await saveCustomer({
      ...editingCustomer,
      updatedAt: new Date()
    });

    showToast(isCreating ? 'Kunde angelegt' : 'Kunde aktualisiert', 'success');
    setEditingCustomer(null);
    setIsCreating(false);
  };

  const handleDelete = async (id: string) => {
    await deleteCustomer(id);
    showToast('Kunde gelöscht', 'info');
    setShowDeleteConfirm(null);
  };

  const handleSelect = (customer: Customer) => {
    if (onSelect) {
      onSelect(customer);
      onClose();
    }
  };

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
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {editingCustomer ? (isCreating ? 'Neuer Kunde' : 'Kunde bearbeiten') : 'Kundenstammdaten'}
              </h2>
              <p className="text-sm text-slate-500">
                {editingCustomer ? 'Kundendaten eingeben' : `${customers.length} Kunden`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {editingCustomer ? (
            // Edit/Create Form
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-5 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Firma / Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.name}
                    onChange={e => setEditingCustomer(c => c ? { ...c, name: e.target.value } : c)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="Musterkunde GmbH"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Straße & Hausnummer <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.street}
                    onChange={e => setEditingCustomer(c => c ? { ...c, street: e.target.value } : c)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="Musterstraße 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    PLZ <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.postalCode}
                    onChange={e => setEditingCustomer(c => c ? { ...c, postalCode: e.target.value } : c)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="12345"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Ort <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.city}
                    onChange={e => setEditingCustomer(c => c ? { ...c, city: e.target.value } : c)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="Musterstadt"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Kunden-Nr.</label>
                  <input
                    type="text"
                    value={editingCustomer.customerNumber || ''}
                    onChange={e => setEditingCustomer(c => c ? { ...c, customerNumber: e.target.value } : c)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="K-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">USt-IdNr.</label>
                  <input
                    type="text"
                    value={editingCustomer.vatId || ''}
                    onChange={e => setEditingCustomer(c => c ? { ...c, vatId: e.target.value } : c)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="DE123456789"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">E-Mail</label>
                  <input
                    type="email"
                    value={editingCustomer.email || ''}
                    onChange={e => setEditingCustomer(c => c ? { ...c, email: e.target.value } : c)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="rechnung@kunde.de"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Telefon</label>
                  <input
                    type="tel"
                    value={editingCustomer.phone || ''}
                    onChange={e => setEditingCustomer(c => c ? { ...c, phone: e.target.value } : c)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="030 123456"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Leitweg-ID</label>
                  <input
                    type="text"
                    value={editingCustomer.leitwegId || ''}
                    onChange={e => setEditingCustomer(c => c ? { ...c, leitwegId: e.target.value } : c)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="04011000-12345-12"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Notizen</label>
                  <textarea
                    value={editingCustomer.notes || ''}
                    onChange={e => setEditingCustomer(c => c ? { ...c, notes: e.target.value } : c)}
                    className="w-full h-20 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                    placeholder="Interne Notizen..."
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button
                  onClick={() => { setEditingCustomer(null); setIsCreating(false); }}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
                >
                  <Save className="w-4 h-4" />
                  Speichern
                </button>
              </div>
            </motion.div>
          ) : (
            // Customer List
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {/* Search & Add */}
              <div className="p-4 border-b border-slate-100 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Kunde suchen..."
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>
                <button
                  onClick={handleCreateNew}
                  className="flex items-center gap-2 px-4 h-11 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Neu</span>
                </button>
              </div>

              {/* Customer List */}
              <div className="max-h-[50vh] overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <Users className="w-12 h-12 text-slate-200 mb-4" />
                    <p className="text-slate-500 text-sm">
                      {searchTerm ? 'Keine Kunden gefunden' : 'Noch keine Kunden angelegt'}
                    </p>
                    {!searchTerm && (
                      <button
                        onClick={handleCreateNew}
                        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        <Plus className="w-4 h-4" />
                        Ersten Kunden anlegen
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredCustomers.map(customer => (
                      <div
                        key={customer.id}
                        className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group"
                      >
                        <button
                          onClick={() => handleSelect(customer)}
                          className="flex-1 flex items-center gap-4 text-left"
                          disabled={!onSelect}
                        >
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold text-slate-900 truncate">{customer.name}</span>
                              {customer.customerNumber && (
                                <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {customer.customerNumber}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{customer.postalCode} {customer.city}</span>
                            </div>
                          </div>
                          {onSelect && (
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                          )}
                        </button>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingCustomer(customer)}
                            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            title="Bearbeiten"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(customer.id)}
                            className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                            title="Löschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center rounded-2xl"
              onClick={() => setShowDeleteConfirm(null)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-xl p-6 m-4 max-w-sm"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Kunde löschen?</h3>
                </div>
                <p className="text-slate-600 mb-6">
                  Der Kunde wird unwiderruflich gelöscht.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="px-4 py-2.5 min-h-[44px] rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={() => handleDelete(showDeleteConfirm)}
                    className="px-4 py-2.5 min-h-[44px] rounded-xl bg-red-600 text-white font-medium hover:bg-red-700"
                  >
                    Löschen
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// Helper to convert Customer to Kaeufer format
export function customerToKaeufer(customer: Customer): Kaeufer {
  return {
    firma: customer.name,
    strasse: customer.street,
    plz: customer.postalCode,
    ort: customer.city,
    ustId: customer.vatId || '',
    ansprechpartner: '',
    email: customer.email || '',
    kundennummer: customer.customerNumber || ''
  };
}

// Helper to convert Kaeufer to Customer format
export function kaeuferToCustomer(kaeufer: Kaeufer, leitwegId?: string): Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: kaeufer.firma,
    street: kaeufer.strasse,
    postalCode: kaeufer.plz,
    city: kaeufer.ort,
    country: 'DE',
    vatId: kaeufer.ustId || undefined,
    email: kaeufer.email || undefined,
    customerNumber: kaeufer.kundennummer || undefined,
    leitwegId: leitwegId || undefined
  };
}
