# YouTube: Präsentationsvideo

**Datei:** `final/cachencarry_presentation_16x9.mp4`
**Untertitel:** `subtitles/de/cachencarry_presentation_de.srt` (Deutsch), `subtitles/en/cachencarry_presentation_en.srt` (Englisch)
**Thumbnail:** `thumbnails/cachencarry_presentation_thumbnail.png`

## Titel

Dein Netzwerk lädt das nicht mehr doppelt herunter: Cache & Carry, der LAN-Paketcache fürs Homelab

## Beschreibung

Drei Linux-Rechner, drei Updates, und jedes Paket kommt dreimal durch deine Internetleitung? Cache & Carry ist ein kleiner, selbst gehosteter Paketcache für dein Heim- oder Büronetz. Der erste Rechner lädt ein Paket aus dem Internet, alle anderen bekommen es danach direkt aus deinem LAN.

Einmal herunterladen. So oft rausholen, wie du willst.

Was Cache & Carry heute kann:
• Pacman für Arch Linux und CachyOS
• APT für Debian, Ubuntu und Proxmox VE
• Dashboard mit Live-Traffic, HIT und MISS, Speicher, Statistik und Einstellungen (Deutsch und Englisch)
• Geteilte Downloads: fragen mehrere Rechner gleichzeitig dieselbe Datei an, läuft nur ein Download aus dem Internet
• Ablage nach SHA-256-Inhalt, Integritätsprüfung, Pinnen und Entfernen von Paketen
• Cachegröße und Bandbreite im Dashboard einstellbar
• Signaturen bleiben unangetastet: apt und pacman prüfen wie gewohnt selbst
• Ein statisches Programm, ein systemd-Dienst, läuft z. B. in einem Proxmox-LXC mit 2 Kernen und 1 GB RAM

Ehrlich gesagt: Pacman und APT sind fertig und mit echten Clients getestet. Einfache HTTP-Dateiserver sind experimentell. Container-Images, npm, PyPI, RPM und Maven sind geplant, aber noch nicht umgesetzt.

Die Zahlen im Video (Paketindex mit 8,6 MiB: 959 ms aus dem Internet, 9 ms aus dem Cache) stammen aus unserem Testnetzwerk, gemessen beim ersten echten Clienttest mit CachyOS. Das ist ein Beispiel, kein Garantiewert.

🔗 GitHub: https://github.com/Anarki-LNX/cachencarry
📖 Installation: https://github.com/Anarki-LNX/cachencarry/blob/main/DEPLOYMENT.md
💻 Clients einrichten: https://github.com/Anarki-LNX/cachencarry/blob/main/docs/CLIENTS.md
🎬 Installations-Tutorial: (Link zum Tutorial-Video einfügen)

Lizenz: Apache License 2.0. Die Software ist kostenlos. Hardware, Strom und Speicherplatz für deinen Server bringst du selbst mit.

Wenn du es ausprobierst: Lass einen Stern auf GitHub da, teile das Projekt und schreib in die Kommentare, wie du es einsetzt.

#CacheAndCarry #Homelab #Linux #SelfHosted #Proxmox #OpenSource

## Kapitel

0:00 Das Problem: dieselben Downloads, immer wieder
0:12 Die Idee: ein Paketlager für dein Netzwerk
0:24 Das ist Cache & Carry
0:39 HIT und MISS
0:56 Ein Download für mehrere Rechner
1:13 Für dein Homelab
1:28 Open Source auf GitHub

## Schlagwörter (Tags)

Cache & Carry, LAN Cache, Paketcache, Homelab, Proxmox, Debian, Ubuntu, Arch Linux, CachyOS, apt, pacman, Self Hosted, Open Source, Linux Server
