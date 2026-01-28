#!/usr/bin/env python3
"""
AI Agency - Multi-Agent System für automatische App-Verbesserung
================================================================
Ein autonomes System mit Orchestrator, Designer, Developer und QA-Wächter.

Architektur:
  [Orchestrator] → Analysiert & entscheidet → [DESIGN] oder [DEV]
         ↓
  [Spezialist] → Führt Task aus (Designer oder Developer)
         ↓
  [Wächter] → Build-Test → Commit oder Rollback
         ↓
  [Loop] → Nächste Iteration

Usage:
  python ai_agency.py              # Startet die Agency
  python ai_agency.py --once       # Nur eine Iteration
  python ai_agency.py --dry-run    # Ohne echte Änderungen
"""

import os
import sys
import subprocess
import time
import re
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple, Literal

# Colorama für bunte Ausgaben
try:
    from colorama import init, Fore, Style
    init(autoreset=True)
except ImportError:
    print("Installing colorama...")
    subprocess.run([sys.executable, "-m", "pip", "install", "colorama", "-q"])
    from colorama import init, Fore, Style
    init(autoreset=True)

# Anthropic SDK
try:
    import anthropic
except ImportError:
    print("Installing anthropic...")
    subprocess.run([sys.executable, "-m", "pip", "install", "anthropic", "-q"])
    import anthropic

# ============================================================================
# KONFIGURATION
# ============================================================================

CONFIG = {
    "project_dir": Path(__file__).parent,
    "target_file": "src/app/page.tsx",
    "log_file": "agency_log.txt",
    "failed_tasks_file": "agency_failed_tasks.json",
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 8000,
    "loop_delay": 10,  # Sekunden zwischen Iterationen
    "max_iterations": 50,  # Sicherheitslimit
}

# ============================================================================
# LOGGING & OUTPUT
# ============================================================================

class AgencyLogger:
    """Zentrales Logging für alle Agenten."""

    def __init__(self, log_path: Path):
        self.log_path = log_path
        self.session_start = datetime.now()
        self._write_header()

    def _write_header(self):
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(f"\n{'='*80}\n")
            f.write(f"AI AGENCY SESSION - {self.session_start.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"{'='*80}\n\n")

    def log(self, agent: str, message: str, level: str = "INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        entry = f"[{timestamp}] [{agent.upper():12}] [{level}] {message}\n"
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(entry)

    def log_code_change(self, agent: str, description: str, lines_changed: int):
        self.log(agent, f"Code geändert: {description} ({lines_changed} Zeilen)")


def print_agent(agent: str, message: str, color: str = Fore.WHITE):
    """Formatierte Agentenausgabe."""
    icon = {
        "orchestrator": "🎯",
        "designer": "🎨",
        "developer": "💻",
        "guardian": "🛡️",
        "system": "⚙️",
    }.get(agent.lower(), "•")

    print(f"{color}{icon} [{agent.upper()}] {message}{Style.RESET_ALL}")


def print_box(title: str, content: str, color: str = Fore.WHITE):
    """Ausgabe in einer Box."""
    width = 70
    print(f"\n{color}╔{'═' * width}╗")
    print(f"║ {title.center(width - 2)} ║")
    print(f"╠{'═' * width}╣")
    for line in content.split('\n')[:10]:  # Max 10 Zeilen
        truncated = line[:width-4] + "..." if len(line) > width-4 else line
        print(f"║ {truncated.ljust(width - 2)} ║")
    print(f"╚{'═' * width}╝{Style.RESET_ALL}\n")


# ============================================================================
# FAILED TASKS MANAGEMENT
# ============================================================================

class FailedTasksManager:
    """Verwaltet gescheiterte Tasks um Wiederholungen zu vermeiden."""

    def __init__(self, path: Path):
        self.path = path
        self.failed_tasks = self._load()

    def _load(self) -> list:
        if self.path.exists():
            try:
                with open(self.path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except:
                return []
        return []

    def _save(self):
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self.failed_tasks[-50:], f, indent=2)  # Nur letzte 50

    def add_failed(self, task: str, error: str):
        self.failed_tasks.append({
            "task": task,
            "error": error[:500],
            "timestamp": datetime.now().isoformat()
        })
        self._save()

    def get_context(self) -> str:
        if not self.failed_tasks:
            return ""
        recent = self.failed_tasks[-5:]
        tasks = [f"- {t['task'][:100]}" for t in recent]
        return f"\n\nVERMEIDE diese kürzlich gescheiterten Aufgaben:\n" + "\n".join(tasks)


# ============================================================================
# CLAUDE API CLIENT
# ============================================================================

class ClaudeClient:
    """Wrapper für Anthropic Claude API."""

    def __init__(self):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError(
                f"{Fore.RED}ANTHROPIC_API_KEY nicht gefunden!\n"
                f"Setze: export ANTHROPIC_API_KEY='sk-ant-...'{Style.RESET_ALL}"
            )
        self.client = anthropic.Anthropic(api_key=api_key)

    def call(self, system: str, user: str, max_tokens: int = 8000) -> str:
        """Ruft Claude API auf und gibt die Antwort zurück."""
        try:
            response = self.client.messages.create(
                model=CONFIG["model"],
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}]
            )
            return response.content[0].text
        except Exception as e:
            raise RuntimeError(f"Claude API Fehler: {e}")


