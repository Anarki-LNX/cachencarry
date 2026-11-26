# Produktionsdokumentation

## Ablauf

1. **Recherche.** Repository gelesen (README, TODO, DEPLOYMENT, CLIENTS,
   ARCHITECTURE, Quellcode der Oberfläche). Jede Aussage mit Quelle steht in
   [research/faktencheck.md](research/faktencheck.md).
2. **Skripte.** Pro Video eine Datei in `scripts/` mit deutschem Text, englischer
   Übersetzung und, wo nötig, einer Aussprachefassung (`say`) für die
   Sprachsynthese (z. B. „Käsch änd Kärri“, „Gitt Habb“, Zahlen ausgeschrieben).
3. **Sprecher.** `pipeline/voice.py` spricht jeden Satz lokal mit Piper und der
   Stimme Thorsten (high, vom Nutzer gewählt, siehe LICENSES.md). Wie in der
   Vorlage `make_vo_de.py`: Stille vorn auf 30 ms und hinten auf 100 ms
   gekürzt, Spitzenpegel 0,89, length_scale 1,0 (Tutorial 1,04). Die gemessene Länge jeder Aufnahme bestimmt
   das Timing der Szenen. Daraus entstehen die Timeline für Remotion und die
   SRT-Dateien (Deutsch und Englisch), exakt synchron zur Stimme. In die
   deutsche Fassung wird nichts eingebrannt: deutscher Bildtext, deutsche
   Stimme. Englische Fassungen entstehen getrennt.
4. **Musik.** `pipeline/music.py` synthetisiert die Musik passend zu den
   Szenengrenzen: elektronisch und ruhig für die Präsentation, sehr leise für
   das Tutorial, schneller (124 BPM) mit Drop für die Shorts. Dazu Whoosh,
   Impact, HIT-Klang, MISS-Klang, Datenimpulse und Tastenklicks, die auf die
   echten Tastenzeitpunkte der Terminalaufnahmen gelegt werden.
5. **Aufnahmen.**
   - Demo-Instanz (frisch gebaut aus dem Repository, eigener Datenordner) auf
     `127.0.0.1:18086` für Präsentation und Shorts. Echte pacman-Clients in
     Docker (`archlinux:latest`, Host-Netzwerk), echte Downloads von
     `geo.mirror.pkgbuild.com` über die Demo-Instanz.
   - Tutorial: frischer, unprivilegierter Debian 13.6 Container (CT 130) auf
     dem Proxmox-Host, offizielles Release v0.2.1 von GitHub, echter
     systemd-Dienst, zwei echte Debian 13 Clients (`debian:trixie-slim`).
   - Terminal: asciinema 3 nimmt die echten Bytes auf. `term/cast2json.mjs`
     spielt sie in einen Terminal-Emulator (`@xterm/headless`) ein und speichert
     Bildschirmzustände; Remotion zeichnet sie gestochen scharf in Markenfarben.
     Das Setup-Token wird dabei schon in der Datei durch Punkte ersetzt und im
     Bild unscharf gezeigt.
   - Oberfläche: Playwright mit Chromium, 2-fache Pixeldichte, 6 Bilder pro
     Sekunde (die Oberfläche ändert sich höchstens einmal pro Sekunde).
6. **Schnitt und Grafik** in Remotion (`project/src`). Ein Projekt für alle
   Videos mit gemeinsamen Bausteinen.
7. **Endbearbeitung.** `finish.sh` normalisiert die Lautheit in zwei Durchgängen
   (EBU R128, −14 LUFS, True Peak −1,5 dBTP).

## Regeln der deutschen Fassung (Vorgabe des Nutzers)

- Sprachen strikt getrennt: kein englischer Bildtext. Englisch bleibt nur in
  echten Programmausgaben (Terminal, GitHub-Seite) und in Begriffen der
  Oberfläche (HIT, MISS, Dashboard, Open Source).
- Keine eingebrannten Untertitel.
- Kurze Pausen: Szenen enden etwa 0,8 s nach dem letzten Satz.

## Qualitätskontrolle

Ergebnisse der letzten Prüfung stehen in [research/qa-bericht.md](research/qa-bericht.md).
Geprüft wird:

- Streams, Auflösung, Bildrate, Dauer (ffprobe)
- schwarze Bilder und Ränder (ffmpeg `blackdetect`, `cropdetect`)
- Lautheit und Spitzenpegel (ffmpeg `ebur128`)
- Einzelbilder alle paar Sekunden als Kontaktbogen, von Hand angesehen
- Untertitel: Timing aus der Sprachaufnahme, Inhalt von Hand gelesen
- Satzzeichenregel für Bildtexte: `python3 pipeline/check_text.py`
- keine Passwörter oder Token im Bild, keine Pfade des Entwicklungsrechners

## Sicherheit und Datenschutz

- Die Produktivinstanz (LXC 120) wurde weder benutzt noch aufgenommen.
- Das Admin-Passwort der Tutorial-Instanz war ein Wegwerfwert (nur als Punkte
  im Bild), das Setup-Token ist im Video unkenntlich und nach der Einrichtung
  ohnehin verbraucht.
- Der Tutorial-Container wurde nach der Abnahme gelöscht.
- Die Seite „Systemzustand“ der Demo-Instanz wurde nicht verwendet, weil sie
  einen Pfad im Home-Verzeichnis des Entwicklungsrechners zeigt.
