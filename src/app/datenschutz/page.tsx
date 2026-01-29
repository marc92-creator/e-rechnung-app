export default function Datenschutz() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm p-8">
        <h1 className="text-2xl font-bold mb-6">Datenschutzerklärung</h1>

        <h2 className="text-lg font-semibold mt-6 mb-2">1. Verantwortlicher</h2>
        <p className="text-gray-700">
          Marc Traut<br />
          Musterstraße 123<br />
          65549 Limburg an der Lahn<br />
          E-Mail: deine@email.de
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">2. Lokale Datenspeicherung</h2>
        <p className="text-gray-700">
          Diese Anwendung speichert alle Ihre Daten (Rechnungen, Kundendaten, Einstellungen)
          <strong> ausschließlich lokal in Ihrem Browser</strong> (IndexedDB).
          Es werden keine Daten an unsere Server übertragen. Ihre Daten verlassen Ihr Gerät nicht.
        </p>
        <p className="text-gray-700 mt-2">
          Sie können Ihre lokal gespeicherten Daten jederzeit löschen, indem Sie die Browser-Daten
          für diese Website löschen oder die Browserdaten zurücksetzen.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">3. Hosting</h2>
        <p className="text-gray-700">
          Diese Website wird bei Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA gehostet.
          Beim Aufruf der Website werden automatisch Informationen (z.B. IP-Adresse, Browsertyp)
          in Server-Logfiles gespeichert. Diese Daten sind nicht bestimmten Personen zuordenbar.
          Weitere Informationen finden Sie in der Datenschutzerklärung von Vercel:
          <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline ml-1">
            vercel.com/legal/privacy-policy
          </a>
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">4. Zahlungsabwicklung</h2>
        <p className="text-gray-700">
          Für den Kauf der Pro-Version nutzen wir Lemon Squeezy (Lemon Squeezy LLC) als Zahlungsdienstleister.
          Bei einem Kauf werden Ihre Zahlungsdaten direkt von Lemon Squeezy verarbeitet.
          Wir erhalten lediglich eine Bestätigung über den Kauf sowie den License Key.
          Weitere Informationen finden Sie in der Datenschutzerklärung von Lemon Squeezy:
          <a href="https://www.lemonsqueezy.com/privacy" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline ml-1">
            lemonsqueezy.com/privacy
          </a>
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">5. License Key</h2>
        <p className="text-gray-700">
          Ihr License Key wird lokal in Ihrem Browser gespeichert, um Ihren Pro-Status zu verifizieren.
          Der Key wird nicht an unsere Server übermittelt.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">6. Cookies</h2>
        <p className="text-gray-700">
          Diese Website verwendet keine Tracking-Cookies. Es werden lediglich technisch notwendige
          Daten im Local Storage Ihres Browsers gespeichert (z.B. License Key, Einstellungen).
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">7. Ihre Rechte</h2>
        <p className="text-gray-700">Sie haben das Recht auf:</p>
        <ul className="list-disc list-inside text-gray-700 mt-2 space-y-1">
          <li>Auskunft über Ihre gespeicherten Daten</li>
          <li>Berichtigung unrichtiger Daten</li>
          <li>Löschung Ihrer Daten</li>
          <li>Einschränkung der Verarbeitung</li>
          <li>Datenübertragbarkeit</li>
          <li>Beschwerde bei einer Aufsichtsbehörde</li>
        </ul>
        <p className="text-gray-700 mt-2">
          Da alle Ihre Rechnungsdaten lokal gespeichert werden, haben Sie jederzeit volle Kontrolle
          über Ihre Daten und können diese selbstständig einsehen, exportieren oder löschen.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">8. Änderungen</h2>
        <p className="text-gray-700">
          Wir behalten uns vor, diese Datenschutzerklärung zu aktualisieren.
          Die aktuelle Version ist stets auf dieser Seite verfügbar.
        </p>

        <p className="text-gray-500 mt-6 text-sm">Stand: Januar 2026</p>

        <div className="mt-8 pt-6 border-t">
          <a href="/" className="text-green-600 hover:underline">← Zurück zur App</a>
        </div>
      </div>
    </div>
  );
}
