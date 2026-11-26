import { describe, expect, it } from 'vitest';
import { DONATE_URL, donateUrl, isValidDonateUrl } from '~/config/site';
import { type Video, embedUrl, validateVideos, videos, watchUrl } from '~/data/videos';
import { copy } from '~/i18n';

describe('PayPal link', () => {
  it('accepts real PayPal addresses only', () => {
    expect(isValidDonateUrl('https://www.paypal.me/HenryMeinekat')).toBe(true);
    expect(isValidDonateUrl('https://paypal.com/donate/?hosted_button_id=ABC')).toBe(true);
    expect(isValidDonateUrl(null)).toBe(false);
    expect(isValidDonateUrl('')).toBe(false);
    expect(isValidDonateUrl('http://www.paypal.me/x')).toBe(false);
    expect(isValidDonateUrl('https://paypal.me.evil.example/x')).toBe(false);
    expect(isValidDonateUrl('https://www.paypal.me/')).toBe(false);
    expect(isValidDonateUrl('https://www.paypal.me/PLACEHOLDER')).toBe(false);
    expect(isValidDonateUrl('not a url')).toBe(false);
  });
  it('the configured link is the one the site shows', () => {
    expect(donateUrl).toBe(isValidDonateUrl(DONATE_URL) ? DONATE_URL : null);
  });
});

const sample: Video = {
  id: 'abcdefghijk',
  title: { de: 'Titel', en: 'Title' },
  description: { de: 'Text', en: 'Text' },
  category: 'installation',
  language: 'de',
  published: '2026-12-01',
  thumbnail: '/videos/abcdefghijk.jpg',
};

describe('videos', () => {
  it('lists no invented video', () => {
    expect(videos).toEqual([]);
  });
  it('accepts a complete entry and sorts newest first', () => {
    const older = {
      ...sample,
      id: 'zzzzzzzzzzz',
      published: '2026-11-01',
      thumbnail: '/videos/zzzzzzzzzzz.jpg',
    };
    expect(validateVideos([older, sample]).map((v) => v.id)).toEqual(['abcdefghijk', 'zzzzzzzzzzz']);
  });
  it('rejects broken entries', () => {
    expect(() => validateVideos([{ ...sample, id: 'short' }])).toThrow();
    expect(() => validateVideos([sample, sample])).toThrow();
    expect(() => validateVideos([{ ...sample, published: '1.12.2026' }])).toThrow();
    expect(() => validateVideos([{ ...sample, title: { de: '', en: 'x' } }])).toThrow();
    expect(() => validateVideos([{ ...sample, thumbnail: 'https://i.ytimg.com/x.jpg' }])).toThrow();
  });
  it('builds YouTube addresses from the id only', () => {
    expect(watchUrl('abcdefghijk')).toBe('https://www.youtube.com/watch?v=abcdefghijk');
    expect(embedUrl('abcdefghijk')).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/abcdefghijk\?/);
  });
});

describe('copy', () => {
  const walk = (v: unknown, path: string, out: string[]) => {
    if (typeof v === 'string') out.push(`${path}=${v}`);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`, out);
  };
  for (const lang of ['de', 'en'] as const) {
    it(`${lang}: no dashes as separators and no semicolons`, () => {
      const all: string[] = [];
      walk(copy[lang], lang, all);
      const bad = all.filter((s) => /[–—;]| - /.test(s.split('=').slice(1).join('=')));
      expect(bad).toEqual([]);
    });
  }
  it('both languages have the same keys', () => {
    const keys = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === 'object' && !Array.isArray(v) ? keys(v).map((x) => `${k}.${x}`) : [k],
      );
    expect(keys(copy.en).sort()).toEqual(keys(copy.de).sort());
  });
});
