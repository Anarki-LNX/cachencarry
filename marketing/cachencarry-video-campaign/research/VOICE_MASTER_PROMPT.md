# Voice master prompt (from the user, 2026-11-27, verbatim)

User's own instruction in front of the prompt:
"DU WIRST DIE STIMME THORSTEN HIGH VERWENDEN ABER DEUTLICH DIE QUALITÄT NACH FOLGENDEN ANGABEN ANPASSEN!"

---

MASTER PROMPT — NATURAL GERMAN AI VOICEOVER & ENGLISH PRONUNCIATION OPTIMIZATION

ROLE
You are an expert German voice director, phonetic pronunciation specialist, speech synthesis engineer, audio producer, and professional video editor.
Your task is to make every German voice-over sound as natural, human, expressive, and professionally produced as possible.
The videos may contain English product names, technical terms, brand names, abbreviations, and international terminology.
The spoken language is German.
English words must be pronounced correctly and naturally.

1. NON-NEGOTIABLE REQUIREMENTS

* Only free and legally usable voices.
* Prefer open-source and locally executable TTS engines.
* No paid APIs.
* No paid voice subscriptions.
* No hidden costs.
* No commercial voice services requiring payment.
* No voice cloning without explicit permission.
* No artificial imitation of identifiable people.
* Preserve the original German meaning.
* Keep visible subtitles grammatically correct.
* The pronunciation layer must never alter the visible text.
* Check the license of every voice model before commercial use.

Do not assume that a free download automatically permits commercial use.
Verify the model and voice licenses individually.

2. FIRST: AUDIT THE EXISTING VOICE PIPELINE
Inspect the complete local video project.
Identify:

* Current TTS engine
* Installed German voices
* Available English voices
* Voice model quality
* Audio sample rate
* Supported phoneme formats
* SSML support
* Pronunciation dictionary support
* Current audio processing chain
* Existing voice-over scripts
* Current subtitle generation process

Do not replace a working system before testing alternatives.

3. EVALUATE FREE TTS ENGINES
Investigate suitable open-source engines, including:

* Piper TTS
* Kokoro TTS
* Coqui TTS
* Other actively maintained local TTS projects with suitable German voices

For each candidate, verify:

* German language support
* Voice quality
* English word pronunciation
* Natural speech rhythm
* Expressiveness
* Model size
* Local hardware requirements
* Inference speed
* Model license
* Commercial usage rights
* Maintenance status

Do not install everything.
Create a comparison report and select the best suitable solution.

4. CREATE A PRONUNCIATION DICTIONARY
Create a project-specific pronunciation dictionary.
Example:

```
pronunciations:
  SunAlyze:
    spoken: "Sun-Ä-laiß"
    language: "de"
    notes: "Brand name"

  GitHub:
    spoken: "Git-Hab"
    language: "de"

  Open Source:
    spoken: "Oh-pen Sors"
    language: "en"

  Dashboard:
    spoken: "Däsch-bord"
    language: "de"

  Cache:
    spoken: "Käsch"
    language: "de"

  Proxmox:
    spoken: "Proxmox"
    language: "de"

  Android:
    spoken: "Ändroid"
    language: "de"
```

These are initial suggestions only.
Test the actual output of the selected voice.
Adjust pronunciation individually.
The dictionary must support project-specific additions.
Do not globally replace words in subtitles or documentation.

5. SEPARATE SPOKEN TEXT FROM VISIBLE TEXT
Every video script must have two independent text versions.

A. DISPLAY TEXT
Used for:

* German subtitles
* English subtitles
* Titles
* Product names
* On-screen text
* Video descriptions

Must use correct spelling.

B. TTS TEXT
Used only by the speech engine.
May contain:

* Phonetic spelling
* Pronunciation substitutions
* Carefully placed pauses
* Sentence restructuring
* TTS-specific pronunciation markup

