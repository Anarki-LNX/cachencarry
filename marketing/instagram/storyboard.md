# Storyboard: Cache & Carry Instagram reel

Format 1080 x 1920 (9:16), 30 fps, 34 seconds, English. All interface shots are
real recordings of Cache & Carry 0.2.1 serving real Arch Linux and Debian
packages from a local demo instance with neutral addresses (10.0.10.x).

| Time | Scene | Picture | On-screen text | Subtitle |
|---|---|---|---|---|
| 0.0 to 3.0 s | Hook | Words fly in one by one on the dark brand background | Same update. Every machine. Downloaded again. And again. | |
| 3.0 to 7.5 s | Problem | Five Linux machines each pull the same 204 MiB package | THE PROBLEM. 5 machines. 5 downloads. 1 GiB of the same bytes | Every Linux box pulls the same packages from the Internet. |
| 7.5 to 10.0 s | Reveal | Logo springs in with a green glow | Cache & Carry. Download once. Carry out forever. | |
| 10.0 to 15.0 s | Solution | Live dashboard, camera pushes in. Highlights: hit ratio, then active downloads, then active clients | THE FIX. One cache for your whole LAN. | Cache & Carry keeps every package on your own network. |
| 15.0 to 20.5 s | Highlight 1 | Real Downloads page: blender for 3 waiting clients, firefox for 2. Highlights on "3 waiting clients" and the progress bar. Three client badges merge into one | LIVE. 3 machines. 1 download. 1 download for all 3 | Three machines want the same file. Only one download runs. |
| 20.5 to 24.0 s | Highlight 2 | Clients page, camera pushes in on the active status column | EVERY CLIENT. Who saved how much. | See every active client and what it saved. |
| 24.0 to 27.5 s | Highlight 3 | Live Traffic, the result column fills with HIT after MISS | EVERY REQUEST. MISS once. HIT forever. | The first fetch comes from the Internet. The rest come from your LAN. |
| 27.5 to 30.0 s | Proof | Counter runs from 959 down to 9 ms. Distribution chips | 8.6 MiB PACKAGE LIST. Internet: 959 ms. Your LAN: 9 ms. Arch, CachyOS, Debian, Ubuntu, Proxmox | Pacman and APT under one roof. |
| 30.0 to 34.0 s | Call to action | Logo, chips, shimmering GitHub button, credit | Free for everyone. Open source. Made for Linux homelabs. Star it on GitHub: github.com/Anarki-LNX/cachencarry. Install it. Share it. Make it better. Built with Claude Code · Claude Fable 5.2 | |

**Facts behind the numbers.** 959 ms and 9 ms are the measured times for the
8.6 MiB Arch `extra.db` in the first real client test (from the Internet and
from the cache). The 204 MiB file is the real size of the `blender` package.
The client counts on the Downloads page are what the server reported while
the recording ran.

**Sound.** A soft synthesized pad, whooshes on every scene change and low
impacts on the hook, the logo and the call to action. Loudness normalized to
-16 LUFS.
