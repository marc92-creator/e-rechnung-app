# E-Rechnung App - Projektstatus

**Letztes Update:** 2026-01-28
**Version:** 1.0 (Savepoint)

---

## Projekt-Ziel

Next.js Web-App zur Erstellung von E-Rechnungen im XRechnung-Format (EN 16931) für deutsche Handwerksbetriebe und KMUs. Die App ermöglicht die einfache Eingabe von Rechnungsdaten und generiert rechtskonforme XML-Dateien für die B2B-Rechnungspflicht ab 01.01.2025.

**Business-Ziel:** 5.000€ MRR bis Ende 2026

---

## Status Quo - Was funktioniert

### Kernfunktionen
- **Rechnungseingabe:** Vollständiges Formular für Verkäufer, Käufer und Positionen
- **Positionsverwaltung:** Hinzufügen, Bearbeiten, Löschen von Rechnungspositionen
- **Automatische Berechnungen:** Netto, USt (19%/7%/0%), Brutto pro Position und Gesamt
- **XRechnung-Export:** Generierung von XRechnung 3.0 konformen XML-Dateien
- **DIN 5008 Vorschau:** Live-Vorschau im deutschen Geschäftsbrief-Format (210mm × 297mm)

### Smart Features
- **Auto-Save:** Automatische Speicherung in localStorage (500ms Debounce)
- **Auto-Datum:** Fälligkeitsdatum wird automatisch auf +14 Tage gesetzt
- **Validierung:** Pflichtfelder, E-Mail-Format, PLZ-Format (5 Stellen)
- **Progress-Bar:** Visuelle Anzeige des Formular-Fortschritts

### UI/UX
- **Responsive Design:** Mobile-first mit Desktop-Optimierung
- **Tab-Navigation:** Eingabe | Vorschau | Export
- **Animationen:** Smooth Transitions mit Framer Motion
- **Toast-Notifications:** Feedback bei Speichern, Export, Reset
- **Confirmation Dialog:** Sicherheitsabfrage vor Reset
- **Print-Optimierung:** Nur weißes A4-Papier beim Drucken

### DIN 5008 Layout (Vorschau)
- Absender-Rücksendezeile (Fensterzeile)
- Korrektes Adressfeld
- Info-Block mit Rechnungsmetadaten
- Positionstabelle
- Summenblock mit Netto/USt/Brutto
- §35a-Hinweis für Handwerkerleistungen
- Footer mit Bankverbindung

---

## Tech Stack

| Technologie | Version | Verwendung |
|-------------|---------|------------|
| Next.js | 16.1.5 | Framework (App Router) |
| React | 19.2.3 | UI Library |
| TypeScript | ^5 | Type Safety |
| Tailwind CSS | ^4 | Styling |
| Framer Motion | ^12.29.2 | Animationen |
| Lucide React | ^0.563.0 | Icons |

### Architektur
- Single-Page App mit Client-Side Rendering (`'use client'`)
- Keine Backend-Abhängigkeit (rein clientseitig)
- localStorage für Persistenz
- Modulare Komponenten-Struktur

---

## Code-Struktur (src/app/page.tsx)

```
Zeilen: ~1150

Struktur:
├── Konstanten (EINHEIT_OPTIONS, UST_OPTIONS, etc.)
├── TypeScript Interfaces (Rechnung, Position, etc.)
├── Utility Functions (formatCurrency, formatDate, etc.)
├── Validation Functions (isValidEmail, isValidPLZ)
├── Initial State Factories (createInitialRechnung, etc.)
├── Sub-Components
│   ├── Toast
│   ├── ConfirmDialog
│   ├── ProgressBar
│   ├── FormInput
│   ├── TypPillSelector
│   ├── EmptyState
│   └── InvoicePreview
└── Home Component (Hauptkomponente)
```

---

## Offene Punkte / Next Steps

### Prio A - Kurzfristig
- [ ] PDF-Export hinzufügen (zusätzlich zu XML)
- [ ] Rechnungsnummer-Generator (automatische Vergabe)
- [ ] Mehrere Rechnungen verwalten (Liste/Archiv)

### Prio B - Mittelfristig
- [ ] Backend-Anbindung für Cloud-Speicherung
- [ ] Benutzer-Authentifizierung
- [ ] Kundenstammdaten speichern
- [ ] Artikelstammdaten speichern

### Prio C - Langfristig
- [ ] ZUGFeRD-Format (PDF mit eingebettetem XML)
- [ ] Direkte Übermittlung an Finanzamt/Peppol
- [ ] Mehrsprachigkeit
- [ ] Dark Mode

---

## Bekannte Bugs / Einschränkungen

1. **Port-Konflikt:** Dev-Server wechselt auf Port 3001 wenn 3000 belegt
2. **Keine Offline-Validierung:** XRechnung wird nicht gegen Schema validiert
3. **Keine Sonderzeichen-Escape:** XML-Export könnte bei Sonderzeichen Probleme machen (escapeXML existiert aber)
4. **Kein Error Boundary:** React Errors können die ganze App crashen

---

## Entwicklungsumgebung

```bash
# Installation
npm install

# Development Server
npm run dev

# Production Build
npm run build
npm start
```

**Dev-Server läuft auf:** http://localhost:3001 (oder 3000)

---

## Dateien

```
e-rechnung-app/
├── src/
│   └── app/
│       ├── page.tsx        # Hauptkomponente (~1150 Zeilen)
│       ├── layout.tsx      # Root Layout
│       └── globals.css     # Tailwind + Custom Styles
├── public/                 # Static Assets
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── PROJECT_STATUS.md       # Diese Datei
```

---

## Kontext für neue Session

Bei Fortsetzung der Arbeit:
1. `npm run dev` starten
2. http://localhost:3001 öffnen
3. Diese Datei lesen für Kontext
4. `src/app/page.tsx` ist die Hauptdatei

Die App ist funktionsfähig und kann E-Rechnungen erstellen. Fokus liegt auf Polish und Feature-Erweiterung.
