'use client';

import { useState, useEffect, useCallback } from 'react';

// License key formats:
// 1. Lemon Squeezy UUID: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX (8-4-4-4-12)
// 2. Legacy ERECH: ERECH-XXXX-XXXX-XXXX-XXXX

interface ProState {
  isPro: boolean;
  licenseKey: string | null;
  activatedAt: string | null;
  expiresAt: string | null; // null = lifetime
}

interface UsageState {
  month: string; // Format: YYYY-MM
  invoicesCreated: number;
}

interface ProHookResult {
  isPro: boolean;
  isLoading: boolean;
  licenseKey: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  remainingInvoices: number;
  invoicesThisMonth: number;
  maxInvoicesPerMonth: number;
  maxCustomers: number;
  maxArticles: number;
  canCreateInvoice: boolean;
  canCreateCustomer: (currentCount: number) => boolean;
  canCreateArticle: (currentCount: number) => boolean;
  canUseZUGFeRD: boolean;
  canUseOffers: boolean;
  activateLicense: (key: string) => { success: boolean; error?: string };
  deactivateLicense: () => void;
  incrementInvoiceCount: () => void;
  showUpgradeModal: () => void;
  hideUpgradeModal: () => void;
  isUpgradeModalOpen: boolean;
}

const STORAGE_KEY_PRO = 'e-rechnung-pro-status';
const STORAGE_KEY_USAGE = 'e-rechnung-usage';

const FREE_LIMITS = {
  invoicesPerMonth: 3,
  customers: 5,
  articles: 10,
};

// Validate license key format
export function validateLicenseKey(key: string): boolean {
  const trimmedKey = key.trim().toUpperCase();

  // Lemon Squeezy UUID Format (8-4-4-4-12)
  const uuidPattern = /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/;

  // Legacy ERECH Format
  const erechPattern = /^ERECH-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

  return uuidPattern.test(trimmedKey) || erechPattern.test(trimmedKey);
}

// Generate a valid license key (for testing)
export function generateTestLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for clarity
  let key = 'ERECH';

  for (let i = 0; i < 4; i++) {
    key += '-';
    for (let j = 0; j < 4; j++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
  }

  // Adjust last character to make checksum valid
  const parts = key.replace('ERECH-', '').replace(/-/g, '');
  let sum = 0;
  for (let i = 0; i < parts.length - 1; i++) {
    const char = parts[i];
    if (char >= 'A' && char <= 'Z') {
      sum += char.charCodeAt(0) - 64;
    } else {
      sum += parseInt(char, 10);
    }
  }

  // Find a character that makes sum divisible by 7
  const remainder = sum % 7;
  const needed = remainder === 0 ? 0 : 7 - remainder;
  const lastChar = needed === 0 ? 'G' : String.fromCharCode(64 + needed); // G=7, so it adds 7 which is 0 mod 7

  return key.slice(0, -1) + lastChar;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function usePro(): ProHookResult {
  const [proState, setProState] = useState<ProState>({
    isPro: false,
    licenseKey: null,
    activatedAt: null,
    expiresAt: null,
  });
  const [usage, setUsage] = useState<UsageState>({
    month: getCurrentMonth(),
    invoicesCreated: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Load state from localStorage
  useEffect(() => {
    try {
      const storedPro = localStorage.getItem(STORAGE_KEY_PRO);
      if (storedPro) {
        const parsed = JSON.parse(storedPro) as ProState;
        // Check if license has expired
        if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
          // License expired, reset to free
          setProState({
            isPro: false,
            licenseKey: null,
            activatedAt: null,
            expiresAt: null,
          });
          localStorage.removeItem(STORAGE_KEY_PRO);
        } else {
          setProState(parsed);
        }
      }

      const storedUsage = localStorage.getItem(STORAGE_KEY_USAGE);
      if (storedUsage) {
        const parsed = JSON.parse(storedUsage) as UsageState;
        const currentMonth = getCurrentMonth();
        // Reset counter if new month
        if (parsed.month !== currentMonth) {
          const newUsage = { month: currentMonth, invoicesCreated: 0 };
          setUsage(newUsage);
          localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(newUsage));
        } else {
          setUsage(parsed);
        }
      }
    } catch (e) {
      console.error('Error loading pro state:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save state to localStorage when it changes
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY_PRO, JSON.stringify(proState));
    }
  }, [proState, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(usage));
    }
  }, [usage, isLoading]);

  const activateLicense = useCallback((key: string): { success: boolean; error?: string } => {
    const normalizedKey = key.toUpperCase().trim();

    if (!validateLicenseKey(normalizedKey)) {
      return { success: false, error: 'Ungültiger License Key. Bitte überprüfen Sie die Eingabe.' };
    }

    setProState({
      isPro: true,
      licenseKey: normalizedKey,
      activatedAt: new Date().toISOString(),
      expiresAt: null, // Lifetime license
    });

    return { success: true };
  }, []);

  const deactivateLicense = useCallback(() => {
    setProState({
      isPro: false,
      licenseKey: null,
      activatedAt: null,
      expiresAt: null,
    });
    localStorage.removeItem(STORAGE_KEY_PRO);
  }, []);

  const incrementInvoiceCount = useCallback(() => {
    setUsage(prev => ({
      ...prev,
      invoicesCreated: prev.invoicesCreated + 1,
    }));
  }, []);

  const showUpgradeModal = useCallback(() => {
    setIsUpgradeModalOpen(true);
  }, []);

  const hideUpgradeModal = useCallback(() => {
    setIsUpgradeModalOpen(false);
  }, []);

  const remainingInvoices = proState.isPro
    ? Infinity
    : Math.max(0, FREE_LIMITS.invoicesPerMonth - usage.invoicesCreated);

  const canCreateInvoice = proState.isPro || usage.invoicesCreated < FREE_LIMITS.invoicesPerMonth;

  const canCreateCustomer = useCallback((currentCount: number) => {
    return proState.isPro || currentCount < FREE_LIMITS.customers;
  }, [proState.isPro]);

  const canCreateArticle = useCallback((currentCount: number) => {
    return proState.isPro || currentCount < FREE_LIMITS.articles;
  }, [proState.isPro]);

  return {
    isPro: proState.isPro,
    isLoading,
    licenseKey: proState.licenseKey,
    activatedAt: proState.activatedAt,
    expiresAt: proState.expiresAt,
    remainingInvoices,
    invoicesThisMonth: usage.invoicesCreated,
    maxInvoicesPerMonth: FREE_LIMITS.invoicesPerMonth,
    maxCustomers: FREE_LIMITS.customers,
    maxArticles: FREE_LIMITS.articles,
    canCreateInvoice,
    canCreateCustomer,
    canCreateArticle,
    canUseZUGFeRD: proState.isPro,
    canUseOffers: proState.isPro,
    activateLicense,
    deactivateLicense,
    incrementInvoiceCount,
    showUpgradeModal,
    hideUpgradeModal,
    isUpgradeModalOpen,
  };
}

export { FREE_LIMITS };
