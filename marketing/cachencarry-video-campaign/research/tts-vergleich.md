# TTS-Vergleich und Prüfung der Sprecher-Pipeline

Stand 27.11.2026. Auftrag: [VOICE_MASTER_PROMPT.md](VOICE_MASTER_PROMPT.md).
Entscheidung des Nutzers: **Piper mit `de_DE-thorsten-high`**, Qualität deutlich
verbessern. Keine andere Engine wurde installiert. Die Angaben zu den
Alternativen stammen aus deren Modellkarten und Projektseiten (Quellen unten).
Das ist keine Rechtsberatung.

## 1. Bestehende Pipeline (geprüft)

| Punkt | Stand |
|---|---|
| Engine | Piper TTS 1.8.0 (`piper-tts`, OHF-Voice/piper1-gpl, GPL-3.0-or-later), lokal in `tools/venv`, CPU |
| Deutsche Stimmen | `de_DE-thorsten-high` (109 MB, VITS), `de_DE-thorsten-medium` (61 MB) in `tools/voices/` |
| Englische Stimmen | keine installiert (für die deutsche Fassung nicht nötig) |
| Abtastrate | 22 050 Hz mono, im Video auf 48 kHz AAC gemischt |
| Phoneme | eSpeak NG (eingebettet in piper-tts, Stimme `de`). **Rohe Lautschrift möglich:** Text in `[[ … ]]` geht als IPA direkt an das Modell, alle IPA-Zeichen der Ausspracheliste sind im Modell vorhanden |
| SSML | nein. Pausen und Rhythmus nur über Satzzeichen und Satzaufteilung |
| Aussprachewörterbuch | bisher eine Python-Liste in `pipeline/voice.py`, jetzt `voice/pronunciation_dictionary.yaml` |
| Steuerung | `length_scale` (Tempo), `noise_scale` (Lebendigkeit), `noise_w_scale` (Rhythmusvariation), je Satz einstellbar |
| Verarbeitung bisher | Stille kürzen (30 ms vorn, 100 ms hinten), Spitze 0,89, sonst nichts. Lautheit erst am fertigen Video (`finish.sh`, −14 LUFS) |
| Skripte | `scripts/*.json`, je Satz `de` (Anzeige), `en` (Übersetzung), optional `say` (Sprechfassung) |
| Untertitel | `voice.py` schreibt SRT aus `de` und `en`, Zeiten aus der echten Länge jeder Aufnahme. Sprechfassung gelangt nicht in die SRT |

## 2. Vergleich freier, lokaler Engines

| Engine / Stimme | Deutsch | Qualität (Einschätzung) | Englische Wörter | Größe, Hardware | Lizenz Modell | Kommerziell nutzbar? | Pflege |
|---|---|---|---|---|---|---|---|
| **Piper, thorsten-high** (gewählt) | ja, ein Sprecher | gut, klar, etwas gleichförmig | über Lautschrift `[[ ]]` steuerbar | 109 MB, CPU, schneller als Echtzeit | Daten CC0, aber **feinabgestimmt von en_US lessac (high)** | **unklar bis riskant**: lessac stammt aus den Blizzard-2013-Daten, deren Lizenz nur Forschung erlaubt | aktiv (OHF-Voice) |
| Piper, thorsten-medium | ja | etwas dumpfer als high | wie oben | 61 MB, CPU | Daten CC0, Basis rdh (CC0) | ja, Kette vollständig CC0 | aktiv |
| Thorsten-Voice/Piper (44 kHz, „TV-44kHz-Full“) | ja | laut Projekt höhere Abtastrate, **nicht getestet** | wie oben | Piper-Modell | als MIT markiert, Daten Thorsten-Voice | wahrscheinlich ja, Trainingskette vor Nutzung prüfen | Thorsten Müller |
| Kokoro-82M, Basis | **nein** (offiziell kein Deutsch) | sehr natürlich (Englisch) | – | 82 M Parameter, CPU möglich | Apache 2.0 | ja | aktiv |
| Kokoro, Thorsten-Voice/Kokoro (deutsche Feinabstimmung) | ja | laut Modellkarte natürlicher als VITS, **nicht getestet** | eSpeak NG, ähnlich wie Piper | 82 M, CPU | Apache 2.0, Daten CC0 | ja, laut Modellkarte | Thorsten Müller |
| Coqui TTS, Thorsten VITS / Tacotron2 | ja | älter, ähnlich Piper medium | eSpeak | CPU | Apache 2.0 (Registry, Hugging Face) | ja | Coqui GmbH geschlossen, Fork von idiap gepflegt |
| Coqui XTTS v2 | ja | sehr natürlich | gut | 1,8 GB, GPU empfohlen | Coqui Public Model License | **nein**, nur nicht kommerziell | Fork |
| Chatterbox Multilingual (Resemble AI) | ja | sehr natürlich, Stimmklonen | gut | 0,5 B Parameter, GPU empfohlen | MIT | ja, aber Wasserzeichen im Ton, seit August 2026 nur noch Archiv ohne Pflege | eingestellt |
| F5-TTS (deutsche Feinabstimmungen) | teils | sehr natürlich | gut | GPU | Basismodell CC-BY-NC (Emilia-Daten) | **nein** | aktiv |

