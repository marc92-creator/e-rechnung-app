'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, Crown, Key, ExternalLink, Check, AlertTriangle, Trash2 } from 'lucide-react';
import { validateLicenseKey } from '@/lib/usePro';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPro: boolean;
  licenseKey: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  invoicesThisMonth: number;
  maxInvoicesPerMonth: number;
  onActivateLicense: (key: string) => { success: boolean; error?: string };
  onDeactivateLicense: () => void;
}

const LEMON_SQUEEZY_CHECKOUT_URL = 'https://e-rechnung-handwerk.lemonsqueezy.com/checkout/buy/5ee192cf-aa56-4d50-961e-a3c411b6dc3c';

export function SettingsModal({
  isOpen,
  onClose,
  isPro,
  licenseKey,
  activatedAt,
  expiresAt,
  invoicesThisMonth,
  maxInvoicesPerMonth,
  onActivateLicense,
  onDeactivateLicense,
}: SettingsModalProps) {
  const [newLicenseKey, setNewLicenseKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  // Format key: just uppercase and allow alphanumeric + hyphens
  const formatKey = (value: string) => {
    return value.toUpperCase().replace(/[^A-F0-9-]/g, '');
  };

  // Check if key has valid length (UUID: 36, ERECH: 24)
  const isValidKeyLength = (key: string) => {
    return key.length === 36 || key.length === 24;
  };

  const handleActivate = async () => {
    setError(null);
    setIsActivating(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const result = onActivateLicense(newLicenseKey);
    setIsActivating(false);

    if (result.success) {
      setNewLicenseKey('');
    } else {
      setError(result.error || 'Aktivierung fehlgeschlagen');
    }
  };

  const handleDeactivate = () => {
    onDeactivateLicense();
    setShowDeactivateConfirm(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const maskLicenseKey = (key: string) => {
    // Show first and last parts, mask middle
    const parts = key.split('-');
    if (parts.length === 5) {
      // UUID format (8-4-4-4-12) or ERECH format
      return `${parts[0]}-****-****-****-${parts[4]}`;
    }
    // Fallback: show first 4 and last 4 chars
    return `${key.slice(0, 4)}****${key.slice(-4)}`;
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
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Einstellungen</h2>
                  <p className="text-xs text-slate-500">Account & Lizenz</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status Card */}
              <div className={`rounded-xl p-4 ${isPro ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Crown className={`w-5 h-5 ${isPro ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={`font-semibold ${isPro ? 'text-emerald-900' : 'text-slate-700'}`}>
                      {isPro ? 'Pro Version' : 'Free Version'}
                    </span>
                  </div>
                  {isPro && (
                    <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                      Aktiv
                    </span>
                  )}
                </div>

                {isPro ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Aktiviert am:</span>
                      <span className="text-slate-900 font-medium">
                        {activatedAt ? formatDate(activatedAt) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Gültig bis:</span>
                      <span className="text-emerald-600 font-medium">
                        {expiresAt ? formatDate(expiresAt) : 'Lifetime'}
                      </span>
                    </div>
                    {licenseKey && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">License Key:</span>
                        <span className="text-slate-900 font-mono text-xs">
                          {maskLicenseKey(licenseKey)}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Rechnungen diesen Monat:</span>
                      <span className={`font-medium ${invoicesThisMonth >= maxInvoicesPerMonth ? 'text-red-600' : 'text-slate-900'}`}>
                        {invoicesThisMonth} / {maxInvoicesPerMonth}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          invoicesThisMonth >= maxInvoicesPerMonth ? 'bg-red-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, (invoicesThisMonth / maxInvoicesPerMonth) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      {invoicesThisMonth >= maxInvoicesPerMonth
                        ? 'Limit erreicht. Upgrade auf Pro für unbegrenzte Rechnungen.'
                        : `Noch ${maxInvoicesPerMonth - invoicesThisMonth} kostenlose Rechnungen diesen Monat.`}
                    </p>
                  </div>
                )}
              </div>

              {/* License Key Section */}
              {!isPro && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    License Key aktivieren
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newLicenseKey}
                      onChange={(e) => {
                        setNewLicenseKey(formatKey(e.target.value));
                        setError(null);
                      }}
                      placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                      className={`flex-1 px-3 py-2 rounded-lg border font-mono text-sm text-slate-900 placeholder-slate-400 ${
                        error ? 'border-red-300 bg-red-50' : 'border-slate-300'
                      } focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500`}
                      maxLength={36}
                    />
                    <button
                      onClick={handleActivate}
                      disabled={!isValidKeyLength(newLicenseKey) || isActivating}
                      className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isActivating ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {error && (
                    <p className="text-red-600 text-sm flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      {error}
                    </p>
                  )}
                </div>
              )}

              {/* Deactivate License */}
              {isPro && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Lizenz verwalten
                  </label>
                  {!showDeactivateConfirm ? (
                    <button
                      onClick={() => setShowDeactivateConfirm(true)}
                      className="w-full px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Lizenz deaktivieren
                    </button>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                      <p className="text-sm text-red-700">
                        Sind Sie sicher? Sie können den Key später erneut aktivieren.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowDeactivateConfirm(false)}
                          className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                        >
                          Abbrechen
                        </button>
                        <button
                          onClick={handleDeactivate}
                          className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          Deaktivieren
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Buy Pro Link */}
              {!isPro && (
                <a
                  href={LEMON_SQUEEZY_CHECKOUT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-colors"
                >
                  <Crown className="w-4 h-4" />
                  Pro kaufen — 29€ einmalig
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}

              {/* App Info */}
              <div className="pt-4 border-t border-slate-200">
                <div className="text-center text-xs text-slate-400 space-y-1">
                  <p>E-Rechnung App v1.0</p>
                  <p>
                    <a href="https://e-rechnung-app.de" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600">
                      e-rechnung-app.de
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