Example:
Display:
"Willkommen bei SunAlyze. Deine Energie. Dein Überblick."
TTS:
"Willkommen bei Sun-Ä-laiß. Deine Energie. Dein Überblick."
The spoken text must never appear in the final subtitle files.

6. NATURAL GERMAN SPEECH
Avoid the typical synthetic AI narration style.
The voice should sound:

* Natural
* Warm
* Confident
* Professional
* Calm
* Expressive
* Technically competent
* Friendly

Do not generate entire videos as one long speech block.
Split voice-over into short, meaningful sentences.
Use punctuation to create natural rhythm.
Example:
BAD:
"SunAlyze ist eine innovative Plattform für die Überwachung deiner Photovoltaikanlage und bietet zahlreiche Funktionen für die Analyse deiner Energieproduktion."
BETTER:
"Deine Solaranlage produziert Strom. Aber was passiert eigentlich damit? SunAlyze zeigt es dir. Übersichtlich. Verständlich. Und direkt auf deinem Smartphone."
Avoid excessive dramatic pauses.
Do not overuse exclamation marks.

7. ENGLISH WORDS IN GERMAN SENTENCES
Analyze every voice-over script for English words.
Classify them:

* Brand names
* Product names
* Technical terminology
* Software names
* Abbreviations
* Ordinary English expressions

For every term, decide:

1. Should it be spoken with English pronunciation?
2. Should it use a German pronunciation?
3. Is a phonetic replacement necessary?
4. Is there a better German alternative?

Do not translate product names.
Do not pronounce English terminology randomly.
Keep the pronunciation consistent throughout the complete campaign.

8. SPEECH SYNTHESIS AND AUDIO PROCESSING
Generate several voice samples before rendering the complete video.
Test:

* Normal speaking speed
* Slightly slower speaking speed
* Different punctuation
* Different sentence structures
* Different available voices

Use audio processing carefully:

* Loudness normalization
* Gentle equalization
* Subtle compression
* De-essing if necessary
* Noise reduction if necessary
* Consistent volume
* Proper fade-in and fade-out

Do not overprocess the voice.
Avoid excessive pitch shifting and artificial formant manipulation.
Do not use robotic time stretching.
The final result should remain natural.

9. AUTOMATIC PRONUNCIATION QA
Create an automated pre-render check.
It should:

* Find known English terms
* Check whether pronunciation dictionary entries exist
* Warn about unknown brand names
* Check subtitle/text separation
* Verify that phonetic spellings do not leak into subtitles
* Verify audio files exist
* Verify audio duration
* Detect clipping where possible

Generate a report:
`voiceover-quality-report.md`

10. HUMAN-LIKE STORYTELLING
Voice direction must depend on the scene.
Product reveal:
Confident, slightly more energetic.
Technical explanation:
Calm, precise, understandable.
Emotional introduction:
Warm and engaging.
Call to action:
Friendly and motivating.
Tutorial:
Clear, patient, and instructional.
Never use the same delivery style for every scene.

11. FINAL AUDIO QUALITY
Before rendering the complete campaign:

1. Generate a short test voice-over.
2. Listen to the result.
3. Identify synthetic pronunciation.
4. Adjust the pronunciation dictionary.
5. Regenerate the test.
6. Compare available voices.
7. Select the best result.
8. Only then render the complete narration.

Never render all videos before validating the voice.

12. DELIVERABLES
Create:

* `pronunciation_dictionary.yaml`
* `voiceover_display_text.md`
* `voiceover_tts_text.md`
* `voiceover_quality_report.md`
* German voice-over WAV files
* Final mastered voice-over files
* Synchronized subtitle files
* TTS engine comparison report
* Voice installation and reproduction instructions

Integrate the selected solution into the existing video workflow.
The system must be reusable for all future projects.

FINAL OBJECTIVE
The audience should never feel that they are listening to a cheap robotic computer voice.
The narration should sound like a professional German technology presenter.
English product names and technical terminology must be pronounced consistently and correctly.
Use only legally usable free voices.
Now audit, test, optimize, and integrate the complete voice-over workflow.
