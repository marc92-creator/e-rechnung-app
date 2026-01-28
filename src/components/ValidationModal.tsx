'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle2, AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight,
  Shield, FileCheck, ExternalLink
} from 'lucide-react';
import { useState } from 'react';
import type { ValidationResult, ValidationMessage } from '@/lib/types';

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ValidationResult;
  onNavigateToField?: (field: string) => void;
}

export function ValidationModal({ isOpen, onClose, result, onNavigateToField }: ValidationModalProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    errors: true,
    warnings: true,
    infos: false
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getStatusColor = () => {
    if (result.errors.length > 0) return 'red';
    if (result.warnings.length > 0) return 'amber';
    return 'emerald';
  };

  const getStatusIcon = () => {
    if (result.errors.length > 0) return AlertCircle;
    if (result.warnings.length > 0) return AlertTriangle;
    return CheckCircle2;
  };

  const getStatusText = () => {
    if (result.errors.length > 0) return 'Validierung fehlgeschlagen';
    if (result.warnings.length > 0) return 'Validierung mit Warnungen';
    return 'Validierung erfolgreich';
  };

  const getStatusDescription = () => {
    if (result.errors.length > 0) {
      return `${result.errors.length} Fehler müssen behoben werden, bevor die Rechnung exportiert werden kann.`;
    }
    if (result.warnings.length > 0) {
      return `${result.warnings.length} Warnungen gefunden. Die Rechnung kann exportiert werden, enthält aber möglicherweise Probleme.`;
    }
    return 'Die Rechnung entspricht den XRechnung 3.0 / EN16931 Anforderungen.';
  };

  const statusColor = getStatusColor();
  const StatusIcon = getStatusIcon();

  const colorClasses: Record<string, { bg: string; border: string; text: string; icon: string; badge: string }> = {
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-900',
      icon: 'text-red-600',
      badge: 'bg-red-600'
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-900',
      icon: 'text-amber-600',
      badge: 'bg-amber-600'
    },
    emerald: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-900',
      icon: 'text-emerald-600',
      badge: 'bg-emerald-600'
    }
  };

  const handleNavigate = (field?: string) => {
    if (field && onNavigateToField) {
      onNavigateToField(field);
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
            <div className={`w-10 h-10 rounded-xl ${colorClasses[statusColor].bg} flex items-center justify-center`}>
              <Shield className={`w-5 h-5 ${colorClasses[statusColor].icon}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">XRechnung-Validierung</h2>
              <p className="text-sm text-slate-500">EN16931 / XRechnung 3.0</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Status Banner */}
        <div className={`p-5 ${colorClasses[statusColor].bg} border-b ${colorClasses[statusColor].border}`}>
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-full ${colorClasses[statusColor].bg} border-2 ${colorClasses[statusColor].border} flex items-center justify-center`}>
              <StatusIcon className={`w-6 h-6 ${colorClasses[statusColor].icon}`} />
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-semibold ${colorClasses[statusColor].text}`}>
                {getStatusText()}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {getStatusDescription()}
              </p>
              <div className="flex gap-3 mt-3">
                {result.errors.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-600 text-white">
                    <AlertCircle className="w-3 h-3" />
                    {result.errors.length} Fehler
                  </span>
                )}
                {result.warnings.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-600 text-white">
                    <AlertTriangle className="w-3 h-3" />
                    {result.warnings.length} Warnungen
                  </span>
                )}
                {result.infos.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
                    <Info className="w-3 h-3" />
                    {result.infos.length} Hinweise
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {/* Errors Section */}
          {result.errors.length > 0 && (
            <ValidationSection
              title="Fehler"
              icon={AlertCircle}
              color="red"
              messages={result.errors}
              isExpanded={expandedSections.errors}
              onToggle={() => toggleSection('errors')}
              onNavigate={handleNavigate}
            />
          )}

          {/* Warnings Section */}
          {result.warnings.length > 0 && (
            <ValidationSection
              title="Warnungen"
              icon={AlertTriangle}
              color="amber"
              messages={result.warnings}
              isExpanded={expandedSections.warnings}
              onToggle={() => toggleSection('warnings')}
              onNavigate={handleNavigate}
            />
          )}

          {/* Info Section */}
          {result.infos.length > 0 && (
            <ValidationSection
              title="Hinweise"
              icon={Info}
              color="blue"
              messages={result.infos}
              isExpanded={expandedSections.infos}
              onToggle={() => toggleSection('infos')}
              onNavigate={handleNavigate}
            />
          )}

          {/* Success State */}
          {result.errors.length === 0 && result.warnings.length === 0 && result.infos.length === 0 && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <FileCheck className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Alles in Ordnung!</h3>
              <p className="text-sm text-slate-500">
                Ihre Rechnung erfüllt alle Anforderungen für XRechnung 3.0.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 flex items-center justify-between">
          <a
            href="https://www.xoev.de/xrechnung-16828"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            XRechnung Spezifikation
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800"
          >
            Schließen
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface ValidationSectionProps {
  title: string;
  icon: typeof AlertCircle;
  color: 'red' | 'amber' | 'blue';
  messages: ValidationMessage[];
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: (field?: string) => void;
}

function ValidationSection({ title, icon: Icon, color, messages, isExpanded, onToggle, onNavigate }: ValidationSectionProps) {
  const colorClasses: Record<string, { bg: string; text: string; border: string; hover: string }> = {
    red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', hover: 'hover:bg-red-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', hover: 'hover:bg-amber-100' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', hover: 'hover:bg-blue-100' }
  };

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${colorClasses[color].text}`} />
          <span className="font-medium text-slate-900">{title}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses[color].bg} ${colorClasses[color].text}`}>
            {messages.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {messages.map((msg, index) => (
                <div
                  key={`${msg.code}-${index}`}
                  className={`p-3 rounded-xl ${colorClasses[color].bg} border ${colorClasses[color].border}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500">{msg.code}</span>
                        {msg.btNumber && (
                          <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                            {msg.btNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-700">{msg.message}</p>
                    </div>
                    {msg.field && (
                      <button
                        onClick={() => onNavigate(msg.field)}
                        className={`px-2 py-1 rounded-lg text-xs font-medium ${colorClasses[color].text} ${colorClasses[color].hover} transition-colors`}
                      >
                        Beheben
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
