# Assets und Lizenzen

Alles in dieser Kampagne ist entweder eigenes Material des Projekts, lokal
erzeugt oder freie Software mit unten genannter Lizenz. Es wurden keine
kostenpflichtigen Dienste, keine Stockbilder, keine fremde Musik und keine
Cloud-Sprachdienste verwendet.

## Inhalte im Bild

| Was | Herkunft | Lizenz / Rechte |
|---|---|---|
| Logo, Bildmarke, Farben | `assets/brand/` des Projekts (erzeugt von `scripts/build-brand.py`) | Projekt Cache & Carry, Apache 2.0 |
| Dashboard-Aufnahmen | echte Oberfläche von Cache & Carry 0.2.1: Demo-Instanz auf dem Entwicklungsrechner und frische Tutorial-Installation | Projekt Cache & Carry |
| Terminalaufnahmen | echte Ausführung, aufgenommen mit asciinema 3.2.1, wiedergegeben über `@xterm/headless` | eigene Aufnahmen |
| Ausgaben von pacman, apt, Proxmox `pct` | Programmausgaben während der Aufnahme | Ausgaben von Werkzeugen, keine geschützten Werke |
| GitHub-Seiten | Screenshots der öffentlichen Projektseite `github.com/Anarki-LNX/cachencarry` | Inhalt: Projekt Cache & Carry. Oberfläche: GitHub, nur als Abbildung der eigenen Projektseite |
| Netzwerkgrafiken, Icons, Animationen | in Remotion gezeichnet (`project/src/kit.tsx`, `blocks.tsx`) | eigene Arbeit |
| Schriften | Adwaita Sans und Adwaita Mono (Systemschriften) | SIL Open Font License 1.1 |

## Ton

| Was | Herkunft | Lizenz / Rechte |
|---|---|---|
| Sprecher (Deutsch) | lokal erzeugt mit Piper TTS 1.8.0 (`piper-tts`, OHF-Voice/piper1-gpl) | Programm: GPL-3.0-or-later. Die erzeugten Audiodateien sind Ausgaben des Programms und fallen nicht unter die GPL |
| Stimme | `de_DE-thorsten-high` aus `rhasspy/piper-voices` (Hugging Face), **vom Nutzer gewählt** (27.11.2026) | Daten Thorsten-Voice **CC0**. Modell laut Modellkarte **feinabgestimmt vom englischen lessac (high)**, siehe Hinweis unten |
| Musik und Soundeffekte | synthetisiert mit numpy/scipy in `pipeline/music.py` (Pad, Bass, Arpeggio, Drums, Whoosh, Impact, HIT-Klang, MISS-Klang) | eigene Komposition, keine Samples |
| Tastaturgeräusch | selbst erzeugt in `pipeline/music.py` (`keyboard_set`): gefiltertes Rauschen und Sinus, 8 Varianten für Buchstaben, je 3 für Leertaste und Enter. Zeitpunkte und Tastenart aus den echten Terminalaufnahmen (`pipeline/key_kinds.py`) | eigene Erzeugung, keine Samples, frei nutzbar |

Hinweis zur Stimme: thorsten-high ist vom Modell „lessac“ abgeleitet. Lessac
wurde mit den Blizzard-2013-Daten der Universität Edinburgh trainiert, deren
Lizenz nur Forschung erlaubt. Ob das auch für abgeleitete Modelle und deren
Audioausgaben gilt, ist nicht geklärt. Für veröffentlichte Videos ist das ein
Risiko. Der Nutzer kennt es und hat High trotzdem gewählt. Vor einer
Veröffentlichung sollte er es bewusst entscheiden (keine Rechtsberatung).
Gleich gute Alternativen mit eindeutig freier Lizenz stehen in
[research/tts-vergleich.md](research/tts-vergleich.md). Ein Wechsel ist eine
Zeile in `voice/voice.yaml`. Fassungen mit anderen Stimmen liegen als Archiv in
`final/de-thorsten-medium/` (CC0-Kette) und `final/de-thorsten-high/` (erste
High-Fassung ohne die neue Pipeline).

Im Video steht auf jeder Endkarte „Sprecherstimme synthetisch (Piper TTS)“,
in allen Beschreibungen ebenfalls.

## Werkzeuge

| Werkzeug | Version | Lizenz |
|---|---|---|
| Remotion | 4.0.546 | Remotion License (kostenlos für Einzelpersonen und kleine Teams; für Unternehmen ab einer bestimmten Größe kostenpflichtig, siehe remotion.dev/license) |
| Playwright (playwright-core) | 1.65 | Apache 2.0 |
| Chromium | System | BSD-artig |
| FFmpeg | 9.1 (GPL-Build) | GPL |
| asciinema | 3.2.1 | GPL-3.0 |
| @xterm/headless | 6.0.0 | MIT |
| Piper TTS | 1.8.0 | GPL-3.0-or-later |
| numpy, scipy | System | BSD |
| ImageMagick | System | ImageMagick License |
| Docker-Images `archlinux:latest`, `debian:trixie-slim` | Docker Hub (offizielle Images) | Lizenzen der jeweiligen Distribution |

Hinweis zu Remotion: Die Remotion-Lizenz ist keine Open-Source-Lizenz. Für
eine Einzelperson bzw. ein kleines Team ist die Nutzung kostenlos. Wird die
Kampagne später von einem größeren Unternehmen gerendert, vorher die
Lizenzbedingungen prüfen.
