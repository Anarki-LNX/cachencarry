# Faktencheck: jede Aussage der Kampagne und ihre Quelle

Stand: Cache & Carry v0.2.1, Repository-Stand vom 26.11.2026.
Quellen: `README.md`, `TODO.md` (verified / not verified), `DEPLOYMENT.md`,
`docs/CLIENTS.md`, Quellcode, und eigene Aufnahmen für diese Kampagne.

| Aussage im Video | Status | Beleg |
|---|---|---|
| Pacman für Arch Linux und CachyOS | fertig, getestet | README „What it caches today“, TODO: echte Arch- und CachyOS-Clients; Kampagne: echte pacman-Clients in `archlinux:latest` |
| APT für Debian, Ubuntu, Proxmox | fertig, getestet | README, TODO: Debian 12/13, Ubuntu 26.04, Proxmox VE 9.2; Kampagne: zwei echte Debian 13 Clients im Tutorial |
| HTTP-Dateiserver experimentell | experimentell | README; im Tutorial als „experimentell“ gekennzeichnet, sonst nicht gezeigt |
| Container-Images, npm, PyPI, RPM, Maven | geplant | nur in den Begleittexten als „geplant“ erwähnt, nie im Video als Funktion |
| Dashboard mit HIT und MISS live | fertig | echte Aufnahmen (Live-Traffic) |
| Geteilte Downloads (mehrere Clients, ein Upstream-Download) | fertig | README, ARCHITECTURE; Kampagne: live aufgenommen mit 3 pacman-Clients („3 wartende Clients“) und 10 HTTP-Clients („10 wartende Clients“) |
| 8,6 MiB Paketindex: 959 ms aus dem Internet, 9 ms aus dem Cache | Messung | README „Why you want this“, erster echter CachyOS-Client gegen die Proxmox-Instanz. Im Bild immer als „Beispiel aus dem Testnetzwerk, kein Garantiewert“ |
| Signaturen bleiben unangetastet | fertig | README, docs/CLIENTS.md; im Tutorial bleibt `Signed-By`, im Arch-Container `SigLevel = Required DatabaseOptional` (unverändert) |
| Statistik aus echten übertragenen Bytes | fertig | README „Honest numbers“ |
| Einstellungen wirken ohne Neustart | fertig | README „Yours to tune“, TODO v0.1.2 |
| Minimum 1 Kern / 256 MB, komfortabel 2 Kerne / 1 GB | Dokumentation | DEPLOYMENT.md „Requirements“ |
| Läuft im unprivilegierten Proxmox-LXC ohne Nesting | getestet | TODO „Proxmox LXC, native install“; im Tutorial erneut so installiert |
| systemd-Dienst heißt `cachencarry` | geprüft | `deployments/systemd/cachencarry.service`, Ausgabe von `systemctl status` im Tutorial |
| Setup-Token mit `su -s /bin/sh cachencarry -c '/usr/local/bin/cachencarry setup-token'` | geprüft | README, im Tutorial ausgeführt |
| Release v0.2.1, Archiv `cachencarry-0.2.1-linux-amd64.tar.gz`, `SHA256SUMS` | geprüft | GitHub-Release; im Tutorial heruntergeladen und mit `sha256sum --check` geprüft |
| Kostenlos, Apache 2.0 | geprüft | `LICENSE`; Hardware und Strom werden ausdrücklich als eigene Kosten genannt (Short 5, Beschreibungen) |
| Docker Compose | dokumentiert, `docker compose up` selbst **nicht verifiziert** | TODO „Not verified yet“; deshalb im Video nicht als gezeigter Installationsweg verwendet |

## Was im Bild gestellt ist (und warum es trotzdem echt ist)

- **Neutrale Client-Adressen** (10.0.10.x) in Präsentation und Shorts: Die
  Anfragen sind echt, sie laufen über ein lokales Relay, das einen
  `X-Forwarded-For`-Header setzt. Die Demo-Instanz vertraut 127.0.0.0/8 als
  Proxy, genau wie bei einem echten Reverse Proxy. So erscheinen keine echten
  LAN-Adressen des Entwicklungsrechners.
- **Adresse `cachencarry.lan:8080`** in der Präsentation: Beispieladresse aus
  `docs/CLIENTS.md`; der Aufnahme-Browser wurde über einen lokalen Proxy auf
  die Demo-Instanz geleitet.
- **„Rechner 1, 2, 3“** in Präsentation und Shorts sind Docker-Container mit
  Arch Linux auf einem PC, jeder mit eigenem pacman und eigener Paketdatenbank.
- **Tippen**: Die Befehle werden von einem Skript (`project/term/drive.sh`)
  sichtbar getippt und dann wirklich ausgeführt. Jede Ausgabe stammt vom
  echten Befehl.
- **Fortschrittsbalken von pacman**: Das Docker-Image `archlinux` blendet sie
  aus (`NoProgressBar`); sie wurden wie auf einem Desktop wieder eingeschaltet,
  außerdem `Color`. Die Signaturprüfung blieb unverändert.
- **Zeitraffer**: Wo das Tutorial schneller abspielt, steht „N× schneller“ im Bild.
- **Zeitlupe** in Short 3: Die Balken laufen dreimal langsamer, das steht im Bild.
- Das Tutorial zeigt die echte LAN-Adresse 192.168.1.41 des Wegwerf-Containers
  und 192.168.1.253 (PC des Nutzers, auf dem beide Debian-Clients liefen).
  Beides wurde vom Nutzer freigegeben.