# ============================================================================
# AGENTEN
# ============================================================================

class Orchestrator:
    """Der CEO - Analysiert und entscheidet über nächsten Schritt."""

    SYSTEM_PROMPT = """Du bist der CEO einer AI-Agentur, die eine E-Rechnungs-App für Handwerker optimiert.
Deine Aufgabe: Analysiere den Code und entscheide, was der nächste logische Schritt ist, um den WERT der App zu steigern.

Wertvolle Verbesserungen (priorisiere diese):
- UX-Verbesserungen die Handwerkern Zeit sparen
- Visuelle Klarheit und Professionalität
- Fehlerreduktion und Stabilität
- Mobile-Optimierung (Handwerker sind unterwegs)
- Accessibility

Kategorisiere deine Entscheidung:
[DESIGN] = Optik, Styling, Animationen, Layout (keine Logik-Änderungen)
[DEV] = Features, Logik, Validierung, Performance (keine Design-Änderungen)

WICHTIG: Antworte EXAKT in diesem Format (eine Zeile):
[DESIGN] Beschreibung der Aufgabe...
oder
[DEV] Beschreibung der Aufgabe...

Sei spezifisch und umsetzbar. Keine vagen Vorschläge."""

    def __init__(self, claude: ClaudeClient, failed_manager: FailedTasksManager):
        self.claude = claude
        self.failed_manager = failed_manager

    def analyze(self, code: str) -> Tuple[Literal["DESIGN", "DEV"], str]:
        """Analysiert Code und gibt (Typ, Aufgabe) zurück."""

        failed_context = self.failed_manager.get_context()

        user_prompt = f"""Analysiere diesen Next.js/React Code einer E-Rechnungs-App:

```tsx
{code[:15000]}
```
{f'... (gekürzt, {len(code)} Zeichen total)' if len(code) > 15000 else ''}
{failed_context}

Was ist der nächste wertsteigernde Schritt? Antworte im Format: [DESIGN] oder [DEV] gefolgt von der Aufgabe."""

        response = self.claude.call(self.SYSTEM_PROMPT, user_prompt, max_tokens=500)

        # Parse Response
        match = re.search(r'\[(DESIGN|DEV)\]\s*(.+)', response, re.IGNORECASE)
        if not match:
            # Fallback: Versuche aus dem Text zu extrahieren
            if "design" in response.lower():
                return ("DESIGN", response.strip()[:200])
            return ("DEV", response.strip()[:200])

        task_type = match.group(1).upper()
        task_description = match.group(2).strip()

        return (task_type, task_description)


class Designer:
    """Der UI/UX Designer - Apple/Stripe Stil."""

    SYSTEM_PROMPT = """Du bist ein preisgekrönter UI-Designer mit Fokus auf Apple/Stripe Ästhetik.

Dein Stil:
- Clean, minimalistisch, viel Whitespace
- Subtile Schatten und Glasmorphismus
- Sanfte Animationen mit Framer Motion
- Perfekte Typografie-Hierarchie
- Harmonische Farbpalette (Slate, Emerald, Blue)

REGELN:
1. Ändere NUR Styling (Tailwind Classes, Framer Motion)
2. Ändere KEINE Logik, State oder Funktionen
3. Behalte alle bestehenden Features
4. Gib den KOMPLETTEN geänderten Code zurück
5. Nutze ```tsx Code-Blöcke

Dein Output muss der vollständige, lauffähige page.tsx Code sein."""

    def __init__(self, claude: ClaudeClient):
        self.claude = claude

    def execute(self, code: str, task: str) -> str:
        """Führt Design-Task aus und gibt neuen Code zurück."""

        user_prompt = f"""AUFGABE: {task}

AKTUELLER CODE:
```tsx
{code}
```

Führe NUR diese Design-Aufgabe aus. Gib den kompletten aktualisierten Code zurück."""

        response = self.claude.call(self.SYSTEM_PROMPT, user_prompt)
        return self._extract_code(response)

    def _extract_code(self, response: str) -> str:
        """Extrahiert Code aus der Antwort."""
        # Suche nach tsx/ts/jsx Code-Block
        match = re.search(r'```(?:tsx|ts|jsx|javascript)?\s*\n(.*?)```', response, re.DOTALL)
        if match:
            return match.group(1).strip()

        # Fallback: Wenn Response mit 'use client' beginnt
        if "'use client'" in response or '"use client"' in response:
            # Versuche den Code-Teil zu extrahieren
            start = response.find("'use client'")
            if start == -1:
                start = response.find('"use client"')
            if start != -1:
                return response[start:].strip()

        raise ValueError("Konnte keinen gültigen Code aus der Antwort extrahieren")


