import type { Rechnung, Verkaeufer, Kaeufer, Position, ValidationResult, ValidationMessage } from './types';

// ============================================================================
// XRechnung VALIDATION
// ============================================================================

/**
 * Validates invoice data according to XRechnung 3.0 / EN16931 requirements
 * References Business Terms (BT-xxx) from the EN16931 specification
 */
export function validateXRechnung(
  rechnung: Rechnung,
  verkaeufer: Verkaeufer,
  kaeufer: Kaeufer,
  positionen: Position[]
): ValidationResult {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];
  const infos: ValidationMessage[] = [];

  // ============================================================================
  // DOCUMENT LEVEL (BG-1 to BG-4)
  // ============================================================================

  // BT-1: Invoice number (mandatory)
  if (!rechnung.nummer || rechnung.nummer.trim() === '') {
    errors.push({
      code: 'BR-01',
      field: 'rechnung.nummer',
      message: 'Rechnungsnummer ist erforderlich',
      severity: 'error',
      btNumber: 'BT-1'
    });
  }

  // BT-2: Invoice issue date (mandatory)
  if (!rechnung.datum) {
    errors.push({
      code: 'BR-02',
      field: 'rechnung.datum',
      message: 'Rechnungsdatum ist erforderlich',
      severity: 'error',
      btNumber: 'BT-2'
    });
  } else if (!isValidDate(rechnung.datum)) {
    errors.push({
      code: 'BR-02-FORMAT',
      field: 'rechnung.datum',
      message: 'Rechnungsdatum hat ungültiges Format (YYYY-MM-DD erwartet)',
      severity: 'error',
      btNumber: 'BT-2'
    });
  }

  // BT-3: Invoice type code (mandatory) - extracted from art field
  const typeCode = rechnung.art?.substring(0, 3);
  if (!typeCode || !['380', '381', '384', '389'].includes(typeCode)) {
    warnings.push({
      code: 'BR-03',
      field: 'rechnung.art',
      message: 'Rechnungsart sollte einen gültigen Code haben (380=Rechnung, 381=Gutschrift)',
      severity: 'warning',
      btNumber: 'BT-3'
    });
  }

  // BT-5: Invoice currency code - hardcoded to EUR, always valid

  // BT-9: Payment due date (optional but recommended)
  if (!rechnung.faelligkeit) {
    infos.push({
      code: 'INFO-BT9',
      field: 'rechnung.faelligkeit',
      message: 'Fälligkeitsdatum wird empfohlen',
      severity: 'info',
      btNumber: 'BT-9'
    });
  }

  // BT-10: Buyer reference (Leitweg-ID) - mandatory for XRechnung to German public sector
  if (!rechnung.leitwegId || rechnung.leitwegId.trim() === '') {
    warnings.push({
      code: 'BR-DE-15',
      field: 'rechnung.leitwegId',
      message: 'Leitweg-ID ist für öffentliche Auftraggeber erforderlich',
      severity: 'warning',
      btNumber: 'BT-10'
    });
  } else if (!isValidLeitwegId(rechnung.leitwegId)) {
    errors.push({
      code: 'BR-DE-15-FORMAT',
      field: 'rechnung.leitwegId',
      message: 'Leitweg-ID hat ungültiges Format. Erwartetes Format: XX-XXXXXXXX-XX oder ähnlich',
      severity: 'error',
      btNumber: 'BT-10'
    });
  }

  // ============================================================================
  // SELLER (BG-4)
  // ============================================================================

  // BT-27: Seller name (mandatory)
  if (!verkaeufer.firma || verkaeufer.firma.trim() === '') {
    errors.push({
      code: 'BR-04',
      field: 'verkaeufer.firma',
      message: 'Verkäufer-Firmenname ist erforderlich',
      severity: 'error',
      btNumber: 'BT-27'
    });
  }

  // BT-35: Seller address line (mandatory)
  if (!verkaeufer.strasse || verkaeufer.strasse.trim() === '') {
    errors.push({
      code: 'BR-05',
      field: 'verkaeufer.strasse',
      message: 'Verkäufer-Straße ist erforderlich',
      severity: 'error',
      btNumber: 'BT-35'
    });
  }

  // BT-37: Seller city (mandatory)
  if (!verkaeufer.ort || verkaeufer.ort.trim() === '') {
    errors.push({
      code: 'BR-06',
      field: 'verkaeufer.ort',
      message: 'Verkäufer-Ort ist erforderlich',
      severity: 'error',
      btNumber: 'BT-37'
    });
  }

  // BT-38: Seller postal code (mandatory in Germany)
  if (!verkaeufer.plz || verkaeufer.plz.trim() === '') {
    errors.push({
      code: 'BR-07',
      field: 'verkaeufer.plz',
      message: 'Verkäufer-Postleitzahl ist erforderlich',
      severity: 'error',
      btNumber: 'BT-38'
    });
  } else if (!isValidGermanPLZ(verkaeufer.plz)) {
    warnings.push({
      code: 'BR-07-FORMAT',
      field: 'verkaeufer.plz',
      message: 'Verkäufer-PLZ sollte 5 Ziffern haben (deutsches Format)',
      severity: 'warning',
      btNumber: 'BT-38'
    });
  }

  // BT-31 or BT-32: Seller VAT identifier OR tax registration number (at least one required)
  if ((!verkaeufer.ustId || verkaeufer.ustId.trim() === '') &&
      (!verkaeufer.steuernummer || verkaeufer.steuernummer.trim() === '')) {
    errors.push({
      code: 'BR-CO-09',
      field: 'verkaeufer.ustId',
      message: 'USt-IdNr. oder Steuernummer des Verkäufers ist erforderlich',
      severity: 'error',
      btNumber: 'BT-31/BT-32'
    });
  }

  // Validate VAT ID format if provided
  if (verkaeufer.ustId && !isValidVATId(verkaeufer.ustId)) {
    warnings.push({
      code: 'BR-DE-14',
      field: 'verkaeufer.ustId',
      message: 'USt-IdNr. Format möglicherweise ungültig. Erwartetes Format: DE + 9 Ziffern',
      severity: 'warning',
      btNumber: 'BT-31'
    });
  }

  // BT-84: Payment account identifier (IBAN) - recommended
  if (!verkaeufer.iban || verkaeufer.iban.trim() === '') {
    warnings.push({
      code: 'INFO-BT84',
      field: 'verkaeufer.iban',
      message: 'IBAN wird für Zahlungsinformationen empfohlen',
      severity: 'warning',
      btNumber: 'BT-84'
    });
  } else if (!isValidIBAN(verkaeufer.iban)) {
    errors.push({
      code: 'BR-DE-19',
      field: 'verkaeufer.iban',
      message: 'IBAN hat ungültiges Format',
      severity: 'error',
      btNumber: 'BT-84'
    });
  }

  // Email validation
  if (verkaeufer.email && !isValidEmail(verkaeufer.email)) {
    warnings.push({
      code: 'FORMAT-EMAIL-SELLER',
      field: 'verkaeufer.email',
      message: 'E-Mail-Adresse des Verkäufers hat ungültiges Format',
      severity: 'warning'
    });
  }

  // ============================================================================
  // BUYER (BG-7)
  // ============================================================================

  // BT-44: Buyer name (mandatory)
  if (!kaeufer.firma || kaeufer.firma.trim() === '') {
    errors.push({
      code: 'BR-08',
      field: 'kaeufer.firma',
      message: 'Käufer-Firmenname ist erforderlich',
      severity: 'error',
      btNumber: 'BT-44'
    });
  }

  // BT-50: Buyer address line (mandatory)
  if (!kaeufer.strasse || kaeufer.strasse.trim() === '') {
    errors.push({
      code: 'BR-09',
      field: 'kaeufer.strasse',
      message: 'Käufer-Straße ist erforderlich',
      severity: 'error',
      btNumber: 'BT-50'
    });
  }

  // BT-52: Buyer city (mandatory)
  if (!kaeufer.ort || kaeufer.ort.trim() === '') {
    errors.push({
      code: 'BR-10',
      field: 'kaeufer.ort',
      message: 'Käufer-Ort ist erforderlich',
      severity: 'error',
      btNumber: 'BT-52'
    });
  }

  // BT-53: Buyer postal code (mandatory in Germany)
  if (!kaeufer.plz || kaeufer.plz.trim() === '') {
    errors.push({
      code: 'BR-11',
      field: 'kaeufer.plz',
      message: 'Käufer-Postleitzahl ist erforderlich',
      severity: 'error',
      btNumber: 'BT-53'
    });
  } else if (!isValidGermanPLZ(kaeufer.plz)) {
    warnings.push({
      code: 'BR-11-FORMAT',
      field: 'kaeufer.plz',
      message: 'Käufer-PLZ sollte 5 Ziffern haben (deutsches Format)',
      severity: 'warning',
      btNumber: 'BT-53'
    });
  }

  // Email validation
  if (kaeufer.email && !isValidEmail(kaeufer.email)) {
    warnings.push({
      code: 'FORMAT-EMAIL-BUYER',
      field: 'kaeufer.email',
      message: 'E-Mail-Adresse des Käufers hat ungültiges Format',
      severity: 'warning'
    });
  }

  // ============================================================================
  // LINE ITEMS (BG-25)
  // ============================================================================

  const validPositions = positionen.filter(p => p.bezeichnung && p.menge > 0 && p.preis > 0);

  // At least one line item required
  if (validPositions.length === 0) {
    errors.push({
      code: 'BR-16',
      field: 'positionen',
      message: 'Mindestens eine vollständige Position ist erforderlich',
      severity: 'error',
      btNumber: 'BG-25'
    });
  }

  // Validate each position
  validPositions.forEach((pos, index) => {
    const posNum = index + 1;

    // BT-126: Invoice line identifier (we generate sequential)

    // BT-129: Invoiced quantity (mandatory)
    if (pos.menge <= 0) {
      errors.push({
        code: 'BR-22',
        field: `positionen.${index}.menge`,
        message: `Position ${posNum}: Menge muss größer als 0 sein`,
        severity: 'error',
        btNumber: 'BT-129'
      });
    }

    // BT-131: Net price (mandatory)
    if (pos.preis < 0) {
      errors.push({
        code: 'BR-26',
        field: `positionen.${index}.preis`,
        message: `Position ${posNum}: Preis darf nicht negativ sein`,
        severity: 'error',
        btNumber: 'BT-146'
      });
    }

    // BT-153: Item name (mandatory)
    if (!pos.bezeichnung || pos.bezeichnung.trim() === '') {
      errors.push({
        code: 'BR-25',
        field: `positionen.${index}.bezeichnung`,
        message: `Position ${posNum}: Bezeichnung ist erforderlich`,
        severity: 'error',
        btNumber: 'BT-153'
      });
    }

    // BT-151: VAT category - validate rate
    if (![0, 7, 19].includes(pos.ust)) {
      warnings.push({
        code: 'BR-CO-04',
        field: `positionen.${index}.ust`,
        message: `Position ${posNum}: Ungewöhnlicher USt-Satz ${pos.ust}%`,
        severity: 'warning',
        btNumber: 'BT-151'
      });
    }
  });

  // ============================================================================
  // CALCULATION VALIDATION (BG-22)
  // ============================================================================

  // Calculate totals for verification
  let netto19 = 0, netto7 = 0, netto0 = 0;

  validPositions.forEach(pos => {
    const betrag = pos.menge * pos.preis;
    if (pos.ust === 19) netto19 += betrag;
    else if (pos.ust === 7) netto7 += betrag;
    else netto0 += betrag;
  });

  const nettoGesamt = netto19 + netto7 + netto0;
  const ust19 = netto19 * 0.19;
  const ust7 = netto7 * 0.07;
  const brutto = nettoGesamt + ust19 + ust7;

  // Check for calculation issues (rounding)
  if (brutto > 0) {
    const calculatedUst = ust19 + ust7;
    const expectedUstMin = nettoGesamt * 0.06; // At least some tax expected if items have tax

    if (netto19 > 0 || netto7 > 0) {
      if (calculatedUst < expectedUstMin) {
        infos.push({
          code: 'CALC-INFO',
          field: 'summen',
          message: 'USt-Berechnung geprüft. Bei Rundungsdifferenzen bitte Einzelbeträge prüfen.',
          severity: 'info'
        });
      }
    }
  }

  // ============================================================================
  // RESULT
  // ============================================================================

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    infos
  };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function isValidGermanPLZ(plz: string): boolean {
  return /^\d{5}$/.test(plz.trim());
}

