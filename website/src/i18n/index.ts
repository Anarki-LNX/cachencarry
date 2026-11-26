// All text of the site in both languages. One object per language with the same shape,
// so a missing translation is a type error. Rules for the copy: no claim that the
// repository does not back up, no dashes as separators, no semicolons.

export const locales = ['de', 'en'] as const;
export type Locale = (typeof locales)[number];

export function isLocale(value: unknown): value is Locale {
  return value === 'de' || value === 'en';
}

export const otherLocale = (l: Locale): Locale => (l === 'de' ? 'en' : 'de');

/** Section anchors, the same in both languages so a shared link works for everyone. */
export const anchors = {
  overview: 'overview',
  features: 'features',
  how: 'how-it-works',
  screenshots: 'screenshots',
  tutorials: 'tutorials',
  install: 'install',
  openSource: 'open-source',
  support: 'support',
} as const;

export type ShotKey = 'dashboard' | 'liveTraffic' | 'downloads' | 'storage' | 'modules' | 'clients' | 'settings';

const de = {
  meta: {
    title: 'Cache & Carry · Paketcache für dein Netzwerk · Open Source',
    description:
      'Cache & Carry ist ein selbst gehosteter Paketcache für APT und Pacman. Einmal aus dem Internet laden, dann von jedem Rechner im LAN abholen. Open Source unter Apache 2.0.',
    ogAlt: 'Cache & Carry Logo mit dem Slogan: Download once, carry out as often as you like.',
    chooseTitle: 'Cache & Carry · Sprache wählen / Choose your language',
  },
  a11y: {
    skip: 'Zum Inhalt springen',
    mainNav: 'Hauptnavigation',
    home: 'Cache & Carry Startseite',
    langSwitch: 'This page in English',
    newTab: '(öffnet in neuem Tab)',
    menu: 'Menü',
    closeMenu: 'Menü schließen',
    footerNav: 'Fußzeile',
  },
  nav: {
    overview: 'Überblick',
    features: 'Funktionen',
    how: 'So funktioniert es',
    screenshots: 'Screenshots',
    tutorials: 'Videos',
    install: 'Installation',
    docs: 'Doku',
    github: 'GitHub',
    support: 'Unterstützen',
  },
  hero: {
    eyebrow: 'Open Source · Self-hosted · Linux',
    title: 'Cache & Carry',
    tagline: 'Dein Netzwerk. Deine Pakete. Dein Cache.',
    lead: 'Cache & Carry speichert heruntergeladene Linux-Pakete in deinem lokalen Netzwerk. Einmal aus dem Internet laden, danach von allen Rechnern im LAN abholen.',
    ctaGithub: 'Auf GitHub ansehen',
    ctaInstall: 'Installation starten',
    license: 'Apache 2.0 · kostenlos für alle',
    release: 'Aktuelle Version',
    diagramLabel:
      'Schema: Ein Paket kommt einmal aus dem Internet in Cache & Carry und geht von dort an mehrere Linux-Rechner im LAN.',
    diagramInternet: 'Internet',
    diagramMirror: 'Mirror',
    diagramCache: 'Cache & Carry',
    diagramLan: 'LAN',
    diagramOnce: '1 × geladen',
    diagramNote: 'Schematische Darstellung, keine Live-Daten',
  },
  facts: [
    { value: '959 → 9 ms', label: 'Paketindex 8,6 MiB, Beispielmessung' },
    {
      value: '1 Download',
      label: 'egal wie viele Rechner gleichzeitig fragen',
    },
    { value: 'ca. 13 MB', label: 'Arbeitsspeicher im Leerlauf, gemessen' },
    { value: 'APT + Pacman', label: 'mit echten Clients getestet' },
  ],
  features: {
    label: 'Funktionen',
    title: 'Klein, schnell und ehrlich.',
    lead: 'Ein Programm, ein Speicherordner, ein Dashboard. Kein Datenbankserver, kein Java, kein Kubernetes.',
    nowTitle: 'Heute verfügbar',
    items: [
      {
        icon: 'share',
        title: 'Ein Download für alle',
        text: 'Fragen mehrere Rechner gleichzeitig nach derselben Datei, lädt Cache & Carry sie nur einmal. Alle wartenden Rechner bekommen sie schon während des Ladens.',
      },
      {
        icon: 'package',
        title: 'APT',
        text: 'Für Debian, Ubuntu und Proxmox. Getestet mit Debian 12 und 13, Ubuntu 26.04 und Proxmox VE 9.2.',
      },
      {
        icon: 'terminal',
        title: 'Pacman',
        text: 'Für Arch Linux und CachyOS. Getestet mit echtem pacman auf beiden Systemen.',
      },
      {
        icon: 'hash',
        title: 'Speicher nach Inhalt',
        text: 'Jede Datei liegt unter ihrer SHA-256-Prüfsumme. Gleicher Inhalt belegt nur einmal Platz, auch aus verschiedenen Paketquellen.',
      },
      {
        icon: 'activity',
        title: 'Live-Dashboard',
        text: 'Jede Anfrage als HIT oder MISS, aktive Downloads und Clients, gesparte Datenmenge und belegter Speicher.',
      },
      {
        icon: 'hard-drive',
        title: 'Speicherverwaltung',
        text: 'Cachegröße, Bandbreitengrenzen und Regeln im Dashboard ändern, sofort wirksam ohne Neustart. Dateien anheften, löschen und prüfen.',
      },
      {
        icon: 'refresh',
        title: 'Abbrüche werden fortgesetzt',
        text: 'Ein unterbrochener Download wird an der richtigen Stelle fortgesetzt, statt von vorn zu beginnen.',
      },
      {
        icon: 'shuffle',
        title: 'Mirror-Fallback',
        text: 'Fällt ein Mirror aus, wird der nächste konfigurierte Mirror genommen. Ohne Internet bleibt alles Gespeicherte installierbar.',
      },
      {
        icon: 'shield',
        title: 'Signaturen bleiben unberührt',
        text: 'Pakete werden Byte für Byte durchgereicht. apt und pacman prüfen weiter selbst mit ihren eigenen Schlüsseln. Kein TLS-Aufbrechen, kein Zertifikat auf den Clients.',
      },
      {
        icon: 'home',
        title: 'Self-hosted',
        text: 'Läuft auf deiner eigenen Hardware, zum Beispiel in einem Proxmox LXC. Keine Cloud, kein Konto bei einem Anbieter.',
      },
      {
        icon: 'feather',
        title: 'Geringer Ressourcenbedarf',
        text: 'Im Test rund 13 MB Arbeitsspeicher im Leerlauf und ein Container-Image von etwa 15 MB. Ein einzelnes statisches Programm.',
      },
      {
        icon: 'languages',
        title: 'Deutsch und Englisch',
        text: 'Das Dashboard spricht beide Sprachen. Umschalten oben rechts.',
      },
    ],
    plannedTitle: 'Geplant, noch nicht gebaut',
    plannedText:
      'Diese Formate stehen auf der Roadmap. Sie funktionieren heute noch nicht und werden erst angekündigt, wenn sie mit echten Clients getestet sind.',
    planned: ['Container-Images', 'npm', 'PyPI', 'RPM', 'Maven', 'Spiele-Downloads', 'Windows-Updates'],
    experimental: 'Einfache HTTP-Dateiserver: experimentell, bisher nur gegen Testserver geprüft.',
    roadmap: 'Zur Roadmap',
  },
  how: {
    label: 'So funktioniert es',
    title: 'Vom Internet einmal. Aus dem LAN beliebig oft.',
    lead: 'Die Rechner werden bewusst auf den Cache gezeigt, mit einer Zeile in ihrer Paketquelle. Danach läuft alles von selbst.',
    steps: [
      {
        title: 'Anfrage',
        text: 'Ein Rechner im LAN fragt über apt oder pacman nach einem Paket.',
      },
      {
        title: 'Nachsehen',
        text: 'Cache & Carry prüft, ob die Datei schon auf der eigenen Platte liegt.',
      },
      {
        title: 'MISS: einmal laden',
        text: 'Liegt sie noch nicht vor, wird sie vom konfigurierten Mirror geladen. Genau ein Download, auch bei vielen gleichzeitigen Anfragen.',
      },
      {
        title: 'Gleichzeitig ausliefern',
        text: 'Alle wartenden Rechner bekommen die Datei schon, während sie noch ankommt.',
      },
      {
        title: 'Sicher ablegen',
        text: 'Beim Laden wird die SHA-256-Prüfsumme berechnet. Erst die vollständige Datei wird in einem Schritt an ihren festen Platz gelegt.',
      },
      {
        title: 'HIT: aus dem LAN',
        text: 'Jeder weitere Rechner bekommt die Datei direkt aus dem lokalen Netzwerk.',
      },
    ],
    glossaryTitle: 'Die Begriffe kurz erklärt',
    glossary: [
      {
        term: 'HIT',
        text: 'Die Datei lag schon im Cache und kommt aus deinem Netzwerk.',
      },
      {
        term: 'MISS',
        text: 'Die Datei war noch nicht da und wurde einmal aus dem Internet geholt.',
      },
      {
        term: 'SHA-256',
        text: 'Eine Prüfsumme über den Inhalt einer Datei. Gleicher Inhalt ergibt immer dieselbe Summe, darum wird er nur einmal gespeichert.',
      },
      {
        term: 'LAN-Cache',
        text: 'Ein Zwischenspeicher in deinem lokalen Netzwerk, nah an den Rechnern, die ihn nutzen.',
      },
      {
        term: 'Upstream-Mirror',
        text: 'Der öffentliche Server, von dem die Pakete ursprünglich kommen, zum Beispiel deb.debian.org.',
      },
      {
        term: 'Paketmanager',
        text: 'Das Programm, das Software installiert und aktualisiert: apt unter Debian und Ubuntu, pacman unter Arch Linux und CachyOS.',
      },
    ],
    diagramLabel:
      'Ablauf: Drei Rechner fragen dasselbe Paket an. Cache & Carry lädt es einmal vom Mirror und liefert es an alle drei.',
    clients: ['Debian', 'Arch Linux', 'Ubuntu'],
  },
  bench: {
    label: 'Beispielmessung',
    title: 'Vom Internettempo zum LAN-Tempo.',
    lead: 'Ein Paketindex von 8,6 MiB (extra.db von Arch Linux) im Testnetzwerk des Projekts, einmal aus dem Internet und einmal aus dem Cache.',
    internet: 'Aus dem Internet',
    cache: 'Aus dem Cache',
    disclaimer:
      'Eine einzelne Messung aus dem dokumentierten Testnetzwerk, keine Garantie. Wie schnell es bei dir wird, hängt von Netz, Platte und Rechnern ab.',
    source: 'Quelle: README des Projekts',
  },
  shots: {
    label: 'Screenshots',
    title: 'Das Dashboard, so wie es ist.',
    lead: 'Echte Screenshots der Software mit Daten aus dem Testnetzwerk. Keine Live-Anzeige.',
    tabsLabel: 'Ansicht wählen',
    zoom: 'Größer anzeigen',
    close: 'Schließen',
    note: 'Screenshot',
    items: {
      dashboard: {
        tab: 'Dashboard',
        caption: 'Trefferquote, gesparte Bandbreite, Speicher und Durchsatz auf einen Blick.',
        alt: 'Dashboard von Cache & Carry mit Kennzahlen zu Trefferquote, Speicher, Bandbreite und einem Durchsatzdiagramm.',
      },
      liveTraffic: {
        tab: 'Live-Verkehr',
        caption: 'Jede Anfrage erscheint sofort. MISS kam aus dem Internet, HIT von der eigenen Platte.',
        alt: 'Liste der Anfragen mit HIT und MISS, Paketnamen, Clients und Übertragungszeiten.',
      },
      downloads: {
        tab: 'Ein Download für alle',
        caption: 'Zwei Rechner fragen gleichzeitig nach derselben Datei. Es läuft nur ein Download.',
        alt: 'Aktiver Download, der gleichzeitig an zwei Clients ausgeliefert wird.',
      },
      storage: {
        tab: 'Speicher',
        caption: 'Was liegt im Cache, wie viel Platz es belegt, was angeheftet ist.',
        alt: 'Speicherübersicht mit belegtem Platz, Objekten und Werkzeugen zum Anheften, Löschen und Prüfen.',
      },
      modules: {
        tab: 'Client-Konfiguration',
        caption: 'Das Dashboard zeigt die passenden Zeilen für jede Paketquelle zum Kopieren.',
        alt: 'Cache-Module für APT und Pacman mit fertigen Konfigurationszeilen für die Clients.',
      },
      clients: {
        tab: 'Clients',
        caption: 'Welche Rechner den Cache nutzen und wie viel sie geladen haben.',
        alt: 'Tabelle der Clients im Netzwerk mit Anfragen und übertragener Datenmenge.',
      },
      settings: {
        tab: 'Einstellungen',
        caption: 'Cachegröße, Grenzen und Regeln, sofort wirksam ohne Neustart.',
        alt: 'Einstellungsseite mit Cachegröße, Bandbreitengrenzen und weiteren Optionen.',
      },
    } satisfies Record<ShotKey, { tab: string; caption: string; alt: string }>,
  },
  videos: {
    label: 'Videoanleitungen',
    title: 'Schritt für Schritt im Video.',
    lead: 'Anleitungen zu Installation, Proxmox, Docker und der Einrichtung der Clients erscheinen nach und nach auf YouTube.',
    emptyTitle: 'Die ersten Videoanleitungen erscheinen in Kürze.',
    emptyText:
      'Sobald ein Video veröffentlicht ist, erscheint es hier. Bis dahin hilft die Anleitung auf GitHub weiter.',
    emptyPlanned: 'Geplante Themen',
    soon: 'In Vorbereitung',
    channel: 'YouTube-Kanal von LOOP OUT TECH',
    play: 'Video abspielen',
    playNote:
      'Beim Abspielen wird ein Video von YouTube (youtube-nocookie.com) geladen. Vorher wird nichts von YouTube geladen.',
    onYoutube: 'Auf YouTube ansehen',
    language: { de: 'Deutsch', en: 'Englisch' },
    categories: {
      installation: 'Installation',
      proxmox: 'Proxmox',
      docker: 'Docker',
      'debian-ubuntu': 'Debian und Ubuntu',
      'arch-cachyos': 'Arch Linux und CachyOS',
      apt: 'APT-Konfiguration',
      pacman: 'Pacman-Konfiguration',
      dashboard: 'Dashboard',
      troubleshooting: 'Fehlersuche',
      maintenance: 'Updates und Wartung',
      overview: 'Überblick',
    },
    plannedTopics: ['Installation', 'Proxmox', 'Docker', 'APT-Konfiguration', 'Pacman-Konfiguration', 'Dashboard'],
  },
  install: {
    label: 'Jetzt loslegen',
    title: 'In ein paar Minuten startklar.',
    lead: 'Ein unprivilegierter Proxmox LXC mit 2 Kernen und 1 GB Arbeitsspeicher reicht dicke. Alle Befehle stammen aus der Anleitung im Repository.',
    tabsLabel: 'Installationsweg wählen',
    methods: {
      release: {
        tab: 'Proxmox LXC, Debian, Ubuntu',
        title: 'Mit dem Release-Paket',
        text: 'Lade das Paket für deinen Rechner aus dem neuesten Release: amd64 für normale PCs und Server, arm64 zum Beispiel für einen Raspberry Pi. Dann entpacken und installieren:',
        after:
          'Danach im Browser http://<adresse>:8080 öffnen und ein Konto anlegen. Die Einrichtung fragt nach einem Einmal-Token, das zeigt dieser Befehl auf dem Server:',
        verified: 'Getestet in einem unprivilegierten Debian-13-Container auf Proxmox VE 9.2.',
        download: 'Neuestes Release herunterladen',
      },
      docker: {
        tab: 'Docker Compose',
        title: 'Mit Docker Compose',
        text: 'Repository klonen, Beispielkonfiguration kopieren, starten. In der Datei .env das Administratorpasswort setzen, mindestens 10 Zeichen.',
        verified:
          'Das Image wurde mit den Compose-Härtungsoptionen gebaut und betrieben. Ein vollständiger Lauf von docker compose up steht noch aus, siehe TODO.md.',
      },
      source: {
        tab: 'Selbst bauen',
        title: 'Aus dem Quellcode',
        text: 'Baut das Dashboard und ein einzelnes statisches Programm. Das fertige Paket liegt danach in dist/.',
        verified:
          'Braucht Go 1.27 und Node.js 20 oder neuer auf dem Rechner, der baut. Auf dem Zielsystem nichts davon.',
      },
    },
    clientsTitle: 'Rechner auf den Cache zeigen',
    clientsText: 'Eine Zeile pro Paketquelle. Das Dashboard zeigt die passenden Zeilen auch selbst an.',
    archCaption: 'Arch Linux: erste Zeile in /etc/pacman.d/mirrorlist',
    debianCaption: 'Debian 13: /etc/apt/sources.list.d/debian.sources',
    reqTitle: 'Voraussetzungen',
    reqBinaryTitle: 'Release-Paket',
    reqBinary: [
      'Linux auf amd64 oder arm64',
      'systemd für den Dienst',
      'Mindestens 1 Kern und 256 MB RAM, bequem mit 2 Kernen und 1 GB',
      'Platz für den Cache plus 10 % frei',
    ],
    reqDockerTitle: 'Docker',
    reqDocker: ['Docker mit Docker Compose v2', 'Ein Verzeichnis oder Volume für den Cache'],
    reqSourceTitle: 'Selbst bauen',
    reqSource: ['Go 1.27', 'Node.js 20 oder neuer', 'make'],
    warn: 'Nur im eigenen LAN betreiben. Den Port nicht ins Internet freigeben.',
    docsDeployment: 'Vollständige Anleitung',
    docsClients: 'Alle Client-Konfigurationen',
    docsTroubleshooting: 'Fehlersuche',
  },
  open: {
    label: 'Open Source',
    title: 'Offen gebaut. Für dein Netzwerk gemacht.',
    lead: 'Der gesamte Quellcode liegt auf GitHub. Du kannst ihn prüfen, Cache & Carry selbst betreiben und an der Weiterentwicklung mitwirken.',
    cta: 'Zum Quellcode auf GitHub',
    license: 'Apache License 2.0',
    licenseText: 'Frei nutzbar, auch kommerziell. Mit Patentschutz für alle Beteiligten.',
    links: [
      {
        key: 'url',
        title: 'Quellcode',
        text: 'Go, React und die komplette Dokumentation',
      },
      {
        key: 'issues',
        title: 'Issues',
        text: 'Fehler melden und Wünsche äußern',
      },
      {
        key: 'contributing',
        title: 'Mitmachen',
        text: 'Entwicklungsumgebung und Regeln',
      },
      {
        key: 'security',
        title: 'Sicherheit',
        text: 'Bedrohungsmodell und Meldeweg',
      },
      { key: 'roadmap', title: 'Roadmap', text: 'Was als Nächstes kommt' },
      {
        key: 'releases',
        title: 'Releases',
        text: 'Alle Versionen mit Prüfsummen',
      },
    ],
    honest: 'Früher Stand. Was getestet ist und was nicht, steht ehrlich in TODO.md.',
  },
  donate: {
    label: 'Unterstützen',
    title: 'Open Source unterstützen',
    text: 'Cache & Carry ist freie Open-Source-Software. Wenn dir das Projekt gefällt und du seine Weiterentwicklung unterstützen möchtest, freuen wir uns über deine freiwillige Unterstützung.',
    button: 'Mit PayPal unterstützen',
    note: 'Freiwillig. Öffnet PayPal in einem neuen Tab. Cache & Carry bleibt so oder so kostenlos.',
    other: 'Auch ohne Geld hilfst du: mit einem Stern auf GitHub, einem Fehlerbericht oder indem du es weitererzählst.',
  },
  footer: {
    text: 'Selbst gehosteter Paketcache für APT und Pacman. Einmal laden, beliebig oft abholen.',
    project: 'Projekt',
    docs: 'Dokumentation',
    legal: 'Rechtliches',
    imprint: 'Impressum',
    privacy: 'Datenschutz',
    license: 'Apache 2.0 Lizenz',
    readme: 'README',
    deployment: 'Installation und Betrieb',
    clients: 'Client-Konfiguration',
    architecture: 'Architektur',
    tutorials: 'Videoanleitungen',
    by: 'Ein Projekt von',
    loopoutPage: 'Projektseite bei LOOP OUT TECH',
    privacyNote: 'Diese Website setzt keine Cookies und nutzt kein Tracking.',
    slogan: 'Download once. Carry it across your network.',
  },
  code: {
    copy: 'Kopieren',
    copied: 'Kopiert',
    copyLabel: 'In die Zwischenablage kopieren',
    failed: 'Kopieren fehlgeschlagen: Text markieren und von Hand kopieren.',
  },
  notFound: {
    title: 'Seite nicht gefunden',
    text: 'Diese Adresse gibt es nicht. Vielleicht hilft die Startseite weiter.',
    back: 'Zur Startseite',
  },
  choose: {
    enter: 'Auf Deutsch weiter',
    suggested: 'Vorschlag für deinen Browser',
  },
};

