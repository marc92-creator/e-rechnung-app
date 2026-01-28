# E-Rechnung App - Projektstatus

**Letztes Update:** 2026-01-28
**Version:** 1.1 (Savepoint)

---

## Projekt-Ziel

Next.js Web-App zur Erstellung von E-Rechnungen im XRechnung-Format (EN 16931) für deutsche Handwerksbetriebe und KMUs. Die App ermöglicht die einfache Eingabe von Rechnungsdaten und generiert rechtskonforme XML-Dateien für die B2B-Rechnungspflicht ab 01.01.2025.

**Business-Ziel:** 5.000€ MRR bis Ende 2026

---

## Status Quo - Was funktioniert

### Kernfunktionen
- **Rechnungseingabe:** Vollständiges Formular für Verkäufer, Käufer und Positionen
- **Positionsverwaltung:** Hinzufügen, Bearbeiten, Löschen von Rechnungspositionen
- **Typ-Kategorien:** Lohn (L), Material (M), Fahrt (F), Sonstige (S) mit Farbcodierung
- **Automatische Berechnungen:** Netto, USt (19%/7%/0%), Brutto pro Position und Gesamt
- **XRechnung-Export:** Generierung von XRechnung 3.0 konformen XML-Dateien
- **DIN 5008 Vorschau:** Live-Vorschau im deutschen Geschäftsbrief-Format (210mm x 297mm)
- **§35a EStG Ausweisung:** Automatische Trennung von Lohn- und Materialkosten

### Smart Features
- **Auto-Save:** Automatische Speicherung in localStorage (500ms Debounce)
- **Auto-Datum:** Fälligkeitsdatum wird automatisch auf +14 Tage gesetzt
- **Validierung:** Pflichtfelder, E-Mail-Format, PLZ-Format (5 Stellen)
- **Progress-Bar:** Visuelle Anzeige des Formular-Fortschritts (0-100%)
- **Demo-Daten:** Ein-Klick Befüllung mit realistischen Beispieldaten

### UI/UX (Apple-Style Design)
- **Glassmorphism:** backdrop-blur-xl, bg-white/80, subtile Transparenzen
- **Micro-Interactions:** ring-1 Focus-States, hover:shadow-md Transitions
- **Unified Sticky Action Bar:** Summen + Export-Button immer sichtbar (Desktop & Mobile)
- **Tab-Navigation:** Eingabe | Vorschau
- **Animationen:** Smooth Transitions mit Framer Motion (duration-200)
- **Toast-Notifications:** Feedback bei Speichern, Export, Reset
- **Confirmation Dialog:** Sicherheitsabfrage vor Reset
- **Touch-Targets:** Alle Buttons min. 44px (Apple HIG)
- **Accessibility:** aria-labels für Screen-Reader

### Mobile Optimierung
- **Responsive Grid:** Breakpoints für Mobile/Tablet/Desktop
- **A4-Preview:** Horizontal scrollbar auf kleinen Screens
- **Sticky Bar:** Brutto auf Mobile, Netto/MwSt/Brutto auf Desktop

### Print-Optimierung
- Nur weißes A4-Papier beim Drucken
- Alle UI-Elemente ausgeblendet
- Korrektes DIN 5008 Layout

### DIN 5008 Layout (Vorschau)
- Absender-Rücksendezeile (Fensterzeile)
- Korrektes Adressfeld (85mm Breite)
- Info-Block mit Rechnungsmetadaten (70mm rechts)
- Positionstabelle mit Pos/Beschreibung/Menge/E-Preis/Betrag
- Summenblock mit Netto/USt/Brutto
- §35a-Hinweis für Handwerkerleistungen
- Footer mit 3-Spalten: Firma | Bank | Steuer

---

## Tech Stack

| Technologie | Version | Verwendung |
|-------------|---------|------------|
| Next.js | 16.1.5 | Framework (App Router, Turbopack) |
| React | 19 | UI Library |
| TypeScript | ^5 | Type Safety |
| Tailwind CSS | ^4 | Styling |
| Framer Motion | ^12 | Animationen |
| Lucide React | ^0.563 | Icons |

### Architektur
- Single-Page App mit Client-Side Rendering (`'use client'`)
- Keine Backend-Abhängigkeit (rein clientseitig)
- localStorage für Persistenz
- Modulare Komponenten-Struktur

---

## Code-Struktur (src/app/page.tsx)

```
Zeilen: ~1255

Struktur:
├── Types (15-82)
├── Constants (84-103)
├── Utility Functions (105-134)
├── Initial State Factories (136-153)
├── Calculation Functions (155-201)
├── XML Generator (203-307)
├── Sub-Components (309-599)
│   ├── Toast
│   ├── ConfirmDialog
│   ├── ProgressBar
│   ├── FormInput (Apple-style inputs)
│   ├── TypPillSelector
│   ├── EmptyState
│   └── InvoicePreview (DIN 5008)
└── Home Component (601-1255)
    ├── State & Refs
    ├── Effects (Load, Save, Auto-Date)
    ├── Handlers
    ├── Header mit Progress
    ├── Privacy Banner
    ├── Status Card
    ├── Tab Toggle
    ├── Eingabe-Formular
    ├── Vorschau (A4)
    ├── Unified Sticky Action Bar
    └── Print Styles
```

---

## Git History

```
8ae1a1b POLISH: Apple-Style Design-Refinements & Accessibility
9569f80 AI Agency: .env Support hinzugefügt
09a0869 FEATURE: AI Agency Multi-Agenten-System
f89f06e UX-FIX: Unified Sticky Action Bar für Desktop & Mobile
a5a2288 FEINSCHLIFF: Mobile Responsiveness, Print-Fixes & Touch-Optimierung
8488e2a SAVEPOINT: Status Quo E-Rechnung App v1.0
```

---

## AI Agency (Experimental)

Python-basiertes Multi-Agenten-System für autonome App-Verbesserung:

```
ai_agency.py
├── Orchestrator (CEO): Analysiert und delegiert
├── Designer: Apple/Stripe UI-Verbesserungen
├── Developer: Code-Logik und Features
└── Guardian: Build-Test, Git Commit/Rollback
```

**Verwendung:**
```bash
# .env mit ANTHROPIC_API_KEY benötigt
python3 ai_agency.py --once
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

## Bekannte Einschränkungen

1. **Keine Offline-Validierung:** XRechnung wird nicht gegen Schema validiert
2. **Kein Error Boundary:** React Errors können die ganze App crashen
3. **Single-File:** Alles in page.tsx (bewusste Entscheidung für Einfachheit)

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

**Dev-Server:** http://localhost:3000 (oder 3001/3002 bei Port-Konflikt)

---

## Dateien

```
e-rechnung-app/
├── src/
│   └── app/
│       ├── page.tsx        # Hauptkomponente (~1255 Zeilen)
│       ├── layout.tsx      # Root Layout
│       └── globals.css     # Tailwind + Custom Styles
├── public/                 # Static Assets
├── ai_agency.py            # Multi-Agenten-System
├── .env                    # API Keys (gitignored)
├── .env.example            # Template für .env
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
2. http://localhost:3000 öffnen
3. Diese Datei lesen für Kontext
4. `src/app/page.tsx` ist die Hauptdatei

Die App ist **production-ready** und kann E-Rechnungen erstellen. Fokus liegt auf Feature-Erweiterung (PDF, Archiv, Cloud).
