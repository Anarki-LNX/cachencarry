# QA-Bericht: deutsche Fassung

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
