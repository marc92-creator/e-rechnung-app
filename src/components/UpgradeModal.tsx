'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Zap, FileText, Users, Package, Sparkles, Key } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivateLicense: (key: string) => { success: boolean; error?: string };
  remainingInvoices: number;
  invoicesThisMonth: number;
  triggerReason?: 'invoice-limit' | 'customer-limit' | 'article-limit' | 'zugferd' | 'offers' | 'general';
}

const PRO_FEATURES = [
  { icon: FileText, label: 'Unbegrenzte Rechnungen', description: 'Keine monatlichen Limits' },
  { icon: Users, label: 'Unbegrenzte Kunden', description: 'Alle Kundendaten speichern' },
  { icon: Package, label: 'Unbegrenzte Artikel', description: 'Kompletter Artikelkatalog' },
  { icon: Zap, label: 'ZUGFeRD Export', description: 'PDF mit eingebettetem XML' },
  { icon: Sparkles, label: 'Angebote erstellen', description: 'Professionelle Angebote' },
  { icon: Check, label: 'Kein Wasserzeichen', description: 'Saubere PDFs' },
];

const LEMON_SQUEEZY_CHECKOUT_URL = 'https://e-rechnung-handwerk.lemonsqueezy.com/checkout/buy/5ee192cf-aa56-4d50-961e-a3c411b6dc3c';

export function UpgradeModal({
  isOpen,
  onClose,
  onActivateLicense,
  remainingInvoices,
  invoicesThisMonth,
  triggerReason = 'general',
}: UpgradeModalProps) {
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  const handleActivate = async () => {
    setError(null);
    setIsActivating(true);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const result = onActivateLicense(licenseKey);
    setIsActivating(false);

    if (result.success) {
      setLicenseKey('');
      setShowKeyInput(false);
      onClose();
    } else {
      setError(result.error || 'Aktivierung fehlgeschlagen');
    }
  };

  // Format key: just uppercase and allow alphanumeric + hyphens
  const formatKey = (value: string) => {
    return value.toUpperCase().replace(/[^A-F0-9-]/g, '');
  };

  // Check if key has valid length (UUID: 36, ERECH: 24)
  const isValidKeyLength = (key: string) => {
    return key.length === 36 || key.length === 24;
  };

  const getTriggerMessage = () => {
    switch (triggerReason) {
      case 'invoice-limit':
        return `Sie haben diesen Monat bereits ${invoicesThisMonth} von 3 kostenlosen Rechnungen erstellt.`;
      case 'customer-limit':
        return 'Sie haben das Limit von 5 Kunden in der Free-Version erreicht.';
      case 'article-limit':
        return 'Sie haben das Limit von 10 Artikeln in der Free-Version erreicht.';
      case 'zugferd':
        return 'ZUGFeRD-Export ist nur in der Pro-Version verfügbar.';
      case 'offers':
        return 'Angebote erstellen ist nur in der Pro-Version verfügbar.';
      default:
        return 'Schalten Sie alle Features frei mit E-Rechnung Pro.';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
          >
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-6 py-8 text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzMiAyIDIgNC0yIDQtMiA0LTItMi0yLTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-6 h-6" />
                  <span className="text-sm font-medium bg-white/20 px-2 py-0.5 rounded-full">Pro</span>
                </div>
                <h2 className="text-2xl font-bold mb-2">Upgrade auf Pro</h2>
                <p className="text-white/90 text-sm">{getTriggerMessage()}</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {!showKeyInput ? (
                <>
                  {/* Features list */}
                  <div className="space-y-3 mb-6">
                    {PRO_FEATURES.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <feature.icon className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{feature.label}</p>
                          <p className="text-xs text-slate-500">{feature.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pricing */}
                  <div className="bg-slate-50 rounded-xl p-4 mb-6">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-3xl font-bold text-slate-900">29€</span>
                        <span className="text-slate-500 ml-1">einmalig</span>
                      </div>
                      <span className="text-xs text-emerald-600 font-medium bg-emerald-100 px-2 py-1 rounded-full">
                        Lifetime Access
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Keine Abos, keine versteckten Kosten</p>
                  </div>

                  {/* Buttons */}
                  <div className="space-y-3">
                    <a
                      href={LEMON_SQUEEZY_CHECKOUT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
                    >
                      <Zap className="w-4 h-4" />
                      Pro kaufen
                    </a>
                    <button
                      onClick={() => setShowKeyInput(true)}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      <Key className="w-4 h-4" />
                      License Key eingeben
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* License key input */}
                  <button
                    onClick={() => {
                      setShowKeyInput(false);
                      setError(null);
                      setLicenseKey('');
                    }}
                    className="text-sm text-slate-500 hover:text-slate-700 mb-4 flex items-center gap-1"
                  >
                    ← Zurück
                  </button>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      License Key
                    </label>
                    <input
                      type="text"
                      value={licenseKey}
                      onChange={(e) => {
                        setLicenseKey(formatKey(e.target.value));
                        setError(null);
                      }}
                      placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                      className={`w-full px-4 py-3 rounded-xl border-2 font-mono text-center tracking-wider text-slate-900 placeholder-slate-400 ${
                        error
                          ? 'border-red-300 bg-red-50 focus:border-red-500'
                          : 'border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                      } outline-none transition-colors`}
                      maxLength={36}
                    />
                    {error && (
                      <p className="text-red-600 text-sm mt-2">{error}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-2">
                      Den License Key erhalten Sie nach dem Kauf per E-Mail.
                    </p>
                  </div>

                  <button
                    onClick={handleActivate}
                    disabled={!isValidKeyLength(licenseKey) || isActivating}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isActivating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Aktiviere...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Pro aktivieren
                      </>
                    )}
                  </button>
                </>
              )}

              {/* Free tier info */}
              {!showKeyInput && remainingInvoices > 0 && (
                <p className="text-center text-xs text-slate-400 mt-4">
                  Noch {remainingInvoices} kostenlose {remainingInvoices === 1 ? 'Rechnung' : 'Rechnungen'} diesen Monat
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
