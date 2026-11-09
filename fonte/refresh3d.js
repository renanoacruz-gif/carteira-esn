/* Camada 3D (fase 4) — WebGL escrito à mão, sem biblioteca, sem rede, sem dados de exemplo.
   Só ADICIONA um cartão antes dos KPIs da Visão da Carteira e efeito de inclinação nos KPIs.
   Dados: clients() (c.mrr, c.topScore, c.segInfo). Abrir ficha reutiliza data-a="gsOpen".
   Desligável (preferência salva), estático com prefers-reduced-motion, oculto em telas ≤900px. */
(() => {
  'use strict';
  const $1 = (s, r = document) => r.querySelector(s);
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)'), WIDE = matchMedia('(min-width: 901px)'), FINE = matchMedia('(hover: hover) and (pointer: fine)');
  const KEY = 'rf.fx3d';
  const getFx = () => { try { return localStorage.getItem(KEY) !== '0' && !(navigator.connection && navigator.connection.saveData); } catch { return true; } };
  const setFx = v => { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { } };
  let D = 3.2, F = 2.5;                                          // câmera: distância e foco (mesma matemática no shader e no JS); barras usam perspectiva mais plana
  const BY = -.5;                                               // deslocamento vertical do conjunto de barras
  const setCam = () => { if (ST.mode === 'orb') { D = 3.2; F = 2.5; } else { D = 7; F = 6.2; } };
  const COL = [[1, .259, .718], [.902, .494, .031], [0, .859, 1], [.455, .514, .561]];   // Alta=rosa, Média=laranja, Baixa=ciano, sem oportunidade=cinza (marca TOTVS)
  const VAR = ['var(--rosa)', 'var(--lar)', 'var(--ciano)', 'var(--cz)'], PL = ['Alta', 'Média', 'Baixa', 'Sem oportunidade'];
  const ST = { mode: 'orb', yaw: .6, pitch: -.3, yawB: -.5, pitchB: -.42, vy: 0, vp: 0, drag: null, hover: -1, grow: 0, t0: 0, fx: getFx(), vis: true, raf: 0, last: 0, mx: 0, my: 0 };
  let nodes = [], bars = [], total = 0, withMrr = 0, cnt = [0, 0, 0, 0], sig = '';
  let cv = null, gl = null, cv2 = null, glOK = null, P = {}, buf = {}, box = null, stage = null;

  /* ---------- dados reais da carteira ---------- */
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  const brl = v => (typeof fmtBRL === 'function' ? fmtBRL(v) : 'R$ ' + Math.round(v).toLocaleString('pt-BR'));
  function build() {
    const cs = typeof clients === 'function' ? clients() : [];
    const segOf = c => (typeof segName === 'function' && segName(c.segInfo && c.segInfo.id)) || 'Sem segmento definido';
    const pr = c => c.topScore == null ? 3 : (c.topScore >= CFG.prio.alta ? 0 : c.topScore >= CFG.prio.media ? 1 : 2);
    const arr = cs.map(c => ({ k: c.key, n: c.name, code: c.code || '', m: Number.isFinite(c.mrr) ? c.mrr : null, s: segOf(c), p: pr(c), h: hash(String(c.key)) }));
    arr.sort((a, b) => a.s.localeCompare(b.s) || a.h - b.h);        // segmentos formam faixas de latitude na esfera
    const N = arr.length, mx = Math.max(1, ...arr.map(o => o.m || 0));
    nodes = arr.map((o, i) => { const y = 1 - 2 * (i + .5) / N, r = Math.sqrt(Math.max(0, 1 - y * y)), ph = i * 2.399963; return Object.assign(o, { x: Math.cos(ph) * r, y, z: Math.sin(ph) * r, sz: o.m == null ? 7 : 10 + 30 * Math.sqrt(o.m / mx) }); });
    total = nodes.reduce((a, o) => a + (o.m || 0), 0); withMrr = nodes.filter(o => o.m != null).length; cnt = [0, 0, 0, 0]; nodes.forEach(o => cnt[o.p]++);
    const g = new Map(); nodes.forEach(o => { const e = g.get(o.s) || { s: o.s, m: 0, n: 0 }; e.m += o.m || 0; e.n++; g.set(o.s, e); });
    let L = [...g.values()].sort((a, b) => b.m - a.m || b.n - a.n);
    if (L.length > 10) { const rest = L.slice(9); L = L.slice(0, 9).concat([{ s: 'Demais segmentos', m: rest.reduce((a, e) => a + e.m, 0), n: rest.reduce((a, e) => a + e.n, 0) }]); }
    const bm = Math.max(0, ...L.map(e => e.m)); bars = L.map(e => Object.assign(e, { f: bm > 0 ? e.m / bm : 0 }));
    sig = nodes.map(o => o.k + o.m + o.p).join('|') + bars.length;
  }

  /* ---------- matemática (idêntica no shader e no JS, para o hover acertar o ponto) ---------- */
  const rot = (yaw, pitch) => { const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // R = Rx(pitch)·Ry(yaw), linha-maior
    return [cy, 0, sy, sp * sy, cp, -sp * cy, -cp * sy, sp, cp * cy]; };
  const app = (m, x, y, z) => [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];
  const colMajor = m => new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
  const cur = () => ST.mode === 'orb' ? rot(ST.yaw, ST.pitch) : rot(ST.yawB, ST.pitchB);
  const size = () => ({ w: stage ? stage.clientWidth : 1, h: stage ? stage.clientHeight : 1 });
  function proj(R, x, y, z) { setCam(); const { w, h } = size(), q = app(R, x, y, z + 0), k = D - q[2]; if (ST.mode === 'bars') { const t = app(R, x, y + BY, z); q[0] = t[0]; q[1] = t[1]; q[2] = t[2]; return { x: (q[0] * F / (D - q[2]) / (w / h) * .5 + .5) * w, y: (.5 - q[1] * F / (D - q[2]) * .5) * h, z: q[2], k: D - q[2] }; } return { x: (q[0] * F / k / (w / h) * .5 + .5) * w, y: (.5 - q[1] * F / k * .5) * h, z: q[2], k }; }
  const tok = v => getComputedStyle(document.documentElement).getPropertyValue(v.slice(4, -1)).trim() || '#00DBFF';
  const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

  /* ---------- layout das barras (espaço do mundo) ---------- */
  function barLayout() {
    const { w, h } = size(), asp = w / h, n = Math.max(1, bars.length), sp = Math.min(1.05, asp * 1.55 / n), bw = sp * .5;
    bars.forEach((b, i) => { b.x = (i - (n - 1) / 2) * sp; b.w = bw; b.H = b.f * 1.1; });
    return { sp, bw };
  }

  /* ---------- WebGL ---------- */
  const VS_COMMON = 'uniform mat3 u_R;uniform float u_d,u_f,u_asp;';
  const POS = 'vec3 q=u_R*P;float w=u_d-q.z;gl_Position=vec4(q.x*u_f/w/u_asp,q.y*u_f/w,-q.z*.25,1.);';
  function prog(vs, fs) {
    const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  function initGL() {
    if (glOK !== null) return glOK;
    try {
      cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
      gl = cv.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
      if (!gl) throw new Error('sem webgl');
      P.pt = prog(`attribute vec3 a_pos;attribute vec4 a_col;attribute float a_size;attribute float a_id;${VS_COMMON}uniform float u_dpr,u_k,u_hov;varying vec4 v_col;varying float v_dep,v_h;
        void main(){vec3 P=a_pos;${POS}float h=step(abs(a_id-u_hov),.5);gl_PointSize=a_size*(1.+h*.6)*u_k*u_dpr*(u_d/w);v_col=a_col;v_dep=clamp(.5+q.z*.5,0.,1.);v_h=h;}`,
        `precision mediump float;varying vec4 v_col;varying float v_dep,v_h;
        void main(){vec2 p=gl_PointCoord*2.-1.;float d=length(p);if(d>1.)discard;float core=smoothstep(1.,.35,d),halo=pow(1.-d,2.2);float a=(core*1.05+halo*.6)*mix(.25,1.,v_dep)*v_col.a;vec3 c=mix(v_col.rgb,vec3(1.),core*core*.5+v_h*.22);gl_FragColor=vec4(c*a,a);}`);
      P.ln = prog(`attribute vec3 a_pos;${VS_COMMON}varying float v_dep;void main(){vec3 P=a_pos;${POS}v_dep=clamp(.5+q.z*.5,0.,1.);}`,
        `precision mediump float;uniform vec4 u_col;varying float v_dep;void main(){float a=u_col.a*mix(.15,1.,v_dep);gl_FragColor=vec4(u_col.rgb*a,a);}`);
      P.bx = prog(`attribute vec3 a_pos;attribute vec3 a_nrm;${VS_COMMON}uniform vec3 u_off,u_scl;varying vec3 v_n;varying float v_y,v_top;
        void main(){vec3 P=a_pos*u_scl+u_off;${POS}v_n=u_R*a_nrm;v_y=a_pos.y;v_top=a_nrm.y;}`,
        `precision mediump float;uniform vec3 u_col;uniform float u_hl;varying vec3 v_n;varying float v_y,v_top;
        void main(){vec3 n=normalize(v_n);float df=max(dot(n,normalize(vec3(-.4,.8,.6))),0.);float rim=pow(1.-max(n.z,0.),2.);vec3 b=mix(u_col*.5,u_col,v_y);vec3 c=b*(.42+.8*df)+rim*vec3(0.,.3,.42)*.6;if(v_top>.9)c=mix(c,u_col+.3,.5);c=mix(c,vec3(1.),u_hl*.28);gl_FragColor=vec4(c,1.);}`);
      buf.pt = gl.createBuffer(); buf.ln = gl.createBuffer(); buf.fl = gl.createBuffer(); buf.bx = gl.createBuffer();
      // esfera: paralelos, meridianos e dois anéis de órbita
      const L = [], seg = 72, push = (a, b) => L.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      for (const lat of [-60, -30, 0, 30, 60]) { const y = Math.sin(lat * Math.PI / 180), r = Math.cos(lat * Math.PI / 180); for (let i = 0; i < seg; i++) { const a = i / seg * 6.2832, b = (i + 1) / seg * 6.2832; push([Math.cos(a) * r, y, Math.sin(a) * r], [Math.cos(b) * r, y, Math.sin(b) * r]); } }
      for (let m = 0; m < 12; m++) { const ph = m / 12 * 3.14159; for (let i = 0; i < seg; i++) { const a = i / seg * 6.2832, b = (i + 1) / seg * 6.2832; push([Math.cos(a) * Math.cos(ph), Math.sin(a), Math.cos(a) * Math.sin(ph)], [Math.cos(b) * Math.cos(ph), Math.sin(b), Math.cos(b) * Math.sin(ph)]); } }
      buf.nSph = L.length / 3; const ring = [];
      for (const [r, tx, tz] of [[1.28, .5, .2], [1.5, -.35, .6]]) for (let i = 0; i < seg; i++) { const a = i / seg * 6.2832, b = (i + 1) / seg * 6.2832; for (const t of [a, b]) { let x = Math.cos(t) * r, y = 0, z = Math.sin(t) * r; const c1 = Math.cos(tx), s1 = Math.sin(tx), y1 = y * c1 - z * s1, z1 = y * s1 + z * c1; const c2 = Math.cos(tz), s2 = Math.sin(tz), x2 = x * c2 - y1 * s2, y2 = x * s2 + y1 * c2; ring.push(x2, y2, z1); } }
      buf.nRing = ring.length / 3; gl.bindBuffer(gl.ARRAY_BUFFER, buf.ln); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(L.concat(ring)), gl.STATIC_DRAW);
      // cubo unitário (x,z em ±.5; y em 0..1) com normais
      const V = [], face = (n, a, b, c, d) => { for (const p of [a, b, c, a, c, d]) V.push(p[0], p[1], p[2], n[0], n[1], n[2]); };
      face([0, 1, 0], [-.5, 1, -.5], [-.5, 1, .5], [.5, 1, .5], [.5, 1, -.5]); face([0, 0, 1], [-.5, 0, .5], [.5, 0, .5], [.5, 1, .5], [-.5, 1, .5]); face([0, 0, -1], [.5, 0, -.5], [-.5, 0, -.5], [-.5, 1, -.5], [.5, 1, -.5]);
      face([1, 0, 0], [.5, 0, .5], [.5, 0, -.5], [.5, 1, -.5], [.5, 1, .5]); face([-1, 0, 0], [-.5, 0, -.5], [-.5, 0, .5], [-.5, 1, .5], [-.5, 1, -.5]);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.bx); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW);
      cv.addEventListener('webglcontextlost', e => { e.preventDefault(); glOK = false; mountView(true); });
      glOK = true;
    } catch (e) { glOK = false; gl = null; }
    return glOK;
  }
  function uploadNodes() {
    const a = new Float32Array(nodes.length * 9);
    nodes.forEach((o, i) => { const c = COL[o.p], j = i * 9; a.set([o.x, o.y, o.z, c[0], c[1], c[2], o.m == null ? .5 : 1, o.sz, i], j); });
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.pt); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW);
  }
  function uploadFloor() {
    const { sp } = barLayout(), n = bars.length, half = Math.max(n * sp / 2 + .3, 1.2), L = [], y = 0;
    for (let x = -half; x <= half + 1e-6; x += sp / 2) L.push(x, y + BY, -half * .55, x, y + BY, half * .55);
    for (let z = -half * .55; z <= half * .55 + 1e-6; z += sp / 2) L.push(-half, y + BY, z, half, y + BY, z);
    buf.nFl = L.length / 3; gl.bindBuffer(gl.ARRAY_BUFFER, buf.fl); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(L), gl.STATIC_DRAW);
  }
  const attr = (p, name, n, stride, off, b) => { const l = gl.getAttribLocation(p.p, name); if (l < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, stride * 4, off * 4); };
  const common = (p, R, W, H) => { gl.uniformMatrix3fv(p.u.u_R, false, colMajor(R)); gl.uniform1f(p.u.u_d, D); gl.uniform1f(p.u.u_f, F); gl.uniform1f(p.u.u_asp, W / H); };
  const lines = (R, W, H, b, n, off, rgba) => { gl.useProgram(P.ln.p); common(P.ln, R, W, H); gl.uniform4f(P.ln.u.u_col, rgba[0], rgba[1], rgba[2], rgba[3]); attr(P.ln, 'a_pos', 3, 3, 0, b); gl.drawArrays(gl.LINES, off, n); };
  function drawGL(ts) {
    setCam(); const W = cv.width, H = cv.height; gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const R = cur(), k = ease((ts - ST.grow) / 900);
    if (ST.mode === 'orb') {
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      lines(R, W, H, buf.ln, buf.nSph, 0, [0, .86, 1, .13]); lines(R, W, H, buf.ln, buf.nRing, buf.nSph, [0, 1, .83, .2]);
      gl.useProgram(P.pt.p); common(P.pt, R, W, H); gl.uniform1f(P.pt.u.u_dpr, H / 380); gl.uniform1f(P.pt.u.u_k, .15 + .85 * k); gl.uniform1f(P.pt.u.u_hov, ST.hover);
      for (const [n, o, s] of [['a_pos', 0, 3], ['a_col', 3, 4], ['a_size', 7, 1], ['a_id', 8, 1]]) attr(P.pt, n, s, 9, o, buf.pt);
      gl.drawArrays(gl.POINTS, 0, nodes.length);
    } else {
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.DEPTH_TEST);
      const Rf = R; gl.useProgram(P.ln.p); lines(Rf, W, H, buf.fl, buf.nFl, 0, [0, .86, 1, .16]);
      gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.useProgram(P.bx.p); common(P.bx, R, W, H); attr(P.bx, 'a_pos', 3, 6, 0, buf.bx); attr(P.bx, 'a_nrm', 3, 6, 3, buf.bx);
      bars.forEach((b, i) => { const kk = ease((ts - ST.grow - i * 70) / 800), h = Math.max(b.m > 0 ? .02 : 0, b.H * kk); if (h <= 0) return;
        const c = i === ST.hover ? [.85, 1, .4] : [0, .78 + .1 * (1 - b.f), 1];
        gl.uniform3f(P.bx.u.u_off, b.x, BY, 0); gl.uniform3f(P.bx.u.u_scl, b.w, h, b.w); gl.uniform3f(P.bx.u.u_col, c[0], c[1], c[2]); gl.uniform1f(P.bx.u.u_hl, i === ST.hover ? 1 : 0); gl.drawArrays(gl.TRIANGLES, 0, 30); });
      gl.disable(gl.DEPTH_TEST);
    }
  }

  /* ---------- reserva 2D (sem WebGL, efeitos desligados ou contexto perdido) ---------- */
  function draw2D() {
    setCam(); const { w, h } = size(), d = Math.min(2, devicePixelRatio || 1); cv2.width = Math.round(w * d); cv2.height = Math.round(h * d); const x = cv2.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, w, h);
    if (ST.mode === 'orb') {
      const R = rot(.6, -.3), L = nodes.map((o, i) => [proj(R, o.x, o.y, o.z), o, i]).sort((a, b) => a[0].z - b[0].z);
      x.strokeStyle = 'rgba(0,219,255,.14)'; x.lineWidth = 1; x.beginPath(); x.arc(w / 2, h / 2, Math.min(h * .4, w * .4), 0, 7); x.stroke();
      L.forEach(([p, o]) => { x.globalAlpha = (.3 + .7 * ((p.z + 1) / 2)) * (o.m == null ? .5 : 1); x.fillStyle = tok(VAR[o.p]); x.beginPath(); x.arc(p.x, p.y, o.sz * (D / p.k) * (size().h / 380) * .5, 0, 7); x.fill(); }); x.globalAlpha = 1;
    } else {
      const n = bars.length, bw = Math.min(70, (w - 80) / n * .6), gap = (w - 80) / n, base = h - 56, mh = h - 130;
      bars.forEach((b, i) => { x.fillStyle = tok('var(--ciano)'); const bh = Math.max(b.m > 0 ? 3 : 0, b.f * mh); x.fillRect(40 + gap * i + (gap - bw) / 2, base - bh, bw, bh); });
    }
  }

  /* ---------- cartão (HUD em HTML; o canvas persistente é reencaixado a cada render) ---------- */
  const esc2 = s => (typeof esc === 'function' ? esc(s) : String(s));
  function hud() {
    const sw = (m, t) => `<button type="button" data-r3="${m}" aria-pressed="${ST.mode === m}">${t}</button>`;
    const leg = PL.map((l, i) => cnt[i] ? `<li><i style="background:${VAR[i]}"></i>${l} <b>${cnt[i]}</b></li>` : '').join('');
    return `<section id="rf3d" class="rf3d" aria-label="Mapa 3D da carteira"><div class="rf3d-stage" id="rf3d-stage"></div>
      <div class="rf3d-hud"><div><div class="rf3d-eb">Mapa da carteira</div><div class="rf3d-t">${nodes.length} cliente(s)</div><div class="rf3d-s">MRR informado na planilha: <b>${brl(total)}</b> em ${withMrr} de ${nodes.length}</div></div>
      <div class="rf3d-ctl"><div class="rf3d-seg" role="group" aria-label="Visualização">${sw('orb', 'Orbe')}${sw('bars', 'Barras de MRR')}</div><button type="button" class="rf3d-fx" data-r3="fx" aria-pressed="${ST.fx}" title="Liga ou desliga a animação 3D">${ST.fx ? '3D ligado' : '3D desligado'}</button></div></div>
      <ul class="rf3d-leg" aria-label="Legenda">${ST.mode === 'orb' ? leg : ''}</ul>
      <div class="rf3d-hint">${ST.mode === 'orb' ? 'Cor = prioridade da principal oportunidade · tamanho = MRR · faixas = segmentos' : 'Altura = MRR informado por segmento'} · arraste para girar · clique para abrir a ficha</div>
      <div class="rf3d-tip" id="rf3d-tip" hidden></div><div class="rf3d-lbs" id="rf3d-lbs"></div>
      <p class="sr">${nodes.length} clientes; ${withMrr} com MRR informado; ${cnt[0]} com prioridade alta. Use a lista de Clientes para navegar pelo teclado.</p></section>`;
  }
  const status = () => ST.mode === 'bars' && !bars.some(b => b.m > 0) ? 'Nenhum cliente com MRR informado na planilha.' : '';
  function mountView(force) {
    const host = $1('#rf3d-stage'); if (!host) return; stage = host;
    const useGL = ST.fx && initGL();
    host.textContent = ''; if (!cv2) { cv2 = document.createElement('canvas'); cv2.setAttribute('aria-hidden', 'true'); }
    const msg = status(); if (msg) { const m = document.createElement('div'); m.className = 'rf3d-empty'; m.textContent = msg; host.appendChild(m); }
    if (useGL && !force) { host.appendChild(cv); resize(); uploadNodes(); if (ST.mode === 'bars') uploadFloor(); } else { host.appendChild(cv2); draw2D(); }
    kick();
  }
  function resize() { if (!stage || !cv) return; const d = Math.min(2, devicePixelRatio || 1), w = stage.clientWidth, h = stage.clientHeight; if (w && (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d))) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); } }
  const using = () => cv && cv.parentNode === stage;

  /* ---------- loop ---------- */
  function frame(ts) {
    ST.raf = 0; if (!using() || !stage.isConnected) return;
    const dt = Math.min(48, ts - (ST.last || ts)); ST.last = ts;
    if (!ST.drag && !REDUCE.matches) { if (ST.mode === 'orb') { ST.yaw += .00022 * dt + ST.vy; ST.pitch += ST.vp; ST.pitch += (-.3 - ST.pitch) * .02; } else { ST.yawB += ST.vy; ST.pitchB += ST.vp; ST.yawB += (-.5 + Math.sin(ts / 3800) * .28 - ST.yawB) * .02; ST.pitchB += (-.42 - ST.pitchB) * .02; } ST.vy *= .93; ST.vp *= .93; }
    resize(); drawGL(ts); labels();
    if (!REDUCE.matches && ST.vis && !document.hidden) kick();
  }
  function kick() { if (!ST.raf && using() && ST.vis) ST.raf = requestAnimationFrame(frame); }
  function labels() {
    const L = $1('#rf3d-lbs'); if (!L) return;
    if (ST.mode !== 'bars') { if (L.firstChild) L.textContent = ''; return; }
    if (L.childElementCount !== bars.length) L.innerHTML = bars.map(() => '<div class="rf3d-lb"><b></b><span></span></div>').join('');
    setCam(); const R = cur(), ts = performance.now();
    [...L.children].forEach((el, i) => { const b = bars[i], kk = ease((ts - ST.grow - i * 70) / 800), top = proj(R, b.x, Math.max(b.m > 0 ? .02 : 0, b.H * kk) + .06, 0), foot = proj(R, b.x, 0, b.w * 1.1);
      el.firstChild.textContent = b.m > 0 ? brl(b.m).replace(',00', '') : ''; el.lastChild.textContent = b.s.length > 16 ? b.s.slice(0, 15) + '…' : b.s;
      el.style.transform = `translate(${top.x.toFixed(1)}px,${top.y.toFixed(1)}px)`; el.firstChild.style.opacity = kk > .6 ? 1 : 0; el.lastChild.style.transform = `translateY(${(foot.y - top.y + 26).toFixed(1)}px)`; });
  }

  /* ---------- interação ---------- */
  function hit(mx, my) {
    setCam(); const R = cur(); let best = -1, bz = -9;
    if (ST.mode === 'orb') nodes.forEach((o, i) => { const p = proj(R, o.x, o.y, o.z); if (p.z < -.25) return; const r = Math.max(8, o.sz * (D / p.k) * (size().h / 380) * .5 + 3); if (Math.hypot(p.x - mx, p.y - my) <= r && p.z > bz) { best = i; bz = p.z; } });
    else bars.forEach((b, i) => { const t = proj(R, b.x, b.H, 0), f = proj(R, b.x, 0, 0), hw = Math.max(12, b.w * F / t.k * size().h * .5); if (mx > t.x - hw && mx < t.x + hw && my > Math.min(t.y, f.y) - 8 && my < Math.max(t.y, f.y) + 8) best = i; });
    return best;
  }
  function setHover(i, mx, my) {
    if (i === ST.hover) { if (i >= 0) place(mx, my); return; } ST.hover = i; const tip = $1('#rf3d-tip'); if (!tip) return;
    if (i < 0) { tip.hidden = true; if (stage) stage.style.cursor = ''; kick(); return; }
    if (ST.mode === 'orb') { const o = nodes[i]; tip.innerHTML = `<b>${esc2(o.n)}</b><span>${esc2(o.code)} • ${esc2(o.s)}</span><span>MRR: ${o.m == null ? 'não informado' : brl(o.m)} • Prioridade: ${PL[o.p]}</span><em>Clique para abrir a ficha</em>`; }
    else { const b = bars[i]; tip.innerHTML = `<b>${esc2(b.s)}</b><span>${b.n} cliente(s)</span><span>MRR informado: ${brl(b.m)}</span><em>Clique para ver em Clientes</em>`; }
    tip.hidden = false; if (stage) stage.style.cursor = 'pointer'; place(mx, my); kick();
  }
  function place(mx, my) { const tip = $1('#rf3d-tip'); if (!tip) return; const { w } = size(); tip.style.left = Math.min(w - tip.offsetWidth - 8, Math.max(8, mx + 14)) + 'px'; tip.style.top = (my - tip.offsetHeight - 14 >= 8 ? my - tip.offsetHeight - 14 : my + 26) + 'px'; }
  const press = (key) => { const b = document.createElement('button'); b.dataset.a = 'gsOpen'; b.dataset.k = key; b.hidden = true; document.body.appendChild(b); b.click(); b.remove(); };
  const local = e => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  document.addEventListener('pointerdown', e => { if (!stage || !e.target.closest || !e.target.closest('#rf3d-stage') || e.button) return; const [x, y] = local(e); ST.drag = { x: e.clientX, y: e.clientY, mx: x, my: y, moved: 0 }; try { e.target.setPointerCapture(e.pointerId); } catch { } });
  document.addEventListener('pointermove', e => {
    if (!stage || !stage.isConnected) return;
    if (ST.drag) { const dx = e.clientX - ST.drag.x, dy = e.clientY - ST.drag.y; ST.drag.x = e.clientX; ST.drag.y = e.clientY; ST.drag.moved += Math.abs(dx) + Math.abs(dy); if (ST.mode === 'orb') { ST.yaw += dx * .006; ST.pitch = Math.max(-1.2, Math.min(1.2, ST.pitch + dy * .006)); } else { ST.yawB += dx * .006; ST.pitchB = Math.max(-1.1, Math.min(-.15, ST.pitchB + dy * .004)); } ST.vy = dx * .0004; ST.vp = 0; if (!using()) return; kick(); return; }
    if (!e.target.closest || !e.target.closest('#rf3d-stage')) { if (ST.hover >= 0) setHover(-1); return; }
    if (!using()) return; const [x, y] = local(e); setHover(hit(x, y), x, y);
  });
  document.addEventListener('pointerup', e => {
    if (!ST.drag) return; const d = ST.drag; ST.drag = null;
    if (d.moved < 6 && stage && stage.isConnected && using()) { const i = hit(d.mx, d.my); if (i >= 0) { if (ST.mode === 'orb') press(nodes[i].k); else { const id = segIdByName(bars[i].s), b = document.createElement('button'); b.hidden = true; if (id) { b.dataset.a = 'segGo'; b.dataset.id = id; } else { b.dataset.a = 'nav'; b.dataset.v = 'clientes'; } document.body.appendChild(b); b.click(); b.remove(); } } }
  });
  function segIdByName(n) { const c = (clients() || []).find(c => (segName(c.segInfo && c.segInfo.id) || 'Sem segmento definido') === n); return c && c.segInfo && c.segInfo.id; }
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-r3]'); if (!t) return;
    const a = t.dataset.r3;
    if (a === 'orb' || a === 'bars') { if (ST.mode === a) return; ST.mode = a; ST.grow = performance.now(); ST.hover = -1; repaint(); }
    else if (a === 'fx') { ST.fx = !ST.fx; setFx(ST.fx); repaint(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ST.hover >= 0) setHover(-1); });

  /* ---------- montagem após cada render() ---------- */
  let io = null;
  function observe() { const el = $1('#rf3d'); if (!el || !('IntersectionObserver' in window)) return; if (io) io.disconnect(); io = new IntersectionObserver(en => { ST.vis = en[0].isIntersecting; if (ST.vis) kick(); }); io.observe(el); }
  function repaint() { const old = $1('#rf3d'); if (!old) return; old.outerHTML = hud(); mountView(); observe(); }
  function mount() {
    const view = typeof UI !== 'undefined' ? UI.view : ''; const root = $1('#app');
    if (!root || view !== 'geral' || !WIDE.matches || !(typeof clients === 'function' && clients().length)) { ST.vis = false; return; }
    if (root.querySelector('#rf3d')) return;
    if (!root.querySelector('.grid.g4')) return; const anchor = root.querySelector('#hoje') || root.querySelector('.grid.g4'); /* o valor vem primeiro: o mapa 3D entra depois de "Onde vale aprofundar hoje" */
    const s = clients().map(c => c.key + c.mrr + c.topScore).join('|'); if (!nodes.length || s !== ST.s) { ST.s = s; build(); ST.grow = performance.now(); }
    anchor.insertAdjacentHTML('afterend', hud()); ST.vis = true; ST.last = 0; mountView();
    observe();
  }
  let q = 0; const sched = () => { if (!q) q = requestAnimationFrame(() => { q = 0; mount(); }); };
  const host = $1('#app'); if (host) new MutationObserver(sched).observe(host, { childList: true });
  addEventListener('resize', () => { const el = $1('#rf3d'); if (!el) { sched(); return; } if (!WIDE.matches) return; if (using()) { resize(); kick(); } else if (cv2 && cv2.parentNode === stage) draw2D(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  sched();

  /* ---------- inclinação 3D nos KPIs (apenas ponteiro fino e sem reduced-motion) ---------- */
  let tEl = null, tRaf = 0, tx = 0, ty = 0;
  const tilt = () => { tRaf = 0; if (!tEl) return; const r = tEl.getBoundingClientRect(), px = (tx - r.left) / r.width, py = (ty - r.top) / r.height; tEl.style.setProperty('--ry', ((px - .5) * 9).toFixed(2) + 'deg'); tEl.style.setProperty('--rx', ((.5 - py) * 9).toFixed(2) + 'deg'); tEl.style.setProperty('--gx', (px * 100).toFixed(1) + '%'); tEl.style.setProperty('--gy', (py * 100).toFixed(1) + '%'); };
  const untilt = el => { if (!el) return; el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); el.classList.remove('tilt'); };
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || REDUCE.matches || !FINE.matches || !ST.fx || ST.drag) return;
    const el = e.target.closest && e.target.closest('.kpi, .seg-card');
    if (el !== tEl) { untilt(tEl); tEl = el; if (el) el.classList.add('tilt'); }
    if (tEl) { tx = e.clientX; ty = e.clientY; if (!tRaf) tRaf = requestAnimationFrame(tilt); }
  }, { passive: true });
  document.addEventListener('pointerleave', e => { if (tEl && e.target === tEl) { untilt(tEl); tEl = null; } }, true);
  document.addEventListener('pointerout', e => { if (!e.relatedTarget && tEl) { untilt(tEl); tEl = null; } }, true);
})();
