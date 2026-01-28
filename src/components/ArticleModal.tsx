'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  X, Search, Plus, Edit2, Trash2, Package, ChevronRight, Save, AlertTriangle,
  Tag
} from 'lucide-react';
import { db, saveArticle, deleteArticle } from '@/lib/db';
import type { Article, Position, PositionTyp } from '@/lib/types';
import { TYP_OPTIONS, EINHEIT_OPTIONS, UST_OPTIONS } from '@/lib/types';

interface ArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (article: Article) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const formatCurrency = (value: number): string =>
  value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ArticleModal({ isOpen, onClose, onSelect, showToast }: ArticleModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<PositionTyp | 'all'>('all');
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Live query for articles
  const articles = useLiveQuery(() => db.articles.orderBy('name').toArray(), []) ?? [];

  // Filter articles based on search and type
  const filteredArticles = articles.filter(a => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.articleNumber && a.articleNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.category && a.category.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'all' || a.type === filterType;
    return matchesSearch && matchesType;
  });

  // Group articles by type
  const groupedArticles = filteredArticles.reduce((acc, article) => {
    const type = article.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(article);
    return acc;
  }, {} as Record<PositionTyp, Article[]>);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setFilterType('all');
      setEditingArticle(null);
      setIsCreating(false);
      setShowDeleteConfirm(null);
    }
  }, [isOpen]);

  const handleCreateNew = () => {
    const newArticle: Article = {
      id: crypto.randomUUID(),
      name: '',
      type: 'L',
      unit: 'Std',
      unitPrice: 0,
      vatRate: 19,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setEditingArticle(newArticle);
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!editingArticle) return;

    if (!editingArticle.name || editingArticle.unitPrice < 0) {
      showToast('Bitte alle Pflichtfelder ausfüllen', 'error');
      return;
    }

    await saveArticle({
      ...editingArticle,
      updatedAt: new Date()
    });

    showToast(isCreating ? 'Artikel angelegt' : 'Artikel aktualisiert', 'success');
    setEditingArticle(null);
    setIsCreating(false);
  };

  const handleDelete = async (id: string) => {
    await deleteArticle(id);
    showToast('Artikel gelöscht', 'info');
    setShowDeleteConfirm(null);
  };

  const handleSelect = (article: Article) => {
    if (onSelect) {
      onSelect(article);
      onClose();
    }
  };

  const getTypConfig = (type: PositionTyp) => {
    return TYP_OPTIONS.find(t => t.value === type) || TYP_OPTIONS[0];
  };

  const colorClasses: Record<string, { bg: string; text: string; badge: string }> = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', badge: 'bg-blue-500' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-600', badge: 'bg-amber-500' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', badge: 'bg-purple-500' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-600', badge: 'bg-slate-500' }
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
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {editingArticle ? (isCreating ? 'Neuer Artikel' : 'Artikel bearbeiten') : 'Artikelstammdaten'}
              </h2>
              <p className="text-sm text-slate-500">
                {editingArticle ? 'Artikeldaten eingeben' : `${articles.length} Artikel`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {editingArticle ? (
            // Edit/Create Form
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-5 space-y-4"
            >
              {/* Type Selector */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Typ</label>
                <div className="flex gap-2">
                  {TYP_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditingArticle(a => a ? { ...a, type: opt.value } : a)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        editingArticle.type === opt.value
                          ? `${colorClasses[opt.color].badge} text-white`
                          : `${colorClasses[opt.color].bg} ${colorClasses[opt.color].text}`
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Bezeichnung <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingArticle.name}
                    onChange={e => setEditingArticle(a => a ? { ...a, name: e.target.value } : a)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="Elektroinstallation"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Beschreibung</label>
                  <textarea
                    value={editingArticle.description || ''}
                    onChange={e => setEditingArticle(a => a ? { ...a, description: e.target.value } : a)}
                    className="w-full h-20 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                    placeholder="Detaillierte Beschreibung..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Einheit</label>
                  <select
                    value={editingArticle.unit}
                    onChange={e => setEditingArticle(a => a ? { ...a, unit: e.target.value } : a)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 cursor-pointer focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    {EINHEIT_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">
                    Einzelpreis (€) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={editingArticle.unitPrice}
                    onChange={e => setEditingArticle(a => a ? { ...a, unitPrice: parseFloat(e.target.value) || 0 } : a)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">USt-Satz</label>
                  <select
                    value={editingArticle.vatRate}
                    onChange={e => setEditingArticle(a => a ? { ...a, vatRate: parseInt(e.target.value) } : a)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 cursor-pointer focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    {UST_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Artikel-Nr.</label>
                  <input
                    type="text"
                    value={editingArticle.articleNumber || ''}
                    onChange={e => setEditingArticle(a => a ? { ...a, articleNumber: e.target.value } : a)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="ART-001"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Kategorie</label>
                  <input
                    type="text"
                    value={editingArticle.category || ''}
                    onChange={e => setEditingArticle(a => a ? { ...a, category: e.target.value } : a)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="Elektro, Material, Fahrt..."
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button
                  onClick={() => { setEditingArticle(null); setIsCreating(false); }}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-amber-600 text-white font-medium hover:bg-amber-700"
                >
                  <Save className="w-4 h-4" />
                  Speichern
                </button>
              </div>
            </motion.div>
          ) : (
            // Article List
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {/* Search, Filter & Add */}
              <div className="p-4 border-b border-slate-100 space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Artikel suchen..."
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

                {/* Type Filter */}
                <div className="flex gap-1 flex-wrap">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filterType === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Alle
                  </button>
                  {TYP_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterType(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        filterType === opt.value
                          ? `${colorClasses[opt.color].badge} text-white`
                          : `${colorClasses[opt.color].bg} ${colorClasses[opt.color].text}`
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Article List */}
              <div className="max-h-[50vh] overflow-y-auto">
                {filteredArticles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <Package className="w-12 h-12 text-slate-200 mb-4" />
                    <p className="text-slate-500 text-sm">
                      {searchTerm || filterType !== 'all' ? 'Keine Artikel gefunden' : 'Noch keine Artikel angelegt'}
                    </p>
                    {!searchTerm && filterType === 'all' && (
                      <button
                        onClick={handleCreateNew}
                        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        <Plus className="w-4 h-4" />
                        Ersten Artikel anlegen
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredArticles.map(article => {
                      const typConfig = getTypConfig(article.type);
                      const colors = colorClasses[typConfig.color];

                      return (
                        <div
                          key={article.id}
                          className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group"
                        >
                          <button
                            onClick={() => handleSelect(article)}
                            className="flex-1 flex items-center gap-4 text-left"
                            disabled={!onSelect}
                          >
                            <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                              <Tag className={`w-5 h-5 ${colors.text}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-semibold text-slate-900 truncate">{article.name}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                                  {typConfig.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-slate-500">
                                <span className="font-medium tabular-nums">{formatCurrency(article.unitPrice)} € / {article.unit}</span>
                                <span className="text-slate-300">·</span>
                                <span>{article.vatRate}% USt</span>
                                {article.articleNumber && (
                                  <>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-slate-400">{article.articleNumber}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {onSelect && (
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                            )}
                          </button>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingArticle(article)}
                              className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                              title="Bearbeiten"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(article.id)}
                              className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                              title="Löschen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
                  <h3 className="text-lg font-semibold text-slate-900">Artikel löschen?</h3>
                </div>
                <p className="text-slate-600 mb-6">
                  Der Artikel wird unwiderruflich gelöscht.
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

// Helper to convert Article to Position format
export function articleToPosition(article: Article): Omit<Position, 'id'> {
  return {
    bezeichnung: article.name,
    typ: article.type,
    menge: 1,
    einheit: article.unit,
    preis: article.unitPrice,
    ust: article.vatRate
  };
}

// Helper to convert Position to Article format
export function positionToArticle(position: Position): Omit<Article, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: position.bezeichnung,
    type: position.typ,
    unit: position.einheit,
    unitPrice: position.preis,
    vatRate: position.ust
  };
}
