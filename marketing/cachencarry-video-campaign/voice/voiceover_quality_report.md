# Prüfbericht Sprecher

Stimme `tools/voices/de_DE-thorsten-high.onnx`, Ausspracheliste `voice/pronunciation_dictionary.yaml` (44 Einträge, 40 geprüfte Wörter ohne Änderung).
Erzeugt von `pipeline/voice_qa.py` vor dem Render.

**Ergebnis: 0 Fehler, 0 Warnungen.**

## Fehler

keine

## Warnungen

keine

## Geprüft

- englische und fremde Begriffe gegen die Ausspracheliste
- keine Lautschrift, IPA oder Pausenmarke in Untertiteln, Anzeigetext der Skripte, Bildtext (`project/src`) und Begleittexten (`social/`)
- jede Audiodatei vorhanden, Länge passt zur Timeline, keine übersteuerten Samples
- Untertitel (SRT, Deutsch und Englisch): ein Eintrag je Satz, Text gleich dem Skript, Beginn mit der Stimme, keine Überlappung, nichts nach dem Videoende

## Untertitel

| Datei | Einträge | letzter endet | Timeline | Video in final/de |
|---|---|---|---|---|
| cachencarry_presentation_de.srt | 18 | 85.62 s | 88.93 s | 89.00 s |
| cachencarry_presentation_en.srt | 18 | 85.62 s | 88.93 s | 89.00 s |
| cachencarry_installation_tutorial_de.srt | 42 | 329.52 s | 331.67 s | 331.70 s |
| cachencarry_installation_tutorial_en.srt | 42 | 329.52 s | 331.67 s | 331.70 s |
| cachencarry_short_01_problem_de.srt | 5 | 17.94 s | 20.07 s | 20.10 s |
| cachencarry_short_01_problem_en.srt | 5 | 17.94 s | 20.07 s | 20.10 s |
| cachencarry_short_02_hit_vs_miss_de.srt | 5 | 19.19 s | 20.67 s | 20.70 s |
| cachencarry_short_02_hit_vs_miss_en.srt | 5 | 19.19 s | 20.67 s | 20.70 s |
| cachencarry_short_03_speed_de.srt | 4 | 20.68 s | 22.77 s | 22.80 s |
| cachencarry_short_03_speed_en.srt | 4 | 20.68 s | 22.77 s | 22.80 s |
| cachencarry_short_04_shared_download_de.srt | 5 | 19.45 s | 21.20 s | 21.30 s |
| cachencarry_short_04_shared_download_en.srt | 5 | 19.45 s | 21.20 s | 21.30 s |
| cachencarry_short_05_open_source_de.srt | 6 | 19.11 s | 20.87 s | 20.90 s |
| cachencarry_short_05_open_source_en.srt | 6 | 19.11 s | 20.87 s | 20.90 s |
| cachencarry_short_06_install_de.srt | 13 | 32.73 s | 34.50 s | nicht gerendert |
| cachencarry_short_06_install_en.srt | 13 | 32.73 s | 34.50 s | nicht gerendert |

## Audiodateien

