# Cache & Carry website

The public project website for **cachencarry.loopout.tech**. It is separate from the
dashboard of the software itself (`web/`): nothing here is built into the binary, and
the website never talks to a Cache & Carry server.

Static site built with [Astro](https://astro.build), German and English, no cookies,
no tracking, no third party requests until a visitor presses play on a video.
The look follows loopout.tech (Geist, Geist Mono, Instrument Serif, self-hosted).

## Commands

Run inside `website/`. Node.js 22 or newer.

```sh
npm install
npm run dev              # development server on http://localhost:4321
npm run check            # type check of all .astro and .ts files
npm run build            # finished site in dist/ plus dist/build.json
npm run check:security   # checks dist/ against the CSP and the site rules
npm run preview          # serve dist/ locally
```

## Where things are

| Path                           | Content                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `src/config/site.ts`           | Every URL the site uses: repository, release, **PayPal link**, YouTube channel, LOOP OUT TECH imprint and privacy |
| `src/data/videos.ts`           | The video tutorials. Empty until a video is published                                                             |
| `src/i18n/index.ts`            | All text in German and English, one object per language with the same shape                                       |
| `src/pages/[lang]/index.astro` | The page, built once for `/de/` and once for `/en/`                                                               |
| `src/pages/index.astro`        | Language choice at `/` (no redirect, suggests the browser language)                                               |
| `src/components/`              | Sections: Hero, Features, HowItWorks, Benchmark, Screenshots, Videos, Install, OpenSource                         |
| `src/assets/screenshots/`      | Copies of `docs/screenshots/` from the repository, converted to AVIF and WebP at build time                       |
| `public/brand/`                | Logo and icons from `assets/brand/`                                                                               |
| `scripts/check-security.mjs`   | Fails the build check on inline scripts, outside resources, secrets, private addresses                            |
| `deploy/`                      | Upload with atomic switch, rollback, Caddy block. See [DEPLOYMENT.md](DEPLOYMENT.md)                              |

## Rules for the content

- Only what the repository backs up. Numbers come from `README.md` and `TODO.md` and
  are labelled as example measurements. Planned formats are shown as planned.
- No dashes as separators and no semicolons in visible text.
- Screenshots are real screenshots. When the dashboard changes, copy the new files from
  `docs/screenshots/` into `src/assets/screenshots/`.
- Install commands are copied from `README.md` and `DEPLOYMENT.md`. Change them there
  first, then in `src/components/Install.astro`. The release version is in
  `src/config/site.ts` (`RELEASE`).

## Adding a YouTube video

1. Publish the video on YouTube. Note its id: the 11 characters after `watch?v=`.
2. Save its thumbnail as a local file, so the page loads nothing from YouTube before a
   click:

   ```sh
   curl -fL -o public/videos/VIDEO_ID.jpg https://i.ytimg.com/vi/VIDEO_ID/maxresdefault.jpg
   ```

3. Add an entry to `src/data/videos.ts`:

   ```ts
   export const videos: Video[] = [
     {
       id: 'VIDEO_ID',
       title: {
         de: 'Installation im Proxmox LXC',
         en: 'Installing in a Proxmox LXC',
       },
       description: {
         de: 'Von der leeren Maschine bis zum ersten HIT.',
         en: 'From an empty machine to the first HIT.',
       },
       category: 'installation',
       language: 'de',
       published: '2026-12-01',
       duration: '5:32',
       thumbnail: '/videos/VIDEO_ID.jpg',
     },
   ];
   ```

4. `npm run build`. The build stops with a clear message if the id, date, titles or
   thumbnail path are wrong. The empty state disappears as soon as one video is listed.

Categories: `installation`, `proxmox`, `docker`, `debian-ubuntu`, `arch-cachyos`, `apt`,
`pacman`, `dashboard`, `troubleshooting`, `maintenance`, `overview`. Their names in both
languages are in `src/i18n/index.ts` under `videos.categories`.

The player is the privacy enhanced one (`youtube-nocookie.com`) and is only put into
the page after the visitor presses play. The Caddy CSP allows exactly this one frame
origin.

## The PayPal link

`DONATE_URL` in `src/config/site.ts`. It is the LOOP OUT TECH link that the NetSluice
website already uses (`https://www.paypal.me/HenryMeinekat`).

- The button is only shown when the value is an `https` address on `paypal.me` or
  `paypal.com` (`isValidDonateUrl`). Anything else, or `null`, hides the support section,
  the header button and the footer link everywhere.
- It is a plain link. No PayPal script is loaded on the site.

## License

Apache License 2.0, like the rest of the repository. Fonts: Geist and Geist Mono
(SIL Open Font License 1.1), Instrument Serif (SIL Open Font License 1.1), bundled
through `@fontsource`.
