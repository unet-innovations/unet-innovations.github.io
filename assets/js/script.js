(function () {
  const root = document.documentElement;
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Theme
  const storedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = storedTheme || 'light';
  root.setAttribute('data-theme', initialTheme);
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.setAttribute('aria-pressed', root.getAttribute('data-theme') === 'dark');
    themeBtn.addEventListener('click', () => {
      const cur = root.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      themeBtn.setAttribute('aria-pressed', next === 'dark');
    });
  }

  // Language
  const storedLang = localStorage.getItem('lang');
  const browserLang = ((navigator.language || 'en') + '').toLowerCase().startsWith('mn') ? 'mn' : 'en';
  const defaultLang = storedLang || 'mn';
  let i18n = {};
  function applyI18n(lang) {
    const dict = i18n[lang] || {};
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (dict[key]) el.innerHTML = dict[key];
    });
    localStorage.setItem('lang', lang);
    document.querySelectorAll('.lang .toggle').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang));
    // toggle lang-mn class for Mongolian font override
    document.documentElement.classList.toggle('lang-mn', lang === 'mn');
  }
  fetch('assets/i18n.json', { cache: 'no-store' })
    .then(r => r.json())
    .then(json => { i18n = json; applyI18n(defaultLang); })
    .catch(() => { });
  document.querySelectorAll('.lang .toggle').forEach(btn => {
    btn.addEventListener('click', () => applyI18n(btn.dataset.lang));
  });

  // Ticker from JSON
  const track = document.getElementById('tickerTrack');
  const periodEl = document.getElementById('tickerPeriod');
  if (track && periodEl) {
    fetch('assets/data/numbers.json', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const items = (data.items || []).map(it => `<b>${it.label}=${it.value}</b>`).join('');
        track.innerHTML = items + items; // duplicate for seamless scroll
        periodEl.textContent = data.period || '—';
      })
      .catch(() => { track.innerHTML = '<b>—</b>'; periodEl.textContent = '—'; });
  }

  // Scroll reveal
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target); } });
  }, { threshold: .06 });
  document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));

  // Count-up stats (index only)
  document.querySelectorAll('.stat .num').forEach(el => {
    const parent = el.closest('.stat');
    if (!parent) return;
    const o = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const end = parseInt(el.dataset.count, 10) || 0; let cur = 0; const dur = 1000; const start = performance.now();
          const step = (t) => { const p = Math.min(1, (t - start) / dur); cur = Math.floor(end * (0.2 + 0.8 * p)); el.textContent = cur.toLocaleString(); if (p < 1) requestAnimationFrame(step); };
          requestAnimationFrame(step); o.unobserve(parent);
        }
      });
    }, { threshold: .3 });
    o.observe(parent);
  });

  // Keyboard shortcut to Products
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); window.location.href = 'products.html';
    }
  });
})();