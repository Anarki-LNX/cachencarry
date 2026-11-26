// Video tutorials shown on the site. Only videos that are really published on YouTube
// belong here. How to add one: website/docs/VIDEOS.md.

export type VideoCategory =
  | 'installation'
  | 'proxmox'
  | 'docker'
  | 'debian-ubuntu'
  | 'arch-cachyos'
  | 'apt'
  | 'pacman'
  | 'dashboard'
  | 'troubleshooting'
  | 'maintenance'
  | 'overview';

export interface Video {
  /** The 11 character YouTube id, as in https://www.youtube.com/watch?v=<id> */
  id: string;
  title: { de: string; en: string };
  description: { de: string; en: string };
  category: VideoCategory;
  /** Spoken language of the video */
  language: 'de' | 'en';
  /** Publication date on YouTube, YYYY-MM-DD */
  published: string;
  /** Length as shown on YouTube, e.g. "5:32". Optional. */
  duration?: string;
  /** Local thumbnail under public/, e.g. "/videos/<id>.jpg". See docs/VIDEOS.md. */
  thumbnail: string;
}

export const videos: Video[] = [];

const ID = /^[A-Za-z0-9_-]{11}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Throws at build time when an entry is incomplete, so a broken card never ships. */
export function validateVideos(list: Video[]): Video[] {
  const seen = new Set<string>();
  for (const v of list) {
    if (!ID.test(v.id)) throw new Error(`videos.ts: "${v.id}" is not a YouTube video id`);
    if (seen.has(v.id)) throw new Error(`videos.ts: ${v.id} is listed twice`);
    seen.add(v.id);
    if (!DATE.test(v.published)) throw new Error(`videos.ts: ${v.id} needs published as YYYY-MM-DD`);
    if (!v.title.de || !v.title.en) throw new Error(`videos.ts: ${v.id} needs a German and an English title`);
    if (!v.thumbnail.startsWith('/videos/')) throw new Error(`videos.ts: ${v.id} thumbnail must be under /videos/`);
  }
  return [...list].sort((a, b) => b.published.localeCompare(a.published));
}

export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
/** Privacy-enhanced player, loaded only after a click. */
export const embedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
