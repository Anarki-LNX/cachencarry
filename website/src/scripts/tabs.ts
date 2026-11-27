// Accessible tabs (WAI-ARIA tabs pattern) for every [data-tabs] block.
// Without JavaScript the tab list stays hidden and every panel is shown.
// Arrow keys, Home and End move between tabs. The chosen tab is remembered per
// block for this visit only (sessionStorage, wrapped in try/catch).

for (const root of document.querySelectorAll<HTMLElement>('[data-tabs]')) {
  const list = root.querySelector<HTMLElement>('[data-tablist]');
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-tab]'));
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls') ?? ''));
  if (!list || !tabs.length || panels.some((p) => !p)) continue;

  const key = root.dataset.tabsKey ? `tabs:${root.dataset.tabsKey}` : null;

  const select = (index: number, focus = false) => {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      const panel = panels[i];
      if (panel) panel.hidden = !on;
    });
    const current = tabs[index];
    if (focus) {
      current?.focus();
      current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    if (key) {
      try {
        sessionStorage.setItem(key, String(index));
      } catch {
        // storage blocked: nothing to remember
      }
    }
  };

  let start = 0;
  if (key) {
    try {
      const saved = Number(sessionStorage.getItem(key));
      if (Number.isInteger(saved) && saved >= 0 && saved < tabs.length) start = saved;
    } catch {
      // storage blocked
    }
  }

  list.hidden = false;
  root.classList.add('has-tabs');
  select(start);

  // Links elsewhere on the page (for example in the hero) can open a tab:
  // <a href="#install" data-tab-target="<tab id>">. The link still scrolls.
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[data-tab-target]')) {
    const i = tabs.findIndex((t) => t.id === link.dataset.tabTarget);
    if (i >= 0) link.addEventListener('click', () => select(i));
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i));
    tab.addEventListener('keydown', (e) => {
      let next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next >= 0) {
        e.preventDefault();
        select(next, true);
      }
    });
  });
}
