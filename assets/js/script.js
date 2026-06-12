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
  const defaultLang = storedLang === 'en' || storedLang === 'mn' ? storedLang : 'mn';
  let currentLang = defaultLang;
  const langBtn = document.getElementById('langToggle');
  let i18n = {};
  const pagePath = window.location.pathname.replace(/\/+$/, '') || '/';
  const pageKey = {
    '/': 'home',
    '/about': 'about',
    '/features': 'features',
    '/products': 'products',
    '/team': 'team'
  }[pagePath];
  function setMetaContent(selector, content) {
    const element = document.querySelector(selector);
    if (element && content) element.setAttribute('content', content);
  }
  function syncSeo(lang, dict) {
    if (!pageKey) return;
    const title = dict[`seo.${pageKey}.title`];
    const description = dict[`seo.${pageKey}.description`];
    if (title) document.title = title;
    setMetaContent('meta[name="description"]', description);
    setMetaContent('meta[property="og:site_name"]', 'Unet Innovations');
    setMetaContent('meta[property="og:title"]', title);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[name="twitter:title"]', title);
    setMetaContent('meta[name="twitter:description"]', description);
    setMetaContent('meta[property="og:locale"]', lang === 'mn' ? 'mn_MN' : 'en_US');
    setMetaContent('meta[property="og:locale:alternate"]', lang === 'mn' ? 'en_US' : 'mn_MN');
  }
  function syncLangButton(lang) {
    if (!langBtn) return;
    const isMn = lang === 'mn';
    const nextLang = isMn ? 'en' : 'mn';
    const nextLabel = nextLang.toUpperCase();
    const nextTitle = nextLang === 'en' ? 'English' : 'Mongolian';
    langBtn.textContent = nextLabel;
    langBtn.setAttribute('aria-pressed', 'false');
    langBtn.setAttribute('title', `Switch language to ${nextTitle}`);
    langBtn.setAttribute('aria-label', `Switch language to ${nextTitle}`);
  }
  function applyI18n(lang) {
    currentLang = lang;
    const dict = i18n[lang] || {};
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (dict[key]) el.innerHTML = dict[key];
    });
    syncSeo(lang, dict);
    localStorage.setItem('lang', lang);
    syncLangButton(lang);
    document.querySelectorAll('.lang .toggle').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang));
    // toggle lang-mn class for Mongolian font override
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.classList.toggle('lang-mn', lang === 'mn');
  }
  fetch('/assets/i18n.json', { cache: 'no-store' })
    .then(r => r.json())
    .then(json => { i18n = json; applyI18n(defaultLang); })
    .catch(() => { });
  document.querySelectorAll('.lang .toggle').forEach(btn => {
    btn.addEventListener('click', () => applyI18n(btn.dataset.lang));
  });
  if (langBtn) {
    syncLangButton(defaultLang);
    langBtn.addEventListener('click', () => {
      const nextLang = currentLang === 'mn' ? 'en' : 'mn';
      applyI18n(nextLang);
    });
  }

  // Ticker from JSON
  const track = document.getElementById('tickerTrack');
  const periodEl = document.getElementById('tickerPeriod');
  if (track && periodEl) {
    fetch('/assets/data/numbers.json', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const items = (data.items || []).map(it => `<b>${it.label}=${it.value}</b>`).join('');
        track.innerHTML = items + items; // duplicate for seamless scroll
        periodEl.textContent = data.period || '—';
      })
      .catch(() => { track.innerHTML = '<b>—</b>'; periodEl.textContent = '—'; });
  }

  // Partner logos (About)
  const partnerWrap = document.getElementById('partnerLogos');
  if (partnerWrap) {
    const allowedExt = ['svg', 'png', 'jpg', 'jpeg', 'webp'];
    const parseList = (list) => (list || [])
      .map(item => (item || '').split('/').pop())
      .filter(name => {
        const ext = name.split('.').pop().toLowerCase();
        return name && allowedExt.includes(ext);
      });
    const humanize = (file) => {
      const base = file.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
      if (!base) return 'Partner logo';
      return base.replace(/\b\w/g, c => c.toUpperCase());
    };
    const render = (files) => {
      const seen = new Set();
      partnerWrap.innerHTML = '';
      files.forEach(file => {
        const clean = file.split('/').pop();
        if (!clean || seen.has(clean)) return;
        seen.add(clean);
        const item = document.createElement('div');
        item.className = 'partner-logo';
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.src = `/assets/logos/${clean}`;
        img.alt = humanize(clean);
        item.appendChild(img);
        partnerWrap.appendChild(item);
      });
    };
    fetch('/assets/logos/manifest.json', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(manifest => {
        const list = Array.isArray(manifest) ? manifest : (manifest.logos || manifest.files || []);
        const files = parseList(list);
        if (files.length) {
          render(files);
          return;
        }
        return Promise.reject();
      })
      .catch(() => {
        // Fallback for hosts that don't serve JSON files correctly.
        fetch('/assets/logos/', { cache: 'no-store' })
          .then(r => r.ok ? r.text() : Promise.reject())
          .then(html => {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const hrefs = Array.from(doc.querySelectorAll('a')).map(a => a.getAttribute('href') || '');
            const files = parseList(hrefs);
            if (files.length) render(files);
          })
          .catch(() => { });
      });
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
