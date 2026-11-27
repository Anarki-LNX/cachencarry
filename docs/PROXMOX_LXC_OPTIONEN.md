# Cache & Carry auf Proxmox VE: Wege zum Ein-Befehl-LXC

Stand: 27.11.2026. **Umgesetzt** ist Variante 1 als `scripts/proxmox-lxc.sh` und die vorbereiteten Dateien für community-scripts in `deployments/community-scripts/`. Wie man beides veröffentlicht, steht in [PROXMOX_VEROEFFENTLICHUNG.md](PROXMOX_VEROEFFENTLICHUNG.md).

## Kurzfassung und Empfehlung

**Empfehlung: das native Binary, kein Docker-Image im LXC.** Ein eigenes Shell-Skript läuft auf dem Proxmox-Host, legt per `pct` einen unprivilegierten Debian-13-Container ohne Nesting an, lädt dort das statische Release-Binary samt `SHA256SUMS` herunter, prüft die Prüfsumme und ruft das vorhandene `scripts/install.sh` auf. Genau diese Kombination ist laut `DEPLOYMENT.md` bereits auf PVE 9.2 getestet. Sie braucht weder Nesting noch keyctl, ist mit `vzdump` normal sicherbar, funktioniert mit dem offiziellen Debian-13-Template für amd64 und arm64 und nutzt für Updates den schon vorhandenen Upgrade-Pfad von `install.sh`.

Das Docker-Image bleibt der Weg für Docker-Hosts und VMs. Der OCI-Import von Proxmox ist für Anwendungscontainer weiterhin Technology Preview und kann einen Container nicht auf ein neueres Image aktualisieren. Er taugt deshalb höchstens als später dokumentierte, experimentelle Option. Ein Bau aus dem Quellcode im Container lohnt nicht: Er bräuchte Go und Node im Container, und das Release-Binary ist bereits statisch (13,5 MB für amd64).

Zur Aufnahme bei community-scripts: Cache & Carry erfüllt deren Aufnahmekriterien derzeit nicht (Details im nächsten Abschnitt). Das eigene Skript sollte aber so aufgebaut sein, dass es sich später fast eins zu eins in deren Struktur übertragen lässt.

Der geplante kleine Credit- und Spendenhinweis in der Weboberfläche ist in allen Varianten gleich enthalten, weil alle dasselbe Binary ausliefern. Er beeinflusst die Wahl nicht.

## Kann Cache & Carry bei community-scripts aufgenommen werden?

**Urteil: jetzt nicht. Frühestens ab dem 21.05.2027 und nur mit mindestens 1.000 GitHub-Sternen, sonst nur über eine seltene Ausnahme.**

### Aufnahmekriterien

