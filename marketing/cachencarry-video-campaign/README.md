# Cache & Carry: Videokampagne

Sieben Videos auf Deutsch (deutscher Bildtext, synthetische deutsche Stimme Piper Thorsten High, ohne eingebrannte Untertitel), dazu Thumbnails, Cover,
Texte und alles, um die Kampagne lokal und kostenlos neu zu erzeugen.
Der Auftrag steht wörtlich in [research/MASTER_PROMPT.md](research/MASTER_PROMPT.md).

## Was liegt wo

| Ordner | Inhalt |
|---|---|
| `final/de/` | fertige deutsche MP4s (nicht in git, siehe unten) |
| `subtitles/de`, `subtitles/en` | `<video>_de.srt` und `<video>_en.srt` für alle sieben Videos |
| `thumbnails/` | Thumbnail Präsentation, Thumbnail Tutorial, fünf Shorts-Cover |
| `social/` | YouTube-Beschreibungen, Shorts-Texte, angepinnter Kommentar |
| `tutorial/befehle.md` | alle Befehle aus dem Tutorial zum Kopieren |
| `scripts/` | Sprechertexte (Deutsch, Englisch, Aussprache) je Video, Quelle für Ton und Untertitel |
| `research/` | Auftrag, Faktenprüfung, Produktionsprotokoll, Hörprobe |
| `assets/logos` | Kopie der Markendateien aus `assets/brand` |
| `assets/recordings/casts` | echte Terminalaufnahmen (asciinema, nicht in git) |
| `pipeline/` | `voice.py` (Sprecher, Timing, SRT), `music.py` (Musik und Effekte) |
| `project/` | Remotion-Projekt mit allen Kompositionen, Aufnahme-Skripten und Terminal-Werkzeugen |
| `LICENSES.md` | Herkunft und Lizenz jedes verwendeten Bausteins |
| `PRODUCTION.md` | wie die Videos entstanden sind, was geprüft wurde, was nicht |

### Fertige Dateien in `final/de/` (deutsche Fassung)

Deutscher Bildtext, deutsche Stimme, keine eingebrannten Untertitel.
Deutsche und englische SRT-Dateien liegen in `subtitles/` (zum Hochladen bei YouTube).
Englische Fassungen mit englischem Text und englischer Stimme folgen getrennt.

| Datei | Format | Länge |
|---|---|---|
| `cachencarry_presentation_de.mp4` | 1920 × 1080 | 1:31 |
| `cachencarry_installation_tutorial_de.mp4` | 1920 × 1080 | 5:33 |
| `cachencarry_short_01_problem_de.mp4` | 1080 × 1920 | 20 s |
| `cachencarry_short_02_hit_vs_miss_de.mp4` | 1080 × 1920 | 20 s |
| `cachencarry_short_03_speed_de.mp4` | 1080 × 1920 | 23 s |
| `cachencarry_short_04_shared_download_de.mp4` | 1080 × 1920 | 21 s |
| `cachencarry_short_05_open_source_de.mp4` | 1080 × 1920 | 21 s |

Alle mit 30 fps, H.264, AAC 48 kHz, Lautheit −14 LUFS. Die Sprecherstimme ist
synthetisch (Piper, Thorsten High), das steht auf jeder Endkarte.
Die MP4s sind wegen ihrer Größe nicht im Repository; sie entstehen mit den
Befehlen unten neu.

## Neu erzeugen

Voraussetzungen (auf dem Entwicklungsrechner vorhanden): Go 1.27, Node.js 20+,
FFmpeg, Chromium unter `/usr/bin/chromium`, Python 3 mit numpy und scipy,
`uv`, asciinema 3, Docker. Keine Cloud-Dienste, keine API-Schlüssel.

```sh
cd marketing/cachencarry-video-campaign

# 1. Einmalig: Werkzeuge
(cd project && npm install)
uv venv tools/venv && uv pip install --python tools/venv/bin/python piper-tts
mkdir -p tools/voices && cd tools/voices && for f in de_DE-thorsten-high.onnx de_DE-thorsten-high.onnx.json MODEL_CARD; do
  curl -LO "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/high/$f"; done; cd ../..

# 2. Sprecher, Timing und Untertitel aus den Skripten
tools/venv/bin/python pipeline/voice.py scripts/*.json

# 3. Musik und Soundeffekte (nach jeder Timing-Änderung)
python3 pipeline/music.py

# 4. Rendern: alle Videos, Lautheit normalisieren, nach final/de/ kopieren
./build-all.sh
# nur einzelne: ONLY="Short01:cachencarry_short_01_problem" ./build-all.sh
```

`./render.sh KOMPOSITION DATEI` rendert eine einzelne Komposition,
`./stills.sh` die Thumbnails und Cover, `./finish.sh` normalisiert den Ton
und prüft die Dateien. `cd project && npm run studio` öffnet die Vorschau.

Alle langen Jobs laufen mit `nice -n 19 ionice -c3` und höchstens vier
Render-Prozessen. Temporäre Dateien liegen in `~/.cache/ccvt`, nicht in `/tmp`.

### Aufnahmen wiederholen

Die Präsentation und die Shorts verwenden eine **Demo-Instanz** auf dem
Entwicklungsrechner (nie die Produktivinstanz):

```sh
cd project
DEMO_WORK=$PWD/../work/demo ./demo.sh start   # baut und startet 127.0.0.1:18086
node relay.mjs &                              # neutrale Client-Adressen 10.0.10.x und Browser-Proxy
node capture.mjs                              # pacman-Clients in Docker plus Dashboard-Aufnahmen
node tools/github.mjs                         # Screenshots der öffentlichen GitHub-Seite
term/convert-all.sh                           # Terminalaufnahmen in Bildschirmzustände umwandeln
./demo.sh stop
```

Das Tutorial wurde in einem frischen Proxmox-Container aufgenommen. Die
Szenen stehen in `project/term/scenes/tut-*.scene`, die Browser-Aufnahmen in
`project/tools/tut-capture.mjs`. Für eine Neuaufnahme braucht es wieder einen
Wegwerf-Container (im Tutorial CT 130 mit 192.168.1.41) und zwei
Debian-Container (`debian:trixie-slim`, `--network host`).

## Etwas ändern

| Was | Wo |
|---|---|
| Sprechertext, Untertitel, Aussprache | `scripts/<video>.json` (Felder `de`, `en`, optional `say`), dann Schritt 2 bis 4 |
| Aussprache allgemein | Liste `LEXICON` in `pipeline/voice.py` |
| Szenenbilder | `project/src/Presentation.tsx`, `Tutorial.tsx`, `Shorts.tsx` |
| Bausteine (Terminal, Fenster, Untertitel, Netzwerkgrafik) | `project/src/kit.tsx`, `blocks.tsx` |
| Farben, Schriften | `project/src/theme.ts` |
| Thumbnails und Cover | `project/src/Stills.tsx` |
| Musik | `pipeline/music.py` |

Regeln für Texte im Bild: keine Semikolons, keine Gedankenstriche, nur echte
Funktionen (Status in `TODO.md` und `README.md` des Projekts), der Benchmark
immer mit dem Hinweis „Testnetzwerk“.
