# Instagram reel for Cache & Carry

Final files are in this folder. The `video/` folder records the real
interface and renders the reel again with a few commands, locally and for
free.

## Make the video again

Requirements (present on this machine): Go, Node.js 20+, FFmpeg, Chromium,
pacman (for current package names in the demo traffic).

```sh
cd marketing/instagram/video
npm install                  # once
./demo.sh start              # demo instance on 127.0.0.1:18086 with neutral data
npm run capture              # record the interface (writes public/footage)
./demo.sh stop
./make-audio.sh              # soundtrack (only needed after changing timings)
npm run render               # renders and runs finish.sh: final, preview, thumbnail
```

`npm run studio` opens the Remotion editor with a live preview.

## Change something

| What | Where |
|---|---|
| Texts, subtitles, scene order | `video/src/Reel.tsx` (table `scenes` at the end) |
| Scene timing | `video/src/theme.ts` (`T`), then the whoosh times in `make-audio.sh` |
| Colours, fonts, safe zones | `video/src/theme.ts` |
| What gets recorded | `video/capture.mjs` (`shots`) |
| Positions of highlights | `video/measure.mjs` prints element boxes of the live interface |

## One prompt for the next video

Paste this into Claude Code in this repository:

> Make a new Instagram reel for Cache & Carry about **<topic, e.g. the new OCI
> adapter>**. Use the setup in `marketing/instagram/video` and the
> `web-demo-video` skill: start the demo instance, record the relevant pages
> with `capture.mjs`, adapt the scenes in `src/Reel.tsx`, keep 1080 x 1920,
> 30 fps, 25 to 35 seconds, English, no semicolons or dashes in on-screen
> text, only real features. Render with `npm run render`, check the result
> (streams, black borders, safe zones, loudness) and save it next to the
> existing files with a new name. Update storyboard and post text.

## Notes

- The recordings (`video/public/footage`, about 45 MB) and `video/out` are
  not in git. They are recreated by `npm run capture` and `npm run render`.
- The demo instance uses its own temporary data folder. It never touches a
  real installation.
