/* assets/js/feature.js
 * Initializes the right-split “futuristic” Chart.js card from /assets/data/feature1.json
 * Expects HTML structure:
 *
 * <div class="chart-card" id="feature1">
 *   <header class="chart-head">
 *     <h4 class="chart-title h3" data-i18n="features.section.1.chartTitle"></h4>
 *     <p class="chart-sub"    data-i18n="features.section.1.chartSubtitle"></p>
 *   </header>
 *   <div class="chart-canvas"><canvas id="chart-feature1"></canvas></div>
 *   <footer class="chart-foot">
 *     <small class="chart-src" data-i18n="features.section.1.source">Source: feature1.json</small>
 *   </footer>
 * </div>
 */

(function () {
    "use strict";

    // ------------------------------
    // Utilities
    // ------------------------------
    function getCSSVar(name, el = document.documentElement, fallback = "") {
        const v = getComputedStyle(el).getPropertyValue(name);
        return (v && v.trim()) || fallback;
    }

    // Parse any CSS color into {r,g,b}, using a throwaway element
    function parseColorToRGB(color) {
        // Fast path for rgb/rgba strings
        const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (rgbMatch) {
            return {
                r: +rgbMatch[1],
                g: +rgbMatch[2],
                b: +rgbMatch[3],
            };
        }
        // Hex (#RRGGBB or #RGB)
        const hex = color.replace("#", "").trim();
        if (/^[0-9a-f]{3}$/i.test(hex)) {
            const r = parseInt(hex[0] + hex[0], 16);
            const g = parseInt(hex[1] + hex[1], 16);
            const b = parseInt(hex[2] + hex[2], 16);
            return { r, g, b };
        }
        if (/^[0-9a-f]{6}$/i.test(hex)) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return { r, g, b };
        }
        // Fallback via DOM (handles named colors)
        const tmp = document.createElement("span");
        tmp.style.color = color;
        document.body.appendChild(tmp);
        const cs = getComputedStyle(tmp).color;
        document.body.removeChild(tmp);
        const m = cs.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (m) return { r: +m[1], g: +m[2], b: +m[3] };
        // default to white
        return { r: 255, g: 255, b: 255 };
    }

    // Find the first numeric series key in a JSON object (excluding known meta keys)
    function pickSeriesKey(obj) {
        const ignore = new Set(["date", "labels", "meta", "source"]);
        for (const k of Object.keys(obj)) {
            if (ignore.has(k)) continue;
            const v = obj[k];
            if (Array.isArray(v)) return k;
            if (v && typeof v === "object") return k;
        }
        return null;
    }

    // Normalize feature1.json shape to { labels: [], values: [] }
    function normalizeData(raw) {
        // Case 1: {date:{'1':'2023Q2',...}, seriesKey:{'1':6.6,...}}
        if (raw && raw.date && typeof raw.date === "object") {
            const order = Object.keys(raw.date).map(Number).sort((a, b) => a - b);
            const seriesKey = pickSeriesKey(raw) || "value";
            const labels = order.map((k) => String(raw.date[String(k) ?? k]));
            const values = order.map((k) => +raw[seriesKey][String(k) ?? k]);
            return { labels, values, seriesKey };
        }
        // Case 2: {labels:[...], values:[...]}
        if (Array.isArray(raw?.labels) && Array.isArray(raw?.values)) {
            return { labels: raw.labels, values: raw.values, seriesKey: "value" };
        }
        // Fallback: empty
        return { labels: [], values: [], seriesKey: "value" };
    }

    // Build a nice gradient fill using CSS accent color
    function gradientFill(ctx, area, accentColor) {
        const { r, g, b } = parseColorToRGB(accentColor);
        const grad = ctx.createLinearGradient(0, area.top, 0, area.bottom);
        grad.addColorStop(0, `rgba(${r},${g},${b},0.35)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0.00)`);
        return grad;
    }

    // Normalize feature5.json into arrays for yoy, upper, lower
    function normalizeFeature5(raw) {
        // order by numeric keys of date
        const order = Object.keys(raw.date).map(Number).sort((a, b) => a - b);
        const get = (obj, k) => obj[String(k) ?? k];
        const toNum = (v) => (v === null || v === "" || Number.isNaN(+v)) ? null : +v;

        const labels = order.map(k => String(get(raw.date, k)));
        const yoy = order.map(k => toNum(get(raw.gdp_yoy, k)));
        const upper = order.map(k => toNum(get(raw["ci95%_upper"], k)));
        const lower = order.map(k => toNum(get(raw["ci95%_lower"], k)));

        return { labels, yoy, upper, lower };
    }

    function rgba(color, alpha) {
        const { r, g, b } = parseColorToRGB(color);
        return `rgba(${r},${g},${b},${alpha})`;
    }


    // ------------------------------
    // Chart initialization
    // ------------------------------
    async function initFeatureCard({
        cardSelector = "#feature1",
        canvasSelector = "#chart-feature1",
        dataUrl = "assets/data/feature1.json",
    } = {}) {
        if (typeof Chart === "undefined") {
            console.warn("[feature.js] Chart.js is not loaded. Make sure /assets/js/chart.js is included before this file.");
            return;
        }

        const card = document.querySelector(cardSelector);
        const canvas = document.querySelector(canvasSelector);
        if (!card || !canvas) {
            console.warn("[feature.js] Chart card or canvas not found:", { cardSelector, canvasSelector });
            return;
        }

        // Load data
        let raw;
        try {
            const res = await fetch(dataUrl, { cache: "no-cache" });
            if (!res.ok) throw new Error(res.status + " " + res.statusText);
            raw = await res.json();
        } catch (err) {
            console.error("[feature.js] Failed to load data:", dataUrl, err);
            return;
        }

        // Optional: set title/subtitle/source from JSON meta if present
        const meta = raw.meta || {};
        const titleEl = card.querySelector(".chart-title");
        const subEl = card.querySelector(".chart-sub");
        const srcEl = card.querySelector(".chart-src");
        if (meta.title && titleEl && !titleEl.getAttribute("data-i18n")) titleEl.textContent = meta.title;
        if (meta.subtitle && subEl && !subEl.getAttribute("data-i18n")) subEl.textContent = meta.subtitle;
        if ((raw.source || meta.source) && srcEl && !srcEl.getAttribute("data-i18n")) {
            srcEl.textContent = `Source: ${raw.source || meta.source}`;
        }

        // Normalize series
        const { labels, values, seriesKey } = normalizeData(raw);

        // Colors from CSS
        const gridColor = getCSSVar("--chart-grid", document.documentElement, "rgba(127,127,127,0.15)");
        const accentA = getCSSVar("--chart-accent-a", document.documentElement) || "#8b5cf6";
        const ctx = canvas.getContext("2d");


        // Create chart
        const chart = new Chart(ctx, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "",
                        data: values,
                        borderColor: accentA,
                        borderWidth: 2,
                        fill: true,
                        backgroundColor: (c) => {
                            const area = c.chart.chartArea;
                            if (!area) return null;
                            return gradientFill(c.chart.ctx, area, accentA);
                        },
                        tension: 0.35,
                        pointRadius: 4.5,
                        pointHoverRadius: 6,
                        pointBackgroundColor: accentA,  // solid fill
                        pointBorderColor: accentA,
                        pointBorderWidth: 0,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // respects .chart-canvas fixed height
                animation: { duration: 500 },
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const v = ctx.raw;
                                // Show percentage if values look like percent; fallback to raw
                                const asPercent = typeof v === "number" && Math.abs(v) < 1000;
                                return ` ${ctx.dataset.label}: ${asPercent ? v.toFixed(2) + "%" : v}`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        grid: {
                            display: true,
                            color: gridColor,
                            drawBorder: false,
                            tickLength: 0,
                        },
                        ticks: {
                            autoSkip: false,                 // we decide which to show
                            maxTicksLimit: labels.length,    // safe upper bound
                            callback: function (val) {
                                const label = this.getLabelForValue(val);
                                const first = this.chart.data.labels[0];
                                const lbl = String(label || "");
                                const year = lbl.slice(0, 4);
                                if (lbl === first) return year;   // first label always shows year
                                if (/Q1$/.test(lbl)) return year; // only Q1s show year
                                return "";                        // hide others
                            },
                        }
                    },
                    y: {
                        grid: {
                            color: gridColor,
                            drawBorder: false,
                        },
                        ticks: {
                            callback: (v) => v + "%",
                        },
                    },
                },
            },
        });

        // Update chart on theme change (if your site toggles [data-theme])
        const root = document.documentElement;
        const obs = new MutationObserver(() => {
            const newGrid = getCSSVar("--chart-grid", root, gridColor);
            const newAccent = getCSSVar("--chart-accent-a", root, accentA);
            chart.data.datasets[0].borderColor = newAccent;
            chart.options.scales.x.grid.color = newGrid;
            chart.options.scales.y.grid.color = newGrid;
            chart.update();
        });
        obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    }

    async function initFeature5Card({
        cardSelector = "#feature5",
        canvasSelector = "#chart-feature5",
        dataUrl = "assets/data/feature5.json",
    } = {}) {
        if (typeof Chart === "undefined") return;

        const card = document.querySelector(cardSelector);
        const canvas = document.querySelector(canvasSelector);
        if (!card || !canvas) return;

        // Load
        let raw;
        try {
            const res = await fetch(dataUrl, { cache: "no-cache" });
            if (!res.ok) throw new Error(res.status + " " + res.statusText);
            raw = await res.json();
        } catch (e) {
            console.error("[feature.js] Failed to load", dataUrl, e);
            return;
        }

        const { labels, yoy, upper, lower } = normalizeFeature5(raw);
        const root = document.documentElement;

        // Colors (reuse your variables)
        const gridColor = getCSSVar("--chart-grid", root, "rgba(127,127,127,0.15)");
        const accentA = getCSSVar("--chart-accent-a", root) || "#8b5cf6"; // for CI lines
        const accentB = getCSSVar("--chart-accent-b", root) || "#1a9fff"; // main YoY line

        const ctx = canvas.getContext("2d");

        const chart = new Chart(ctx, {
            type: "line",
            data: {
                labels,
                datasets: [
                    // 0) CI Lower — dashed, squares, no fill
                    {
                        label: "CI 95% Lower",
                        data: lower,
                        borderColor: accentA,
                        borderWidth: 2,
                        borderDash: [2, 6],
                        fill: false,
                        backgroundColor: "transparent",
                        tension: 0,
                        pointStyle: "rect",
                        pointRadius: 3,
                        pointHoverRadius: 4,
                        pointBorderWidth: 0,
                        pointBackgroundColor: accentA,
                        pointBorderColor: accentA,
                        spanGaps: true,
                        order: 1
                    },

                    // 1) CI Upper — dashed, squares, **fills down to Lower (-1)** with a gradient
                    {
                        label: "CI 95% Upper",
                        data: upper,
                        borderColor: accentA,
                        borderWidth: 2,
                        borderDash: [2, 6],
                        // Fill to previous dataset (index -1) = CI Lower
                        fill: "-1",
                        backgroundColor: (ctx) => {
                            const area = ctx.chart.chartArea;
                            if (!area) return rgba(accentA, 0.12);
                            const g = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
                            // nice, subtle band — tweak alphas as you like
                            g.addColorStop(0, rgba(accentA, 0.18)); // top
                            g.addColorStop(1, rgba(accentA, 0.06)); // bottom
                            return g;
                        },
                        tension: 0,
                        pointStyle: "rect",
                        pointRadius: 3,
                        pointHoverRadius: 4,
                        pointBorderWidth: 0,
                        pointBackgroundColor: accentA,
                        pointBorderColor: accentA,
                        spanGaps: true,
                        order: 1
                    },

                    // 2) Main YoY line — solid, sits on top of the band
                    {
                        label: "GDP YoY",
                        data: yoy,
                        borderColor: accentA,
                        borderWidth: 2,
                        fill: false,                 // no area fill under YoY
                        backgroundColor: "transparent",
                        tension: 0.35,
                        pointRadius: 4.5,
                        pointHoverRadius: 6,
                        pointBackgroundColor: accentA,
                        pointBorderColor: accentA,
                        pointBorderWidth: 0,
                        order: 3
                    },
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.raw).toFixed(2)}%`
                        }
                    }
                },
                elements: {
                    line: { borderWidth: 2 },
                    point: { hoverBorderWidth: 0 }
                },
                scales: {
                    x: {
                        grid: { display: true, color: gridColor, drawBorder: false, tickLength: 0 },
                        ticks: {
                            autoSkip: false,
                            maxTicksLimit: labels.length,
                            callback: function (val) {
                                const label = this.getLabelForValue(val);
                                const first = this.chart.data.labels[0];
                                const lbl = String(label || "");
                                const year = lbl.slice(0, 4);
                                if (lbl === first) return year;    // first shows year
                                if (/Q1$/.test(lbl)) return year;  // Q1s show year
                                return "";                          // others hidden
                            }
                        }
                    },
                    y: {
                        grid: { color: gridColor, drawBorder: false },
                        ticks: { callback: (v) => v + "%" }
                    }
                }
            }
        });

        // Theme updates (if you toggle themes)
        const obs = new MutationObserver(() => {
            const newGrid = getCSSVar("--chart-grid", root, gridColor);
            const newA = getCSSVar("--chart-accent-a", root, accentA);
            const newB = getCSSVar("--chart-accent-b", root, accentB);

            const ds = chart.data.datasets;
            // YoY line
            ds[0].borderColor = newA;
            ds[0].pointBackgroundColor = newA;
            ds[0].pointBorderColor = newA;
            // CI lines
            ds[1].borderColor = newA; ds[1].pointBackgroundColor = newA; ds[1].pointBorderColor = newA;
            ds[2].borderColor = newA; ds[2].pointBackgroundColor = newA; ds[2].pointBorderColor = newA;

            chart.options.scales.x.grid.color = newGrid;
            chart.options.scales.y.grid.color = newGrid;
            chart.update();
        });
        obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    }

    // Initialize when DOM is ready
    function onReady(fn) {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", fn, { once: true });
        } else {
            fn();
        }
    }

    // ---------- Section 4: load values from /data/feature4.json and animate ----------
    function normalizeFeature4(raw) {
        const unit = (raw?.unit || "%").trim();

        // Your shape
        if (Array.isArray(raw?.accuracy)) {
            return raw.accuracy.slice(0, 3).map(item => ({
                label: item.label ?? "",
                value: Number(item.value ?? 0),
                unit
            }));
        }

        // Other supported shapes (kept for flexibility)
        if (Array.isArray(raw?.bars)) {
            return raw.bars.slice(0, 3).map(b => ({
                label: b.label ?? "",
                value: Number(b.value ?? 0),
                unit: b.unit ?? unit
            }));
        }
        if (Array.isArray(raw?.values)) {
            return raw.values.slice(0, 3).map((v, i) => ({
                label: raw.labels?.[i] ?? "",
                value: Number(v ?? 0),
                unit
            }));
        }
        const pref = ["accuracy", "recall", "uptime", "bar1", "bar2", "bar3"];
        const out = [];
        for (const k of pref) if (k in raw && typeof raw[k] === "number") out.push({ label: k, value: Number(raw[k]), unit });
        if (out.length >= 3) return out.slice(0, 3);

        return Object.entries(raw)
            .filter(([, v]) => typeof v === "number")
            .slice(0, 3)
            .map(([k, v]) => ({ label: k, value: Number(v), unit }));
    }

    function initFeature4BarsFromJSON({
        containerSelector = "#feature4-bars",
        dataUrl = "assets/data/feature4.json"
    } = {}) {
        const root = document.querySelector(containerSelector);
        if (!root) return;

        fetch(dataUrl, { cache: "no-cache" })
            .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
            .then(raw => {
                const items = normalizeFeature4(raw);
                const cards = root.querySelectorAll(".bar-card");

                cards.forEach((card, i) => {
                    const item = items[i];
                    if (!item) return;
                    const v = Math.max(0, Math.min(100, Number(item.value) || 0));
                    const unit = (item.unit || "%").trim();

                    // set label only if not i18n-bound
                    const lblEl = card.querySelector(".bar-label span");
                    if (lblEl && !lblEl.hasAttribute("data-i18n") && item.label) {
                        lblEl.textContent = item.label;
                    }

                    // update unit badge
                    const unitEl = card.querySelector(".bar-num .unit");
                    if (unitEl) unitEl.textContent = unit;

                    // animate value + width when visible
                    const fill = card.querySelector(".bar-fill");
                    const valueEl = card.querySelector(".bar-num .value");

                    const io = new IntersectionObserver((entries) => {
                        if (!entries[0].isIntersecting) return;
                        // width
                        requestAnimationFrame(() => { fill.style.width = v + "%"; });
                        // count up
                        const dur = 1000, start = performance.now();
                        function step(t) {
                            const p = Math.min(1, (t - start) / dur);
                            const n = v * p;
                            valueEl.textContent = (v % 1 !== 0 || v < 10) ? (n).toFixed(1) : Math.round(n).toString();
                            if (p < 1) requestAnimationFrame(step);
                        }
                        requestAnimationFrame(step);
                        io.disconnect();
                    }, { threshold: 0.25 });
                    io.observe(card);
                });
            })
            .catch(e => console.error("[feature.js] feature4.json load error:", e));
    }


    // ---------- Section 3 slider (feature3.json) ----------
    function getDomain(u) {
        try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ""; }
    }
    function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
    function fmtDate(s) {
        if (!s) return "";
        // keep YYYY-MM-DD if present; otherwise take first 10 chars
        const m = String(s).match(/\d{4}-\d{2}-\d{2}/);
        return m ? m[0] : String(s).slice(0, 10);
    }
    function summarize(text, maxChars = 240) {
        if (!text) return "";
        const t = String(text).replace(/\s+/g, ' ').trim();
        if (t.length <= maxChars) return t;
        // try cut on sentence end
        const cut = t.slice(0, maxChars);
        const lastDot = cut.lastIndexOf('。') > -1 ? cut.lastIndexOf('。')
            : cut.lastIndexOf('!') > -1 ? cut.lastIndexOf('!')
                : cut.lastIndexOf('…') > -1 ? cut.lastIndexOf('…')
                    : cut.lastIndexOf('.');
        if (lastDot > 80) return cut.slice(0, lastDot + 1);
        return cut.trim() + "…";
    }

    // If you already defined fetchFirstAvailable earlier, you can reuse it.
    // This is a tiny guarded version.
    async function fetchFirstAvailable(urls) {
        for (const u of urls) {
            try {
                const r = await fetch(u, { cache: "no-cache" });
                if (r.ok) return { json: await r.json(), url: u };
            } catch (e) { /* continue */ }
        }
        throw new Error("All paths failed");
    }

    function normalizeFeature3(raw) {
        // Expect an array of article-like objects
        // { title, url, date, score, headline (lede), text (body) }
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.articles)) return raw.articles;
        // Fallback: take values of object if they are arrays/objects
        return Object.values(raw || {});
    }

    function renderArticleHTML(a) {
        const title = a.title || a.headline || "Untitled";
        const url = a.url || "#";
        const date = fmtDate(a.date || "");
        const src = getDomain(url);
        const score = (a.score != null) ? Number(a.score).toFixed(2) : "";
        const lede = a.headline || a.summary || "";
        const body = a.text || "";

        return `
    <article class="article-card">
      <h4 class="art-title"><a href="${url}" target="_blank" rel="noopener">${title}</a></h4>
      <div class="art-meta">
        ${date ? "🕒 " + date + "<br />" : ""}
        ${src ? "🌐 " + src + "<br />" : ""}
        ${score ? "🧠 AI Score: " + score : ""}
      </div>
      ${lede ? `<div class="art-lede"><strong>📌 Хураангуй:</strong> ${summarize(lede, 400)}</div>` : ""}
      <div class="art-body">${summarize(body, 1500)}</div>
    </article>
  `;
    }

    function initFeature3Slider({
        containerSelector = "#feature3",
        dataUrlCandidates = [
            "assets/data/feature3.json",
            "./assets/data/feature3.json",
            "assets/data/feature3.json"
        ],
    } = {}) {
        const root = document.querySelector(containerSelector);
        if (!root) return;

        const win = root.querySelector(".article-window");
        const dotsEl = root.querySelector(".dots");
        const prevBtn = root.querySelector(".nav-btn.prev");
        const nextBtn = root.querySelector(".nav-btn.next");

        let items = [];
        let idx = 0;

        (async () => {
            let raw;
            try {
                const { json, url } = await fetchFirstAvailable(dataUrlCandidates);
                raw = json;
                console.log("[feature.js] feature3.json loaded from:", url);
            } catch (e) {
                console.error("[feature.js] feature3.json load error:", e.message);
                win.innerHTML = `<article class="article-card"><p style="padding:14px;">Failed to load articles.</p></article>`;
                return;
            }
            items = normalizeFeature3(raw);
            if (!Array.isArray(items) || !items.length) {
                win.innerHTML = `<article class="article-card"><p style="padding:14px;">No articles.</p></article>`;
                return;
            }
            // Build dots
            dotsEl.innerHTML = items.map((_, i) => `<span class="dot${i === 0 ? ' active' : ''}"></span>`).join("");
            render(idx);

            // Wire controls
            prevBtn.addEventListener("click", () => { go(-1); });
            nextBtn.addEventListener("click", () => { go(+1); });
            root.addEventListener("keydown", (e) => {
                if (e.key === "ArrowLeft") go(-1);
                if (e.key === "ArrowRight") go(+1);
            });
            // click dots
            dotsEl.addEventListener("click", (e) => {
                const i = Array.from(dotsEl.children).indexOf(e.target);
                if (i >= 0) set(i);
            });
        })();

        function set(i) {
            idx = clamp(i, 0, items.length - 1);
            render(idx);
        }
        function go(step) {
            set((idx + step + items.length) % items.length);
        }
        function render(i) {
            const a = items[i];
            win.innerHTML = renderArticleHTML(a);
            Array.from(dotsEl.children).forEach((d, di) => d.classList.toggle("active", di === i));
        }
    }



    // ===== Section 6: Logo -> Pane switcher =====
    function initFeature6Tools({ containerSelector = "#feature6-tools" } = {}) {
        const root = document.querySelector(containerSelector);
        if (!root) return;

        const buttons = Array.from(root.querySelectorAll('.tool-logos .tool'));
        const panes = {
            excel: root.querySelector('#tool-pane-excel'),
            ppt: root.querySelector('#tool-pane-ppt'),
            stata: root.querySelector('#tool-pane-stata'),
        };

        function show(which) {
            buttons.forEach(btn => btn.setAttribute('aria-selected', String(btn.dataset.tool === which)));
            Object.entries(panes).forEach(([k, el]) => {
                if (!el) return;
                el.hidden = (k !== which);
            });
        }

        root.addEventListener('click', (e) => {
            const btn = e.target.closest('.tool-logos .tool');
            if (!btn) return;
            show(btn.dataset.tool);
        });

        // Keyboard tabs
        root.addEventListener('keydown', (e) => {
            const idx = buttons.findIndex(b => b.getAttribute('aria-selected') === 'true');
            if (e.key === 'ArrowRight') { e.preventDefault(); buttons[(idx + 1) % buttons.length].click(); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); buttons[(idx - 1 + buttons.length) % buttons.length].click(); }
        });

        // default
        show('excel');
    }


    // ===== Section Top: Click Hyperlink =====
    function initFeatureJumpLinks() {
        const cards = Array.from(document.querySelectorAll('.container .grid .card')).slice(0, 6);
        const sections = Array.from(document.querySelectorAll('#feature-splits .split-item')).slice(0, 6);

        // Compute a good scroll offset from your header
        const header = document.querySelector('.site-header');
        const offset = (header?.offsetHeight || 80) + 12;
        sections.forEach((sec, i) => {
            if (!sec.id) sec.id = `sec-${i + 1}`;               // ensure an id exists
            sec.style.scrollMarginTop = offset + 'px';         // prevent header overlap
        });

        cards.forEach((card, i) => {
            const target = sections[i];
            if (!target) return;

            // overlay anchor makes the whole card clickable + accessible
            const a = document.createElement('a');
            a.className = 'card-overlay';
            a.href = `#${target.id}`;
            a.setAttribute('aria-label', `Jump to section ${i + 1}`);
            card.classList.add('is-link');
            card.appendChild(a);

            // smooth scroll (intercept default anchor jump)
            const go = () => target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            a.addEventListener('click', (e) => { e.preventDefault(); go(); });

            // keyboard support on the card
            card.tabIndex = 0;
            card.setAttribute('role', 'link');
            card.setAttribute('aria-controls', target.id);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
            });
        });
    }

    // Apply language-specific hrefs based on <html> state
    function applyLocalizedHrefs() {
        const html = document.documentElement;
        const isMN = html.classList.contains('lang-mn') || (html.getAttribute('lang') || '').startsWith('mn');

        document.querySelectorAll('a[data-href-en], a[data-href-mn]').forEach(a => {
            const en = a.dataset.hrefEn;
            const mn = a.dataset.hrefMn;
            const url = isMN ? (mn || en || '#') : (en || mn || '#');
            a.setAttribute('href', url);
            a.setAttribute('hreflang', isMN ? 'mn' : 'en');
        });
    }

    // Update automatically if your site toggles language by changing <html class> or lang=
    new MutationObserver(applyLocalizedHrefs)
        .observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'lang'] });

    onReady(applyLocalizedHrefs);
    onReady(() => {
        // Section 1 (already in your file)
        initFeatureCard({
            cardSelector: "#feature1",
            canvasSelector: "#chart-feature1",
            dataUrl: "assets/data/feature1.json",
        });

        // Section 5
        initFeature5Card({
            cardSelector: "#feature5",
            canvasSelector: "#chart-feature5",
            dataUrl: "assets/data/feature5.json",
        });

        initFeature4BarsFromJSON({
            containerSelector: "#feature4-bars",
            dataUrl: "assets/data/feature4.json"
        });

        initFeature3Slider({
            containerSelector: "#feature3",
            ledeMax: Infinity,
            bodyMax: Infinity
        });

        initFeature6Tools({ containerSelector: "#feature6-tools" });
        initFeatureJumpLinks();
    });

    // Expose a tiny API in case you want to init more cards later
    window.FeatureCharts = {
        initFeatureCard,
    };
})();
