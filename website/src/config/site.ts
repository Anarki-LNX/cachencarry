// Facts every part of the site shares. Change a link here, not in a page.
// Only URLs that really exist belong here (checked 2026-11-26).

export const SITE = {
  name: 'Cache & Carry',
  url: 'https://cachencarry.loopout.tech',
  /** Language of "/" in hreflang x-default and of the language choice page. */
  defaultLocale: 'de',
} as const;

const repo = 'https://github.com/Anarki-LNX/cachencarry';
export const REPO = {
  url: repo,
  issues: `${repo}/issues`,
  pulls: `${repo}/pulls`,
  releases: `${repo}/releases`,
  latestRelease: `${repo}/releases/latest`,
  license: `${repo}/blob/main/LICENSE`,
  notice: `${repo}/blob/main/NOTICE.md`,
  readme: `${repo}#readme`,
  deployment: `${repo}/blob/main/DEPLOYMENT.md`,
  clients: `${repo}/blob/main/docs/CLIENTS.md`,
  architecture: `${repo}/blob/main/ARCHITECTURE.md`,
  adapters: `${repo}/blob/main/ADAPTERS.md`,
  security: `${repo}/blob/main/SECURITY.md`,
  roadmap: `${repo}/blob/main/ROADMAP.md`,
  todo: `${repo}/blob/main/TODO.md`,
  contributing: `${repo}/blob/main/CONTRIBUTING.md`,
  troubleshooting: `${repo}/blob/main/docs/TROUBLESHOOTING.md`,
  api: `${repo}/blob/main/docs/API.md`,
} as const;

/** Newest release, as published on GitHub. Update with each release. */
export const RELEASE = {
  version: '0.2.3',
  date: '2026-11-27',
  url: `${repo}/releases/tag/v0.2.3`,
} as const;

/**
 * Donation link. The site shows the PayPal button only when this is a valid https URL
 * on paypal.me or paypal.com. Set it to null to hide the button everywhere.
 * Source: the same LOOP OUT TECH link the NetSluice website uses (netsluice.loopout.tech).
 */
export const DONATE_URL: string | null = 'https://www.paypal.me/HenryMeinekat';

/** The YouTube channel of LOOP OUT TECH. Null hides every link to it. */
export const YOUTUBE_CHANNEL: string | null = 'https://www.youtube.com/@loopouttech';

export const LOOPOUT = {
  home: 'https://loopout.tech',
  projectDe: 'https://loopout.tech/projekte/cachencarry',
  projectEn: 'https://loopout.tech/en/projects/cachencarry',
  imprint: 'https://loopout.tech/impressum',
  privacy: 'https://loopout.tech/datenschutz',
} as const;

/** True only for a real PayPal address. Used to decide whether the button is shown. */
export function isValidDonateUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      /^(?:www\.)?(?:paypal\.me|paypal\.com)$/.test(u.hostname) &&
      u.pathname.length > 1 &&
      !/placeholder|example|xxx/i.test(url)
    );
  } catch {
    return false;
  }
}

export const donateUrl: string | null = isValidDonateUrl(DONATE_URL) ? DONATE_URL : null;
