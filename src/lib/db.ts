import Dexie, { type EntityTable } from 'dexie';

// ============================================================================
// TYPES
// ============================================================================

export type InvoiceStatus = 'draft' | 'sent' | 'paid';

export interface InvoiceData {
  rechnung: {
    nummer: string;
    datum: string;
    faelligkeit: string;
    leistungszeitraum: string;
    art: string;
    leitwegId: string;
    bestellnummer: string;
  };
  verkaeufer: {
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
  };
  kaeufer: {
    firma: string;
    strasse: string;
    plz: string;
    ort: string;
    ustId: string;
    ansprechpartner: string;
    email: string;
    kundennummer: string;
  };
  positionen: Array<{
    id: string;
    bezeichnung: string;
    typ: 'L' | 'M' | 'F' | 'S';
    menge: number;
    einheit: string;
    preis: number;
    ust: number;
  }>;
}

export interface ArchivedInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  totalGross: number;
  status: InvoiceStatus;
  createdAt: Date;
  updatedAt: Date;
  data: InvoiceData;
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

// ============================================================================
// DATABASE
// ============================================================================

const db = new Dexie('ERechnungDB') as Dexie & {
  invoices: EntityTable<ArchivedInvoice, 'id'>;
  settings: EntityTable<InvoiceNumberSettings, 'id'>;
};

db.version(1).stores({
  invoices: 'id, invoiceNumber, customerName, status, createdAt, updatedAt',
  settings: 'id'
});

export { db };

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const getDefaultSettings = (): InvoiceNumberSettings => ({
  id: 'invoice-number-settings',
  prefix: 'RE',
  separator: '-',
  yearFormat: '4',
  numberLength: 4,
  resetOnYearChange: true,
  lastYear: new Date().getFullYear(),
  lastNumber: 0
});

export const generateInvoiceNumber = async (): Promise<string> => {
  let settings = await db.settings.get('invoice-number-settings');

  if (!settings) {
    settings = getDefaultSettings();
    await db.settings.put(settings);
  }

  const currentYear = new Date().getFullYear();
  let nextNumber = settings.lastNumber + 1;

  // Reset number on year change if enabled
  if (settings.resetOnYearChange && currentYear !== settings.lastYear) {
    nextNumber = 1;
  }

  const yearStr = settings.yearFormat === '4'
    ? currentYear.toString()
    : currentYear.toString().slice(-2);

  const numberStr = nextNumber.toString().padStart(settings.numberLength, '0');

  // Update settings
  await db.settings.put({
    ...settings,
    lastYear: currentYear,
    lastNumber: nextNumber
  });

  return `${settings.prefix}${settings.separator}${yearStr}${settings.separator}${numberStr}`;
};

export const getNextInvoiceNumber = async (): Promise<string> => {
  let settings = await db.settings.get('invoice-number-settings');

  if (!settings) {
    settings = getDefaultSettings();
  }

  const currentYear = new Date().getFullYear();
  let nextNumber = settings.lastNumber + 1;

  if (settings.resetOnYearChange && currentYear !== settings.lastYear) {
    nextNumber = 1;
  }

  const yearStr = settings.yearFormat === '4'
    ? currentYear.toString()
    : currentYear.toString().slice(-2);

  const numberStr = nextNumber.toString().padStart(settings.numberLength, '0');

  return `${settings.prefix}${settings.separator}${yearStr}${settings.separator}${numberStr}`;
};

export const checkDuplicateInvoiceNumber = async (invoiceNumber: string, excludeId?: string): Promise<boolean> => {
  const existing = await db.invoices.where('invoiceNumber').equals(invoiceNumber).first();
  if (!existing) return false;
  if (excludeId && existing.id === excludeId) return false;
  return true;
};

export const migrateFromLocalStorage = async (): Promise<void> => {
  const STORAGE_KEY = 'e-rechnung-formdata';
  const migrationKey = 'e-rechnung-migrated';

  // Check if already migrated
  if (localStorage.getItem(migrationKey)) return;

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    localStorage.setItem(migrationKey, 'true');
    return;
  }

  try {
    const data = JSON.parse(saved) as InvoiceData;

    // Only migrate if there's actual data
    if (data.rechnung?.nummer || data.verkaeufer?.firma || data.kaeufer?.firma) {
      const summen = data.positionen.reduce((acc, pos) => {
        if (pos.bezeichnung && pos.menge > 0 && pos.preis > 0) {
          const betrag = pos.menge * pos.preis;
          acc.netto += betrag;
          if (pos.ust === 19) acc.ust += betrag * 0.19;
          if (pos.ust === 7) acc.ust += betrag * 0.07;
        }
        return acc;
      }, { netto: 0, ust: 0 });

      const invoice: ArchivedInvoice = {
        id: crypto.randomUUID(),
        invoiceNumber: data.rechnung.nummer || 'Entwurf',
        customerName: data.kaeufer.firma || 'Unbekannt',
        totalGross: summen.netto + summen.ust,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
        data
      };

      await db.invoices.put(invoice);
    }

    localStorage.setItem(migrationKey, 'true');
  } catch (e) {
    console.error('Migration failed:', e);
  }
};