Nicht in Frage kommen Cloud-Dienste (Edge-TTS, ElevenLabs und ähnliche), weil sie
Netz, Konten oder Kosten bedeuten.

## 3. Ergebnis

- **Umgesetzt:** Piper mit thorsten-high, wie vom Nutzer entschieden. Die
  Qualität wird verbessert durch Lautschrift für englische Begriffe, kürzere
  Sätze, Tempo und Ausdruck je Szene und eine behutsame Nachbearbeitung
  (siehe [voice/README.md](../voice/README.md)).
- **Lizenz offen:** thorsten-high ist von lessac abgeleitet, und lessac ist
  nur für Forschung freigegeben. Der Nutzer kennt das Risiko. Vor einer
  Veröffentlichung sollte er es bewusst entscheiden.
- **Alternativen mit eindeutig freier Lizenz**, gleich gut oder besser
  (nicht installiert, Wechsel nur mit Freigabe des Nutzers):
  1. **Thorsten-Voice/Kokoro**: dieselbe Stimme (Thorsten), modernere Architektur, Apache 2.0, Daten CC0.
  2. **Thorsten-Voice/Piper 44 kHz**: dieselbe Pipeline, höhere Abtastrate, als MIT markiert.
  3. **thorsten-medium**: schon installiert, Kette vollständig CC0, etwas weniger klar.
  Die Pipeline ist so gebaut, dass ein Wechsel nur `voice/voice.yaml` betrifft.

## Quellen

- Piper-Modellkarten: [thorsten high](https://huggingface.co/rhasspy/piper-voices/blob/v1.0.0/de/de_DE/thorsten/high/MODEL_CARD), [thorsten medium](https://huggingface.co/rhasspy/piper-voices/blob/main/de/de_DE/thorsten/medium/MODEL_CARD), [lessac high](https://huggingface.co/rhasspy/piper-voices/blob/v1.0.0/en/en_US/lessac/high/MODEL_CARD)
- Lessac-Lizenz: [CSTR Blizzard 2013](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html), Diskussion [rhasspy/piper#271](https://github.com/rhasspy/piper/discussions/271)
- Kokoro Deutsch: [Thorsten-Voice/Kokoro](https://huggingface.co/Thorsten-Voice/Kokoro), [hexgrad/kokoro#290](https://github.com/hexgrad/kokoro/issues/290)
- Thorsten-Voice: [Piper 44 kHz](https://huggingface.co/Thorsten-Voice/Piper/raw/main/README.md), [VITS (Coqui)](https://huggingface.co/Thorsten-Voice/VITS), [GitHub](https://github.com/thorstenMueller/Thorsten-Voice)
- Chatterbox: [Modellkarte](https://huggingface.co/ResembleAI/chatterbox/blob/main/README.md), [Resemble: Multilingual v3](https://www.resemble.ai/resources/chatterbox-multilingual-v3-tts-with-embedded-watermarking-for-25-languages)
- Lizenzprüfung NuOrb: `/home/anarki/Projekte/Xiaomi/docs/lizenzpruefung.md`
