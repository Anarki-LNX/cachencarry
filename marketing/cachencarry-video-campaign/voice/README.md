# Sprecher: Einrichtung, Ablauf, Wiederverwendung

Lokale deutsche Sprachsynthese mit Piper und der Stimme Thorsten (high).
Kein Netz, keine Kosten, keine API-Schlüssel. Vergleich mit anderen Engines und
Lizenzstand: [research/tts-vergleich.md](../research/tts-vergleich.md).

## Dateien

| Datei | Zweck |
|---|---|
| `voice/voice.yaml` | Stimme, Sprechstile je Szene, Nachbearbeitung. Ein Stimmwechsel ist eine Zeile (`model`) |
| `voice/pronunciation_dictionary.yaml` | Ausspracheliste. Gilt nur für den Sprechtext |
| `voice/pron_candidates.yaml` | Schreibvarianten je Begriff für den Aussprachetest |
| `voice/pron_test_report_runde1.md` bis `_runde3.md` | Ergebnisse des Aussprachetests (whisper), ein neuer Lauf schreibt `voice/pron_test_report.md` |
| `voice/english_watchlist.txt` | gängige englische Fachwörter, für die die Prüfung warnt, wenn sie in keiner Liste stehen |
| `voice/voiceover_display_text.md` | Anzeigetext aller Videos (erzeugt) |
| `voice/voiceover_tts_text.md` | Sprechtext und was Piper wirklich bekommt (erzeugt) |
| `voice/voiceover_quality_report.md` | Prüfbericht vor dem Render (erzeugt) |
| `pipeline/voice.py` | Sprachaufnahmen, Timeline, Untertitel |
| `pipeline/voice_qa.py` | Prüfung vor dem Render |
| `pipeline/pron_test.py` | Aussprachetest |
| `research/samples/pron/` | eine Hörprobe je Begriff und Variante |
| `research/samples/high-test/` | Vergleich alte Methode und neue Stile (gleicher Text) |

## Einrichten

```sh
uv venv tools/venv && uv pip install --python tools/venv/bin/python piper-tts pyyaml numpy
# nur für den Aussprachetest:
uv pip install --python tools/venv/bin/python faster-whisper
mkdir -p tools/voices && cd tools/voices && for f in de_DE-thorsten-high.onnx de_DE-thorsten-high.onnx.json MODEL_CARD; do
  curl -LO "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/high/$f"; done; cd ../..
```

FFmpeg mit `soxr` wird für die Nachbearbeitung gebraucht.

## Ablauf

1. **Skript schreiben** (`scripts/<video>.json`). Je Satz `de` (Anzeigetext,
   richtige Schreibweise) und `en`. Optional `tts`: Sprechfassung in normaler
   Schreibweise, darf Sätze kürzen, Zahlen ausschreiben und Pausen setzen
   (`{p300}` = 300 ms). Lautschrift gehört nie ins Skript, nur in die
   Ausspracheliste. `style` je Szene oder Satz: `intro`, `product`, `tech`,
   `tutorial`, `cta`, `neutral`. `rate` je Satz verändert das Tempo leicht
   (zum Beispiel 0.97).
2. **Neue Begriffe testen:** in `voice/pron_candidates.yaml` eintragen, dann
   `HF_HOME=~/.cache/ccvt/hf tools/venv/bin/python pipeline/pron_test.py Begriff`.
   Die beste Variante in die Ausspracheliste übernehmen und anhören
   (`research/samples/pron/`).
3. **Aufnehmen:** `tools/venv/bin/python pipeline/voice.py scripts/<video>.json`.
4. **Prüfen:** `tools/venv/bin/python pipeline/voice_qa.py`. `build-all.sh`
   bricht bei Fehlern ab.
5. **Rendern:** `ONLY="Short05:cachencarry_short_05_open_source" ./build-all.sh`.

## Was die Pipeline mit der Stimme macht

- Piper spricht jeden Satz einzeln. Zwischen Sätzen steht eine feste, kurze
  Pause je Stil (0,24 bis 0,30 s), Stille an den Rändern wird gekürzt.
- Englische Begriffe werden über die Ausspracheliste gesprochen, wo nötig in
  Lautschrift (`[[ ]]`), damit eSpeak nicht rät.
- Tempo und Lebendigkeit je Szene über `length_scale`, `noise_scale`,
  `noise_w_scale`. Das ist keine Zeitstreckung und keine Tonhöhenänderung.
- Nachbearbeitung je Satz: Hochpass 70 Hz, −1,5 dB bei 220 Hz, +1,5 dB bei
  3,2 kHz, leichter De-Esser, Kompressor 2:1, gleiche Sprachlautstärke,
  Ein- und Ausblenden, Spitze höchstens 0,89, 48 kHz (soxr).
- Die Lautheit des fertigen Videos setzt `finish.sh` auf −14 LUFS.

## Für andere Projekte

`voice/`, `pipeline/voice.py`, `pipeline/voice_qa.py` und `pipeline/pron_test.py`
kopieren. In `voice_qa.py` die Liste `VIDEOS` und die Pfade der Anzeigetexte
anpassen. Die Ausspracheliste wächst mit, Einträge gelten projektweit gleich.

## Grenzen

- Die Aussprache wurde mit whisper geprüft, nicht von Menschen angehört.
  whisper erkennt kurze englische Wörter in deutschen Sätzen schlecht, die
  Werte sind deshalb nur ein Vergleich zwischen Varianten.
- Einige Begriffe erkennt whisper in keiner Schreibweise (Mirrorlist, Header,
  root, Setup-Token). Dort sagt die Sprechfassung ein gleichwertiges deutsches
  Wort, der Anzeigetext bleibt unverändert.
- Die Erkennung unbekannter englischer Wörter ist eine Heuristik
  (Großschreibung, Buchstabenmuster, Beobachtungsliste). Sie findet nicht alles.
