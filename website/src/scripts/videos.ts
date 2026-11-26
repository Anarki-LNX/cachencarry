// Click to load: the YouTube player (youtube-nocookie.com) is put into the page
// only after the visitor presses play. Before that nothing is requested from YouTube.
// Without JavaScript the play button is a normal link to the video on YouTube.

for (const media of document.querySelectorAll<HTMLElement>('[data-video]')) {
  const start = media.querySelector<HTMLAnchorElement>('[data-video-start]');
  const src = media.dataset.embed;
  if (!start || !src || !/^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}\?/.test(src)) continue;
  start.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const frame = document.createElement('iframe');
    frame.src = src;
    frame.title = media.dataset.title ?? 'YouTube';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.loading = 'eager';
    media.replaceChildren(frame);
    frame.focus();
  });
}
