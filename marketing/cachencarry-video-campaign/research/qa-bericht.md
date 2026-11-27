# QA-Bericht: deutsche Fassung

## Testvideo Thorsten High mit neuer Sprecher-Pipeline (27.11.2026)

Auf Wunsch des Nutzers Thorsten High mit verbesserter Qualität
([VOICE_MASTER_PROMPT.md](VOICE_MASTER_PROMPT.md)). Nur ein Testvideo, die
übrigen sechs werden erst nach der Abnahme durch den Nutzer neu vertont.

| Datei | Länge | Lautheit | True Peak | LRA | Schwarzbilder |
|---|---|---|---|---|---|
| final/de/cachencarry_short_02_hit_vs_miss_de.mp4 | 20,7 s | −14,1 LUFS | −1,3 dBTP | 2,5 LU | keine |

- Prüfung vor dem Render (`pipeline/voice_qa.py`): 0 Fehler, 0 Warnungen.
- Je Satz fünf Aufnahmen, die verständlichste gewählt (whisper small),
  Protokoll in `voice/takes/short02.md`. Alle Fachbegriffe (MISS, HIT, Cache,
  Cache & Carry, Open Source, GitHub) werden in der gewählten Aufnahme erkannt.
- Kontaktbogen: nur deutscher Bildtext, keine Untertitel, Endkarte mit
  „Sprecherstimme synthetisch (Piper TTS)“.
- Die Aussprache hat noch kein Mensch angehört.

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
