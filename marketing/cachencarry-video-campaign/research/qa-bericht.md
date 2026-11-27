# QA-Bericht: deutsche Fassung

## Alle 7 Videos mit Thorsten High und neuer Sprecher-Pipeline (27.11.2026)

Short02 als Testvorlage vom Nutzer abgenommen („passt, die anderen videos auch
so rendern“), danach die übrigen sechs mit derselben Ausspracheliste und
Verarbeitung. Dateien in `final/de/`.

| Datei | Länge | Lautheit | True Peak | Schwarzbilder |
|---|---|---|---|---|
| cachencarry_presentation_de.mp4 | 1:29 | −14,1 LUFS | −1,3 dBTP | keine |
| cachencarry_installation_tutorial_de.mp4 | 5:32 | −14,1 LUFS | −1,2 dBTP | keine |
| cachencarry_short_01_problem_de.mp4 | 20,1 s | −13,9 LUFS | −1,2 dBTP | keine |
| cachencarry_short_02_hit_vs_miss_de.mp4 | 20,7 s | −14,1 LUFS | −1,3 dBTP | keine |
| cachencarry_short_03_speed_de.mp4 | 22,8 s | −14,0 LUFS | −1,1 dBTP | keine |
| cachencarry_short_04_shared_download_de.mp4 | 21,3 s | −14,0 LUFS | −1,0 dBTP | keine |
| cachencarry_short_05_open_source_de.mp4 | 20,9 s | −14,1 LUFS | −1,2 dBTP | keine |

- Prüfung vor dem Render (`pipeline/voice_qa.py`): 0 Fehler, 0 Warnungen.
  Keine Lautschrift und keine Pausenmarken in Untertiteln, Bildtexten und
  `social/`.
- Je Satz die verständlichste von fünf Aufnahmen (whisper small), bei
  schwachen Sätzen von zehn. Protokolle in `voice/takes/`.
- whisper-Gegenprobe aller 85 Sätze: 108 von 130 Fachbegriffen erkannt. Die
  Ausfälle sind überwiegend Grenzen der Erkennung, zum Beispiel „Kleint“ für
  Client oder Zahlen als Ziffern. Short03 bekam einen neuen Schluss
  („Mehr dazu auf GitHub“), weil „GitHub-Repository“ auf der Kippe lag.
- Kontaktbögen: nur deutscher Bildtext, keine Untertitel, Endkarten mit
  „Sprecherstimme synthetisch (Piper TTS)“.
- Kapitelmarken in `social/youtube_*.md` an die neuen Längen angepasst.

Bitte anhören, hier ist whisper unsicher:
- Tutorial: „sudo“ (whisper hört „zu du“), „SHA-256-Summe“, „systemd-Dienst“,
  „systemctl zeigt“, „Signed-By“.
- Präsentation: „systemd-Dienst“, „Ubuntu“ in der Aufzählung.
- Die Aussprache hat noch kein Mensch komplett angehört.

Archiv: `final/de-thorsten-high/` (erste High-Fassung, 26.11.),
`final/de-thorsten-medium/` (Medium, 27.11., das Tutorial dort noch mit der
älteren Aussprache von Client und Dashboard).

## Vorige Fassung (26.11.2026)

Stand 26.11.2026, Dateien in `final/de/`. Geprüft mit `work/qa.sh`
(ffprobe, `blackdetect`, `cropdetect`, `ebur128`, Kontaktbogen mit 24 Bildern).

| Datei | Auflösung | Länge | Lautheit | True Peak | Schwarzbilder |
|---|---|---|---|---|---|
| cachencarry_presentation_de.mp4 | 1920 × 1080 | 1:31 | −14,1 LUFS | −1,4 dBTP | keine |
| cachencarry_installation_tutorial_de.mp4 | 1920 × 1080 | 5:33 | −14,0 LUFS | −1,4 dBTP | keine |
| cachencarry_short_01_problem_de.mp4 | 1080 × 1920 | 20,3 s | −14,0 LUFS | −1,4 dBTP | keine |
| cachencarry_short_02_hit_vs_miss_de.mp4 | 1080 × 1920 | 20,4 s | −14,2 LUFS | −1,4 dBTP | keine |
| cachencarry_short_03_speed_de.mp4 | 1080 × 1920 | 22,8 s | −14,0 LUFS | −1,2 dBTP | keine |
| cachencarry_short_04_shared_download_de.mp4 | 1080 × 1920 | 21,1 s | −14,0 LUFS | −1,3 dBTP | keine |
| cachencarry_short_05_open_source_de.mp4 | 1080 × 1920 | 21,2 s | −14,0 LUFS | −1,2 dBTP | keine |

