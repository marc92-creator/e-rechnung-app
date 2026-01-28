import type { Rechnung, Verkaeufer, Kaeufer, Position, DocumentType } from './types';
import { EINHEIT_MAP } from './types';

// ============================================================================
// XML HELPERS
// ============================================================================

export const escapeXML = (str: string): string =>
  str.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// ============================================================================
// UBL XRECHNUNG GENERATOR
// ============================================================================

/**
 * Generates XRechnung 3.0 compliant UBL Invoice XML
 */
export function generateXRechnungXML(
  rechnung: Rechnung,
  verkaeufer: Verkaeufer,
  kaeufer: Kaeufer,
  positionen: Position[],
  documentType: DocumentType = 'invoice'
): string {
  // Calculate tax amounts per rate
  let netto19 = 0, netto7 = 0, netto0 = 0;

  positionen.forEach(pos => {
    if (pos.bezeichnung && pos.menge > 0 && pos.preis > 0) {
      const betrag = pos.menge * pos.preis;
      if (pos.ust === 19) netto19 += betrag;
      else if (pos.ust === 7) netto7 += betrag;
      else netto0 += betrag;
    }
  });

  const nettoGesamt = netto19 + netto7 + netto0;
  const ust19 = netto19 * 0.19;
  const ust7 = netto7 * 0.07;
  const brutto = nettoGesamt + ust19 + ust7;

  // Generate invoice lines
  let positionenXML = '';
  let posNr = 0;

  positionen.forEach(pos => {
    if (pos.bezeichnung && pos.menge > 0 && pos.preis > 0) {
      posNr++;
      const betrag = pos.menge * pos.preis;
      const taxCategoryId = pos.ust === 0 ? 'Z' : 'S';

      positionenXML += `
    <cac:InvoiceLine>
        <cbc:ID>${posNr}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="${EINHEIT_MAP[pos.einheit] || 'H87'}">${pos.menge.toFixed(2)}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="EUR">${betrag.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:Item>
            <cbc:Name>${escapeXML(pos.bezeichnung)}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>${taxCategoryId}</cbc:ID>
                <cbc:Percent>${pos.ust}</cbc:Percent>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price><cbc:PriceAmount currencyID="EUR">${pos.preis.toFixed(2)}</cbc:PriceAmount></cac:Price>
    </cac:InvoiceLine>`;
    }
  });

  // Generate tax subtotals
  let taxSubtotals = '';

  if (netto19 > 0) {
    taxSubtotals += `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="EUR">${netto19.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="EUR">${ust19.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>19</cbc:Percent>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>`;
  }

  if (netto7 > 0) {
    taxSubtotals += `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="EUR">${netto7.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="EUR">${ust7.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>7</cbc:Percent>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>`;
  }

  if (netto0 > 0) {
    taxSubtotals += `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="EUR">${netto0.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>Z</cbc:ID>
                <cbc:Percent>0</cbc:Percent>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>`;
  }

  // Determine invoice type code
  const typeCode = rechnung.art?.substring(0, 3) || '380';

  // Generate seller contact info
  let sellerContact = '';
  if (verkaeufer.telefon || verkaeufer.email) {
    sellerContact = `
        <cac:Contact>
            ${verkaeufer.telefon ? `<cbc:Telephone>${escapeXML(verkaeufer.telefon)}</cbc:Telephone>` : ''}
            ${verkaeufer.email ? `<cbc:ElectronicMail>${escapeXML(verkaeufer.email)}</cbc:ElectronicMail>` : ''}
        </cac:Contact>`;
  }

  // Generate buyer contact info
  let buyerContact = '';
  if (kaeufer.ansprechpartner || kaeufer.email) {
    buyerContact = `
        <cac:Contact>
            ${kaeufer.ansprechpartner ? `<cbc:Name>${escapeXML(kaeufer.ansprechpartner)}</cbc:Name>` : ''}
            ${kaeufer.email ? `<cbc:ElectronicMail>${escapeXML(kaeufer.email)}</cbc:ElectronicMail>` : ''}
        </cac:Contact>`;
  }

  // Generate order reference if available
  let orderReference = '';
  if (rechnung.bestellnummer) {
    orderReference = `
    <cac:OrderReference>
        <cbc:ID>${escapeXML(rechnung.bestellnummer)}</cbc:ID>
    </cac:OrderReference>`;
  }

  // Generate delivery period if available
  let deliveryPeriod = '';
  if (rechnung.leistungszeitraum) {
    // Try to parse period - assume format "YYYY-MM" or "Januar 2026" etc.
    deliveryPeriod = `
    <cac:InvoicePeriod>
        <cbc:DescriptionCode>35</cbc:DescriptionCode>
    </cac:InvoicePeriod>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
    <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
    <cbc:ID>${escapeXML(rechnung.nummer)}</cbc:ID>
    <cbc:IssueDate>${rechnung.datum}</cbc:IssueDate>
    ${rechnung.faelligkeit ? `<cbc:DueDate>${rechnung.faelligkeit}</cbc:DueDate>` : ''}
    <cbc:InvoiceTypeCode>${typeCode}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
    <cbc:BuyerReference>${escapeXML(rechnung.leitwegId || kaeufer.kundennummer || 'n/a')}</cbc:BuyerReference>${orderReference}${deliveryPeriod}
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXML(verkaeufer.strasse)}</cbc:StreetName>
                <cbc:CityName>${escapeXML(verkaeufer.ort)}</cbc:CityName>
                <cbc:PostalZone>${escapeXML(verkaeufer.plz)}</cbc:PostalZone>
                <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
            </cac:PostalAddress>
            ${verkaeufer.ustId ? `<cac:PartyTaxScheme>
                <cbc:CompanyID>${escapeXML(verkaeufer.ustId)}</cbc:CompanyID>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:PartyTaxScheme>` : ''}
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXML(verkaeufer.firma)}</cbc:RegistrationName>
                ${verkaeufer.handelsregister ? `<cbc:CompanyID>${escapeXML(verkaeufer.handelsregister)}</cbc:CompanyID>` : ''}
            </cac:PartyLegalEntity>${sellerContact}
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PostalAddress>
                <cbc:StreetName>${escapeXML(kaeufer.strasse)}</cbc:StreetName>
                <cbc:CityName>${escapeXML(kaeufer.ort)}</cbc:CityName>
                <cbc:PostalZone>${escapeXML(kaeufer.plz)}</cbc:PostalZone>
                <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
            </cac:PostalAddress>
            ${kaeufer.ustId ? `<cac:PartyTaxScheme>
                <cbc:CompanyID>${escapeXML(kaeufer.ustId)}</cbc:CompanyID>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:PartyTaxScheme>` : ''}
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${escapeXML(kaeufer.firma)}</cbc:RegistrationName>
            </cac:PartyLegalEntity>${buyerContact}
        </cac:Party>
    </cac:AccountingCustomerParty>
    ${verkaeufer.iban ? `<cac:PaymentMeans>
        <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
        <cac:PayeeFinancialAccount>
            <cbc:ID>${verkaeufer.iban.replace(/\s/g, '')}</cbc:ID>
            ${verkaeufer.bic ? `<cac:FinancialInstitutionBranch>
                <cbc:ID>${verkaeufer.bic.replace(/\s/g, '')}</cbc:ID>
            </cac:FinancialInstitutionBranch>` : ''}
        </cac:PayeeFinancialAccount>
    </cac:PaymentMeans>` : ''}
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="EUR">${(ust19 + ust7).toFixed(2)}</cbc:TaxAmount>${taxSubtotals}
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="EUR">${nettoGesamt.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="EUR">${nettoGesamt.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="EUR">${brutto.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="EUR">${brutto.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>${positionenXML}
</Invoice>`;
}
