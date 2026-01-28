import Dexie, { type EntityTable } from 'dexie';
import type {
  ArchivedInvoice,
  InvoiceData,
  InvoiceNumberSettings,
  OfferNumberSettings,
  Customer,
  Article,
  DocumentType
} from './types';

// Re-export types for backward compatibility
export type { ArchivedInvoice, InvoiceData, InvoiceNumberSettings, Customer, Article };
export type { InvoiceStatus, DocumentType, OfferStatus } from './types';

// ============================================================================
// DATABASE
// ============================================================================

const db = new Dexie('ERechnungDB') as Dexie & {
  invoices: EntityTable<ArchivedInvoice, 'id'>;
  customers: EntityTable<Customer, 'id'>;
  articles: EntityTable<Article, 'id'>;
  settings: EntityTable<InvoiceNumberSettings | OfferNumberSettings, 'id'>;
};

// Version 1: Original schema
db.version(1).stores({
  invoices: 'id, invoiceNumber, customerName, status, createdAt, updatedAt',
  settings: 'id'
});

// Version 2: Add customers, articles, documentType
db.version(2).stores({
  invoices: 'id, invoiceNumber, customerName, status, documentType, createdAt, updatedAt',
  customers: 'id, name, customerNumber, city, createdAt',
  articles: 'id, name, type, category, articleNumber, createdAt',
  settings: 'id'
}).upgrade(tx => {
  // Migrate existing invoices to have documentType
  return tx.table('invoices').toCollection().modify(invoice => {
    if (!invoice.documentType) {
      invoice.documentType = 'invoice';
    }
  });
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

export const getDefaultOfferSettings = (): OfferNumberSettings => ({
  id: 'offer-number-settings',
  prefix: 'ANG',
  separator: '-',
  yearFormat: '4',
  numberLength: 4,
  resetOnYearChange: true,
  lastYear: new Date().getFullYear(),
  lastNumber: 0
});

export const generateInvoiceNumber = async (): Promise<string> => {
  let settings = await db.settings.get('invoice-number-settings') as InvoiceNumberSettings | undefined;

  if (!settings) {
    settings = getDefaultSettings();
    await db.settings.put(settings);
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

  await db.settings.put({
    ...settings,
    lastYear: currentYear,
    lastNumber: nextNumber
  });

  return `${settings.prefix}${settings.separator}${yearStr}${settings.separator}${numberStr}`;
};

export const generateOfferNumber = async (): Promise<string> => {
  let settings = await db.settings.get('offer-number-settings') as OfferNumberSettings | undefined;

  if (!settings) {
    settings = getDefaultOfferSettings();
    await db.settings.put(settings);
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

  await db.settings.put({
    ...settings,
    lastYear: currentYear,
    lastNumber: nextNumber
  });

  return `${settings.prefix}${settings.separator}${yearStr}${settings.separator}${numberStr}`;
};

export const getNextInvoiceNumber = async (): Promise<string> => {
  let settings = await db.settings.get('invoice-number-settings') as InvoiceNumberSettings | undefined;

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

export const getNextOfferNumber = async (): Promise<string> => {
  let settings = await db.settings.get('offer-number-settings') as OfferNumberSettings | undefined;

  if (!settings) {
    settings = getDefaultOfferSettings();
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

export const generateDocumentNumber = async (type: DocumentType): Promise<string> => {
  return type === 'invoice' ? generateInvoiceNumber() : generateOfferNumber();
};

export const getNextDocumentNumber = async (type: DocumentType): Promise<string> => {
  return type === 'invoice' ? getNextInvoiceNumber() : getNextOfferNumber();
};

// ============================================================================
// CUSTOMER FUNCTIONS
// ============================================================================

export const getAllCustomers = async (): Promise<Customer[]> => {
  return db.customers.orderBy('name').toArray();
};

export const getCustomer = async (id: string): Promise<Customer | undefined> => {
  return db.customers.get(id);
};

export const saveCustomer = async (customer: Customer): Promise<string> => {
  await db.customers.put(customer);
  return customer.id;
};

export const deleteCustomer = async (id: string): Promise<void> => {
  await db.customers.delete(id);
};

export const searchCustomers = async (query: string): Promise<Customer[]> => {
  const lowerQuery = query.toLowerCase();
  const all = await db.customers.toArray();
  return all.filter(c =>
    c.name.toLowerCase().includes(lowerQuery) ||
    (c.customerNumber && c.customerNumber.toLowerCase().includes(lowerQuery)) ||
    c.city.toLowerCase().includes(lowerQuery)
  );
};

// ============================================================================
// ARTICLE FUNCTIONS
// ============================================================================

export const getAllArticles = async (): Promise<Article[]> => {
  return db.articles.orderBy('name').toArray();
};

export const getArticle = async (id: string): Promise<Article | undefined> => {
  return db.articles.get(id);
};

export const saveArticle = async (article: Article): Promise<string> => {
  await db.articles.put(article);
  return article.id;
};

export const deleteArticle = async (id: string): Promise<void> => {
  await db.articles.delete(id);
};

export const searchArticles = async (query: string): Promise<Article[]> => {
  const lowerQuery = query.toLowerCase();
  const all = await db.articles.toArray();
  return all.filter(a =>
    a.name.toLowerCase().includes(lowerQuery) ||
    (a.articleNumber && a.articleNumber.toLowerCase().includes(lowerQuery)) ||
    (a.category && a.category.toLowerCase().includes(lowerQuery))
  );
};

export const getArticlesByType = async (type: Article['type']): Promise<Article[]> => {
  return db.articles.where('type').equals(type).toArray();
};

// ============================================================================
// MIGRATION
// ============================================================================

export const migrateFromLocalStorage = async (): Promise<void> => {
  const STORAGE_KEY = 'e-rechnung-formdata';
  const migrationKey = 'e-rechnung-migrated';

  if (localStorage.getItem(migrationKey)) return;

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    localStorage.setItem(migrationKey, 'true');
    return;
  }

  try {
    const data = JSON.parse(saved) as InvoiceData;

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
        documentType: 'invoice',
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
