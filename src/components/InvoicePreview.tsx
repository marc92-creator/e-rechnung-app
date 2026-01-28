'use client';

import type { Rechnung, Verkaeufer, Kaeufer, Position, Summen, DocumentType } from '@/lib/types';

interface InvoicePreviewProps {
  rechnung: Rechnung;
  verkaeufer: Verkaeufer;
  kaeufer: Kaeufer;
  positionen: Position[];
  summen: Summen;
  brutto: number;
  documentType: DocumentType;
  validUntil?: string;
  previewRef?: React.RefObject<HTMLDivElement | null>;
}

const formatCurrency = (value: number): string =>
  value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
};

export function InvoicePreview({
  rechnung,
  verkaeufer,
  kaeufer,
  positionen,
  summen,
  brutto,
  documentType,
  validUntil,
  previewRef
}: InvoicePreviewProps) {
  const isOffer = documentType === 'offer';
  const documentTitle = isOffer ? 'ANGEBOT' : 'RECHNUNG';
  const numberLabel = isOffer ? 'Angebots-Nr.:' : 'Rechnungs-Nr.:';
  const dateLabel2 = isOffer ? 'Gültig bis:' : 'Fällig bis:';
  const endDate = isOffer ? (validUntil || rechnung.faelligkeit) : rechnung.faelligkeit;

  return (
    <div
      ref={previewRef}
      className="bg-white mx-auto invoice-paper"
      style={{ width: '210mm', minHeight: '297mm', padding: '20mm', boxSizing: 'border-box' }}
    >
      {/* Absender-Rücksendezeile */}
      <p className="text-[9px] text-gray-400 underline decoration-gray-300 underline-offset-2 mb-2 print:text-gray-500 print:no-underline">
        {verkaeufer.firma || 'Firma'} · {verkaeufer.strasse || 'Straße'} · {verkaeufer.plz} {verkaeufer.ort}
      </p>

      {/* Adressfeld + Infoblock */}
      <div className="flex justify-between items-start" style={{ minHeight: '35mm' }}>
        <div style={{ width: '85mm' }}>
          <p className="font-semibold text-gray-900 text-[11pt]">{kaeufer.firma || '—'}</p>
          {kaeufer.ansprechpartner && <p className="text-gray-700 text-[10pt]">{kaeufer.ansprechpartner}</p>}
          <p className="text-gray-700 text-[10pt]">{kaeufer.strasse || '—'}</p>
          <p className="text-gray-700 text-[10pt]">{kaeufer.plz} {kaeufer.ort}</p>
        </div>
        <div className="text-right" style={{ width: '70mm' }}>
          <p className="text-[22pt] font-black text-gray-900 tracking-tight leading-none mb-3">{documentTitle}</p>
          <table className="ml-auto text-[9pt]">
            <tbody>
              <tr>
                <td className="text-gray-500 pr-3 py-0.5 text-left">{numberLabel}</td>
                <td className="text-gray-900 font-medium tabular-nums text-right">{rechnung.nummer || '—'}</td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-3 py-0.5 text-left">Datum:</td>
                <td className="text-gray-900 tabular-nums text-right">{formatDate(rechnung.datum)}</td>
              </tr>
              {rechnung.leistungszeitraum && (
                <tr>
                  <td className="text-gray-500 pr-3 py-0.5 text-left">
                    {isOffer ? 'Zeitraum:' : 'Leistungszeitraum:'}
                  </td>
                  <td className="text-gray-900 text-right">{rechnung.leistungszeitraum}</td>
                </tr>
              )}
              {kaeufer.kundennummer && (
                <tr>
                  <td className="text-gray-500 pr-3 py-0.5 text-left">Kunden-Nr.:</td>
                  <td className="text-gray-900 tabular-nums text-right">{kaeufer.kundennummer}</td>
                </tr>
              )}
              <tr>
                <td className="text-gray-500 pr-3 py-0.5 text-left">{dateLabel2}</td>
                <td className="text-gray-900 font-medium tabular-nums text-right">{formatDate(endDate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Betreffzeile */}
      <div style={{ marginTop: '12mm', marginBottom: '6mm' }}>
        <p className="text-[11pt] text-gray-900 font-semibold">
          {isOffer
            ? `Angebot für ${rechnung.leistungszeitraum ? `geplante Leistungen – ${rechnung.leistungszeitraum}` : 'angebotene Leistungen'}`
            : `Rechnung für erbrachte Leistungen${rechnung.leistungszeitraum ? ` – ${rechnung.leistungszeitraum}` : ''}`
          }
        </p>
      </div>

      {/* Positionen-Tabelle */}
      <table className="w-full text-[9pt]" style={{ marginBottom: '8mm' }}>
        <thead>
          <tr className="border-b-2 border-gray-900">
            <th className="text-left py-2 font-semibold text-gray-700 w-8">Pos</th>
            <th className="text-left py-2 font-semibold text-gray-700">Beschreibung</th>
            <th className="text-right py-2 font-semibold text-gray-700 w-14">Menge</th>
            <th className="text-right py-2 font-semibold text-gray-700 w-16">E-Preis</th>
            <th className="text-right py-2 font-semibold text-gray-700 w-18">Betrag</th>
          </tr>
        </thead>
        <tbody>
          {positionen.filter(p => p.bezeichnung).map((pos, idx) => (
            <tr key={pos.id} className="border-b border-gray-200">
              <td className="py-2 text-gray-500 tabular-nums align-top">{idx + 1}</td>
              <td className="py-2 text-gray-900 align-top">{pos.bezeichnung}</td>
              <td className="py-2 text-right text-gray-700 tabular-nums align-top">{pos.menge} {pos.einheit}</td>
              <td className="py-2 text-right text-gray-700 tabular-nums align-top">{formatCurrency(pos.preis)} €</td>
              <td className="py-2 text-right text-gray-900 font-medium tabular-nums align-top">{formatCurrency(pos.menge * pos.preis)} €</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summenblock */}
      <div className="flex justify-end" style={{ marginBottom: '8mm' }}>
        <div style={{ width: '65mm' }}>
          <table className="w-full text-[9pt]">
            <tbody>
              <tr>
                <td className="py-1 text-gray-600">Nettobetrag:</td>
                <td className="py-1 text-right text-gray-900 tabular-nums font-medium">{formatCurrency(summen.netto)} €</td>
              </tr>
              {summen.ust19 > 0 && (
                <tr>
                  <td className="py-1 text-gray-600">+ USt 19%:</td>
                  <td className="py-1 text-right text-gray-700 tabular-nums">{formatCurrency(summen.ust19)} €</td>
                </tr>
              )}
              {summen.ust7 > 0 && (
                <tr>
                  <td className="py-1 text-gray-600">+ USt 7%:</td>
                  <td className="py-1 text-right text-gray-700 tabular-nums">{formatCurrency(summen.ust7)} €</td>
                </tr>
              )}
              <tr className="border-t-2 border-gray-900">
                <td className="py-2 text-gray-900 font-bold text-[11pt]">Gesamtbetrag:</td>
                <td className="py-2 text-right text-gray-900 font-black text-[13pt] tabular-nums">{formatCurrency(brutto)} €</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* §35a Ausweisung (nur bei Rechnung) */}
      {!isOffer && (summen.lohn > 0 || summen.material > 0) && (
        <div className="border border-gray-300 rounded p-3 text-[8pt]" style={{ marginBottom: '8mm' }}>
          <p className="font-semibold text-gray-700 mb-1">Ausweisung gemäß §35a EStG (Handwerkerleistungen):</p>
          <div className="flex gap-6 text-gray-600">
            <span>Lohnkosten: <strong className="text-gray-900 tabular-nums">{formatCurrency(summen.lohn)} €</strong></span>
            <span>Materialkosten: <strong className="text-gray-900 tabular-nums">{formatCurrency(summen.material)} €</strong></span>
          </div>
        </div>
      )}

      {/* Schlusstext */}
      <div className="text-[9pt] text-gray-700" style={{ marginBottom: '12mm' }}>
        {isOffer ? (
          <>
            <p>Dieses Angebot ist gültig bis zum <strong>{formatDate(endDate)}</strong>.</p>
            <p className="mt-1">Bei Fragen stehen wir Ihnen gerne zur Verfügung. Wir freuen uns auf Ihre Beauftragung!</p>
          </>
        ) : (
          <>
            <p>Bitte überweisen Sie den Rechnungsbetrag bis zum <strong>{formatDate(rechnung.faelligkeit)}</strong> auf das unten angegebene Konto.</p>
            <p className="mt-1">Vielen Dank für Ihren Auftrag!</p>
          </>
        )}
      </div>

      {/* Spacer */}
      <div style={{ minHeight: '15mm' }} />

      {/* Footer */}
      <div className="border-t border-gray-300 pt-4 mt-auto">
        <div className="grid grid-cols-3 gap-4 text-[8pt] text-gray-500">
          <div>
            <p className="font-semibold text-gray-700 mb-1">{verkaeufer.firma}</p>
            <p>{verkaeufer.strasse}</p>
            <p>{verkaeufer.plz} {verkaeufer.ort}</p>
            {verkaeufer.telefon && <p>Tel: {verkaeufer.telefon}</p>}
            {verkaeufer.email && <p>{verkaeufer.email}</p>}
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1">Bankverbindung</p>
            {verkaeufer.iban && <p>IBAN: {verkaeufer.iban}</p>}
            {verkaeufer.bic && <p>BIC: {verkaeufer.bic}</p>}
            {verkaeufer.bank && <p>{verkaeufer.bank}</p>}
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1">Steuerdaten</p>
            {verkaeufer.ustId && <p>USt-IdNr.: {verkaeufer.ustId}</p>}
            {verkaeufer.steuernummer && <p>St.-Nr.: {verkaeufer.steuernummer}</p>}
            {verkaeufer.handelsregister && <p>{verkaeufer.handelsregister}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