class Developer:
    """Der Senior Engineer - Clean Code & Logik."""

    SYSTEM_PROMPT = """Du bist ein Senior Next.js/React Entwickler mit 10+ Jahren Erfahrung.

Dein Fokus:
- Clean Code (SOLID, DRY)
- TypeScript Best Practices
- Performance-Optimierung
- Fehlerbehandlung
- Accessibility (a11y)

REGELN:
1. Ändere NUR Logik, State, Funktionen
2. Minimale Style-Änderungen (nur wenn für Feature nötig)
3. Behalte alle bestehenden Features
4. Gib den KOMPLETTEN geänderten Code zurück
5. Nutze ```tsx Code-Blöcke

Dein Output muss der vollständige, lauffähige page.tsx Code sein."""

    def __init__(self, claude: ClaudeClient):
        self.claude = claude

    def execute(self, code: str, task: str) -> str:
        """Führt Dev-Task aus und gibt neuen Code zurück."""

        user_prompt = f"""AUFGABE: {task}

AKTUELLER CODE:
```tsx
{code}
```

Führe NUR diese Entwicklungs-Aufgabe aus. Gib den kompletten aktualisierten Code zurück."""

        response = self.claude.call(self.SYSTEM_PROMPT, user_prompt)
        return self._extract_code(response)

    def _extract_code(self, response: str) -> str:
        """Extrahiert Code aus der Antwort."""
        match = re.search(r'```(?:tsx|ts|jsx|javascript)?\s*\n(.*?)```', response, re.DOTALL)
        if match:
            return match.group(1).strip()

        if "'use client'" in response or '"use client"' in response:
            start = response.find("'use client'")
            if start == -1:
                start = response.find('"use client"')
            if start != -1:
                return response[start:].strip()

        raise ValueError("Konnte keinen gültigen Code aus der Antwort extrahieren")