| Video | Zeile | Szene | Stil | Länge | Spitze |
|---|---|---|---|---|---|
| presentation | 01 | problem | intro | 0.68 s | -6.6 dBFS |
| presentation | 02 | problem | intro | 2.93 s | -6.3 dBFS |
| presentation | 03 | problem | intro | 3.41 s | -8.8 dBFS |
| presentation | 04 | idea | intro | 3.07 s | -5.2 dBFS |
| presentation | 05 | idea | intro | 3.88 s | -6.5 dBFS |
| presentation | 06 | meet | product | 1.30 s | -4.7 dBFS |
| presentation | 07 | meet | product | 3.26 s | -5.9 dBFS |
| presentation | 08 | meet | product | 5.60 s | -5.4 dBFS |
| presentation | 09 | hitmiss | tech | 2.64 s | -5.8 dBFS |
| presentation | 10 | hitmiss | tech | 1.25 s | -6.1 dBFS |
| presentation | 11 | hitmiss | tech | 2.67 s | -6.6 dBFS |
| presentation | 12 | shared | tech | 6.85 s | -5.6 dBFS |
| presentation | 13 | shared | tech | 9.05 s | -5.8 dBFS |
| presentation | 14 | homelab | product | 3.71 s | -4.1 dBFS |
| presentation | 15 | homelab | product | 4.04 s | -6.1 dBFS |
| presentation | 16 | homelab | product | 3.84 s | -6.4 dBFS |
| presentation | 17 | cta | cta | 4.15 s | -5.3 dBFS |
| presentation | 18 | cta | cta | 5.71 s | -3.2 dBFS |
| tutorial | 01 | title | intro | 4.81 s | -6.5 dBFS |
| tutorial | 02 | title | intro | 3.06 s | -4.6 dBFS |
| tutorial | 03 | diagram | tutorial | 7.30 s | -5.5 dBFS |
| tutorial | 04 | diagram | tutorial | 7.17 s | -7.0 dBFS |
| tutorial | 05 | diagram | tutorial | 13.33 s | -5.3 dBFS |
| tutorial | 06 | diagram | tutorial | 6.12 s | -6.9 dBFS |
| tutorial | 07 | proxmox | tutorial | 10.19 s | -7.1 dBFS |
| tutorial | 08 | proxmox | tutorial | 7.47 s | -5.4 dBFS |
| tutorial | 09 | proxmox | tutorial | 10.37 s | -5.6 dBFS |
| tutorial | 10 | server | tutorial | 8.40 s | -5.7 dBFS |
| tutorial | 11 | server | tutorial | 12.19 s | -5.5 dBFS |
| tutorial | 12 | server | tutorial | 6.38 s | -4.9 dBFS |
| tutorial | 13 | download | tutorial | 6.00 s | -6.9 dBFS |
| tutorial | 14 | download | tutorial | 4.74 s | -4.7 dBFS |
| tutorial | 15 | download | tutorial | 6.86 s | -5.0 dBFS |
| tutorial | 16 | install | tutorial | 8.59 s | -6.4 dBFS |
| tutorial | 17 | install | tutorial | 4.07 s | -6.5 dBFS |
| tutorial | 18 | status | tutorial | 6.90 s | -5.8 dBFS |
| tutorial | 19 | browser | tutorial | 4.16 s | -5.9 dBFS |
| tutorial | 20 | browser | tutorial | 9.02 s | -5.0 dBFS |
| tutorial | 21 | token | tutorial | 5.07 s | -7.2 dBFS |
| tutorial | 22 | form | tutorial | 5.63 s | -6.3 dBFS |
| tutorial | 23 | form | tutorial | 3.79 s | -5.0 dBFS |
| tutorial | 24 | client | tutorial | 5.21 s | -6.2 dBFS |
| tutorial | 25 | sources | tutorial | 11.14 s | -5.1 dBFS |
| tutorial | 26 | sources | tutorial | 7.74 s | -5.3 dBFS |
| tutorial | 27 | dialog | tutorial | 5.20 s | -5.4 dBFS |
| tutorial | 28 | apt1 | tutorial | 3.40 s | -3.4 dBFS |
| tutorial | 29 | apt1 | tutorial | 8.61 s | -5.2 dBFS |
| tutorial | 30 | arch | tutorial | 9.15 s | -6.8 dBFS |
| tutorial | 31 | client2 | tutorial | 8.62 s | -5.3 dBFS |
| tutorial | 32 | apt2 | tutorial | 2.42 s | -5.7 dBFS |
| tutorial | 33 | apt2 | tutorial | 9.24 s | -4.9 dBFS |
| tutorial | 34 | traffic | tutorial | 6.45 s | -5.7 dBFS |
| tutorial | 35 | curl | tutorial | 6.70 s | -4.5 dBFS |
| tutorial | 36 | stats | tutorial | 6.32 s | -4.1 dBFS |
| tutorial | 37 | files | tutorial | 2.83 s | -6.1 dBFS |
| tutorial | 38 | files | tutorial | 8.03 s | -4.7 dBFS |
| tutorial | 39 | tour | tutorial | 7.36 s | -5.8 dBFS |
| tutorial | 40 | tour | tutorial | 4.67 s | -7.6 dBFS |
| tutorial | 41 | outro | cta | 3.11 s | -6.0 dBFS |
| tutorial | 42 | outro | cta | 6.39 s | -5.6 dBFS |
| short01 | 01 | hook | intro | 2.06 s | -6.6 dBFS |
| short01 | 02 | problem | intro | 3.21 s | -8.1 dBFS |
| short01 | 03 | solution | product | 2.79 s | -4.9 dBFS |
| short01 | 04 | solution | product | 2.56 s | -7.0 dBFS |
| short01 | 05 | end | cta | 3.41 s | -6.2 dBFS |
| short02 | 01 | hook | product | 2.43 s | -5.5 dBFS |
| short02 | 02 | miss | tech | 3.41 s | -5.8 dBFS |
| short02 | 03 | hit | tech | 3.00 s | -4.9 dBFS |
| short02 | 04 | hit | tech | 2.67 s | -5.9 dBFS |
| short02 | 05 | end | cta | 2.32 s | -5.3 dBFS |
| short03 | 01 | hook | product | 4.78 s | -6.9 dBFS |
| short03 | 02 | compare | tech | 8.00 s | -6.8 dBFS |
| short03 | 03 | compare | tech | 1.65 s | -6.3 dBFS |
| short03 | 04 | end | cta | 3.37 s | -5.7 dBFS |
| short04 | 01 | hook | product | 3.28 s | -7.6 dBFS |
| short04 | 02 | demo | tech | 4.52 s | -7.2 dBFS |
| short04 | 03 | demo | tech | 2.95 s | -6.1 dBFS |
| short04 | 04 | demo | tech | 3.82 s | -7.5 dBFS |
| short04 | 05 | end | cta | 2.07 s | -7.6 dBFS |
| short05 | 01 | hook | intro | 1.10 s | -6.2 dBFS |
| short05 | 02 | free | product | 2.19 s | -4.8 dBFS |
| short05 | 03 | free | product | 2.28 s | -5.4 dBFS |
| short05 | 04 | control | product | 3.18 s | -4.9 dBFS |
| short05 | 05 | control | product | 3.15 s | -6.5 dBFS |
| short05 | 06 | end | cta | 2.86 s | -6.8 dBFS |
| short06 | 01 | hook | intro | 1.53 s | -6.0 dBFS |
| short06 | 02 | hook | intro | 1.48 s | -8.0 dBFS |
| short06 | 03 | proxmox | product | 1.19 s | -4.9 dBFS |
| short06 | 04 | proxmox | product | 3.04 s | -4.1 dBFS |
| short06 | 05 | proxmox | product | 1.94 s | -8.1 dBFS |
| short06 | 06 | docker | product | 1.10 s | -4.7 dBFS |
| short06 | 07 | docker | product | 2.10 s | -6.5 dBFS |
| short06 | 08 | docker | product | 1.40 s | -7.4 dBFS |
| short06 | 09 | debian | product | 2.05 s | -7.9 dBFS |
| short06 | 10 | debian | product | 3.05 s | -5.3 dBFS |
| short06 | 11 | debian | product | 2.53 s | -5.3 dBFS |
| short06 | 12 | end | cta | 3.19 s | -5.7 dBFS |
| short06 | 13 | end | cta | 1.24 s | -7.4 dBFS |