Die Vorlage für Script-Requests im Repo `community-scripts/ProxmoxVE` nennt als allgemeine Voraussetzungen ([request-script.yml](https://github.com/community-scripts/ProxmoxVE/blob/main/.github/DISCUSSION_TEMPLATE/request-script.yml)):

| Kriterium | Cache & Carry heute | Erfüllt |
|---|---|---|
| selbst gehostet | ja | ja |
| offizielles öffentliches Quell-Repo | github.com/Anarki-LNX/cachencarry | ja |
| offizielle Releases oder Tags | v0.2.1 mit Tarballs und `SHA256SUMS` | ja |
| aktiv gepflegt | ja | ja |
| mindestens 1.000 Sterne | 0 Sterne (GitHub-API am 27.11.2026) | nein |
| letztes Release höchstens 6 Monate alt | 21.11.2026 | ja |
| Projekt mindestens 6 Monate alt | Repo angelegt am 21.11.2026 | nein, frühestens 21.05.2027 |
| kein Docker nötig ([Contribution-Doku](https://community-scripts.org/docs/contribution/readme)) | natives Binary vorhanden | ja |

Laut Vorlage prüft ein automatischer Check Sterne und Alter. Ohne ausgefüllte Begründung für eine Ausnahme wird der Antrag automatisch geschlossen. Ausnahmen gelten als selten und brauchen ein klar belegbares, deutliches Signal öffentlicher Verbreitung.

### Wie der Ablauf heute aussieht

- Neue Skripte gehen nicht direkt nach ProxmoxVE, sondern in das Test-Repo [DevScripts](https://github.com/community-scripts/DevScripts) (früher ProxmoxVED). PRs mit neuen Skripten gegen ProxmoxVE werden ohne Review geschlossen ([CONTRIBUTING.md](https://github.com/community-scripts/ProxmoxVE/blob/main/CONTRIBUTING.md)).
- Pflichtdateien: `ct/<slug>.sh` (Container anlegen, `update_script()`), `install/<slug>-install.sh` (Installation im Container) und `json/<slug>.json` (Metadaten). Website-Metadaten wie Name, Beschreibung, Logo und Tags werden über die Website gepflegt.
- Das gemeinsame Framework liegt im Repo [community-scripts/core](https://github.com/community-scripts/core) (MIT). Die `ct`-Skripte laden `build.func` von dort. Container-Defaults setzen sie über Variablen wie `var_cpu`, `var_ram`, `var_disk`, `var_os`, `var_version`, `var_unprivileged`, `var_arm64`. Das Template holt das Framework über `pveam`.
- Releases werden über Helfer wie `fetch_and_deploy_gh_release` installiert und über `check_for_gh_release` aktualisiert. Für vorgebaute Tarballs gibt es den Modus `prebuild` ([AGENTS.md in DevScripts](https://github.com/community-scripts/DevScripts/blob/main/AGENTS.md)). Das passt gut zu den vorhandenen Release-Tarballs.
- Docker ist in `ct`- und `install`-Skripten nicht erlaubt. `var_arm64` darf nur `yes` sein, wenn das Projekt arm64-Assets veröffentlicht (bei Cache & Carry der Fall).
- Ablauf: Fork von DevScripts, PR, automatischer Testbau auf Proxmox VE und Incus, Review, Merge als Entwicklungsskript, Rückmeldungen von Testern im Discord, danach Übernahme nach ProxmoxVE durch Maintainer. Die PR-Vorlage verlangt die Angabe, ob KI benutzt wurde.
- Passende Kategorie: **Network & Firewall**. Dort steht auch Apt-Cacher-NG, ebenfalls mit amd64 und arm64 ([Skriptseite](https://community-scripts.org/scripts/apt-cacher-ng)). Host Management passt nicht, dort stehen Werkzeuge für den Host selbst ([Kategorien](https://community-scripts.org/categories?category=host-management)).

### Was fehlt und konkrete Schritte

1. Verbreitung aufbauen, bis das Repo 1.000 Sterne hat, und das Projekt mindestens bis 21.05.2027 regelmäßig releasen.
2. Bis dahin das eigene Proxmox-Skript (Variante 1) veröffentlichen und Erfahrungen sammeln. Es sollte intern schon in Host-Teil und Container-Teil getrennt sein, wie `ct/` und `install/` bei community-scripts.
3. Wenn die Kriterien erfüllt sind: zuerst einen Script-Request als Discussion in ProxmoxVE stellen, dann in DevScripts einen PR mit `ct/cachencarry.sh`, `install/cachencarry-install.sh` und `json/cachencarry.json`, Kategorie Network & Firewall, `var_arm64=yes`, Installation per `fetch_and_deploy_gh_release` im Modus `prebuild`.
4. Nach der Übernahme pflegt die Community das Skript im eigenen Framework weiter. Das eigene Skript bleibt dann als Alternative bestehen oder verweist auf das community-scripts-Skript.

### Was das für die Empfehlung bedeutet

Die Empfehlung bleibt Variante 1. Wird die Aufnahme später möglich, ersetzt das Framework von community-scripts nur den Host-Teil (Container anlegen, Menüs, Update-Hülle). Der Container-Teil bleibt inhaltlich gleich: Release laden, als Systemd-Dienst installieren, Setup-Token ausgeben. Daher lohnt es sich jetzt nicht, vom Framework von community-scripts abzuhängen. Ein eigenständiges Skript ohne fremde Laufzeitabhängigkeit ist für die nächsten Monate einfacher zu pflegen und lässt sich später übertragen.

## Vergleichstabelle

| Kriterium | 1. Host-Skript, natives Binary | 2. Eigenes LXC-Template | 3. OCI-Image als LXC | 4. Docker im LXC |
|---|---|---|---|---|
| Reifegrad auf PVE | Standardweg, auf PVE 9.2 getestet (siehe `DEPLOYMENT.md`) | Standardweg (`pct create` aus lokaler Datei) | Anwendungscontainer sind Technology Preview (Stand PVE 9.3) | funktioniert oft, offiziell nicht empfohlen |
| Sicherheit | unprivilegiert, ohne Nesting, gehärtete Systemd-Unit | wie 1 | unprivilegiert, Prozess als UID 65532, kein Systemd-Sandboxing | braucht `nesting=1`, oft `keyctl=1`, teils AppArmor-Lockerung |
| Updates | `install.sh` mit neuem Binary, Konfiguration und Daten bleiben | Binary-Update wie 1, OS per `apt` | nur Neuanlegen und Daten-Volume umhängen | `docker pull`, dazu Docker selbst und Debian pflegen |
| Backup (`vzdump`) | normal, Daten auf Rootfs oder eigenem Volume | wie 1 | Rootfs normal, Daten-Volume wie 1 | normal, aber Docker-Volumes im Container mitgesichert |
| Shell, Logs, Token | `pct enter`, `journalctl`, `cachencarry setup-token` | wie 1 | keine Shell im distroless-Image, Konsole laut Forum nicht verfügbar | `docker logs`, `docker exec` |
| Aufwand fürs Projekt | ein Shell-Skript, nutzt vorhandenes `install.sh` | Build-Pipeline für Templates pro Release und Architektur | gering, Image wird ohnehin gebaut | Dokumentation, aber viel Support bei Fehlern |
| arm64 | offizielles Debian-13-Template für arm64 vorhanden | zweites Template nötig | Multi-Arch-Image vorhanden | möglich |
| Download-Größe | Debian-Template rund 130 MB (einmal pro Host) plus Tarball rund 5,7 MB | eigenes Template, geschätzt 50 bis 100 MB (nicht gemessen) | klein (distroless plus Binary) | Debian-Template plus Docker plus Image |
| Lizenzen der Werkzeuge | `pct` (Teil von Proxmox VE, AGPL-3.0), Bash, curl | distrobuilder Apache-2.0, debootstrap Expat (MIT) | skopeo Apache-2.0 (von Proxmox genutzt) | Docker Engine Apache-2.0 |
| Bewertung | **empfohlen** | nicht lohnend | später als experimentelle Option | nicht empfohlen |

## Variante 1: Host-Skript mit `pct` und nativem Binary

**Ablauf.** Ein Bash-Skript auf dem PVE-Host prüft die Umgebung, lädt bei Bedarf das Debian-13-Template per `pveam`, legt den Container mit `pct create` an, startet ihn und führt die Installation per `pct exec` im Container aus. Danach gibt es URL und Setup-Token aus. Das entspricht dem Muster der community-scripts, ohne deren Code zu übernehmen.

**Was im Repo schon vorhanden ist (geprüft):**
- Release v0.2.1 mit `cachencarry-0.2.1-linux-amd64.tar.gz`, `cachencarry-0.2.1-linux-arm64.tar.gz` und `SHA256SUMS`. Der Tarball enthält Binary, Beispielkonfiguration, Systemd-Unit, `install.sh` und `uninstall.sh`.
- `scripts/install.sh` legt den Systembenutzer `cachencarry` an, erzeugt `/var/lib/cachencarry`, `/var/log/cachencarry` und `/etc/cachencarry`, installiert das Binary per Umbenennen, prüft die Konfiguration mit `check-config`, behält eine vorhandene Konfiguration und startet den Dienst bei einem Upgrade neu.
- `deployments/systemd/cachencarry.service` ist stark gehärtet (`ProtectSystem=strict`, `NoNewPrivileges`, leeres `CapabilityBoundingSet` und mehr). Laut `DEPLOYMENT.md` lief diese Unit auf PVE 9.2 im unprivilegierten Container ohne Nesting unverändert.
- Setup-Token: Beim ersten Start ohne Administrator schreibt der Server einen zufälligen Token nach `/var/lib/cachencarry/setup-token` (Modus 0600). Das Log nennt nur den Dateipfad, nicht den Token. `cachencarry setup-token` gibt ihn aus. Alternativ legt `CACHENCARRY_SECURITY_ADMIN_PASSWORD` den ersten Administrator direkt an.

**Sicherheit.** Unprivilegiert ist bei PVE der Standard ([pct-Doku](https://pve.proxmox.com/pve-docs/chapter-pct.html)). Nesting und keyctl bleiben aus. Proxmox zeigt bei neueren Systemd-Versionen einen Hinweis auf Nesting an. Laut `DEPLOYMENT.md` war es für Cache & Carry nicht nötig. Das Skript sollte das Binary nur nach erfolgreicher Prüfung gegen `SHA256SUMS` installieren.

**Updates.** Ein Unterbefehl des Host-Skripts (zum Beispiel `update <CTID>`) lädt das neueste Release in den Container, prüft die Prüfsumme und ruft `install.sh` auf. Konfiguration und Daten bleiben unberührt. Debian selbst aktualisiert der Nutzer wie gewohnt per `apt`.

**Backup.** `vzdump` sichert das Rootfs mit `/etc/cachencarry`. Liegt der Cache auf einem eigenen Volume (`mp0`), entscheidet dessen Option `backup` darüber, ob er mitgesichert wird. Bind-Mounts vom Host werden von `vzdump` nicht gesichert ([pct-Doku](https://pve.proxmox.com/pve-docs/chapter-pct.html)). Wichtig: Die Metadaten-Datenbank liegt im Speicherpfad, also auf demselben Volume wie die Blobs. Wer das Cache-Volume aus dem Backup nimmt, sollte die Datenbank mit `cachencarry backup -out <Datei>` auf das Rootfs kopieren.

**arm64.** Proxmox VE 9.2 gibt es seit 05.08.2026 offiziell für arm64, voll unterstützt allerdings nur für Enterprise-Hardware (NVIDIA Grace und Vera). Andere UEFI-Systeme ab ARMv9-A laufen best effort, Raspberry Pi und andere Device-Tree-Boards werden nicht unterstützt ([Roadmap](https://pve.proxmox.com/wiki/Roadmap)). Das offizielle Debian-13-Template gibt es auch für arm64 ([Template-Verzeichnis](http://download.proxmox.com/images/system/)). Für inoffizielle arm64-Ports auf Bastelhardware gilt: Das Skript braucht nur `pct` und `pveam`, wählt die Architektur über `dpkg --print-architecture` und funktioniert dort, sofern ein passendes Template verfügbar ist. Das ist nicht getestet.

**Aufwand.** Ein Skript im Repo, Shellcheck in der CI, ein Testlauf je PVE-Hauptversion. Kein zusätzliches Build-Artefakt.

## Variante 2: Eigenes LXC-Template als Release-Asset

**Ablauf.** In der CI wird pro Release und Architektur ein Rootfs gebaut, zum Beispiel mit [distrobuilder](https://github.com/lxc/distrobuilder) (Apache-2.0) oder [debootstrap](https://salsa.debian.org/installer-team/debootstrap) (Expat/MIT), mit vorinstalliertem Binary und Unit, gepackt als `.tar.zst`. Der Nutzer lädt die Datei in den Template-Speicher (zum Beispiel `/var/lib/vz/template/cache/`) und legt den Container mit `pct create <ID> local:vztmpl/<datei>.tar.zst ...` an.

**Bewertung.**
- Größe: Ein minimales Debian-Rootfs plus 13,5 MB Binary. Geschätzt 50 bis 100 MB komprimiert, nicht gemessen. Das offizielle Debian-Template liegt bei rund 130 MB, ist aber meist schon auf dem Host.
- Updates: Das Template hilft nur bei der Erstinstallation. Updates laufen danach genau wie in Variante 1. Ein neues Template ersetzt keinen bestehenden Container.
- Pflege: Das Projekt würde ein Debian-Image verteilen und müsste es für Sicherheitsupdates neu bauen. Dazu kommen Templates für zwei Architekturen pro Release.
- Vertrauen: Nutzer müssen ein komplettes Betriebssystem-Image vom Projekt akzeptieren statt eines Debian-Templates von Proxmox.

Kein Vorteil gegenüber Variante 1, aber deutlich mehr Aufwand. Nicht empfohlen.

## Variante 3: OCI-Image direkt als LXC (PVE 9.1 und neuer)

**Stand der Funktion.**
- Seit PVE 9.1 (19.11.2025) lassen sich LXC-Container aus OCI-Images anlegen. Systemcontainer aus passenden Images gelten als unterstützt, **Anwendungscontainer als Technology Preview** ([Roadmap](https://pve.proxmox.com/wiki/Roadmap), [pct-Doku](https://pve.proxmox.com/pve-docs/chapter-pct.html)). Auch in der aktuellen Doku zu PVE 9.3 (25.11.2026) steht weiterhin Technology Preview.
- Bezug: In der Weboberfläche per Upload oder über „Pull from OCI registry“ in der Template-Ansicht eines Speichers. Per CLI über die API `pvesh create /nodes/<node>/storage/<storage>/oci-registry-pull --reference <image>`. Intern nutzt Proxmox dafür skopeo ([Patch auf der Mailingliste](https://lists.proxmox.com/pipermail/pve-devel/2025-October/075883.html), [Forum](https://forum.proxmox.com/threads/downloading-oci-images-through-the-cli-instead-of-the-gui.177798/)). Die CLI-Syntax steht nicht in der offiziellen Doku.
- Einstiegspunkt und Umgebungsvariablen sind in den Container-Optionen änderbar (`entrypoint`, `env`). Für Anwendungscontainer ist hostseitiges DHCP automatisch aktiv. Seit PVE 9.2 wird die `User`-Angabe des Images beachtet, `/dev/shm` ist ein tmpfs, und Mountpoints kennen `idmap` und `keepattrs`.
- PVE 9.3 hat mehrere Sicherheitslücken im OCI-Import geschlossen, etwa das Einschleusen von Zeilen in die LXC-Konfiguration und das Löschen von Dateien außerhalb des Rootfs durch bösartige Images ([Roadmap, Abschnitt 9.3](https://pve.proxmox.com/wiki/Roadmap)). Der Code ist also noch jung.
- **Updates:** Die Image-Schichten werden beim Anlegen zu einem Rootfs zusammengeführt. Ein bestehender Container lässt sich nicht auf ein neueres Image umstellen. Der Weg ist: Daten auf eigenem Volume, neuen Container anlegen, Volume umhängen ([Forum: Persistent Data Across OCI Update](https://forum.proxmox.com/goto/post?id=826351), [Starline](https://www.starline.de/en/magazine/technical-articles/oci-under-proxmox-containers-according-to-fixed-rules), [Forum-Thread zu 9.1](https://forum.proxmox.com/threads/oci-images-in-lxc-release-9-1.176273/)). Die Roadmap nennt reifere OCI-Unterstützung als künftiges Ziel.
- Konsole: Forennutzer berichten, dass die Konsole für solche Container nicht verfügbar ist und `pct enter` als Ausweg dient ([Forum-Thread zu 9.1](https://forum.proxmox.com/threads/oci-images-in-lxc-release-9-1.176273/)).

**Passt das distroless-Image dazu?** Teilweise.
- Pro: Das Image braucht kein Init-System. Der Einstiegspunkt `/usr/local/bin/cachencarry serve` ist genau das, was ein Anwendungscontainer starten soll. Es läuft als UID 65532, ohne Shell und Paketmanager, also mit kleiner Angriffsfläche.
- Contra: Ohne Shell funktioniert `pct enter` nicht. Es gibt kein Systemd, also auch kein Sandboxing über die Unit und kein `journalctl`. Wohin die Ausgabe des Prozesses bei Anwendungscontainern geschrieben wird, ist in der Doku nicht beschrieben und muss getestet werden.
- Setup-Token: Der Standard-Speicherpfad ist `/var/lib/cachencarry`, auch ohne Konfigurationsdatei. Daher sollte `pct exec <ID> -- /usr/local/bin/cachencarry setup-token` den Token ausgeben, weil `pct exec` keine Shell braucht. Das ist nicht getestet. Alternativ setzt man vor dem ersten Start `CACHENCARRY_SECURITY_ADMIN_PASSWORD` über die `env`-Option. Dann steht das Passwort aber in der Container-Konfiguration auf dem Host.
- Healthcheck: Der `HEALTHCHECK` aus dem Dockerfile wird von LXC nicht ausgewertet.
- Updates bleiben ein Neuanlegen mit Umhängen des Daten-Volumes.

**Hinweis zum Repo:** Das Image `ghcr.io/anarki-lnx/cachencarry` ist öffentlich veröffentlicht, mit den Tags `0.2.1`, `0.2` und `latest`, für amd64 und arm64, etwa 16 MB groß. Der Workflow `.github/workflows/image.yml` baut und veröffentlicht es bei jedem Tag `vX.Y.Z`. Er liegt im Commit e0b9117 auf `main` bei GitHub.

**Bewertung.** Interessant, aber nicht als Hauptweg geeignet, solange Updates und Logs so umständlich sind und die Funktion Technology Preview ist. Später kann das Projekt das Image als experimentelle Option dokumentieren, nach einem eigenen Test.

## Variante 4: Docker im LXC

**Voraussetzungen.** `nesting=1` und für unprivilegierte Container meist `keyctl=1`. Die Doku sagt dazu, man müsse sich praktisch zwischen systemd-networkd und Docker entscheiden ([pct-Doku](https://pve.proxmox.com/pve-docs/chapter-pct.html)). Für maximale Isolation und Live-Migration empfiehlt Proxmox, Container in einer QEMU-VM zu betreiben.

**Probleme aus der Praxis.**
- Im November 2025 brach ein containerd/runc-Update (Fix für CVE-2025-52881) Docker in unprivilegierten LXC mit dem Fehler zu `net.ipv4.ip_unprivileged_port_start`. Verbreitete Umgehungen waren das Festhalten alter Pakete oder `lxc.apparmor.profile: unconfined`, also weniger Isolation ([Forum](https://forum.proxmox.com/threads/docker-inside-lxc-net-ipv4-ip_unprivileged_port_start-error.175437/), [Forum: CVE-2025-52881](https://forum.proxmox.com/threads/cve-2025-52881-breaks-docker-lxc-containers.175827/)). Laut Nutzerberichten ist das mit neueren lxc-pve-Paketen behoben.
- Speichertreiber: Auf ZFS fiel Docker früher auf den langsamen `vfs`-Treiber zurück. Seit OpenZFS 2.2 unterstützt ZFS overlayfs, auf aktuellem PVE (ZFS 2.4) ist das daher vermutlich kein Thema mehr. Selbst getestet ist das nicht.
- Doppelte UID-Abbildung bei Bind-Mounts (65532 im Docker-Container wird auf dem Host zu 165532), siehe `DEPLOYMENT.md`.

**Bewertung.** Mehr Schichten, mehr Rechte, mehr Pflege (Debian, Docker, Image), kein Gewinn. Cache & Carry braucht keine Kernel-Funktionen, die nur Docker bietet. Nicht empfohlen. Wer Docker will, nimmt eine VM und die Compose-Datei.

## Offene Fragen an dich

1. **Aufruf:** Ist ein `curl ... | bash`-Einzeiler gewünscht, oder lieber zwei Schritte (Skript herunterladen, ansehen, ausführen)? Und soll die URL an ein Release-Tag gebunden sein statt an `main`?
2. **Interaktiv oder nicht:** Nur Umgebungsvariablen und Defaults, oder zusätzlich Dialoge (whiptail) für Speicher, Größe und Netzwerk?
3. **Cache-Ablage:** Standardmäßig ein eigenes Volume `mp0` (empfohlen) mit welcher Größe? Soll es ins `vzdump`-Backup, oder nur die Datenbank über `cachencarry backup`?
4. **Signaturen:** Reicht `SHA256SUMS` aus demselben Release, oder sollen Releases zusätzlich signiert werden (zum Beispiel mit minisign oder cosign)?
5. **Update-Weg:** Update-Befehl auf dem Host (`proxmox-lxc.sh update <CTID>`) oder ein kleines Update-Skript im Container?
6. **OCI-Variante:** Soll das ghcr-Image nach einem eigenen Test als experimentelle Option für PVE 9.1+ dokumentiert werden?
7. **community-scripts:** Soll die Aufnahme als Ziel für Mitte 2027 eingeplant werden (Sterne sammeln, regelmäßig releasen)?
8. **Doku-Korrektur:** Die Aussage in `DEPLOYMENT.md` zu ZFS und `vfs` ist vermutlich veraltet. Soll sie nach einem Test angepasst werden?

## Skizze: der empfohlene Ein-Befehl-Install

Umgesetzt in `scripts/proxmox-lxc.sh`. Die Skizze bleibt als Begründung stehen, maßgeblich ist das Skript und `DEPLOYMENT.md`.

Aufruf auf dem Proxmox-Host als root:

```sh
# einfach
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Anarki-LNX/cachencarry/v0.3.0/scripts/proxmox-lxc.sh)"

# mit Vorgaben, ohne Rückfragen
CC_CTID=130 CC_STORAGE=local-lvm CC_CACHE_GB=200 CC_IP=dhcp \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/Anarki-LNX/cachencarry/v0.3.0/scripts/proxmox-lxc.sh)"

# Update eines bestehenden Containers
bash proxmox-lxc.sh update 130
```

Ablauf des Skripts:

1. **Prüfen:** läuft als root auf einem PVE-Host (`pveversion` vorhanden), Version mindestens 9.x (getestet 9.2), Architektur über `dpkg --print-architecture` (amd64 oder arm64), freie CTID über `pvesh get /cluster/nextid` falls keine vorgegeben.
2. **Template:** `pveam update`, neuestes `debian-13-standard_*_<arch>.tar.zst` aus `pveam available --section system` wählen und nur laden, wenn es noch nicht im Template-Speicher liegt.
3. **Container anlegen:** `pct create` mit `--unprivileged 1`, ohne `--features`, `--cores 2 --memory 1024 --swap 512`, Rootfs 4 GB, `--mp0 <storage>:<CC_CACHE_GB>,mp=/var/lib/cachencarry`, `--net0 name=eth0,bridge=vmbr0,ip=<dhcp oder statisch>`, `--onboot 1`, `--hostname cachencarry`, `--tags cachencarry`. Danach `pct start` und warten, bis der Container eine Adresse und DNS hat.
4. **Im Container (per `pct exec`):** `apt-get install -y ca-certificates curl`, Release-Tarball für die Architektur und `SHA256SUMS` laden, mit `sha256sum -c` prüfen, entpacken, `./scripts/install.sh` ausführen. Damit gelten Benutzer, Verzeichnisse, gehärtete Unit und Konfigurationsprüfung aus dem vorhandenen Installer.
5. **Abschluss:** warten, bis `/var/lib/cachencarry/setup-token` existiert, dann URL `http://<IP>:8080/` und den Token per `cachencarry setup-token` (als Benutzer `cachencarry`) ausgeben. Dazu ein Hinweis auf `pct enter <CTID>`, `journalctl -u cachencarry` und den Update-Befehl.
6. **Update-Modus:** prüft, ob der Container existiert und `cachencarry` installiert ist, vergleicht `cachencarry version` mit dem neuesten Release, macht optional vorher `cachencarry backup -out` auf das Rootfs, lädt und prüft das neue Tarball und ruft erneut `install.sh` auf. Konfiguration und Daten bleiben erhalten.
7. **Fehlerbehandlung:** Bricht ein Schritt nach `pct create` ab, fragt das Skript, ob der halbfertige Container gelöscht werden soll, und löscht nie ungefragt.

Aufbau intern: ein Host-Teil (Schritte 1 bis 3, 5, 6) und ein Container-Teil (Schritt 4) als eigene Funktion oder Datei. So lässt sich der Container-Teil später direkt als `install/cachencarry-install.sh` für community-scripts übernehmen.

## Quellen

- Proxmox VE Roadmap und Release Notes 9.1, 9.2, 9.2 arm64, 9.3: https://pve.proxmox.com/wiki/Roadmap
- Proxmox VE Doku, Kapitel Linux Container (OCI, `entrypoint`, `env`, `keyctl`, Mountpoint-Backup): https://pve.proxmox.com/pve-docs/chapter-pct.html
- Proxmox-Template-Verzeichnis (Debian 13 amd64 und arm64): http://download.proxmox.com/images/system/
- Pressemitteilung PVE 9.1: https://proxmox.com/en/about/company-details/press-releases/proxmox-virtual-environment-9-1
- heise zu PVE 9.1 und OCI: https://heise.de/-11086586
- Starline, OCI unter Proxmox: https://www.starline.de/en/magazine/technical-articles/oci-under-proxmox-containers-according-to-fixed-rules
- Patch `oci-registry-pull` mit skopeo: https://lists.proxmox.com/pipermail/pve-devel/2025-October/075883.html
- Forum, OCI per CLI laden: https://forum.proxmox.com/threads/downloading-oci-images-through-the-cli-instead-of-the-gui.177798/
- Forum, OCI Images in LXC (9.1): https://forum.proxmox.com/threads/oci-images-in-lxc-release-9-1.176273/
- Forum, Persistent Data Across OCI Update: https://forum.proxmox.com/goto/post?id=826351
- Forum, Docker in LXC und `ip_unprivileged_port_start`: https://forum.proxmox.com/threads/docker-inside-lxc-net-ipv4-ip_unprivileged_port_start-error.175437/
- Forum, CVE-2025-52881 und Docker in LXC: https://forum.proxmox.com/threads/cve-2025-52881-breaks-docker-lxc-containers.175827/
- community-scripts ProxmoxVE (MIT), CONTRIBUTING: https://github.com/community-scripts/ProxmoxVE/blob/main/CONTRIBUTING.md
- community-scripts Script-Request-Vorlage: https://github.com/community-scripts/ProxmoxVE/blob/main/.github/DISCUSSION_TEMPLATE/request-script.yml
- community-scripts DevScripts und AGENTS.md: https://github.com/community-scripts/DevScripts
- community-scripts core (MIT): https://github.com/community-scripts/core
- community-scripts Contribution-Doku: https://community-scripts.org/docs/contribution/readme
- community-scripts Kategorien und Apt-Cacher-NG: https://community-scripts.org/categories?category=host-management und https://community-scripts.org/scripts/apt-cacher-ng
- distrobuilder (Apache-2.0): https://github.com/lxc/distrobuilder
- debootstrap (Expat): https://salsa.debian.org/installer-team/debootstrap
- skopeo (Apache-2.0): https://github.com/containers/skopeo
- umoci (Apache-2.0): https://github.com/opencontainers/umoci
