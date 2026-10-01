/* Lumen landing: motion, scroll choreography, mini-UIs */
(() => {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const GL = () => window.LUMEN && window.LUMEN.S;
  const setS = (k, v) => { const S = GL(); if (S) S[k] = v; };

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (!reduce) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = $(id); if (!el) return;
    e.preventDefault();
    lenis ? lenis.scrollTo(el, { offset: id === '#top' ? 0 : -20, duration: 1.6 }) : el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }));

  /* ---------- Nav: tint on scroll, hide on fast down-scroll ---------- */
  const nav = $('#nav');
  let lastY = 0;
  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle('scrolled', y > 40);
    nav.classList.toggle('hide', y > 600 && y > lastY + 4);
    if (y < lastY - 4) nav.classList.remove('hide');
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Render the WebGL scene only when a 3D section is on screen ---------- */
  const glSections = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => en.isIntersecting ? glSections.add(en.target) : glSections.delete(en.target));
    window.LUMEN && window.LUMEN.setActive(glSections.size > 0);
  }, { rootMargin: '10% 0px' });
  $$('[data-gl]').forEach((s) => io.observe(s));

  /* ---------- Live hero counter ---------- */
  const reqEl = $('#reqs');
  let reqs = 4812604113;
  setInterval(() => { reqs += Math.floor(40000 + Math.random() * 30000); reqEl.textContent = reqs.toLocaleString('en-US'); }, 700);

  /* ---------- Mini UI: latency sparkline ---------- */
  const latPts = Array.from({ length: 40 }, (_, i) => 38 + Math.sin(i * 0.6) * 4 + (Math.random() - 0.5) * 6);
  const latLine = $('#latLine'), latArea = $('#latArea'), latNum = $('#latNum');
  const drawLat = () => {
    const max = 60, min = 20, w = 400, h = 120;
    const pts = latPts.map((v, i) => [i / (latPts.length - 1) * w, h - (v - min) / (max - min) * h]);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2;
      d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    latLine.setAttribute('d', d);
    latArea.setAttribute('d', `${d} L${w},${h} L0,${h} Z`);
  };
  drawLat();
  setInterval(() => {
    const last = latPts[latPts.length - 1];
    latPts.shift();
    latPts.push(Math.max(30, Math.min(48, last + (Math.random() - 0.5) * 5 + (38 - last) * 0.25)));
    drawLat();
    latNum.innerHTML = `${Math.round(latPts[latPts.length - 1])}<small>ms</small>`;
  }, 900);

  /* ---------- Mini UI: autoscale bars ---------- */
  const bars = $('#bars');
  for (let i = 0; i < 22; i++) {
    const b = document.createElement('i');
    const h = 30 + Math.sin(i * 0.45) * 22 + i * 2.2 + Math.random() * 12;
    b.style.setProperty('--h', Math.min(100, h) + '%');
    b.style.setProperty('--d', (i * 0.08).toFixed(2) + 's');
    if (i > 15) b.className = 'hot';
    bars.appendChild(b);
  }

  /* ---------- Mini UI: toggles flip on a loop ---------- */
  const sws = $$('#toggles .sw');
  let swI = 0;
  setInterval(() => { sws[swI % sws.length].classList.toggle('on'); swI += 2; }, 1800);

  /* ---------- Mini UI: typed deploy ---------- */
  const codeEl = $('#codeType');
  const codeLines = [
    '<span class="c"># ship a model to the planet</span>',
    '<span class="k">$</span> lumen deploy <span class="s">qwen/Qwen3-32B</span> \\',
    '    --regions <span class="s">all</span> --min-warm <span class="s">2</span>',
    '',
    '<span class="g">✓</span> compiled for H200 · fp8',
    '<span class="g">✓</span> live in 42 regions · 1m 48s',
    '<span class="k">→</span> https://acme.lumen.run/v1',
  ];
  const typeCode = async () => {
    while (true) {
      codeEl.innerHTML = '';
      for (const line of codeLines) {
        const row = document.createElement('div');
        codeEl.appendChild(row);
        if (line.startsWith('<span class="g">') || line.startsWith('<span class="k">→')) {
          await new Promise((r) => setTimeout(r, 520));
          row.innerHTML = line;
          continue;
        }
        // type visible characters while preserving markup
        const tmp = document.createElement('div'); tmp.innerHTML = line;
        const text = tmp.textContent;
        for (let i = 0; i <= text.length; i++) {
          row.innerHTML = colorize(line, i) + '<span class="caret"></span>';
          await new Promise((r) => setTimeout(r, 26 + Math.random() * 30));
        }
        row.innerHTML = line;
      }
      codeEl.lastChild.innerHTML += ' <span class="caret"></span>';
      await new Promise((r) => setTimeout(r, 4200));
    }
  };
  // returns `line` markup truncated to n visible characters
  function colorize(html, n) {
    let out = '', count = 0, i = 0;
    while (i < html.length && count < n) {
      if (html[i] === '<') { const j = html.indexOf('>', i); out += html.slice(i, j + 1); i = j + 1; continue; }
      if (html[i] === '&') { const j = html.indexOf(';', i); out += html.slice(i, j + 1); i = j + 1; count++; continue; }
      out += html[i]; i++; count++;
    }
    const opens = (out.match(/<span/g) || []).length, closes = (out.match(/<\/span>/g) || []).length;
    return out + '</span>'.repeat(Math.max(0, opens - closes));
  }
  if (reduce) codeEl.innerHTML = codeLines.map((l) => `<div>${l}</div>`).join('');
  else new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { typeCode(); o.disconnect(); } }).observe(codeEl);

  /* ---------- Console chart ---------- */
  (() => {
    const svg = $('#trafficChart'); const W = 800, H = 170, N = 48;
    const series = [
      { c: '#5b6270', base: 30, amp: 16, ph: 2.2 },
      { c: '#ffb487', base: 52, amp: 22, ph: 0.9 },
      { c: '#ff6a2b', base: 70, amp: 26, ph: 0 },
    ];
    let stack = new Array(N).fill(0), html = '<defs>';
    series.forEach((s, k) => html += `<linearGradient id="tc${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.c}" stop-opacity=".55"/><stop offset="1" stop-color="${s.c}" stop-opacity=".04"/></linearGradient>`);
    html += '</defs>';
    for (let g = 1; g < 4; g++) html += `<line x1="0" x2="${W}" y1="${g * H / 4}" y2="${g * H / 4}" stroke="rgba(255,255,255,.05)"/>`;
    const layers = [];
    series.forEach((s, k) => {
      const prev = stack.slice();
      stack = stack.map((v, i) => v + Math.max(4, s.base * 0.5 + s.amp * (0.6 + 0.4 * Math.sin(i / N * Math.PI * 2 + s.ph)) * (0.55 + 0.45 * Math.sin(i / N * Math.PI)) + Math.random() * 5));
      layers.push({ s, k, top: stack.slice(), bot: prev });
    });
    const max = Math.max(...stack) * 1.08;
    const y = (v) => H - v / max * H, x = (i) => i / (N - 1) * W;
    layers.reverse().forEach(({ s, k, top, bot }) => {
      let d = `M0,${y(top[0])}`; top.forEach((v, i) => { if (i) d += ` L${x(i)},${y(v)}`; });
      for (let i = N - 1; i >= 0; i--) d += ` L${x(i)},${y(bot[i])}`;
      let l = `M0,${y(top[0])}`; top.forEach((v, i) => { if (i) l += ` L${x(i)},${y(v)}`; });
      html += `<path d="${d}Z" fill="url(#tc${k})"/><path d="${l}" fill="none" stroke="${s.c}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
    });
    svg.innerHTML = html;
  })();

  /* ---------- World map (dot matrix + arcs) ---------- */
  (() => {
    const svg = $('#worldMap'); const W = 600, H = 340;
    const land = (lat, lon) => {
      const v = Math.sin(lat * 2.1 + 0.6) * Math.cos(lon * 1.7 - 0.3) + 0.55 * Math.sin(lon * 3.3 + lat * 1.3) + 0.35 * Math.cos(lat * 5.1 - lon * 2.2);
      return v > 0.38 && Math.abs(lat) < 1.25;
    };
    let html = '';
    for (let gx = 0; gx < 60; gx++) for (let gy = 0; gy < 32; gy++) {
      const lon = (gx / 60) * Math.PI * 2 - Math.PI, lat = (0.5 - gy / 32) * Math.PI;
      const on = land(lat, lon);
      html += `<circle cx="${10 + gx * 9.8}" cy="${12 + gy * 10}" r="${on ? 1.9 : 1}" fill="rgba(255,255,255,${on ? 0.32 : 0.06})"/>`;
    }
    const hubs = [[140, 92], [300, 70], [330, 150], [470, 120], [520, 230], [190, 230], [400, 250]];
    const arcs = [[0, 1], [1, 3], [1, 2], [3, 4], [2, 6], [0, 5], [1, 6]];
    arcs.forEach(([a, b], i) => {
      const [x1, y1] = hubs[a], [x2, y2] = hubs[b];
      const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - Math.hypot(x2 - x1, y2 - y1) * 0.35;
      html += `<path d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" fill="none" stroke="url(#arcG)" stroke-width="1.4" stroke-dasharray="6 300" stroke-linecap="round">
        <animate attributeName="stroke-dashoffset" from="0" to="-306" dur="${2.4 + i * 0.3}s" repeatCount="indefinite"/></path>
        <path d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="1"/>`;
    });
    hubs.forEach(([x, y], i) => {
      html += `<circle class="pulse" cx="${x}" cy="${y}" r="7" fill="none" stroke="#ff6a2b" style="animation-delay:${i * 0.35}s"/>
        <circle cx="${x}" cy="${y}" r="3.5" fill="#ff8a4f"/>`;
    });
    svg.innerHTML = `<defs><linearGradient id="arcG"><stop stop-color="#fff"/><stop offset="1" stop-color="#ff6a2b"/></linearGradient></defs>${html}`;
  })();

  /* ---------- Testimonials ---------- */
  (() => {
    const Q = [
      ['We moved 14 models in a weekend. <b>p95 dropped from 410 ms to 62 ms</b> and our on-call rotation finally got quiet.', 'Priya Raman', 'Head of Infra, Vesper AI', '1494790108377-be9c29b29330', 1],
      ['The model router alone paid for Lumen. We send easy prompts to a small model and saved 48% in the first month.', 'Marcus Lee', 'CTO, Kite Labs', '1500648767791-00dcc994a43e'],
      ['I keep waiting for the cold start. It never comes.', 'Sofia Alvarez', 'Staff Engineer, Northwind', '1438761681033-6461ffad8d80'],
      ['Our users in Jakarta used to get 1.4 s first tokens. Now it is <b>under 90 ms.</b> Same model, same code.', 'Arif Hakim', 'Founder, Monogram', '1507003211169-0a1dd7228f2d'],
      ['Lumen is the first infra vendor our security team approved in one meeting. Zero retention by default helped.', 'Hannah Becker', 'VP Engineering, Helix', '1534528741775-53994a69daeb'],
      ['Black Friday traffic tripled and the dashboard just showed GPUs appearing in the right regions <b>ten minutes early.</b>', 'Tom Okafor', 'Platform Lead, Arcadia', '1506794778202-cad84cf45f1d', 1],
      ['Traces down to the prefill step. We found a 600-token system prompt that was costing us $9k a month.', 'Lena Novak', 'ML Engineer, Quanta', '1544005313-94ddf0286df2'],
      ['Switching was literally a base URL change. Our OpenAI client code did not notice.', 'Diego Castro', 'Engineer, parallel', '1472099645785-5658abf4ff4e'],
      ['Finally a bill I can explain to finance. Per token, per project, per region.', 'Mei Tanaka', 'COO, Vesper AI', '1517841905240-472988babdf9'],
    ];
    const card = ([p, n, r, img, big]) => `<figure class="quote${big ? ' big' : ''}"><p>${p}</p><footer><img src="https://images.unsplash.com/photo-${img}?w=80&h=80&fit=crop&crop=faces" alt="" loading="lazy"><div>${n}<span>${r}</span></div></footer></figure>`;
    const cols = $('#cols');
    [[0, 3, 6], [1, 4, 7], [2, 5, 8]].forEach((idx, c) => {
      const items = idx.map((i) => card(Q[i])).join('');
      cols.insertAdjacentHTML('beforeend', `<div class="col"><div class="col-track">${items}${items.replace(/<figure/g, '<figure aria-hidden="true"')}</div></div>`);
    });
  })();

  /* ---------- Pricing toggle ---------- */
  (() => {
    const tg = $('#billing'), knob = $('.knob', tg), btns = $$('button', tg), price = $('[data-m]');
    const place = (b) => { knob.style.width = b.offsetWidth + 'px'; knob.style.transform = `translateX(${b.offsetLeft - 4}px)`; };
    const o = { v: 480 };
    btns.forEach((b) => b.addEventListener('click', () => {
      btns.forEach((x) => { x.classList.toggle('act', x === b); x.setAttribute('aria-pressed', x === b); });
      place(b);
      const to = +price.dataset[b.dataset.period];
      gsap.to(o, { v: to, duration: reduce ? 0 : 0.7, ease: 'power3.out', onUpdate: () => price.textContent = '$' + Math.round(o.v) });
    }));
    document.fonts.ready.then(() => place(btns[0]));
    addEventListener('resize', () => place($('.act', tg)));
  })();

  /* ---------- FAQ ---------- */
  $$('.qa button').forEach((b) => b.addEventListener('click', () => {
    const qa = b.parentElement, open = !qa.classList.contains('open');
    $$('.qa').forEach((q) => { q.classList.remove('open'); $('button', q).setAttribute('aria-expanded', 'false'); });
    if (open) { qa.classList.add('open'); b.setAttribute('aria-expanded', 'true'); }
    setTimeout(() => ScrollTrigger.refresh(), 600);
  }));

  /* ---------- Cursor spotlight on cells, magnetic buttons ---------- */
  $$('.spot').forEach((c) => c.addEventListener('pointermove', (e) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--x', e.clientX - r.left + 'px'); c.style.setProperty('--y', e.clientY - r.top + 'px');
  }));
  if (fine && !reduce) $$('.magnetic').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.22, y: (e.clientY - r.top - r.height / 2) * 0.3, duration: 0.4, ease: 'power3.out' });
    });
    el.addEventListener('mouseleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'power3.out' }));
  });

  /* ---------- One-shot "in view" classes (ring, meter, terminal) ---------- */
  const inIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); inIO.unobserve(e.target); } }), { threshold: 0.35 });
  $$('.cell, #term').forEach((el) => inIO.observe(el));
  $$('#term .ln').forEach((l, i) => l.style.transitionDelay = (0.3 + i * 0.45) + 's');

  /* ---------- Template credit badge ---------- */
  const promo = $('#promo');
  if (promo) {
    let hidden = false;
    try { hidden = sessionStorage.getItem('lumen-promo') === '0'; } catch (e) {}
    if (!hidden) setTimeout(() => promo.classList.add('show'), 2600);
    $('.promo-x', promo).addEventListener('click', () => {
      promo.classList.add('gone');
      try { sessionStorage.setItem('lumen-promo', '0'); } catch (e) {}
    });
  }

  /* ---------- Spend counter ---------- */
  const spend = $('#spend');

  /* ---------- Morph section stage logic (shared by motion + reduced) ---------- */
  const stages = $$('.stage'), huds = $$('.hud .tag'), railNum = $('#railNum'), railBar = $('#railBar');
  let curStage = -1;
  const showStage = (i) => {
    if (i === curStage) return;
    const prev = curStage; curStage = i;
    railNum.textContent = String(i + 1).padStart(2, '0');
    stages.forEach((s, k) => {
      if (k === i) {
        s.classList.add('on');
        if (!reduce) gsap.fromTo(s.children, { y: 34, opacity: 0, filter: 'blur(8px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out', stagger: 0.06, overwrite: true });
      } else if (k === prev && !reduce) {
        gsap.to(s.children, { y: -24, opacity: 0, filter: 'blur(6px)', duration: 0.35, ease: 'power2.in', stagger: 0.02, overwrite: true, onComplete: () => s.classList.remove('on') });
      } else s.classList.remove('on');
    });
    huds.forEach((h) => {
      const on = +h.dataset.hud === i;
      gsap.to(h, { opacity: on ? 1 : 0, y: on ? 0 : 10, scale: on ? 1 : 0.96, duration: on ? 0.7 : 0.3, delay: on ? 0.35 + Math.random() * 0.3 : 0, ease: 'power3.out', overwrite: true });
    });
  };

  /* =================== MOTION =================== */
  const init = () => {
    if (reduce) {
      $$('[data-hero-fade]').forEach((e) => e.style.opacity = 1);
      $$('[data-count]').forEach((el) => el.textContent = (+el.dataset.count).toLocaleString('en-US', { maximumFractionDigits: +(el.dataset.dec || 0) }));
      showStage(0);
      return;
    }

    /* Hero entrance */
    const h1 = $('.hero h1');
    SplitText.create(h1, {
      type: 'words,lines', mask: 'lines', autoSplit: true,
      onSplit(self) {
        return gsap.from(self.words, { yPercent: 115, rotate: 4, opacity: 0, duration: 1.25, ease: 'expo.out', stagger: 0.075, delay: 0.25 });
      },
    });
    gsap.fromTo('[data-hero-fade]', { y: 26, opacity: 0, filter: 'blur(6px)' },
      { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'power3.out', stagger: 0.09, delay: 0.55, clearProps: 'filter' });
    gsap.from('.nav', { y: -30, opacity: 0, duration: 1, ease: 'power3.out', delay: 0.2 });
    const startIntro = () => window.LUMEN && window.LUMEN.intro && window.LUMEN.intro();
    window.LUMEN ? startIntro() : addEventListener('lumen:ready', startIntro, { once: true });

    /* Hero content parallax out */
    gsap.to('.hero-copy', { yPercent: -18, opacity: 0.0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 15%', scrub: true } });
    gsap.to('.telemetry', { y: -40, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '55% top', end: 'bottom top', scrub: true } });

    /* 3D choreography: write scroll progress into the scene */
    ScrollTrigger.create({ trigger: '.hero', start: 'top top', endTrigger: '.statement', end: 'bottom 70%', scrub: true, onUpdate: (s) => setS('hero', s.progress) });
    ScrollTrigger.create({ trigger: '.morph', start: 'top bottom', end: 'top top', onUpdate: (s) => setS('morphIn', s.progress) });
    ScrollTrigger.create({ trigger: '.cta', start: 'top bottom', end: 'top 15%', onUpdate: (s) => setS('cta', s.progress) });

    /* Pinned morph: halo -> globe -> fabric with holds between */
    const map = (p) => {
      // hold 0 | travel to 1 | hold 1 | travel to 2 | hold 2
      if (p < 0.14) return 0;
      if (p < 0.42) return (p - 0.14) / 0.28;
      if (p < 0.58) return 1;
      if (p < 0.86) return 1 + (p - 0.58) / 0.28;
      return 2;
    };
    ScrollTrigger.create({
      trigger: '.morph', start: 'top top', end: () => '+=' + innerHeight * 3.2, pin: true, scrub: true,
      onUpdate: (s) => {
        const m = map(s.progress);
        setS('morph', m);
        railBar.style.transform = `scaleX(${s.progress})`;
        showStage(m < 0.5 ? 0 : m < 1.5 ? 1 : 2);
      },
    });
    showStage(0);

    /* Statement: scroll-fill per line */
    SplitText.create('.fill-text', {
      type: 'lines', linesClass: 'line', autoSplit: true,
      onSplit(self) {
        return self.lines.map((l) => gsap.to(l, { backgroundPosition: '0% 0', ease: 'none',
          scrollTrigger: { trigger: l, start: 'top 82%', end: 'bottom 42%', scrub: true } }));
      },
    });
    gsap.from('.statement-foot', { opacity: 0, y: 20, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.statement-foot', start: 'top 90%' } });

    /* Section headings: line mask rise */
    $$('[data-split]').forEach((el) => SplitText.create(el, {
      type: 'lines', mask: 'lines', autoSplit: true,
      onSplit(self) {
        return gsap.from(self.lines, { yPercent: 105, duration: 1.15, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: el, start: 'top 86%' } });
      },
    }));
    $$('[data-reveal-one]').forEach((el) => gsap.from(el, { y: 24, opacity: 0, duration: 1, ease: 'power3.out', delay: 0.15, scrollTrigger: { trigger: el, start: 'top 88%' } }));
    $$('[data-reveal]').forEach((g) => gsap.fromTo(g.children, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.08, clearProps: 'transform,opacity', scrollTrigger: { trigger: g, start: 'top 84%' } }));
    gsap.from('.logos', { opacity: 0, y: 20, duration: 1.2, ease: 'power3.out', delay: 1.2 });

    /* Counters */
    $$('[data-count]').forEach((el) => {
      const end = +el.dataset.count, dec = +(el.dataset.dec || 0), o = { v: 0 };
      gsap.to(o, { v: end, duration: 2.2, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' },
        onUpdate: () => el.textContent = o.v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) });
    });
    const so = { v: 0 };
    gsap.to(so, { v: 6412, duration: 2.4, ease: 'power3.out', scrollTrigger: { trigger: spend, start: 'top 90%' }, onUpdate: () => spend.textContent = '$' + Math.round(so.v).toLocaleString('en-US') });

    /* Console: 3D tilt into place */
    gsap.fromTo('#mock', { rotateX: 32, scale: 0.86, y: 60 }, { rotateX: 0, scale: 1, y: 0, ease: 'none',
      scrollTrigger: { trigger: '.mock-stage', start: 'top 95%', end: 'top 25%', scrub: 0.6 } });
    gsap.from('.float', { opacity: 0, scale: 0.9, duration: 1, ease: 'power3.out', stagger: 0.2, scrollTrigger: { trigger: '.mock-stage', start: 'top 45%' } });

    /* Generic parallax */
    $$('[data-speed]').forEach((el) => gsap.to(el, { y: () => -80 * +el.dataset.speed, ease: 'none',
      scrollTrigger: { trigger: el.closest('section'), start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } }));

    /* Stacking cards */
    const cards = $$('.stack-card');
    cards.forEach((card, i) => {
      if (i === cards.length - 1) return;
      gsap.to(card, { scale: 0.93, filter: 'brightness(0.5)', ease: 'none',
        scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top 120px', scrub: true } });
    });
    cards.forEach((card) => gsap.from(card.querySelector('.visual'), { clipPath: 'inset(12% 12% 12% 12% round 20px)', opacity: 0.2, duration: 1.3, ease: 'expo.out',
      scrollTrigger: { trigger: card, start: 'top 75%' } }));

    /* CTA headline grows slightly as the core rises */
    gsap.fromTo('.cta h2', { scale: 0.92 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'top 20%', scrub: true } });

    /* Footer wordmark rises */
    gsap.from('.wordmark', { yPercent: 40, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });

    addEventListener('load', () => ScrollTrigger.refresh());
  };

  document.fonts.ready.then(init);
})();