export type Copy = typeof de;

const en: Copy = {
  meta: {
    title: 'Cache & Carry · Package cache for your network · Open source',
    description:
      'Cache & Carry is a self-hosted package cache for APT and Pacman. Download once from the Internet, then serve every machine on your LAN. Open source under Apache 2.0.',
    ogAlt: 'Cache & Carry logo with the slogan: Download once, carry out as often as you like.',
    chooseTitle: 'Cache & Carry · Choose your language / Sprache wählen',
  },
  a11y: {
    skip: 'Skip to content',
    mainNav: 'Main navigation',
    home: 'Cache & Carry home',
    langSwitch: 'Diese Seite auf Deutsch',
    newTab: '(opens in a new tab)',
    menu: 'Menu',
    closeMenu: 'Close menu',
    footerNav: 'Footer',
  },
  nav: {
    overview: 'Overview',
    features: 'Features',
    how: 'How it works',
    screenshots: 'Screenshots',
    tutorials: 'Tutorials',
    install: 'Installation',
    docs: 'Docs',
    github: 'GitHub',
    support: 'Support',
  },
  hero: {
    eyebrow: 'Open source · Self-hosted · Linux',
    title: 'Cache & Carry',
    tagline: 'Your network. Your packages. Your cache.',
    lead: 'Cache & Carry keeps the Linux packages your machines download on your own network. Download once from the Internet, then serve every machine on your LAN.',
    ctaGithub: 'View on GitHub',
    ctaInstall: 'Start installing',
    license: 'Apache 2.0 · free for everyone',
    release: 'Latest version',
    diagramLabel:
      'Diagram: a package comes from the Internet into Cache & Carry once and goes from there to several Linux machines on the LAN.',
    diagramInternet: 'Internet',
    diagramMirror: 'Mirror',
    diagramCache: 'Cache & Carry',
    diagramLan: 'LAN',
    diagramOnce: 'fetched 1 ×',
    diagramNote: 'Schematic illustration, not live data',
  },
  facts: [
    {
      value: '959 → 9 ms',
      label: '8.6 MiB package index, example measurement',
    },
    { value: '1 download', label: 'no matter how many machines ask at once' },
    { value: 'about 13 MB', label: 'memory when idle, measured' },
    { value: 'APT + Pacman', label: 'tested with real clients' },
  ],
  features: {
    label: 'Features',
    title: 'Small, fast and honest.',
    lead: 'One binary, one storage folder, one dashboard. No database server, no Java, no Kubernetes.',
    nowTitle: 'Available today',
    items: [
      {
        icon: 'share',
        title: 'One download for everyone',
        text: 'When several machines ask for the same file at once, Cache & Carry fetches it only once. Every waiting machine is served while it is still arriving.',
      },
      {
        icon: 'package',
        title: 'APT',
        text: 'For Debian, Ubuntu and Proxmox. Tested with Debian 12 and 13, Ubuntu 26.04 and Proxmox VE 9.2.',
      },
      {
        icon: 'terminal',
        title: 'Pacman',
        text: 'For Arch Linux and CachyOS. Tested with real pacman on both.',
      },
      {
        icon: 'hash',
        title: 'Content addressed storage',
        text: 'Every file is stored under its SHA-256 hash. The same content takes space once, even when it comes from different repositories.',
      },
      {
        icon: 'activity',
        title: 'Live dashboard',
        text: 'Every request as HIT or MISS, active downloads and clients, saved bandwidth and used storage.',
      },
      {
        icon: 'hard-drive',
        title: 'Storage management',
        text: 'Change cache size, bandwidth limits and policies in the dashboard, effective at once without a restart. Pin, delete and verify files.',
      },
      {
        icon: 'refresh',
        title: 'Resumed downloads',
        text: 'An interrupted download continues where it stopped instead of starting over.',
      },
      {
        icon: 'shuffle',
        title: 'Mirror fallback',
        text: 'If a mirror is down, the next configured mirror is used. Without Internet, everything already cached keeps installing.',
      },
      {
        icon: 'shield',
        title: 'Signatures stay intact',
        text: 'Packages pass through byte for byte. apt and pacman keep verifying them against their own keyrings. No TLS interception, no certificate on the clients.',
      },
      {
        icon: 'home',
        title: 'Self-hosted',
        text: 'Runs on your own hardware, for example in a Proxmox LXC. No cloud, no account with a provider.',
      },
      {
        icon: 'feather',
        title: 'Light on resources',
        text: 'In testing about 13 MB of memory when idle and a container image of about 15 MB. A single static binary.',
      },
      {
        icon: 'languages',
        title: 'English and German',
        text: 'The dashboard speaks both languages. Switch in the top right corner.',
      },
    ],
    plannedTitle: 'Planned, not built yet',
    plannedText:
      'These formats are on the roadmap. They do not work today and will only be announced once they are tested with real clients.',
    planned: ['Container images', 'npm', 'PyPI', 'RPM', 'Maven', 'Game downloads', 'Windows updates'],
    experimental: 'Plain HTTP file servers: experimental, so far checked against mock servers only.',
    roadmap: 'See the roadmap',
  },
  how: {
    label: 'How it works',
    title: 'From the Internet once. From your LAN as often as you like.',
    lead: 'Machines are pointed at the cache on purpose, with one line in their package sources. Everything after that happens on its own.',
    steps: [
      {
        title: 'Request',
        text: 'A machine on your LAN asks for a package through apt or pacman.',
      },
      {
        title: 'Look up',
        text: 'Cache & Carry checks whether the file is already on its own disk.',
      },
      {
        title: 'MISS: fetch once',
        text: 'If it is not there yet, it is fetched from the configured mirror. Exactly one download, even for many requests at once.',
      },
      {
        title: 'Serve while arriving',
        text: 'Every waiting machine receives the file while it is still coming in.',
      },
      {
        title: 'Store safely',
        text: 'The SHA-256 hash is computed while the file streams. Only the complete file is moved to its final place, in one atomic step.',
      },
      {
        title: 'HIT: from the LAN',
        text: 'Every further machine gets the file straight from your local network.',
      },
    ],
    glossaryTitle: 'The terms in brief',
    glossary: [
      {
        term: 'HIT',
        text: 'The file was already in the cache and comes from your own network.',
      },
      {
        term: 'MISS',
        text: 'The file was not there yet and was fetched once from the Internet.',
      },
      {
        term: 'SHA-256',
        text: 'A checksum over the content of a file. The same content always gives the same sum, so it is stored only once.',
      },
      {
        term: 'LAN cache',
        text: 'A store in your local network, close to the machines that use it.',
      },
      {
        term: 'Upstream mirror',
        text: 'The public server the packages originally come from, for example deb.debian.org.',
      },
      {
        term: 'Package manager',
        text: 'The program that installs and updates software: apt on Debian and Ubuntu, pacman on Arch Linux and CachyOS.',
      },
    ],
    diagramLabel:
      'Flow: three machines ask for the same package. Cache & Carry fetches it once from the mirror and serves all three.',
    clients: ['Debian', 'Arch Linux', 'Ubuntu'],
  },
  bench: {
    label: 'Example measurement',
    title: 'From Internet speed to LAN speed.',
    lead: 'An 8.6 MiB package index (Arch Linux extra.db) in the project test network, once from the Internet and once from the cache.',
    internet: 'From the Internet',
    cache: 'From the cache',
    disclaimer:
      'A single measurement from the documented test network, not a guarantee. How fast it gets for you depends on your network, disks and machines.',
    source: 'Source: the project README',
  },
  shots: {
    label: 'Screenshots',
    title: 'The dashboard, as it is.',
    lead: 'Real screenshots of the software with data from the test network. Not a live view.',
    tabsLabel: 'Choose a view',
    zoom: 'Show larger',
    close: 'Close',
    note: 'Screenshot',
    items: {
      dashboard: {
        tab: 'Dashboard',
        caption: 'Hit rate, saved bandwidth, storage and throughput at a glance.',
        alt: 'Cache & Carry dashboard with figures for hit rate, storage, bandwidth and a throughput chart.',
      },
      liveTraffic: {
        tab: 'Live traffic',
        caption: 'Every request shows up at once. MISS came from the Internet, HIT from your own disk.',
        alt: 'List of requests marked HIT and MISS with package names, clients and transfer times.',
      },
      downloads: {
        tab: 'One download for all',
        caption: 'Two machines ask for the same file at the same moment. Only one download runs.',
        alt: 'An active download being served to two clients at the same time.',
      },
      storage: {
        tab: 'Storage',
        caption: 'What is in the cache, how much space it takes, what is pinned.',
        alt: 'Storage overview with used space, objects and tools to pin, delete and verify.',
      },
      modules: {
        tab: 'Client setup',
        caption: 'The dashboard shows the matching lines for each repository, ready to copy.',
        alt: 'Cache modules for APT and Pacman with ready made configuration lines for the clients.',
      },
      clients: {
        tab: 'Clients',
        caption: 'Which machines use the cache and how much they have downloaded.',
        alt: 'Table of the clients on the network with requests and transferred data.',
      },
      settings: {
        tab: 'Settings',
        caption: 'Cache size, limits and policies, effective at once without a restart.',
        alt: 'Settings page with cache size, bandwidth limits and other options.',
      },
    },
  },
  videos: {
    label: 'Video tutorials',
    title: 'Step by step on video.',
    lead: 'Guides for installation, Proxmox, Docker and client setup will appear on YouTube one by one.',
    emptyTitle: 'The first video tutorials are coming soon.',
    emptyText: 'As soon as a video is published, it shows up here. Until then the guide on GitHub has you covered.',
    emptyPlanned: 'Planned topics',
    soon: 'In preparation',
    channel: 'LOOP OUT TECH on YouTube',
    play: 'Play video',
    playNote: 'Playing loads a video from YouTube (youtube-nocookie.com). Nothing is loaded from YouTube before that.',
    onYoutube: 'Watch on YouTube',
    language: { de: 'German', en: 'English' },
    categories: {
      installation: 'Installation',
      proxmox: 'Proxmox',
      docker: 'Docker',
      'debian-ubuntu': 'Debian and Ubuntu',
      'arch-cachyos': 'Arch Linux and CachyOS',
      apt: 'APT setup',
      pacman: 'Pacman setup',
      dashboard: 'Dashboard',
      troubleshooting: 'Troubleshooting',
      maintenance: 'Updates and maintenance',
      overview: 'Overview',
    },
    plannedTopics: ['Installation', 'Proxmox', 'Docker', 'APT setup', 'Pacman setup', 'Dashboard'],
  },
  install: {
    label: 'Get started',
    title: 'Up and running in a few minutes.',
    lead: 'An unprivileged Proxmox LXC with 2 cores and 1 GB of memory is plenty. Every command comes from the guide in the repository.',
    tabsLabel: 'Choose an installation method',
    methods: {
      release: {
        tab: 'Proxmox LXC, Debian, Ubuntu',
        title: 'With the release package',
        text: 'Download the package for your machine from the latest release: amd64 for normal PCs and servers, arm64 for a Raspberry Pi and similar. Then unpack and install:',
        after:
          'Then open http://<address>:8080 in your browser and create your account. Setup asks for a one-time token, which this command prints on the server:',
        verified: 'Tested in an unprivileged Debian 13 container on Proxmox VE 9.2.',
        download: 'Download the latest release',
      },
      docker: {
        tab: 'Docker Compose',
        title: 'With Docker Compose',
        text: 'Clone the repository, copy the example configuration, start. Set the administrator password in .env, at least 10 characters.',
        verified:
          'The image was built and run with the Compose hardening options. A full run of docker compose up is still open, see TODO.md.',
      },
      source: {
        tab: 'Build it yourself',
        title: 'From source',
        text: 'Builds the dashboard and a single static binary. The finished package ends up in dist/.',
        verified: 'Needs Go 1.27 and Node.js 20 or newer on the build machine. None of that on the target.',
      },
    },
    clientsTitle: 'Point a machine at it',
    clientsText: 'One line per repository. The dashboard shows the matching lines itself as well.',
    archCaption: 'Arch Linux: first line of /etc/pacman.d/mirrorlist',
    debianCaption: 'Debian 13: /etc/apt/sources.list.d/debian.sources',
    reqTitle: 'Requirements',
    reqBinaryTitle: 'Release package',
    reqBinary: [
      'Linux on amd64 or arm64',
      'systemd for the service',
      'At least 1 core and 256 MB RAM, comfortable with 2 cores and 1 GB',
      'Space for the cache plus 10 % free',
    ],
    reqDockerTitle: 'Docker',
    reqDocker: ['Docker with Docker Compose v2', 'A directory or volume for the cache'],
    reqSourceTitle: 'Build from source',
    reqSource: ['Go 1.27', 'Node.js 20 or newer', 'make'],
    warn: 'Run it on your own LAN only. Do not expose the port to the Internet.',
    docsDeployment: 'Full guide',
    docsClients: 'Every client configuration',
    docsTroubleshooting: 'Troubleshooting',
  },
  open: {
    label: 'Open source',
    title: 'Built in the open. Made for your network.',
    lead: 'All of the source code is on GitHub. You can read it, run Cache & Carry yourself and help shape what comes next.',
    cta: 'Explore the source code',
    license: 'Apache License 2.0',
    licenseText: 'Free to use, commercial use included. With a patent grant for everyone involved.',
    links: [
      {
        key: 'url',
        title: 'Source code',
        text: 'Go, React and the complete documentation',
      },
      {
        key: 'issues',
        title: 'Issues',
        text: 'Report bugs and ask for features',
      },
      {
        key: 'contributing',
        title: 'Contributing',
        text: 'Development setup and rules',
      },
      {
        key: 'security',
        title: 'Security',
        text: 'Threat model and how to report',
      },
      { key: 'roadmap', title: 'Roadmap', text: 'What comes next' },
      {
        key: 'releases',
        title: 'Releases',
        text: 'Every version with checksums',
      },
    ],
    honest: 'Early release. What is tested and what is not is listed honestly in TODO.md.',
  },
  donate: {
    label: 'Support',
    title: 'Support open source',
    text: 'Cache & Carry is free and open source software. If you like the project and want to support its development, we are glad about your voluntary support.',
    button: 'Support via PayPal',
    note: 'Voluntary. Opens PayPal in a new tab. Cache & Carry stays free either way.',
    other: 'You can help without money too: with a star on GitHub, a bug report or by telling others about it.',
  },
  footer: {
    text: 'Self-hosted package cache for APT and Pacman. Download once, carry out as often as you like.',
    project: 'Project',
    docs: 'Documentation',
    legal: 'Legal',
    imprint: 'Imprint',
    privacy: 'Privacy',
    license: 'Apache 2.0 license',
    readme: 'README',
    deployment: 'Install and operate',
    clients: 'Client setup',
    architecture: 'Architecture',
    tutorials: 'Video tutorials',
    by: 'A project by',
    loopoutPage: 'Project page at LOOP OUT TECH',
    privacyNote: 'This website sets no cookies and uses no tracking.',
    slogan: 'Download once. Carry it across your network.',
  },
  code: {
    copy: 'Copy',
    copied: 'Copied',
    copyLabel: 'Copy to clipboard',
    failed: 'Copy failed: select the text and copy it by hand.',
  },
  notFound: {
    title: 'Page not found',
    text: 'This address does not exist. The home page may help.',
    back: 'Back to the home page',
  },
  choose: {
    enter: 'Continue in English',
    suggested: 'Suggested for your browser',
  },
};

export const copy: Record<Locale, Copy> = { de, en };
export const t = (l: Locale): Copy => copy[l];

/** `/de/` for German, `/en/` for English. */
export const homePath = (l: Locale) => `/${l}/`;