class Guardian:
    """Der QA-Wächter - Build-Tests und Git-Management."""

    def __init__(self, project_dir: Path, logger: AgencyLogger):
        self.project_dir = project_dir
        self.logger = logger

    def run_build(self) -> Tuple[bool, str]:
        """Führt npm run build aus."""
        print_agent("guardian", "Starte Build-Prozess...", Fore.CYAN)

        try:
            result = subprocess.run(
                ["npm", "run", "build"],
                cwd=self.project_dir,
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.returncode == 0:
                return (True, "Build erfolgreich")
            else:
                error = result.stderr[:500] if result.stderr else result.stdout[:500]
                return (False, error)

        except subprocess.TimeoutExpired:
            return (False, "Build Timeout (>120s)")
        except Exception as e:
            return (False, str(e))

    def commit(self, agent: str, task: str) -> bool:
        """Erstellt Git Commit."""
        try:
            # Stage changes
            subprocess.run(
                ["git", "add", CONFIG["target_file"]],
                cwd=self.project_dir,
                check=True,
                capture_output=True
            )

            # Commit
            message = f"Agent {agent}: {task[:50]}"
            subprocess.run(
                ["git", "commit", "-m", message],
                cwd=self.project_dir,
                check=True,
                capture_output=True
            )

            self.logger.log("guardian", f"Commit erstellt: {message}")
            return True

        except subprocess.CalledProcessError as e:
            self.logger.log("guardian", f"Commit fehlgeschlagen: {e}", "ERROR")
            return False

    def rollback(self) -> bool:
        """Setzt Änderungen zurück."""
        try:
            subprocess.run(
                ["git", "checkout", "--", CONFIG["target_file"]],
                cwd=self.project_dir,
                check=True,
                capture_output=True
            )
            self.logger.log("guardian", "Rollback durchgeführt")
            return True
        except subprocess.CalledProcessError:
            return False


# ============================================================================
# HAUPTSCHLEIFE
# ============================================================================

class AIAgency:
    """Die AI Agency - Koordiniert alle Agenten."""

    def __init__(self, dry_run: bool = False):
        self.project_dir = CONFIG["project_dir"]
        self.target_file = self.project_dir / CONFIG["target_file"]
        self.dry_run = dry_run

        # Initialisiere Komponenten
        self.logger = AgencyLogger(self.project_dir / CONFIG["log_file"])
        self.failed_manager = FailedTasksManager(
            self.project_dir / CONFIG["failed_tasks_file"]
        )

        try:
            self.claude = ClaudeClient()
        except ValueError as e:
            print(e)
            sys.exit(1)

        self.orchestrator = Orchestrator(self.claude, self.failed_manager)
        self.designer = Designer(self.claude)
        self.developer = Developer(self.claude)
        self.guardian = Guardian(self.project_dir, self.logger)

        self.iteration = 0

    def read_code(self) -> str:
        """Liest aktuellen Code."""
        with open(self.target_file, "r", encoding="utf-8") as f:
            return f.read()

    def write_code(self, code: str):
        """Schreibt neuen Code."""
        with open(self.target_file, "w", encoding="utf-8") as f:
            f.write(code)

    def run_iteration(self) -> bool:
        """Führt eine Iteration durch. Gibt True zurück wenn erfolgreich."""
        self.iteration += 1

        print(f"\n{Fore.WHITE}{'='*70}")
        print(f"{Fore.WHITE}  ITERATION {self.iteration}")
        print(f"{Fore.WHITE}{'='*70}\n")

        # 1. Code lesen
        current_code = self.read_code()
        self.logger.log("system", f"Iteration {self.iteration} gestartet")

        # 2. Orchestrator entscheidet
        print_agent("orchestrator", "Analysiere Code und plane nächsten Schritt...", Fore.YELLOW)

        try:
            task_type, task = self.orchestrator.analyze(current_code)
        except Exception as e:
            print_agent("orchestrator", f"Fehler bei Analyse: {e}", Fore.RED)
            self.logger.log("orchestrator", f"Analyse-Fehler: {e}", "ERROR")
            return False

        print_box(
            f"ORCHESTRATOR ENTSCHEIDUNG: [{task_type}]",
            task,
            Fore.YELLOW
        )
        self.logger.log("orchestrator", f"[{task_type}] {task}")

        # 3. Spezialist führt aus
        if task_type == "DESIGN":
            print_agent("designer", f"Übernehme Aufgabe...", Fore.MAGENTA)
            specialist = self.designer
            agent_name = "DESIGNER"
            agent_color = Fore.MAGENTA
        else:
            print_agent("developer", f"Übernehme Aufgabe...", Fore.BLUE)
            specialist = self.developer
            agent_name = "DEVELOPER"
            agent_color = Fore.BLUE

        try:
            new_code = specialist.execute(current_code, task)
        except Exception as e:
            print_agent(agent_name.lower(), f"Fehler: {e}", Fore.RED)
            self.logger.log(agent_name.lower(), f"Ausführungs-Fehler: {e}", "ERROR")
            self.failed_manager.add_failed(task, str(e))
            return False

        # Validiere dass sich etwas geändert hat
        if new_code == current_code:
            print_agent(agent_name.lower(), "Keine Änderungen vorgenommen", Fore.YELLOW)
            self.logger.log(agent_name.lower(), "Keine Änderungen", "WARN")
            return False

        lines_changed = abs(len(new_code.split('\n')) - len(current_code.split('\n')))
        print_agent(
            agent_name.lower(),
            f"Code aktualisiert ({lines_changed} Zeilen Differenz)",
            agent_color
        )

        if self.dry_run:
            print_agent("system", "DRY-RUN: Änderungen nicht gespeichert", Fore.CYAN)
            return True

        # 4. Code schreiben
        self.write_code(new_code)
        self.logger.log_code_change(agent_name.lower(), task[:50], lines_changed)

        # 5. Guardian prüft
        print_agent("guardian", "Starte Qualitätsprüfung...", Fore.CYAN)

        build_success, build_message = self.guardian.run_build()

        if build_success:
            print_agent("guardian", "✓ Build erfolgreich!", Fore.GREEN)

            # Commit
            if self.guardian.commit(agent_name, task):
                print_agent("guardian", "✓ Commit erstellt", Fore.GREEN)
                self.logger.log("guardian", "Build & Commit erfolgreich")

                print(f"\n{Fore.GREEN}{'━'*70}")
                print(f"{Fore.GREEN}  ✓ ITERATION {self.iteration} ERFOLGREICH ABGESCHLOSSEN")
                print(f"{Fore.GREEN}{'━'*70}\n")

                return True
            else:
                print_agent("guardian", "⚠ Commit fehlgeschlagen", Fore.YELLOW)
        else:
            print_agent("guardian", f"✗ Build fehlgeschlagen!", Fore.RED)
            print(f"{Fore.RED}Fehler: {build_message[:200]}{Style.RESET_ALL}")

            # Rollback
            print_agent("guardian", "Führe Rollback durch...", Fore.YELLOW)
            self.guardian.rollback()

            self.failed_manager.add_failed(task, build_message)
            self.logger.log("guardian", f"Build fehlgeschlagen, Rollback: {build_message[:100]}", "ERROR")

            print(f"\n{Fore.RED}{'━'*70}")
            print(f"{Fore.RED}  ✗ ITERATION {self.iteration} FEHLGESCHLAGEN - ROLLBACK")
            print(f"{Fore.RED}{'━'*70}\n")

            return False

    def run(self, max_iterations: Optional[int] = None, once: bool = False):
        """Startet die Agency-Schleife."""

        max_iter = 1 if once else (max_iterations or CONFIG["max_iterations"])

        print(f"\n{Fore.CYAN}╔{'═'*68}╗")
        print(f"{Fore.CYAN}║{'AI AGENCY - Multi-Agent System'.center(68)}║")
        print(f"{Fore.CYAN}║{'E-Rechnung App Optimierung'.center(68)}║")
        print(f"{Fore.CYAN}╠{'═'*68}╣")
        print(f"{Fore.CYAN}║  🎯 Orchestrator  → Analysiert & plant                              ║")
        print(f"{Fore.CYAN}║  🎨 Designer      → UI/UX Verbesserungen                            ║")
        print(f"{Fore.CYAN}║  💻 Developer     → Features & Logik                                ║")
        print(f"{Fore.CYAN}║  🛡️  Guardian      → Build-Tests & Git                               ║")
        print(f"{Fore.CYAN}╚{'═'*68}╝\n")

        if self.dry_run:
            print(f"{Fore.YELLOW}⚠ DRY-RUN MODUS - Keine echten Änderungen{Style.RESET_ALL}\n")

        self.logger.log("system", f"Agency gestartet (max={max_iter}, dry_run={self.dry_run})")

        successes = 0
        failures = 0

        try:
            while self.iteration < max_iter:
                try:
                    if self.run_iteration():
                        successes += 1
                    else:
                        failures += 1
                except KeyboardInterrupt:
                    raise
                except Exception as e:
                    print_agent("system", f"Unerwarteter Fehler: {e}", Fore.RED)
                    self.logger.log("system", f"Fehler: {e}", "ERROR")
                    failures += 1

                if self.iteration < max_iter and not once:
                    print_agent(
                        "system",
                        f"Pause {CONFIG['loop_delay']}s vor nächster Iteration...",
                        Fore.WHITE
                    )
                    time.sleep(CONFIG["loop_delay"])

        except KeyboardInterrupt:
            print(f"\n{Fore.YELLOW}⚠ Agency durch Benutzer gestoppt{Style.RESET_ALL}")
            self.logger.log("system", "Durch Benutzer gestoppt")

        # Zusammenfassung
        print(f"\n{Fore.CYAN}╔{'═'*68}╗")
        print(f"{Fore.CYAN}║{'ZUSAMMENFASSUNG'.center(68)}║")
        print(f"{Fore.CYAN}╠{'═'*68}╣")
        print(f"{Fore.CYAN}║  Iterationen:  {self.iteration:<51}║")
        print(f"{Fore.GREEN}║  Erfolgreich:  {successes:<51}║")
        print(f"{Fore.RED}║  Fehlgeschlagen: {failures:<49}║")
        print(f"{Fore.CYAN}╚{'═'*68}╝\n")

        self.logger.log("system", f"Beendet: {successes} Erfolge, {failures} Fehler")


# ============================================================================
# ENTRY POINT
# ============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="AI Agency - Multi-Agent App Optimizer")
    parser.add_argument("--once", action="store_true", help="Nur eine Iteration")
    parser.add_argument("--dry-run", action="store_true", help="Keine echten Änderungen")
    parser.add_argument("--max", type=int, default=None, help="Max Iterationen")

    args = parser.parse_args()

    agency = AIAgency(dry_run=args.dry_run)
    agency.run(max_iterations=args.max, once=args.once)


if __name__ == "__main__":
    main()
