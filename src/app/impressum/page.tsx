export default function Impressum() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm p-8">
        <h1 className="text-2xl font-bold mb-6">Impressum</h1>

        <h2 className="text-lg font-semibold mt-6 mb-2">Angaben gemäß § 5 TMG</h2>
        <p className="text-gray-700">
          Marc Traut<br />
          Walderdorffstraße 5a<br />
          65549 Limburg an der Lahn
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">Kontakt</h2>
        <p className="text-gray-700">
          E-Mail: e.rechnung.app@gmail.com
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
        <p className="text-gray-700">
          Marc Traut<br />
          Walderdorffstraße 5a<br />
          65549 Limburg an der Lahn
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">Streitschlichtung</h2>
        <p className="text-gray-700">
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:
          <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline ml-1">
            https://ec.europa.eu/consumers/odr/
          </a>
        </p>
        <p className="text-gray-700 mt-2">
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>

        <h2 className="text-lg font-semibold mt-6 mb-2">Haftung für Inhalte</h2>
        <p className="text-gray-700">
          Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
        </p>

        <div className="mt-8 pt-6 border-t">
          <a href="/" className="text-green-600 hover:underline">← Zurück zur App</a>
        </div>
      </div>
    </div>
  );
}