function isValidVATId(vatId: string): boolean {
  // German VAT ID: DE + 9 digits
  const cleaned = vatId.replace(/\s/g, '').toUpperCase();
  return /^DE\d{9}$/.test(cleaned);
}

function isValidIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  // Basic format check: 2 letters + 2 digits + up to 30 alphanumeric
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(cleaned)) return false;
  // German IBAN: DE + 20 characters = 22 total
  if (cleaned.startsWith('DE') && cleaned.length !== 22) return false;
  return true;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidLeitwegId(leitwegId: string): boolean {
  // Leitweg-ID format: typically XX-XXXXXXXX-XX or similar patterns
  // Common patterns:
  // - 04011000-12345-12
  // - 991-12345-67
  const cleaned = leitwegId.trim();
  // At least have some structure with numbers and dashes
  return /^[\dA-Za-z]+-[\dA-Za-z]+([-][\dA-Za-z]+)*$/.test(cleaned) && cleaned.length >= 5;
}

// ============================================================================
// QUICK VALIDATION (for basic form validation)
// ============================================================================

export function validateFormBasic(
  rechnung: Rechnung,
  verkaeufer: Verkaeufer,
  kaeufer: Kaeufer,
  positionen: Position[]
): string[] {
  const errors: string[] = [];

  if (!rechnung.nummer) errors.push('Rechnungsnummer');
  if (!rechnung.datum) errors.push('Rechnungsdatum');
  if (!verkaeufer.firma) errors.push('Ihre Firma');
  if (!verkaeufer.strasse) errors.push('Ihre Straße');
  if (!verkaeufer.plz || !verkaeufer.ort) errors.push('Ihre PLZ/Ort');
  if (!verkaeufer.ustId && !verkaeufer.steuernummer) errors.push('USt-ID oder Steuernummer');
  if (!kaeufer.firma) errors.push('Kunde: Firma');
  if (!kaeufer.strasse) errors.push('Kunde: Straße');
  if (!kaeufer.plz || !kaeufer.ort) errors.push('Kunde: PLZ/Ort');
  if (!positionen.some(p => p.bezeichnung && p.menge > 0 && p.preis > 0)) errors.push('Mind. 1 Position');

  return errors;
}

export function calculateProgress(
  rechnung: Rechnung,
  verkaeufer: Verkaeufer,
  kaeufer: Kaeufer,
  positionen: Position[]
): number {
  let filled = 0;
  if (rechnung.nummer) filled++;
  if (rechnung.datum) filled++;
  if (verkaeufer.firma) filled++;
  if (verkaeufer.strasse) filled++;
  if (verkaeufer.plz && verkaeufer.ort) filled++;
  if (verkaeufer.ustId || verkaeufer.steuernummer) filled++;
  if (kaeufer.firma) filled++;
  if (kaeufer.strasse) filled++;
  if (kaeufer.plz && kaeufer.ort) filled++;
  if (positionen.some(p => p.bezeichnung && p.menge > 0 && p.preis > 0)) filled++;
  return Math.round((filled / 10) * 100);
}
