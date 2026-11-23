(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---------- Page log: real events, shown on the hero monitor ----------

  const logLines = [];
  const logListeners = [];
  const pad = (n) => String(n).padStart(2, '0');
  const clockTime = (d, seconds) => `${pad(d.getHours())}:${pad(d.getMinutes())}${seconds ? `:${pad(d.getSeconds())}` : ''}`;

  function syslog(tag, message, tone) {
    const line = { time: new Date(), tag, message, tone };
    logLines.push(line);
    if (logLines.length > 40) logLines.shift();
    logListeners.forEach((fn) => fn(line));
  }

  function logPageEvents() {
    window.addEventListener('load', () => {
      const nav = performance.getEntriesByType('navigation')[0];
      const status = nav && nav.responseStatus ? ` ${nav.responseStatus}` : '';
      syslog('http', `GET ${location.pathname}${status} · ${Math.round(nav ? nav.loadEventStart : performance.now())}ms`, 'ok');
    });
    document.fonts?.ready.then(() => syslog('fonts', 'Space Grotesk, JetBrains Mono ready'));
    document.addEventListener('visibilitychange', () => syslog('tab', document.hidden ? 'hidden' : 'visible'));
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (link) syslog('open', link.getAttribute('href'));
    });
  }

  // ---------- Background particle field ----------

  function startField() {
    const canvas = document.querySelector('.field');
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let dots = [];
    let raf = 0;
    const pointer = { x: -9999, y: -9999 };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(90, (width * height) / 16000));
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.2 + 0.4,
        hue: Math.random() < 0.7 ? '77, 243, 255' : '157, 123, 255',
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      const linkDist = 130;
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < linkDist) {
            ctx.strokeStyle = `rgba(122, 162, 255, ${0.12 * (1 - d / linkDist)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        const pd = Math.hypot(a.x - pointer.x, a.y - pointer.y);
        const near = pd < 160 ? 1 - pd / 160 : 0;
        ctx.fillStyle = `rgba(${a.hue}, ${0.45 + near * 0.5})`;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r + near * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function step() {
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < -10) d.x = width + 10;
        if (d.x > width + 10) d.x = -10;
        if (d.y < -10) d.y = height + 10;
        if (d.y > height + 10) d.y = -10;
      }
      draw();
      raf = requestAnimationFrame(step);
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    }, { passive: true });

    if (reduceMotion) {
      draw();
      window.addEventListener('resize', draw);
      return;
    }
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      raf = document.hidden ? 0 : requestAnimationFrame(step);
    });
    raf = requestAnimationFrame(step);
  }

  // ---------- Pointer spotlight and card glow ----------

  function trackPointer() {
    if (!finePointer) return;
    const root = document.documentElement;
    let frame = 0;
    let last = null;
    window.addEventListener('pointermove', (e) => {
      last = e;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty('--mx', `${last.clientX}px`);
        root.style.setProperty('--my', `${last.clientY}px`);
      });
    }, { passive: true });

    for (const card of document.querySelectorAll('.build')) {
      card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--y', `${e.clientY - rect.top}px`);
      });
    }
  }

  // ---------- Text scramble ----------

  const GLYPHS = '!<>-_\\/[]{}=+*^?#01';
  const DIGITS = '0123456789';

  function scramble(el, duration = 700) {
    const final = el.textContent;
    const pool = el.dataset.scramble === 'digits' ? DIGITS : GLYPHS;
    if (reduceMotion) return;
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const settled = Math.floor(t * final.length);
      let out = '';
      for (let i = 0; i < final.length; i++) {
        const ch = final[i];
        out += i < settled || ch === ' ' ? ch : pool[Math.floor(Math.random() * pool.length)];
      }
      el.textContent = out;
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = final;
    }
    requestAnimationFrame(frame);
  }

  // ---------- Hero boot sequence ----------

  function boot() {
    const hero = document.querySelector('.hero');
    const cmd = hero.querySelector('.boot-cmd');
    const readout = hero.querySelectorAll('.readout [data-scramble]');

    function finish() {
      hero.classList.add('is-booted');
      syslog('boot', 'whoami → Aaron Ding', 'ok');
      setTimeout(() => readout.forEach((el) => scramble(el, 900)), 550);
    }

    if (reduceMotion) {
      finish();
      return;
    }

    const text = cmd.dataset.type;
    cmd.textContent = '';
    let i = 0;
    setTimeout(function type() {
      cmd.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(type, 70 + Math.random() * 60);
      else setTimeout(finish, 280);
    }, 450);
  }

  // ---------- Scroll reveals ----------

  function reveals() {
    const targets = document.querySelectorAll('.reveal, .label [data-scramble]');
    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        io.unobserve(el);
        if (el.matches('[data-scramble]')) scramble(el);
        else el.classList.add('is-in');
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    targets.forEach((el) => io.observe(el));
  }

  // ---------- sf6 input log ----------

  function inputLog() {
    const log = document.querySelector('.console-log');
    if (!log || reduceMotion) return;
    const rows = [...log.children];
    let timer = 0;
    let running = false;

    function play() {
      rows.forEach((r) => r.classList.add('is-pending'));
      let i = 0;
      (function next() {
        if (!running) return;
        if (i < rows.length) {
          rows[i].classList.remove('is-pending');
          const pause = rows[i].matches('.is-hit, .is-miss') ? 1300 : 420;
          i++;
          timer = setTimeout(next, pause);
        } else {
          timer = setTimeout(play, 3200);
        }
      })();
    }

    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !running) {
        running = true;
        play();
      } else if (!entry.isIntersecting && running) {
        running = false;
        clearTimeout(timer);
        rows.forEach((r) => r.classList.remove('is-pending'));
      }
    }, { threshold: 0.3 }).observe(log);
  }

  // ---------- Maze: depth-first search with backtracking ----------

  function maze() {
    const canvas = document.querySelector('.maze-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const codeOut = document.querySelector('[data-maze-code]');
    const metaOut = document.querySelector('[data-maze-meta]');
    const locOut = document.querySelector('[data-trace-loc]');
    const stmtOut = document.querySelector('[data-trace-stmt]');
    const stateOut = document.querySelector('[data-trace-state]');
    const toggle = document.querySelector('[data-maze-toggle]');
    const toggleLabel = document.querySelector('[data-maze-toggle-label]');
    const stepButton = document.querySelector('[data-maze-step]');
    const announce = document.querySelector('[data-maze-announce]');

    const COLS = 47;
    const ROWS = 29;
    const OPEN = 0;
    const WALL = 1;
    const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

    let grid;
    let mouse;
    let stack;
    let visited;
    let dead;
    let exits;
    let steps;
    let done;
    let cell = 10;
    let visible = false;
    let paused = false;
    let running = false;
    let holdUntil = 0;
    let lastStep = 0;
    let lastTrace = 0;
    let exitHeldUntil = 0;
    let lastResult = null;
    let raf = 0;

    const key = (x, y) => y * COLS + x;

    function generate() {
      grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(WALL));
      const carve = [[1, 1]];
      grid[1][1] = OPEN;
      while (carve.length) {
        const [cx, cy] = carve[carve.length - 1];
        const options = DIRS
          .map(([dx, dy]) => [cx + dx * 2, cy + dy * 2, dx, dy])
          .filter(([nx, ny]) => nx > 0 && ny > 0 && nx < COLS - 1 && ny < ROWS - 1 && grid[ny][nx] === WALL);
        if (!options.length) {
          carve.pop();
          continue;
        }
        const [nx, ny, dx, dy] = options[Math.floor(Math.random() * options.length)];
        grid[cy + dy][cx + dx] = OPEN;
        grid[ny][nx] = OPEN;
        carve.push([nx, ny]);
      }
      const oddRow = () => 1 + 2 * Math.floor(Math.random() * ((ROWS - 1) / 2));
      grid[oddRow()][0] = OPEN;
      grid[oddRow()][COLS - 1] = OPEN;
      if (Math.random() < 0.5) grid[0][1 + 2 * Math.floor(Math.random() * ((COLS - 1) / 2))] = OPEN;

      const sx = 1 + 2 * Math.floor((COLS - 1) / 4);
      const sy = 1 + 2 * Math.floor((ROWS - 1) / 4);
      mouse = { x: sx, y: sy };
      stack = [];
      visited = new Set([key(sx, sy)]);
      dead = new Set();
      exits = new Set();
      steps = 0;
      done = false;
      lastResult = null;
      holdUntil = 0;
    }

    const isEdge = (x, y) => x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;

    // The pane under the canvas prints this function's own source, so keep
    // each branch on lines the trace can find.
    function stepMouse() {
      for (const [dx, dy] of DIRS) {
        const nx = mouse.x + dx;
        const ny = mouse.y + dy;
        if (grid[ny]?.[nx] !== OPEN) continue;
        if (visited.has(key(nx, ny))) continue;
        stack.push([dx, dy]);
        mouse = { x: nx, y: ny };
        visited.add(key(nx, ny));
        if (isEdge(nx, ny)) exits.add(key(nx, ny));
        return isEdge(nx, ny) ? 'exit' : 'go';
      }
      if (!stack.length) {
        done = true;
        return 'done';
      }
      dead.add(key(mouse.x, mouse.y));
      const [dx, dy] = stack.pop();
      mouse = { x: mouse.x - dx, y: mouse.y - dy };
      return 'back';
    }

    function advance() {
      const result = stepMouse();
      if (result !== 'done') steps++;
      lastResult = result;
      if (result === 'exit') {
        exitHeldUntil = performance.now() + 600;
        syslog('maze', `exit found · step ${steps}`, 'ok');
      }
      if (result === 'done') syslog('maze', `explored · ${exits.size} exit${exits.size === 1 ? '' : 's'} in ${steps} steps`);
      return result;
    }

    // ----- Source pane -----

    const KEYWORDS = new Set(['function', 'for', 'const', 'let', 'of', 'if', 'continue', 'return', 'true', 'false']);
    const escapeHtml = (text) => text.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);

    function highlight(line) {
      const token = /(\/\/.*$)|('[^']*')|(\b\d+\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)|([{}()[\];,.:?!=<>+\-*&|]+)/g;
      let html = '';
      let last = 0;
      for (const m of line.matchAll(token)) {
        html += escapeHtml(line.slice(last, m.index));
        const [text, comment, string, number, call, word, punc] = m;
        let cls = '';
        if (comment) cls = 'c';
        else if (string) cls = 's';
        else if (number) cls = 'n';
        else if (call) cls = KEYWORDS.has(call) ? 'kw' : 'fn';
        else if (word) cls = KEYWORDS.has(word) ? 'kw' : '';
        else if (punc) cls = 'p';
        html += cls ? `<span class="${cls}">${escapeHtml(text)}</span>` : escapeHtml(text);
        last = m.index + text.length;
      }
      return html + escapeHtml(line.slice(last));
    }

    const source = stepMouse.toString().split('\n');
    const indent = Math.min(...source.slice(1).filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
    const lines = source.map((l, i) => (i ? l.slice(indent) : l));
    const find = (needle) => lines.findIndex((l) => l.includes(needle));
    const LIT = {
      go: [find('stack.push(')],
      exit: [find('stack.push('), find('exits.add(')],
      back: [find('stack.pop()')],
      done: [find('done = true')],
    };
    let lineEls = [];
    if (codeOut) {
      codeOut.innerHTML = lines.map((l) => `<span class="l">${highlight(l)}</span>`).join('');
      lineEls = [...codeOut.children];
    }

    // An exit stays lit for a moment even though the next step already backs out of it.
    function showTrace(now) {
      if (!codeOut) return;
      lastTrace = now;
      const shown = now < exitHeldUntil && !done ? 'exit' : lastResult;
      const lit = new Set(shown ? LIT[shown] : []);
      lineEls.forEach((el, i) => {
        el.classList.toggle('is-go', lit.has(i) && shown === 'go');
        el.classList.toggle('is-exit', lit.has(i) && shown === 'exit');
        el.classList.toggle('is-back', lit.has(i) && shown === 'back');
        el.classList.toggle('is-done', lit.has(i) && shown === 'done');
      });
      const at = shown ? LIT[shown][LIT[shown].length - 1] : -1;
      locOut.textContent = at >= 0 ? `stepMouse:${at + 1}` : 'stepMouse';
      stmtOut.textContent = at >= 0 ? lines[at].trim() : '';
      const plural = exits.size === 1 ? '' : 's';
      stateOut.textContent = done
        ? `Explored the whole maze and found ${exits.size}\u00a0exit${plural}.`
        : `${String(steps).padStart(4, '0')}: ${lastResult === 'back' ? 'back' : lastResult ? 'go' : 'ready'} · stack ${stack.length} · exits ${exits.size}`;
      if (metaOut) metaOut.textContent = done ? '// done' : paused && !toggle.hidden ? '// paused' : running ? '// running' : '// idle';
    }

    // Spoken feedback for the buttons only, so autoplay stays quiet.
    function say(text) {
      if (announce) announce.textContent = text;
    }

    const SAID = { go: 'moved forward', exit: 'found an exit', back: 'backed up' };
    function sayStep() {
      const plural = exits.size === 1 ? '' : 's';
      say(done
        ? `Explored the whole maze and found ${exits.size}\u00a0exit${plural}.`
        : `Step ${steps}: ${SAID[lastResult]}, ${exits.size} exit${plural} found.`);
    }

    // ----- Canvas -----

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssWidth = canvas.clientWidth || 600;
      cell = cssWidth / COLS;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cell * ROWS * dpr);
      canvas.style.aspectRatio = `${COLS} / ${ROWS}`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render();
    }

    function render() {
      const w = cell * COLS;
      const h = cell * ROWS;
      ctx.clearRect(0, 0, w, h);

      // Current path from the start to the mouse.
      const path = new Set();
      let px = mouse.x;
      let py = mouse.y;
      path.add(key(px, py));
      for (let i = stack.length - 1; i >= 0; i--) {
        px -= stack[i][0];
        py -= stack[i][1];
        path.add(key(px, py));
      }

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const k = key(x, y);
          if (grid[y][x] === WALL) {
            ctx.fillStyle = 'rgba(122, 162, 255, 0.13)';
            ctx.fillRect(x * cell + 0.5, y * cell + 0.5, cell - 1, cell - 1);
          } else if (exits.has(k)) {
            ctx.fillStyle = '#a4ff6b';
            ctx.fillRect(x * cell, y * cell, cell, cell);
          } else if (path.has(k)) {
            ctx.fillStyle = 'rgba(77, 243, 255, 0.85)';
            ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
          } else if (dead.has(k)) {
            ctx.fillStyle = 'rgba(157, 123, 255, 0.4)';
            ctx.fillRect(x * cell + 1.5, y * cell + 1.5, cell - 3, cell - 3);
          }
        }
      }

      ctx.save();
      ctx.shadowColor = '#4df3ff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc((mouse.x + 0.5) * cell, (mouse.y + 0.5) * cell, cell * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ----- Playback -----

    function tick(now) {
      if (!running) return;
      let exited = false;
      if (done) {
        if (!holdUntil) holdUntil = now + 2600;
        if (now >= holdUntil) generate();
      } else if (now - lastStep > 16) {
        lastStep = now;
        for (let i = 0; i < 2 && !done; i++) {
          if (advance() === 'exit') exited = true;
        }
      }
      if (exited || now - lastTrace >= 120) showTrace(now);
      render();
      raf = requestAnimationFrame(tick);
    }

    // Play is a request to run, so it starts even when the maze is off screen.
    function start(force) {
      if (running || paused || (!visible && !force)) return;
      running = true;
      raf = requestAnimationFrame(tick);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    function setPaused(value) {
      paused = value;
      toggle.classList.toggle('is-paused', paused);
      toggleLabel.textContent = paused ? 'Play' : 'Pause';
      syslog('maze', paused ? 'paused' : 'resumed', paused ? 'warn' : 'ok');
      if (paused) {
        stop();
        exitHeldUntil = 0;
      } else {
        if (done) generate();
        start(true);
      }
      showTrace(performance.now());
    }

    toggle.addEventListener('click', () => {
      setPaused(!paused);
      say(paused ? 'Paused' : 'Playing');
    });
    stepButton.addEventListener('click', () => {
      if (!paused && toggle.hidden === false) setPaused(true);
      stop();
      if (done) generate();
      advance();
      exitHeldUntil = 0;
      render();
      showTrace(performance.now());
      sayStep();
    });

    generate();
    resize();
    new ResizeObserver(resize).observe(canvas);

    if (reduceMotion) {
      paused = true;
      toggle.hidden = true;
      while (!done) advance();
      render();
      showTrace(performance.now());
      return;
    }

    showTrace(performance.now());

    // Runs while the canvas or its code pane is at least 20% on screen, not
    // counting what is under the sticky header. The 0 threshold makes leaving
    // the screen entirely always report, even after Play from under 20%.
    const headerH = getComputedStyle(document.documentElement).getPropertyValue('--header-h').trim() || '0px';
    const seen = new Map();
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) seen.set(entry.target, entry.isIntersecting && entry.intersectionRatio >= 0.19);
      visible = [...seen.values()].some(Boolean);
      if (visible) start();
      else if (running) {
        stop();
        showTrace(performance.now());
      }
    }, { rootMargin: `-${headerH} 0px 0px 0px`, threshold: [0, 0.2] });
    [canvas, codeOut?.closest('.src')].forEach((el) => el && io.observe(el));
  }

  // ---------- Code panes: a pane that scrolls sideways takes keyboard focus ----------

  function panes() {
    if (!('ResizeObserver' in window)) return;
    const check = (body) => {
      if (body.scrollWidth > body.clientWidth + 1) {
        const src = body.closest('.src');
        body.tabIndex = 0;
        body.setAttribute('role', 'region');
        body.setAttribute('aria-label', src.dataset.label || src.querySelector('.c')?.textContent.replace(/^\/\/\s*/, '') || 'Code');
      } else if (body.hasAttribute('role')) {
        body.removeAttribute('tabindex');
        body.removeAttribute('role');
        body.removeAttribute('aria-label');
      }
    };
    const ro = new ResizeObserver((entries) => entries.forEach((entry) => check(entry.target)));
    document.querySelectorAll('.src-body').forEach((body) => ro.observe(body));
  }

  // ---------- Header tabs: mark the section in view ----------

  function tabs() {
    const nav = document.querySelector('.tabs');
    if (!nav || !('IntersectionObserver' in window)) return;
    const links = new Map([...nav.querySelectorAll('a[href^="#"]')].map((a) => [a.hash.slice(1), a]));
    const sections = [...links.keys()].map((id) => document.getElementById(id)).filter(Boolean);
    const hero = document.querySelector('.hero');
    const lastId = sections[sections.length - 1]?.id;
    const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    let current;
    let bandId = null;

    function mark(id) {
      if (id === current) return;
      current = id;
      if (id) syslog('view', links.get(id).textContent.trim());
      for (const [section, link] of links) {
        if (section === id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
      const link = links.get(id);
      if (link && nav.scrollWidth > nav.clientWidth) {
        nav.scrollTo({ left: Math.max(0, link.offsetLeft + link.offsetWidth - nav.clientWidth), behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    }

    // The section crossing a thin band just above the middle of the viewport is current.
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) bandId = entry.target === hero ? null : entry.target.id;
      }
      mark(atBottom() ? lastId : bandId);
    }, { rootMargin: '-45% 0px -54% 0px' });
    [hero, ...sections].forEach((el) => el && io.observe(el));

    // At the very bottom the last section may never reach the band; leaving
    // the bottom hands the mark back to the section in the band.
    window.addEventListener('scroll', () => mark(atBottom() ? lastId : bandId), { passive: true });
  }

  // ---------- Hero monitor: htop and a live log of this page ----------

  function monitor() {
    const screen = document.querySelector('.monitor');
    if (!screen) return;
    const meters = screen.querySelector('[data-mon-meters]');
    const logOut = screen.querySelector('[data-mon-log]');
    const clock = screen.querySelector('[data-mon-clock]');
    const started = performance.now();
    const MAX_LINES = 14;
    let fps = null;
    let frames = 0;
    let sampleStart = performance.now();
    let raf = 0;

    const bar = (fraction, width) => '|'.repeat(Math.round(Math.max(0, Math.min(1, fraction)) * width)).padEnd(width);

    function renderMeters() {
      const elapsed = Math.floor((performance.now() - started) / 1000);
      const scrollMax = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = scrollMax > 0 ? window.scrollY / scrollMax : 0;
      const years = new Date().getFullYear() - 2006;
      const fpsText = fps === null ? '--' : String(Math.round(fps));
      meters.innerHTML = [
        `<span class="mk">fps </span>[<span class="mg">${bar((fps || 0) / 60, 16)}</span>${fpsText.padStart(4)}]`,
        `<span class="mk">scrl</span>[<span class="mc">${bar(scrolled, 16)}</span>${`${Math.round(scrolled * 100)}%`.padStart(4)}]`,
        '',
        '<span class="mk">Tasks:</span> 6, 4 running',
        `<span class="mk">Uptime:</span> ${years} years`,
        `<span class="mk">Session:</span> ${pad(Math.floor(elapsed / 3600))}:${pad(Math.floor(elapsed / 60) % 60)}:${pad(elapsed % 60)}`,
      ].join('\n');
    }

    function renderLine(line) {
      const row = document.createElement('li');
      row.className = 'mon-line';
      const time = document.createElement('time');
      time.textContent = clockTime(line.time, true);
      const tag = document.createElement('b');
      tag.textContent = line.tag.padEnd(6);
      if (line.tone) tag.className = line.tone;
      row.append(time, ' ', tag, line.message);
      logOut.querySelector('.mon-cursor')?.classList.remove('mon-cursor');
      row.classList.add('mon-cursor');
      logOut.append(row);
      while (logOut.children.length > MAX_LINES) logOut.firstElementChild.remove();
    }

    logLines.forEach(renderLine);
    logListeners.push(renderLine);

    function updateClock() {
      clock.textContent = clockTime(new Date(), false);
    }
    updateClock();
    setInterval(updateClock, 10000);

    renderMeters();
    window.addEventListener('scroll', renderMeters, { passive: true });
    setInterval(() => {
      renderMeters();
      if (fps !== null && !document.hidden) syslog('sys', `heartbeat · ${Math.round(fps)} fps`);
    }, 15000);

    if (reduceMotion) {
      setInterval(renderMeters, 1000);
      return;
    }

    // Count frames while the screen is visible; that's the fps meter.
    function tick(now) {
      frames++;
      if (now - sampleStart >= 500) {
        fps = (frames * 1000) / (now - sampleStart);
        frames = 0;
        sampleStart = now;
        renderMeters();
      }
      raf = requestAnimationFrame(tick);
    }

    new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf);
      if (entry.isIntersecting) {
        frames = 0;
        sampleStart = performance.now();
        raf = requestAnimationFrame(tick);
      }
    }).observe(screen);
  }

  logPageEvents();
  monitor();
  startField();
  trackPointer();
  boot();
  reveals();
  inputLog();
  maze();
  panes();
  tabs();
})();
