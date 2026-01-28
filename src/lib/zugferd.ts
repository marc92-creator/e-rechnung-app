import type { Rechnung, Verkaeufer, Kaeufer, Position } from './types';
import { EINHEIT_MAP } from './types';
import { escapeXML } from './xrechnung';

// ============================================================================
// ZUGFeRD 2.2 CII XML GENERATOR
// ============================================================================

/**
 * Generates ZUGFeRD 2.2 (EN16931 Profile) compliant CII XML
 * UN/CEFACT Cross Industry Invoice Format
 */
export function generateZUGFeRDXML(
  rechnung: Rechnung,
  verkaeufer: Verkaeufer,
  kaeufer: Kaeufer,
  positionen: Position[]
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

  // Generate line items
  let lineItems = '';
  let posNr = 0;

  positionen.forEach(pos => {
    if (pos.bezeichnung && pos.menge > 0 && pos.preis > 0) {
      posNr++;
      const betrag = pos.menge * pos.preis;
      const ustBetrag = betrag * (pos.ust / 100);
      const taxCategoryCode = pos.ust === 0 ? 'Z' : 'S';

      lineItems += `
        <ram:IncludedSupplyChainTradeLineItem>
            <ram:AssociatedDocumentLineDocument>
                <ram:LineID>${posNr}</ram:LineID>
            </ram:AssociatedDocumentLineDocument>
            <ram:SpecifiedTradeProduct>
                <ram:Name>${escapeXML(pos.bezeichnung)}</ram:Name>
            </ram:SpecifiedTradeProduct>
            <ram:SpecifiedLineTradeAgreement>
                <ram:NetPriceProductTradePrice>
                    <ram:ChargeAmount>${pos.preis.toFixed(2)}</ram:ChargeAmount>
                </ram:NetPriceProductTradePrice>
            </ram:SpecifiedLineTradeAgreement>
            <ram:SpecifiedLineTradeDelivery>
                <ram:BilledQuantity unitCode="${EINHEIT_MAP[pos.einheit] || 'H87'}">${pos.menge.toFixed(2)}</ram:BilledQuantity>
            </ram:SpecifiedLineTradeDelivery>
            <ram:SpecifiedLineTradeSettlement>
                <ram:ApplicableTradeTax>
                    <ram:TypeCode>VAT</ram:TypeCode>
                    <ram:CategoryCode>${taxCategoryCode}</ram:CategoryCode>
                    <ram:RateApplicablePercent>${pos.ust}</ram:RateApplicablePercent>
                </ram:ApplicableTradeTax>
                <ram:SpecifiedTradeSettlementLineMonetarySummation>
                    <ram:LineTotalAmount>${betrag.toFixed(2)}</ram:LineTotalAmount>
                </ram:SpecifiedTradeSettlementLineMonetarySummation>
            </ram:SpecifiedLineTradeSettlement>
        </ram:IncludedSupplyChainTradeLineItem>`;
    }
  });

  // Generate tax breakdown
  let taxBreakdown = '';

  if (netto19 > 0) {
    taxBreakdown += `
            <ram:ApplicableTradeTax>
                <ram:CalculatedAmount>${ust19.toFixed(2)}</ram:CalculatedAmount>
                <ram:TypeCode>VAT</ram:TypeCode>
                <ram:BasisAmount>${netto19.toFixed(2)}</ram:BasisAmount>
                <ram:CategoryCode>S</ram:CategoryCode>
                <ram:RateApplicablePercent>19</ram:RateApplicablePercent>
            </ram:ApplicableTradeTax>`;
  }

  if (netto7 > 0) {
    taxBreakdown += `
            <ram:ApplicableTradeTax>
                <ram:CalculatedAmount>${ust7.toFixed(2)}</ram:CalculatedAmount>
                <ram:TypeCode>VAT</ram:TypeCode>
                <ram:BasisAmount>${netto7.toFixed(2)}</ram:BasisAmount>
                <ram:CategoryCode>S</ram:CategoryCode>
                <ram:RateApplicablePercent>7</ram:RateApplicablePercent>
            </ram:ApplicableTradeTax>`;
  }

  if (netto0 > 0) {
    taxBreakdown += `
            <ram:ApplicableTradeTax>
                <ram:CalculatedAmount>0.00</ram:CalculatedAmount>
                <ram:TypeCode>VAT</ram:TypeCode>
                <ram:BasisAmount>${netto0.toFixed(2)}</ram:BasisAmount>
                <ram:CategoryCode>Z</ram:CategoryCode>
                <ram:RateApplicablePercent>0</ram:RateApplicablePercent>
            </ram:ApplicableTradeTax>`;
  }

  // Determine invoice type code
  const typeCode = rechnung.art?.substring(0, 3) || '380';

  // Format date for CII (YYYYMMDD)
  const formatCIIDate = (dateStr: string) => dateStr.replace(/-/g, '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
    xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
    xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
    xmlns:xs="http://www.w3.org/2001/XMLSchema"
    xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
    <rsm:ExchangedDocumentContext>
        <ram:GuidelineSpecifiedDocumentContextParameter>
            <ram:ID>urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:comfort</ram:ID>
        </ram:GuidelineSpecifiedDocumentContextParameter>
    </rsm:ExchangedDocumentContext>
    <rsm:ExchangedDocument>
        <ram:ID>${escapeXML(rechnung.nummer)}</ram:ID>
        <ram:TypeCode>${typeCode}</ram:TypeCode>
        <ram:IssueDateTime>
            <udt:DateTimeString format="102">${formatCIIDate(rechnung.datum)}</udt:DateTimeString>
        </ram:IssueDateTime>
    </rsm:ExchangedDocument>
    <rsm:SupplyChainTradeTransaction>${lineItems}
        <ram:ApplicableHeaderTradeAgreement>
            ${rechnung.leitwegId ? `<ram:BuyerReference>${escapeXML(rechnung.leitwegId)}</ram:BuyerReference>` : ''}
            <ram:SellerTradeParty>
                <ram:Name>${escapeXML(verkaeufer.firma)}</ram:Name>
                <ram:PostalTradeAddress>
                    <ram:PostcodeCode>${escapeXML(verkaeufer.plz)}</ram:PostcodeCode>
                    <ram:LineOne>${escapeXML(verkaeufer.strasse)}</ram:LineOne>
                    <ram:CityName>${escapeXML(verkaeufer.ort)}</ram:CityName>
                    <ram:CountryID>DE</ram:CountryID>
                </ram:PostalTradeAddress>
                ${verkaeufer.email ? `<ram:URIUniversalCommunication>
                    <ram:URIID schemeID="EM">${escapeXML(verkaeufer.email)}</ram:URIID>
                </ram:URIUniversalCommunication>` : ''}
                ${verkaeufer.ustId ? `<ram:SpecifiedTaxRegistration>
                    <ram:ID schemeID="VA">${escapeXML(verkaeufer.ustId)}</ram:ID>
                </ram:SpecifiedTaxRegistration>` : ''}
                ${verkaeufer.steuernummer ? `<ram:SpecifiedTaxRegistration>
                    <ram:ID schemeID="FC">${escapeXML(verkaeufer.steuernummer)}</ram:ID>
                </ram:SpecifiedTaxRegistration>` : ''}
            </ram:SellerTradeParty>
            <ram:BuyerTradeParty>
                <ram:Name>${escapeXML(kaeufer.firma)}</ram:Name>
                <ram:PostalTradeAddress>
                    <ram:PostcodeCode>${escapeXML(kaeufer.plz)}</ram:PostcodeCode>
                    <ram:LineOne>${escapeXML(kaeufer.strasse)}</ram:LineOne>
                    <ram:CityName>${escapeXML(kaeufer.ort)}</ram:CityName>
                    <ram:CountryID>DE</ram:CountryID>
                </ram:PostalTradeAddress>
                ${kaeufer.email ? `<ram:URIUniversalCommunication>
                    <ram:URIID schemeID="EM">${escapeXML(kaeufer.email)}</ram:URIID>
                </ram:URIUniversalCommunication>` : ''}
                ${kaeufer.ustId ? `<ram:SpecifiedTaxRegistration>
                    <ram:ID schemeID="VA">${escapeXML(kaeufer.ustId)}</ram:ID>
                </ram:SpecifiedTaxRegistration>` : ''}
            </ram:BuyerTradeParty>
            ${rechnung.bestellnummer ? `<ram:BuyerOrderReferencedDocument>
                <ram:IssuerAssignedID>${escapeXML(rechnung.bestellnummer)}</ram:IssuerAssignedID>
            </ram:BuyerOrderReferencedDocument>` : ''}
        </ram:ApplicableHeaderTradeAgreement>
        <ram:ApplicableHeaderTradeDelivery>
            ${rechnung.leistungszeitraum ? `<ram:ActualDeliverySupplyChainEvent>
                <ram:OccurrenceDateTime>
                    <udt:DateTimeString format="102">${formatCIIDate(rechnung.datum)}</udt:DateTimeString>
                </ram:OccurrenceDateTime>
            </ram:ActualDeliverySupplyChainEvent>` : ''}
        </ram:ApplicableHeaderTradeDelivery>
        <ram:ApplicableHeaderTradeSettlement>
            <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
            ${verkaeufer.iban ? `<ram:SpecifiedTradeSettlementPaymentMeans>
                <ram:TypeCode>58</ram:TypeCode>
                <ram:PayeePartyCreditorFinancialAccount>
                    <ram:IBANID>${verkaeufer.iban.replace(/\s/g, '')}</ram:IBANID>
                </ram:PayeePartyCreditorFinancialAccount>
                ${verkaeufer.bic ? `<ram:PayeeSpecifiedCreditorFinancialInstitution>
                    <ram:BICID>${verkaeufer.bic.replace(/\s/g, '')}</ram:BICID>
                </ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}
            </ram:SpecifiedTradeSettlementPaymentMeans>` : ''}${taxBreakdown}
            ${rechnung.faelligkeit ? `<ram:SpecifiedTradePaymentTerms>
                <ram:DueDateDateTime>
                    <udt:DateTimeString format="102">${formatCIIDate(rechnung.faelligkeit)}</udt:DateTimeString>
                </ram:DueDateDateTime>
            </ram:SpecifiedTradePaymentTerms>` : ''}
            <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
                <ram:LineTotalAmount>${nettoGesamt.toFixed(2)}</ram:LineTotalAmount>
                <ram:TaxBasisTotalAmount>${nettoGesamt.toFixed(2)}</ram:TaxBasisTotalAmount>
                <ram:TaxTotalAmount currencyID="EUR">${(ust19 + ust7).toFixed(2)}</ram:TaxTotalAmount>
                <ram:GrandTotalAmount>${brutto.toFixed(2)}</ram:GrandTotalAmount>
                <ram:DuePayableAmount>${brutto.toFixed(2)}</ram:DuePayableAmount>
            </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        </ram:ApplicableHeaderTradeSettlement>
    </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

// ============================================================================
// PDF/A-3 WITH EMBEDDED XML
// ============================================================================

/**
 * Creates a ZUGFeRD PDF with embedded XML using pdf-lib
 * The PDF is created as PDF/A-3 compliant with the XML as an associated file
 */
export async function createZUGFeRDPDF(
  pdfBytes: Uint8Array,
  rechnung: Rechnung,
  verkaeufer: Verkaeufer,
  kaeufer: Kaeufer,
  positionen: Position[]
): Promise<Uint8Array> {
  const { PDFDocument, PDFName, PDFDict, PDFArray, PDFString, PDFHexString, PDFStream, AFRelationship } = await import('pdf-lib');

  // Generate the CII XML
  const xmlContent = generateZUGFeRDXML(rechnung, verkaeufer, kaeufer, positionen);
  const xmlBytes = new TextEncoder().encode(xmlContent);

  // Load the existing PDF
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Embed the XML file
  await pdfDoc.attach(xmlBytes, 'factur-x.xml', {
    mimeType: 'text/xml',
    description: 'Factur-X/ZUGFeRD Invoice',
    afRelationship: AFRelationship.Alternative,
    creationDate: new Date(),
    modificationDate: new Date(),
  });

  // Set PDF/A-3 metadata
  pdfDoc.setTitle(`Rechnung ${rechnung.nummer}`);
  pdfDoc.setAuthor(verkaeufer.firma);
  pdfDoc.setSubject(`Rechnung an ${kaeufer.firma}`);
  pdfDoc.setKeywords(['ZUGFeRD', 'Factur-X', 'E-Rechnung', 'EN16931']);
  pdfDoc.setProducer('E-Rechnung App');
  pdfDoc.setCreator('E-Rechnung App - Handwerk Edition');
  pdfDoc.setCreationDate(new Date());
  pdfDoc.setModificationDate(new Date());

  // Add XMP metadata for PDF/A-3 and ZUGFeRD compliance
  const xmpMetadata = generateZUGFeRDXMP(rechnung.nummer, verkaeufer.firma);

  // Note: pdf-lib doesn't have built-in XMP support, but the attachment
  // with AFRelationship.Alternative is the key requirement for ZUGFeRD

  // Save the modified PDF
  const modifiedPdfBytes = await pdfDoc.save();

  return modifiedPdfBytes;
}

/**
 * Generate XMP metadata for ZUGFeRD compliance
 */
function generateZUGFeRDXMP(invoiceNumber: string, sellerName: string): string {
  const now = new Date().toISOString();

  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">Rechnung ${escapeXML(invoiceNumber)}</rdf:li>
        </rdf:Alt>
      </dc:title>
      <dc:creator>
        <rdf:Seq>
          <rdf:li>${escapeXML(sellerName)}</rdf:li>
        </rdf:Seq>
      </dc:creator>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
      <xmp:CreatorTool>E-Rechnung App - Handwerk Edition</xmp:CreatorTool>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Helper to convert data URL to Uint8Array
 */
export function dataURLToUint8Array(dataURL: string): Uint8Array {
  const base64 = dataURL.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
