# Cache & Carry installieren: alle Befehle aus dem Tutorial

Genau diese Befehle wurden für das Tutorial am 26.11.2026 ausgeführt und
aufgenommen: Proxmox VE 9.2, unprivilegierter Debian 13.6 Container ohne
Nesting, Release v0.2.1 (amd64), zwei Debian 13 Clients.
Ersetze `192.168.1.41` durch die Adresse deines Servers.

## Kapitel 2: Server vorbereiten

### Proxmox: Container anlegen (auf dem Proxmox-Host)

```sh
pveam list local | grep debian-13
pct create 130 local:vztmpl/debian-13-standard_13.6-1_amd64.tar.zst --hostname cc-tutorial --unprivileged 1 --cores 2 --memory 1024 --rootfs local-lvm:8 --net0 name=eth0,bridge=vmbr0,ip=192.168.1.41/24,gw=192.168.1.1 --onboot 1
pct start 130 && pct status 130
```

Fehlt die Vorlage: `pveam update`, dann
`pveam download local debian-13-standard_13.6-1_amd64.tar.zst`.
Die Warnung „Systemd 257 detected. You may need to enable nesting.“ ist für
Cache & Carry ohne Bedeutung: Der Dienst wurde ohne Nesting getestet.
Danach die Konsole des Containers öffnen (Proxmox-Oberfläche oder `pct enter 130`).
Auf einem normalen Debian- oder Ubuntu-Server geht es direkt hier weiter:

### Im Container bzw. auf dem Server

```sh
grep PRETTY_NAME /etc/os-release     # Debian oder Ubuntu mit systemd
dpkg --print-architecture            # amd64 oder arm64: bestimmt das Release-Archiv
hostname -I                          # Adresse, unter der die Clients den Server erreichen
nproc && free -h | head -2           # Minimum 1 Kern und 256 MB, komfortabel 2 Kerne und 1 GB
df -h /var/lib                       # der Cache liegt unter /var/lib/cachencarry
```

## Kapitel 3: Herunterladen und installieren

Als root wie im Video, sonst `sudo` vor `./scripts/install.sh`.

```sh
cd /root && wget -q --show-progress https://github.com/Anarki-LNX/cachencarry/releases/download/v0.2.1/cachencarry-0.2.1-linux-amd64.tar.gz
wget -q https://github.com/Anarki-LNX/cachencarry/releases/download/v0.2.1/SHA256SUMS
sha256sum --check --ignore-missing SHA256SUMS
tar xzf cachencarry-*-linux-amd64.tar.gz && ls cachencarry-*-linux-amd64
cd cachencarry-*-linux-amd64 && ./scripts/install.sh
systemctl status cachencarry --no-pager
wget -qO- http://localhost:8080/healthz; echo
```

Für einen Raspberry Pi oder andere ARM-Rechner `linux-arm64` statt `linux-amd64`.

Das Installationsskript
- legt den Systembenutzer und die Gruppe `cachencarry` an,
- installiert `/usr/local/bin/cachencarry`,
- erzeugt `/etc/cachencarry/config.yaml`, aber nur, wenn es sie noch nicht gibt,
- legt `/var/lib/cachencarry` (Daten) und `/var/log/cachencarry` an,
- prüft die Konfiguration, installiert den gehärteten systemd-Dienst `cachencarry`, aktiviert und startet ihn.

## Kapitel 4: Ersteinrichtung

Im Browser `http://192.168.1.41:8080` öffnen. Das Setup-Token liest du auf dem
Server aus:

```sh
su -s /bin/sh cachencarry -c '/usr/local/bin/cachencarry setup-token'
```

Benutzername, Passwort (mindestens 10 Zeichen), Token einfügen, „Konto anlegen“.

## Kapitel 5: Ersten Client einrichten (Debian 13)

Original sichern und `/etc/apt/sources.list.d/debian.sources` ersetzen, genau
wie in `docs/CLIENTS.md`. `Signed-By` bleibt, apt prüft die Signaturen weiter selbst.

```sh
cat /etc/apt/sources.list.d/debian.sources
cp /etc/apt/sources.list.d/debian.sources /root/debian.sources.orig
cat > /etc/apt/sources.list.d/debian.sources <<'EOF'
Types: deb
URIs: http://192.168.1.41:8080/apt/debian
Suites: trixie trixie-updates
Components: main contrib non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg

Types: deb
URIs: http://192.168.1.41:8080/apt/debian-security
Suites: trixie-security
Components: main contrib non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg
EOF
apt update
apt install -y curl
```

Ubuntu, Proxmox-Hosts, Arch Linux und CachyOS: siehe `docs/CLIENTS.md`.
Arch Linux, erste Zeile in `/etc/pacman.d/mirrorlist` (ein echter Mirror bleibt darunter):

```ini
Server = http://192.168.1.41:8080/pacman/archlinux/$repo/os/$arch
```

## Kapitel 6: Cache testen

Auf dem zweiten Client dieselben Befehle wie in Kapitel 5 (ohne das erste `cat`), danach:

```sh
curl -sI http://192.168.1.41:8080/apt/debian/dists/trixie/InRelease | grep -i x-cache
```

`X-Cache: MISS` beim allerersten Abruf einer Datei, danach `X-Cache: HIT`.
Gemessen im Tutorial: `apt install -y curl` (10,2 MB) dauerte auf Client 1
3 s (MISS, vom Debian-Mirror), auf Client 2 0 s mit 252 MB/s (HIT, aus dem Cache).

## Kapitel 7: Wo finde ich was?

```sh
ls /etc/cachencarry
grep -A3 "^storage:" /etc/cachencarry/config.yaml
du -sh /var/lib/cachencarry
journalctl -u cachencarry -n 4 --no-pager -o cat
```

| Was | Wo |
|---|---|
| Konfiguration | `/etc/cachencarry/config.yaml` (alle Optionen: `config.example.yaml` daneben) |
| Daten und Cache | `/var/lib/cachencarry` |
| Logs | `journalctl -u cachencarry -f` |
| Statistik, gespeicherte Pakete | Dashboard: Statistik, Speicher |
| Cachegröße und Bandbreite | Dashboard: Einstellungen (wirkt sofort, ohne Neustart) |
| Client-Anleitungen | Dashboard: Cache-Module, „Client einrichten“; `docs/CLIENTS.md` |
| Dokumentation | `README.md`, `DEPLOYMENT.md`, `docs/TROUBLESHOOTING.md` im Repository |