Alle: H.264, 30 fps, AAC 48 kHz Stereo.

- Ränder: `cropdetect` meldet nur den dunklen Hintergrund am Bildrand, keine
  schwarzen Balken (in den Kontaktbögen geprüft).
- Bildtexte: Kontaktbögen und Einzelbilder angesehen. Nur deutscher Text,
  keine Untertitel. Englisch nur in echten Programmausgaben und in Begriffen
  der Oberfläche (HIT, MISS, Dashboard, Open Source).
- Satzzeichenregel: `python3 pipeline/check_text.py` meldet keine Fehler.
- Keine Passwörter oder Token im Bild, das Setup-Token ist schon in den
  Daten durch Punkte ersetzt.
- Benchmark überall mit „Beispiel aus dem Testnetzwerk“ bzw. „Kein Garantiewert“.

## Nicht geprüft

- Die Aussprache wurde nicht von Menschen angehört. Eine lokale
  Spracherkennung (whisper small) hat die meisten Sätze wiedererkannt, ist
  bei der synthetischen Stimme aber ungenau. Fachwörter wie systemd, Ubuntu
  und CachyOS sollte jemand anhören.
- Die Videos wurden nicht auf YouTube oder einem Telefon abgespielt.

## Tippgeräusch im menschlichen Rhythmus (27.11.2026)

Die sichtbare Eingabe bleibt schnell (im Tutorial als „× schneller“ gekennzeichnet). Hörbar sind nur Anschläge im Tempo eines Menschen: etwa 5 bis 7 pro Sekunde, Abstände 100 bis 250 ms, etwas länger vor Leerzeichen und Sonderzeichen, eine kurze Pause vor Enter, eingefügte Befehle nur mit Enter. Echtes Tipptempo im Bild hätte das Tutorial von 5:32 auf etwa 10 Minuten verlängert.

| Video | Länge | Lautheit | True Peak | Schwarzbilder |
|---|---|---|---|---|
| Tutorial | 331.7 s | −14.0 LUFS | −1.2 dBTP | keine |
| Präsentation | 89.0 s | −14.0 LUFS | −1.3 dBTP | keine |
| Short01 | 20.1 s | −13.9 LUFS | −1.3 dBTP | keine |
| Short02 | 20.7 s | −14.2 LUFS | −1.3 dBTP | keine |

Short03 bis Short05 haben kein Tippgeräusch und bleiben unverändert. Hörvergleich alt und neu: `research/samples/tippen/`.

## Short 6: drei Wege zu installieren (27.11.2026)

| Prüfung | Ergebnis |
|---|---|
| Datei | `final/de/cachencarry_short_06_install_de.mp4`, 1080 × 1920, 30 fps, 34,6 s |
| Lautheit | −14,0 LUFS, Spitze −1,1 dBFS |
| schwarze Bilder | keine |
| Sprecherprüfung (`voice_qa.py`) | 0 Fehler, 0 Warnungen |
| Bildtext (`check_text.py`) | keine Gedankenstriche, keine Semikolons |
| Aussprache neu | Docker (IPA, 2/3), Image als „Immitsch“ (3/3), Raspberry Pi und Link wie geschrieben (3/3), Bericht `voice/pron_test_report_runde4.md` |
| Inhalt | Befehle aus README.md, Proxmox-Ausgabe aus einem echten Lauf von `scripts/proxmox-lxc.sh`, Setup-Token verdeckt |
| Kontaktbogen | von Hand angesehen, Titel steht ab dem ersten Bild |
