'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileText, FileDown, ChevronDown, Loader2, Info } from 'lucide-react';

type ExportFormat = 'xrechnung' | 'zugferd' | 'pdf';

interface ExportDropdownProps {
  isValid: boolean;
  isGeneratingPdf: boolean;
  onExport: (format: ExportFormat) => void;
}

const EXPORT_OPTIONS: { value: ExportFormat; label: string; description: string; icon: typeof FileText }[] = [
  {
    value: 'xrechnung',
    label: 'XRechnung (XML)',
    description: 'Reines XML für öffentliche Auftraggeber',
    icon: FileText
  },
  {
    value: 'zugferd',
    label: 'ZUGFeRD (PDF+XML)',
    description: 'PDF mit eingebettetem XML für B2B',
    icon: FileDown
  },
  {
    value: 'pdf',
    label: 'PDF',
    description: 'Standard-PDF ohne XML-Daten',
    icon: FileDown
  }
];

export function ExportDropdown({ isValid, isGeneratingPdf, onExport }: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState<ExportFormat | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = (format: ExportFormat) => {
    onExport(format);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        disabled={isGeneratingPdf}
        className={`flex items-center gap-2 px-5 lg:px-6 py-3 min-h-[48px] rounded-xl font-semibold text-sm lg:text-base transition-all ${
          isValid
            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-600/30'
            : 'bg-slate-200 text-slate-500 cursor-pointer hover:bg-slate-300'
        }`}
      >
        {isGeneratingPdf ? (
          <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin" />
        ) : (
          <Download className="w-4 h-4 lg:w-5 lg:h-5" />
        )}
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50"
          >
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-xs font-medium text-slate-500">Export-Format wählen</p>
            </div>

            {EXPORT_OPTIONS.map(option => {
              const Icon = option.icon;
              return (
                <div key={option.value} className="relative">
                  <button
                    onClick={() => handleExport(option.value)}
                    onMouseEnter={() => setShowTooltip(option.value)}
                    onMouseLeave={() => setShowTooltip(null)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      option.value === 'xrechnung' ? 'bg-blue-100 text-blue-600' :
                      option.value === 'zugferd' ? 'bg-emerald-100 text-emerald-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 text-sm">{option.label}</p>
                      <p className="text-xs text-slate-500">{option.description}</p>
                    </div>
                  </button>
                </div>
              );
            })}

            <div className="px-3 py-2 border-t border-slate-100 mt-1">
              <div className="flex items-start gap-2 text-xs text-slate-500">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <p>
                  <strong>XRechnung:</strong> Für Behörden pflicht.{' '}
                  <strong>ZUGFeRD:</strong> Standard für B2B.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
