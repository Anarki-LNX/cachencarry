// On the language choice page: mark the card for the language chosen on an
// earlier visit, otherwise the one that matches the browser. Never redirects.
let saved: string | null = null;
try {
  saved = localStorage.getItem('cc-lang');
} catch {
  // storage blocked
}
const pref = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase();
const match =
  saved === 'de' || saved === 'en' ? saved : pref.startsWith('de') ? 'de' : pref.startsWith('en') ? 'en' : null;
if (match) {
  const card = document.querySelector<HTMLElement>(`[data-lang-card="${match}"]`);
  if (card) {
    card.classList.add('is-suggested');
    card.querySelector<HTMLElement>('[data-lang-hint]')?.removeAttribute('hidden');
  }
}
