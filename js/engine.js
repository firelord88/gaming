/* LIFE SENTENCE — engine: renderer, world, characters, controls, camera, audio */
(function () {
  'use strict';
  const T = THREE;
  const G = (window.G = {});

  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  G.isTouch = isTouch;

  // ---------------------------------------------------------------- renderer
  const canvas = document.getElementById('scene');
  const renderer = new T.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2));
  renderer.shadowMap.enabled = !isTouch;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.fog = new T.Fog(0xcfdfe8, 45, 170);
  const camera = new T.PerspectiveCamera(62, 1, 0.1, 400);
  G.scene = scene; G.camera = camera;

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 74 : 62;
    camera.updateProjectionMatrix();
    G.portrait = w < h;
  }
  window.addEventListener('resize', resize);

  // ------------------------------------------------------------------ lights
  const hemi = new T.HemisphereLight(0xdfe9f5, 0x6b6257, 0.9);
  scene.add(hemi);
  const sun = new T.DirectionalLight(0xfff4dd, 1.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 160;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const sunDir = new T.Vector3(0.45, 1, 0.35).normalize();

  const SKIES = {
    dawn:    { top: '#4f6288', bot: '#eab88c', fog: 0xd3b9a2, sun: 0xffd2a0, si: 0.95, hi: 0.75, dir: [0.9, 0.5, 0.3] },
    day:     { top: '#3f7ac4', bot: '#cfe3f2', fog: 0xcfdfe8, sun: 0xfff4dd, si: 1.3, hi: 0.9, dir: [0.45, 1, 0.35] },
    overcast:{ top: '#727c86', bot: '#b9bfc4', fog: 0xb4babf, sun: 0xdfe4ea, si: 0.6, hi: 1.0, dir: [0.2, 1, 0.3] },
    hot:     { top: '#3a78cf', bot: '#f1e7c8', fog: 0xe6dcc0, sun: 0xfff0c8, si: 1.45, hi: 0.95, dir: [-0.3, 1, 0.2] },
    dusk:    { top: '#2d3561', bot: '#e07b53', fog: 0xa97664, sun: 0xff9a6a, si: 0.85, hi: 0.6, dir: [-0.9, 0.35, 0.4] },
    evening: { top: '#141a36', bot: '#b0563f', fog: 0x6f4a4a, sun: 0xff8a5a, si: 0.5, hi: 0.5, dir: [-0.9, 0.22, 0.5] },
  };
  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 4; skyCanvas.height = 256;
  const skyTex = new T.CanvasTexture(skyCanvas);
  skyTex.colorSpace = T.SRGBColorSpace;
  scene.background = skyTex;
  G.setSky = function (name) {
    const s = SKIES[name] || SKIES.day;
    const c = skyCanvas.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, s.top); g.addColorStop(0.62, s.bot); g.addColorStop(1, s.bot);
    c.fillStyle = g; c.fillRect(0, 0, 4, 256);
    skyTex.needsUpdate = true;
    scene.fog.color.setHex(s.fog);
    sun.color.setHex(s.sun); sun.intensity = s.si; hemi.intensity = s.hi;
    sunDir.set(s.dir[0], s.dir[1], s.dir[2]).normalize();
    G.skyBase = { hi: s.hi, hemi: hemi.color.getHex() };
  };

  // ---------------------------------------------------------------- textures
  function noiseTex(base, vary, rep, size) {
    size = size || 128;
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, size, size);
    for (let i = 0; i < size * size * 0.6; i++) {
      const v = Math.random() * vary;
      x.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${v})` : `rgba(255,255,255,${v})`;
      x.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  function chainTex() {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d');
    x.strokeStyle = '#9aa3a8'; x.lineWidth = 2.2;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(32, 32); x.moveTo(32, 0); x.lineTo(0, 32); x.stroke();
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  function textTex(text, opt) {
    opt = opt || {};
    const c = document.createElement('canvas'); c.width = opt.w || 512; c.height = opt.h || 96;
    const x = c.getContext('2d');
    if (opt.bg) { x.fillStyle = opt.bg; x.fillRect(0, 0, c.width, c.height); }
    x.font = (opt.font || '700 54px') + ' "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    if (opt.stroke) { x.lineWidth = 8; x.strokeStyle = opt.stroke; x.strokeText(text, c.width / 2, c.height / 2 + 2); }
    x.fillStyle = opt.fg || '#fff'; x.fillText(text, c.width / 2, c.height / 2 + 2);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  function shelfTex() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#4a3524'; x.fillRect(0, 0, 256, 256);
    const cols = ['#7a2e2e', '#2e4a7a', '#3d6b45', '#b08a3c', '#5a3d6b', '#8a8274', '#2f2f35', '#a8562c'];
    for (let r = 0; r < 4; r++) {
      let px = 4;
      while (px < 250) {
        const w = 6 + Math.random() * 12, h = 40 + Math.random() * 16;
        x.fillStyle = cols[(Math.random() * cols.length) | 0];
        x.fillRect(px, r * 64 + (58 - h), w, h);
        px += w + 1;
      }
      x.fillStyle = '#33241a'; x.fillRect(0, r * 64 + 58, 256, 6);
    }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  const L = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  const M = {
    wall: L(0xffffff, { map: noiseTex('#b9b3a6', 0.06, 3) }),
    wallDark: L(0xffffff, { map: noiseTex('#8f8b82', 0.07, 3) }),
    floor: L(0xffffff, { map: noiseTex('#8d8f8e', 0.05, 10) }),
    yard: L(0xffffff, { map: noiseTex('#b79f78', 0.09, 14) }),
    ground: L(0xffffff, { map: noiseTex('#9b8a63', 0.1, 60) }),
    court: L(0x4b5158), line: L(0xe9e6da),
    steel: L(0x6f777d), steelDark: L(0x3d4348), paint: L(0x56707c),
    mattress: L(0x7d8a6b), wood: L(0x6e5138), bench: L(0x8a6f4d),
    black: L(0x1c1e21), white: L(0xe9e7e0), red: L(0x9c2f2a), yellow: L(0xd9b13b),
    ceiling: L(0x9a9790), glow: new T.MeshBasicMaterial({ color: 0xfff3d6 }),
    tv: new T.MeshBasicMaterial({ color: 0x6fa3d8 }),
    fence: new T.MeshBasicMaterial({ map: chainTex(), transparent: true, alphaTest: 0.35, side: T.DoubleSide }),
    shelf: L(0xffffff, { map: shelfTex() }),
  };

  // ------------------------------------------------------- geometry helpers
  const colliders = []; G.colliders = colliders;
  let solid2D = [];
  const world = new T.Group(); scene.add(world);
  const unitBox = new T.BoxGeometry(1, 1, 1);

  function addCollider(x, y0, z, w, h, d) {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minY: y0, maxY: y0 + h, minZ: z - d / 2, maxZ: z + d / 2 });
  }
  // box centered on x,z with its base at y0
  function box(w, h, d, x, y0, z, mat, o) {
    o = o || {};
    const m = new T.Mesh(unitBox, mat);
    m.scale.set(w, h, d); m.position.set(x, y0 + h / 2, z);
    if (o.shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
    world.add(m);
    if (o.collide !== false) addCollider(x, y0, z, w, h, d);
    return m;
  }
  function plane(w, d, x, y, z, mat) {
    const m = new T.Mesh(new T.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
    world.add(m); return m;
  }
  function cyl(r, h, x, y0, z, mat, seg) {
    const m = new T.Mesh(new T.CylinderGeometry(r, r, h, seg || 12), mat);
    m.position.set(x, y0 + h / 2, z); m.castShadow = true; m.receiveShadow = true;
    world.add(m); return m;
  }
  function sign(text, w, h, x, y, z, rotY, opt) {
    const m = new T.Mesh(new T.PlaneGeometry(w, h),
      new T.MeshBasicMaterial({ map: textTex(text, Object.assign({ bg: '#22272b', fg: '#e8e2cf' }, opt || {})) }));
    m.position.set(x, y, z); m.rotation.y = rotY || 0; world.add(m); return m;
  }
  const barList = []; // [x, y0, z, h]
  const coilList = []; // [x, y, z, rotY]
  function barRun(x0, z0, x1, z1, y0, h) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.19));
    for (let i = 0; i <= n; i++) barList.push([x0 + (x1 - x0) * i / n, y0, z0 + (z1 - z0) * i / n, h]);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    [y0 + 0.08, y0 + h * 0.5, y0 + h - 0.08].forEach(function (yy) {
      box(alongX ? len : 0.07, 0.07, alongX ? 0.07 : len, cx, yy, cz, M.steelDark, { collide: false, shadow: false });
    });
  }
  function fence(x0, z0, x1, z1, h) {
    h = h || 4.2;
    const len = Math.hypot(x1 - x0, z1 - z0), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const mat = M.fence.clone(); mat.map = M.fence.map.clone(); mat.map.repeat.set(len * 2.2, h * 2.2); mat.map.needsUpdate = true;
    const m = new T.Mesh(new T.PlaneGeometry(len, h), mat);
    m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); if (!alongX) m.rotation.y = Math.PI / 2;
    world.add(m);
    addCollider((x0 + x1) / 2, 0, (z0 + z1) / 2, alongX ? len : 0.2, h, alongX ? 0.2 : len);
    const n = Math.max(1, Math.round(len / 4));
    for (let i = 0; i <= n; i++) cyl(0.06, h + 0.2, x0 + (x1 - x0) * i / n, 0, z0 + (z1 - z0) * i / n, M.steel, 6);
    box(alongX ? len : 0.06, 0.06, alongX ? 0.06 : len, (x0 + x1) / 2, h, (z0 + z1) / 2, M.steel, { collide: false, shadow: false });
    const cn = Math.round(len / 0.7);
    for (let i = 0; i < cn; i++) coilList.push([x0 + (x1 - x0) * (i + 0.5) / cn, h + 0.35, z0 + (z1 - z0) * (i + 0.5) / cn, alongX ? Math.PI / 2 : 0]);
  }
  function table(x, z, mat) {
    cyl(1.0, 0.08, x, 0.74, z, mat || M.steel, 16); cyl(0.12, 0.74, x, 0, z, M.steelDark, 8);
    [[1.35, 0], [-1.35, 0], [0, 1.35], [0, -1.35]].forEach(function (o) {
      cyl(0.2, 0.06, x + o[0], 0.44, z + o[1], M.steel, 10); cyl(0.05, 0.44, x + o[0], 0, z + o[1], M.steelDark, 6);
    });
    addCollider(x, 0, z, 1.7, 0.9, 1.7);
  }
  function lamp(x, z, h) {
    cyl(0.09, h, x, 0, z, M.steelDark, 6);
    box(1.2, 0.12, 0.35, x, h, z, M.steelDark, { collide: false });
    box(1.0, 0.05, 0.28, x, h - 0.05, z, M.glow, { collide: false, shadow: false });
    addCollider(x, 0, z, 0.3, h, 0.3);
  }

  // ------------------------------------------------------------------- world
  function buildWorld() {
    plane(400, 400, 0, 0, 0, M.ground);

    // ===== A-BLOCK (cellblock) : interior x -18..18, z -42..-12 =====
    plane(36, 30, 0, 0.02, -27, M.floor);
    box(37, 7, 0.5, 0, 0, -42.25, M.wall);
    box(0.5, 7, 30.5, -18.25, 0, -27, M.wall);
    box(0.5, 7, 30.5, 18.25, 0, -27, M.wall);
    box(16.5, 7, 0.5, -10.25, 0, -12.25, M.wall);
    box(16.5, 7, 0.5, 10.25, 0, -12.25, M.wall);
    box(4, 4, 0.5, 0, 3, -12.25, M.wall);
    box(37.5, 0.3, 31, 0, 7, -27, M.ceiling);
    box(36, 0.5, 0.12, 0, 1.0, -12.0 - 0.52, M.paint, { collide: false, shadow: false });
    sign('A-BLOCK', 3.6, 0.7, 0, 3.6, -11.98, 0);
    sign('HARLAN CREEK UNIT  ·  TDCJ', 7, 0.7, 0, 5.2, -11.98, 0, { w: 1024, font: '600 50px' });

    [-1, 1].forEach(function (s) {
      // upper tier slab + rail
      box(6.5, 0.25, 30, s * 14.75, 3.2, -27, M.wallDark);
      box(0.06, 0.06, 30, s * 11.5, 4.4, -27, M.steelDark, { collide: false, shadow: false });
      for (let i = 0; i <= 15; i++) barList.push([s * 11.5, 3.45, -42 + i * 2, 0.95]);
      for (let k = 0; k < 5; k++) {
        const z0 = -42 + 6 * k, zc = z0 + 3, xf = s * 13;
        if (k > 0) box(5, 3.2, 0.25, s * 15.5, 0, z0, M.wall);
        // lower front: bars with door gap
        barRun(xf, z0 + 0.1, xf, zc - 0.75, 0, 3.2);
        barRun(xf, zc + 0.75, xf, z0 + 5.9, 0, 3.2);
        addCollider(xf, 0, (z0 + zc - 0.75) / 2, 0.16, 3.2, zc - 0.75 - z0);
        addCollider(xf, 0, (zc + 0.75 + z0 + 6) / 2, 0.16, 3.2, z0 + 6 - zc - 0.75);
        barRun(xf, zc - 0.75, xf, zc + 0.75, 2.25, 0.95);
        // slid-open door
        barRun(xf + s * 0.12, zc + 0.8, xf + s * 0.12, zc + 2.2, 0.05, 2.15);
        // upper tier cell: closed bars + dark back
        barRun(xf, z0 + 0.1, xf, z0 + 5.9, 3.45, 3.1);
        box(0.1, 3.1, 5.9, s * 15.5, 3.45, zc, M.black, { collide: false, shadow: false });
        if (k > 0) box(2.5, 3.5, 0.2, s * 14.3, 3.45, z0, M.wall, { collide: false });
        // furniture
        const bx = s * 17.25, bz = z0 + 1.35;
        box(1.0, 0.16, 2.1, bx, 0.42, bz, M.mattress, { collide: false });
        box(1.0, 0.16, 2.1, bx, 1.5, bz, M.mattress, { collide: false });
        box(1.06, 0.08, 2.16, bx, 0.34, bz, M.steelDark, { collide: false });
        box(1.06, 0.08, 2.16, bx, 1.42, bz, M.steelDark, { collide: false });
        [[-0.5, -1.05], [0.5, -1.05], [-0.5, 1.05], [0.5, 1.05]].forEach(function (o) {
          box(0.07, 1.9, 0.07, bx + o[0], 0, bz + o[1], M.steelDark, { collide: false, shadow: false });
        });
        addCollider(bx, 0, bz, 1.1, 1.9, 2.2);
        box(0.55, 0.85, 0.55, s * 17.6, 0, z0 + 5.5, M.steel);             // toilet/sink combo
        box(0.6, 0.06, 1.1, s * 17.55, 0.76, z0 + 3.9, M.steel, { collide: false }); // desk
        addCollider(s * 17.55, 0, z0 + 3.9, 0.6, 0.8, 1.1);
        cyl(0.18, 0.45, s * 16.9, 0, z0 + 3.9, M.steelDark, 8);
        // cell number
        sign((s < 0 ? 'W-' : 'E-') + (k + 1), 0.7, 0.32, xf - s * 0.1, 2.75, zc, s < 0 ? Math.PI / 2 : -Math.PI / 2,
          { w: 128, h: 64, font: '700 40px', bg: '#2c3338' });
      }
    });
    // dayroom
    [[-5, -34], [5, -34], [-5, -24], [5, -24]].forEach(function (p) { table(p[0], p[1]); });
    box(2.2, 1.3, 0.15, 0, 3.2, -41.9, M.black, { collide: false });
    box(2.0, 1.1, 0.05, 0, 3.3, -41.8, M.tv, { collide: false, shadow: false });
    for (let i = 0; i < 3; i++) { // wall phones
      box(0.35, 0.6, 0.18, 6 + i * 1.1, 1.2, -12.6, M.steelDark, { collide: false });
      box(0.5, 1.4, 0.05, 6.55 + i * 1.1, 0.9, -12.7, M.steel, { collide: false });
    }
    box(2.2, 1.05, 0.9, -6, 0, -14.2, M.wood);                             // officer desk
    for (let i = 0; i < 4; i++) box(4, 0.08, 0.5, 0, 6.9, -39 + i * 8, M.glow, { collide: false, shadow: false });
    [[0, -36], [0, -27], [0, -18]].forEach(function (p) {
      const pl = new T.PointLight(0xfff0d0, 6, 30, 1.2); pl.position.set(p[0], 6, p[1]); scene.add(pl);
    });

    // ===== YARD : x -28..28, z -12..30 =====
    plane(56, 42, 0, 0.015, 9, M.yard);
    plane(14, 9, 15, 0.03, 19, M.court);
    [[14, 0.12, 15, 14.6], [14, 0.12, 15, 23.4], [0.12, 9, 8.1, 19], [0.12, 9, 21.9, 19], [0.12, 9, 15, 19]].forEach(function (l) {
      plane(l[0], l[1], l[2], 0.04, l[3], M.line);
    });
    cyl(0.1, 3.4, 22.6, 0, 19, M.steelDark, 8); addCollider(22.6, 0, 19, 0.3, 3.4, 0.3);
    box(0.1, 1.0, 1.6, 22.2, 2.8, 19, M.white, { collide: false });
    const rim = new T.Mesh(new T.TorusGeometry(0.25, 0.025, 6, 16), M.red);
    rim.rotation.x = Math.PI / 2; rim.position.set(21.85, 3.05, 19); world.add(rim);
    fence(-28, 30, 28, 30); fence(-28, 12, -28, 30); fence(28, 12, 28, 30);
    fence(-28, -12, -18.5, -12); fence(18.5, -12, 28, -12);
    fence(-28, -12, -28, -8); fence(28, -12, 28, -8);
    // picnic tables
    [[-9, 4], [9, 4]].forEach(function (p) {
      box(2.2, 0.08, 0.9, p[0], 0.74, p[1], M.bench, { collide: false });
      box(2.2, 0.06, 0.35, p[0], 0.44, p[1] - 0.8, M.bench, { collide: false });
      box(2.2, 0.06, 0.35, p[0], 0.44, p[1] + 0.8, M.bench, { collide: false });
      box(0.1, 0.74, 1.6, p[0] - 0.8, 0, p[1], M.steelDark, { collide: false });
      box(0.1, 0.74, 1.6, p[0] + 0.8, 0, p[1], M.steelDark, { collide: false });
      addCollider(p[0], 0, p[1], 2.2, 0.8, 2.0);
    });
    // weight pit
    plane(10, 8, -19, 0.03, 20, M.court);
    for (let i = 0; i < 3; i++) {
      const bx = -22 + i * 3;
      box(0.45, 0.45, 1.5, bx, 0, 20, M.black);
      box(0.08, 1.1, 0.08, bx - 0.55, 0, 19.5, M.steelDark, { collide: false });
      box(0.08, 1.1, 0.08, bx + 0.55, 0, 19.5, M.steelDark, { collide: false });
      const bar = cyl(0.03, 1.9, bx, 0, 19.5, M.steel, 6); bar.rotation.z = Math.PI / 2; bar.position.y = 1.1;
      [-0.8, 0.8].forEach(function (o) {
        const pl = cyl(0.24, 0.08, bx + o, 0, 19.5, M.black, 12); pl.rotation.z = Math.PI / 2; pl.position.y = 1.1;
      });
    }
    // pull-up bars
    [[-21.2, 10], [-18.8, 10]].forEach(function (p) { cyl(0.06, 2.5, p[0], 0, p[1], M.steelDark, 6); addCollider(p[0], 0, p[1], 0.2, 2.5, 0.2); });
    const pb = cyl(0.035, 2.4, -20, 0, 10, M.steel, 6); pb.rotation.z = Math.PI / 2; pb.position.y = 2.45;
    // bleachers
    for (let i = 0; i < 3; i++) box(1.0, 0.45 * (i + 1), 6, 24.6 + i * 1.0, 0, 6, M.bench);
    lamp(-26, -4, 7); lamp(26, 26, 7); lamp(-26, 26, 7); lamp(0, 28.5, 7);
    plane(4, 6, 0, 0.03, -9, M.floor);

    // ===== LIBRARY (west) : x -48..-28, z -8..12 =====
    plane(20, 20, -38, 0.02, 2, L(0x7c6a55));
    box(0.5, 4.5, 8.2, -28.25, 0, -4.1, M.wall); box(0.5, 4.5, 9.2, -28.25, 0, 7.6, M.wall);
    box(0.5, 1.5, 3, -28.25, 3, 1.5, M.wall);
    box(20.5, 4.5, 0.5, -38, 0, -8.25, M.wall); box(20.5, 4.5, 0.5, -38, 0, 12.25, M.wall);
    box(0.5, 4.5, 21, -48.25, 0, 2, M.wall);
    box(21, 0.3, 21, -38, 4.5, 2, M.ceiling);
    sign('LIBRARY  ·  CHAPEL', 4.4, 0.6, -27.97, 3.6, 1.5, Math.PI / 2, { font: '700 46px' });
    box(14, 2.6, 0.6, -40, 0, -7.6, M.shelf); box(0.6, 2.6, 15, -47.6, 0, 3, M.shelf);
    box(0.6, 2.2, 5, -43, 0, 7.5, M.shelf); box(0.6, 2.2, 5, -39.5, 0, 7.5, M.shelf);
    box(2.4, 0.08, 1.2, -34, 0.74, 8, M.wood, { collide: false }); addCollider(-34, 0, 8, 2.4, 0.8, 1.2);
    box(2.4, 0.08, 1.2, -41, 0.74, -2.5, M.wood, { collide: false }); addCollider(-41, 0, -2.5, 2.4, 0.8, 1.2);
    box(0.5, 1.0, 1.0, -34.3, 0, -4.6, M.steel);                           // book cart
    box(0.42, 0.3, 0.9, -34.3, 1.0, -4.6, M.shelf, { collide: false });
    box(4, 0.08, 0.5, -38, 4.42, 2, M.glow, { collide: false, shadow: false });
    const ll = new T.PointLight(0xffe2b8, 5, 22, 1.2); ll.position.set(-38, 3.8, 2); scene.add(ll);

    // ===== CHOW HALL + COMMISSARY (east) : x 28..48, z -8..12 =====
    plane(20, 20, 38, 0.02, 2, M.floor);
    box(0.5, 4.5, 8.2, 28.25, 0, -4.1, M.wall); box(0.5, 4.5, 9.2, 28.25, 0, 7.6, M.wall);
    box(0.5, 1.5, 3, 28.25, 3, 1.5, M.wall);
    box(20.5, 4.5, 0.5, 38, 0, -8.25, M.wall); box(20.5, 4.5, 0.5, 38, 0, 12.25, M.wall);
    box(0.5, 4.5, 21, 48.25, 0, 2, M.wall);
    box(21, 0.3, 21, 38, 4.5, 2, M.ceiling);
    sign('CHOW HALL  ·  COMMISSARY', 5.2, 0.6, 27.97, 3.6, 1.5, -Math.PI / 2, { w: 768, font: '700 46px' });
    box(8, 1.1, 0.8, 38, 0, -5.6, M.steel);                                // commissary counter
    box(2.5, 1.6, 0.12, 35.2, 1.1, -5.6, M.steelDark, { collide: false });
    box(2.5, 1.6, 0.12, 40.8, 1.1, -5.6, M.steelDark, { collide: false });
    barRun(36.5, -5.6, 39.5, -5.6, 1.75, 0.95);
    sign('COMMISSARY', 3.4, 0.6, 38, 3.2, -5.5, 0, { bg: '#7a2e2e' });
    for (let i = 0; i < 4; i++) box(1.2, 0.5, 0.4, 35 + i * 2, 1.1, -7.7, [M.red, M.yellow, M.paint, M.white][i], { collide: false });
    [33.5, 38, 42.5].forEach(function (x) {
      box(1.0, 0.08, 5, x, 0.74, 5.5, M.steel, { collide: false });
      box(0.4, 0.06, 5, x - 0.85, 0.44, 5.5, M.steel, { collide: false });
      box(0.4, 0.06, 5, x + 0.85, 0.44, 5.5, M.steel, { collide: false });
      addCollider(x, 0, 5.5, 2.1, 0.8, 5);
    });
    box(4, 0.08, 0.5, 38, 4.42, 2, M.glow, { collide: false, shadow: false });
    const cl = new T.PointLight(0xf2f6ff, 5, 22, 1.2); cl.position.set(38, 3.8, 2); scene.add(cl);

    // ===== perimeter =====
    box(124, 8, 1, 0, 0, 46, M.wallDark); box(124, 8, 1, 0, 0, -52, M.wallDark);
    box(1, 8, 99, -62, 0, -3, M.wallDark); box(1, 8, 99, 62, 0, -3, M.wallDark);
    for (let i = 0; i < 170; i++) { coilList.push([-61 + i * 0.72, 8.35, 46, Math.PI / 2]); coilList.push([-61 + i * 0.72, 8.35, -52, Math.PI / 2]); }
    for (let i = 0; i < 136; i++) { coilList.push([-62, 8.35, -52 + i * 0.72, 0]); coilList.push([62, 8.35, -52 + i * 0.72, 0]); }
    [[-36, 37], [36, 37], [-54, -46], [54, -46]].forEach(function (p) {
      box(3, 10, 3, p[0], 0, p[1], M.wall);
      box(4.6, 0.3, 4.6, p[0], 10, p[1], M.wallDark, { collide: false });
      box(4, 2.4, 4, p[0], 10.3, p[1], L(0x39464f), { collide: false });
      box(5, 0.3, 5, p[0], 12.7, p[1], M.steelDark, { collide: false });
    });

    // instanced bars + razor coils
    const bg = new T.CylinderGeometry(0.022, 0.022, 1, 5);
    const bars = new T.InstancedMesh(bg, M.steelDark, barList.length);
    const d = new T.Object3D();
    barList.forEach(function (b, i) { d.position.set(b[0], b[1] + b[3] / 2, b[2]); d.scale.set(1, b[3], 1); d.rotation.set(0, 0, 0); d.updateMatrix(); bars.setMatrixAt(i, d.matrix); });
    world.add(bars);
    const cg = new T.TorusGeometry(0.33, 0.018, 4, 10);
    const coils = new T.InstancedMesh(cg, L(0xa9b1b6), coilList.length);
    coilList.forEach(function (b, i) { d.position.set(b[0], b[1], b[2]); d.scale.set(1, 1, 1); d.rotation.set(0, b[3], 0.5); d.updateMatrix(); coils.setMatrixAt(i, d.matrix); });
    world.add(coils);

    solid2D = colliders.filter(function (c) { return c.minY < 1.6 && c.maxY > 0.15; });
  }

  // -------------------------------------------------------------- characters
  const headGeo = new T.SphereGeometry(0.15, 14, 10);
  const hairGeo = new T.SphereGeometry(0.158, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  function makeChar(o) {
    o = o || {};
    const skin = L(o.skin || 0xc99774), shirt = L(o.shirt || 0xeeeae0), pants = L(o.pants || 0xe4e0d5), shoe = L(0x2a2a2a);
    const w = o.w || 1, g = new T.Group(), body = new T.Group(); g.add(body);
    const bx = function (W, H, D, x, y, z, mat, parent) {
      const m = new T.Mesh(unitBox, mat); m.scale.set(W, H, D); m.position.set(x, y, z); m.castShadow = true; (parent || body).add(m); return m;
    };
    bx(0.5 * w, 0.62, 0.27 * (o.belly || 1), 0, 1.14, 0, shirt);
    bx(0.47 * w, 0.2, 0.26, 0, 0.78, 0, pants);
    bx(0.1, 0.1, 0.1, 0, 1.49, 0, skin);
    const head = new T.Mesh(headGeo, skin); head.scale.set(1, 1.12, 1.02); head.position.y = 1.66; head.castShadow = true; body.add(head);
    bx(0.035, 0.03, 0.02, -0.055, 1.69, 0.14, M.black); bx(0.035, 0.03, 0.02, 0.055, 1.69, 0.14, M.black);
    if (o.hair != null) { const h = new T.Mesh(hairGeo, L(o.hair)); h.position.y = 1.685; h.rotation.x = -0.25; h.scale.set(1.02, 1.1, 1.05); body.add(h); }
    if (o.glasses) { bx(0.3, 0.012, 0.012, 0, 1.69, 0.15, M.black); bx(0.09, 0.06, 0.012, -0.06, 1.69, 0.152, L(0x31363b)); bx(0.09, 0.06, 0.012, 0.06, 1.69, 0.152, L(0x31363b)); }
    if (o.cap) { bx(0.32, 0.1, 0.32, 0, 1.8, 0, L(o.cap)); bx(0.3, 0.03, 0.16, 0, 1.77, 0.2, L(o.cap)); }
    if (o.badge) bx(0.07, 0.08, 0.02, 0.14, 1.32, 0.14, M.yellow);
    const limb = function (x, y, isArm) {
      const p = new T.Group(); p.position.set(x, y, 0); body.add(p);
      if (isArm) { bx(0.14, 0.28, 0.15, 0, -0.12, 0, shirt, p); bx(0.11, 0.36, 0.12, 0, -0.42, 0, skin, p); }
      else { bx(0.18, 0.72, 0.19, 0, -0.36, 0, pants, p); bx(0.18, 0.08, 0.27, 0, -0.74, 0.04, shoe, p); }
      return p;
    };
    const c = {
      g: g, body: body,
      aL: limb(-(0.25 * w + 0.08), 1.43, true), aR: limb(0.25 * w + 0.08, 1.43, true),
      lL: limb(-0.12, 0.78, false), lR: limb(0.12, 0.78, false),
      phase: Math.random() * 6, amp: 0, pose: 'stand', flail: 0,
    };
    const s = o.h || 1; g.scale.set(s, s, s);
    scene.add(g);
    return c;
  }
  function animChar(c, dt, moving, rate) {
    c.amp += ((moving ? 1 : 0) - c.amp) * Math.min(1, dt * 10);
    if (moving) c.phase += dt * (rate || 8);
    const sw = Math.sin(c.phase) * 0.75 * c.amp;
    const t = performance.now() / 1000;
    if (c.pose === 'sit') {
      c.body.position.y = -0.3; c.lL.rotation.x = c.lR.rotation.x = -Math.PI / 2;
      c.aL.rotation.x = c.aR.rotation.x = -0.9 + Math.sin(t * 0.7 + c.phase) * 0.05; c.body.rotation.x = 0.08;
    } else if (c.pose === 'floor') {
      c.body.position.y = -0.62; c.lL.rotation.x = -1.45; c.lR.rotation.x = -1.2; c.aL.rotation.x = -0.3; c.aR.rotation.x = -1.9; c.body.rotation.x = -0.2;
    } else if (c.flail > 0) {
      c.body.position.y = 0; c.body.rotation.x = 0.15;
      c.aL.rotation.x = -1.4 + Math.sin(t * 13 + c.phase) * 0.9; c.aR.rotation.x = -1.4 + Math.cos(t * 11 + c.phase) * 0.9;
      c.lL.rotation.x = Math.sin(t * 9) * 0.3; c.lR.rotation.x = -Math.sin(t * 9) * 0.3;
    } else {
      c.body.position.y = Math.abs(Math.sin(c.phase)) * 0.04 * c.amp; c.body.rotation.x = 0.06 * c.amp;
      c.lL.rotation.x = sw; c.lR.rotation.x = -sw;
      const idle = Math.sin(t * 1.3 + c.phase) * 0.03;
      c.aL.rotation.x = -sw * 0.8 + idle; c.aR.rotation.x = sw * 0.8 - idle;
    }
  }
  function nameTag(text) {
    const sp = new T.Sprite(new T.SpriteMaterial({ map: textTex(text, { w: 384, h: 80, font: '700 44px', stroke: 'rgba(0,0,0,.85)', fg: '#f3ecd8' }), depthTest: false, transparent: true }));
    sp.scale.set(1.5, 0.31, 1); sp.position.y = 2.08; sp.renderOrder = 5; sp.visible = false;
    return sp;
  }

  const W = 0xeeeae0, WP = 0xe4e0d5, GS = 0x8d949b, GP = 0x2e3338;
  const CAST = {
    raymond: { name: 'Raymond', skin: 0x74503a, hair: 0x9a9a98, w: 1.08, belly: 1.15 },
    nathan:  { name: 'Nathan', skin: 0xd8ab88, hair: 0x6b4e2e, w: 0.94, glasses: true, h: 1.02 },
    alvarez: { name: 'Officer Alvarez', skin: 0xb8845f, hair: 0x1d1a18, shirt: GS, pants: GP, cap: 0x2e3338, badge: true, w: 0.95, h: 0.97 },
    briggs:  { name: 'Officer Briggs', skin: 0xe2b9a0, hair: 0x7a5a3a, shirt: GS, pants: GP, cap: 0x2e3338, badge: true, w: 1.2, belly: 1.4 },
    tiny:    { name: 'Tiny', skin: 0xb98360, w: 0.92, h: 0.96 },
    cutter:  { name: 'Cutter', skin: 0xd9b299, w: 1.25, h: 1.06 },
    rowA:    { name: 'Row soldier', skin: 0xa87850, hair: 0x1a1a1a, w: 1.12 },
    rowB:    { name: 'Row soldier', skin: 0xe0c0a8, w: 1.1 },
    duke:    { name: 'Duke', skin: 0xa87850, hair: 0x111111, w: 0.9, h: 1.05 },
    clerk:   { name: 'Ms. Okafor', skin: 0x5e3f2c, hair: 0x111111, shirt: 0x3f6a94, pants: 0x2b2f38, w: 0.92, h: 0.95 },
    dee:     { name: "Lil' Dee", skin: 0x8a5c40, hair: 0x151515, w: 0.95 },
    dom2:    { name: 'Old Man Suggs', skin: 0xcaa07e, hair: 0xd8d8d4, w: 1.0 },
    f1:      { name: 'Inmate', skin: 0xc09070, hair: 0x2a2018, w: 1.05 },
    f2:      { name: 'Inmate', skin: 0x7b563d, w: 1.1 },
  };
  const npcs = {}; G.npcs = npcs;
  function buildCast() {
    Object.keys(CAST).forEach(function (id) {
      const d = CAST[id], c = makeChar(d);
      c.id = id; c.name = d.name; c.x = 0; c.z = 0; c.rot = 0; c.known = false;
      c.tag = nameTag(d.name); c.g.add(c.tag);
      c.g.visible = false; npcs[id] = c;
    });
  }
  // place: {id:[x,z,rot,pose]} — anyone not listed is hidden
  G.placeCast = function (place) {
    Object.keys(npcs).forEach(function (id) {
      const c = npcs[id], p = place[id];
      c.flail = 0; c.walkTo = null;
      if (!p) { c.g.visible = false; return; }
      c.g.visible = true; c.x = p[0]; c.z = p[1]; c.rot = p[2] || 0; c.pose = p[3] || 'stand';
      c.g.position.set(c.x, 0, c.z); c.g.rotation.y = c.rot;
    });
  };
  G.moveNpc = function (id, x, z, rot, pose) {
    const c = npcs[id]; c.g.visible = true; c.x = x; c.z = z; if (rot != null) c.rot = rot; if (pose) c.pose = pose;
    c.g.position.set(x, 0, z); c.g.rotation.y = c.rot;
  };
  G.npcWalk = function (id, x, z, speed) { npcs[id].walkTo = { x: x, z: z, s: speed || 2.4 }; };

  // ambient population
  const SKINS = [0xc99774, 0x74503a, 0xd8ab88, 0xa87850, 0x8a5c40, 0xe0c0a8, 0x5e3f2c, 0xb98360];
  const HAIRS = [0x1a1a1a, 0x2a2018, null, 0x6b4e2e, null, 0x888888, 0x111111];
  const ZONES = { day: [-10, 10, -40, -14], yard: [-25, 25, -8, 27] };
  const walkers = []; G.walkers = walkers;
  function buildWalkers() {
    for (let i = 0; i < 15; i++) {
      const zone = i < 6 ? 'day' : 'yard';
      const c = makeChar({ skin: SKINS[i % SKINS.length], hair: HAIRS[i % HAIRS.length], w: 0.92 + (i % 4) * 0.07, h: 0.95 + (i % 5) * 0.025 });
      const z = ZONES[zone];
      c.zone = zone; c.x = z[0] + Math.random() * (z[1] - z[0]); c.z = z[2] + Math.random() * (z[3] - z[2]);
      c.wait = Math.random() * 5; c.tx = c.x; c.tz = c.z; c.speed = 1.2 + Math.random() * 0.6; c.rot = 0; c.path = null;
      if (i >= 13) { c.g.traverse(function (m) { if (m.isMesh && m.material.color && m.material.color.getHex() === W) m.material = L(GS); }); }
      walkers.push(c);
    }
  }
  G.setCrowd = function (mode) { // 'normal' | 'none' | 'lockdown' | 'few'
    walkers.forEach(function (c, i) {
      const z = ZONES[c.zone];
      c.path = null; c.done = false;
      c.g.visible = mode === 'normal' || mode === 'lockdown' || (mode === 'few' && i % 3 === 0);
      if (mode === 'normal' || mode === 'few') { c.x = z[0] + Math.random() * (z[1] - z[0]); c.z = z[2] + Math.random() * (z[3] - z[2]); c.tx = c.x; c.tz = c.z; c.speed = 1.2 + Math.random() * 0.6; }
      if (mode === 'lockdown') {
        const s = i % 2 ? 1 : -1, k = i % 5;
        c.path = c.zone === 'yard' ? [[(Math.random() - 0.5) * 2, -10], [(Math.random() - 0.5) * 2, -15]] : [];
        c.path.push([s * 11.6, -39 + 6 * k], [s * 14, -39 + 6 * k]);
        c.speed = 3.6 + Math.random() * 1.6; c.wait = Math.random() * 2.5;
      }
    });
  };
  function stepWalker(c, dt) {
    if (!c.g.visible) return;
    let moving = false;
    if (c.wait > 0) c.wait -= dt;
    else {
      if (c.path) {
        if (!c.path.length) { c.g.visible = false; return; }
        c.tx = c.path[0][0]; c.tz = c.path[0][1];
      }
      const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
      if (d < 0.4) {
        if (c.path) c.path.shift();
        else { const z = ZONES[c.zone]; c.tx = z[0] + Math.random() * (z[1] - z[0]); c.tz = z[2] + Math.random() * (z[3] - z[2]); c.wait = 1 + Math.random() * 7; }
      } else {
        const ox = c.x, oz = c.z;
        c.x += dx / d * c.speed * dt; c.z += dz / d * c.speed * dt;
        resolve(c, 0.3);
        if (!c.path && Math.hypot(c.x - ox, c.z - oz) < c.speed * dt * 0.3) { c.tx = c.x; c.tz = c.z; }
        c.rot = lerpAngle(c.rot, Math.atan2(dx, dz), Math.min(1, dt * 8));
        moving = true;
      }
    }
    c.g.position.set(c.x, 0, c.z); c.g.rotation.y = c.rot;
    animChar(c, dt, moving, c.speed * 3.2);
  }

  // --------------------------------------------------------------- collision
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerpAngle(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; }
  function resolve(p, r) {
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < solid2D.length; i++) {
        const c = solid2D[i];
        if (p.x < c.minX - r || p.x > c.maxX + r || p.z < c.minZ - r || p.z > c.maxZ + r) continue;
        const cx = clamp(p.x, c.minX, c.maxX), cz = clamp(p.z, c.minZ, c.maxZ);
        const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
        else {
          const l = p.x - c.minX, rr = c.maxX - p.x, t = p.z - c.minZ, b = c.maxZ - p.z, m = Math.min(l, rr, t, b);
          if (m === l) p.x = c.minX - r; else if (m === rr) p.x = c.maxX + r; else if (m === t) p.z = c.minZ - r; else p.z = c.maxZ + r;
        }
      }
    }
  }
  function pointBlocked(x, y, z) {
    const e = 0.22;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (x > c.minX - e && x < c.maxX + e && z > c.minZ - e && z < c.maxZ + e && y > c.minY - e && y < c.maxY + e) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ player
  const player = { x: 0, z: -14, rot: Math.PI, c: null, speed: 0 };
  G.player = player;
  const cam = { yaw: 0, pitch: 0.28, dist: 4.4, cur: 4.4 };
  G.cam = cam;
  G.teleport = function (x, z, rot, yaw) {
    player.x = x; player.z = z; player.rot = rot || 0;
    cam.yaw = yaw != null ? yaw : player.rot + Math.PI; cam.pitch = 0.28;
  };

  // ------------------------------------------------------------------- input
  const keys = {};
  const input = { mx: 0, my: 0, run: false };
  G.input = input; G.locked = true; // locked = player control disabled
  window.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (G.onKey) G.onKey(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0 && !e.target.closest('button')) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('blur', function () { for (const k in keys) keys[k] = false; });

  // pointer: mouse drag = look. touch: left half = move stick, right half = look
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  let look = { id: null, x: 0, y: 0 };
  const stickEl = document.getElementById('stick'), nubEl = document.getElementById('nub');
  canvas.addEventListener('pointerdown', function (e) {
    if (G.audioInit) G.audioInit();
    if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.45 && stick.id === null) {
      stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0;
      stickEl.hidden = false; stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; nubEl.style.transform = '';
    } else if (look.id === null) { look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerId === stick.id) {
      let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const d = Math.hypot(dx, dy), max = 56;
      if (d > max) { dx *= max / d; dy *= max / d; }
      stick.x = dx / max; stick.y = dy / max; nubEl.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    } else if (e.pointerId === look.id) {
      const k = e.pointerType === 'touch' ? 0.007 : 0.005;
      cam.yaw -= (e.clientX - look.x) * k; cam.pitch = clamp(cam.pitch + (e.clientY - look.y) * k * 0.8, -0.15, 1.1);
      look.x = e.clientX; look.y = e.clientY;
    }
  });
  function pUp(e) {
    if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; stickEl.hidden = true; }
    if (e.pointerId === look.id) look.id = null;
  }
  canvas.addEventListener('pointerup', pUp); canvas.addEventListener('pointercancel', pUp);
  canvas.addEventListener('wheel', function (e) { cam.dist = clamp(cam.dist + e.deltaY * 0.004, 2.2, 7); }, { passive: true });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ------------------------------------------------------------------- audio
  let ac = null, master = null, sirenNodes = null, muted = false;
  G.audioInit = function () {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
      // room tone
      const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3; }
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const g = ac.createGain(); g.gain.value = 0.16; src.connect(g); g.connect(master); src.start();
    } catch (err) { ac = null; }
  };
  G.setMuted = function (m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; };
  function noiseBurst(dur, freq, gain, q) {
    if (!ac) return;
    const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const s = ac.createBufferSource(); s.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ac.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(master); s.start();
  }
  function tone(freq, dur, gain, type, when) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + (when || 0);
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  G.sfx = {
    step: function () { noiseBurst(0.07, 500 + Math.random() * 300, 0.12, 1.2); },
    blip: function () { tone(660, 0.06, 0.05, 'triangle'); },
    good: function () { tone(520, 0.12, 0.06, 'triangle'); tone(780, 0.16, 0.05, 'triangle', 0.09); },
    bad: function () { tone(180, 0.22, 0.09, 'sawtooth'); },
    clang: function () { noiseBurst(0.5, 900, 0.5, 3); tone(93, 1.6, 0.35); tone(187, 1.1, 0.18); tone(411, 0.7, 0.08); },
    siren: function (on) {
      if (!ac) return;
      if (on && !sirenNodes) {
        const o = ac.createOscillator(), l = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
        o.type = 'square'; o.frequency.value = 620; l.frequency.value = 0.9; lg.gain.value = 180;
        l.connect(lg); lg.connect(o.frequency); g.gain.value = 0.07; o.connect(g); g.connect(master); o.start(); l.start();
        sirenNodes = [o, l];
      } else if (!on && sirenNodes) { sirenNodes.forEach(function (n) { try { n.stop(); } catch (e) { /* stopped */ } }); sirenNodes = null; }
    },
  };

  // ---------------------------------------------------------- marker beacon
  const beacon = new T.Group();
  const beam = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 7, 16, 1, true),
    new T.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
  beam.position.y = 3.5;
  const ring = new T.Mesh(new T.RingGeometry(0.55, 0.75, 24), new T.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
  beacon.add(beam, ring); beacon.visible = false; scene.add(beacon);
  G.marker = null;
  G.setMarker = function (p) { G.marker = p; beacon.visible = !!p; if (p) beacon.position.set(p.x, 0, p.z); };

  // -------------------------------------------------------------------- loop
  G.alarm = false;
  G.updates = [];
  let last = 0, stepAcc = 0;
  const tgt = new T.Vector3();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;

    // movement
    let ix = 0, iy = 0;
    if (!G.locked) {
      if (keys.KeyW || keys.ArrowUp) iy += 1; if (keys.KeyS || keys.ArrowDown) iy -= 1;
      if (keys.KeyD) ix += 1; if (keys.KeyA) ix -= 1;
      if (keys.ArrowLeft) cam.yaw += dt * 2.2; if (keys.ArrowRight) cam.yaw -= dt * 2.2;
      ix += stick.x; iy -= stick.y;
    }
    const mag = Math.hypot(ix, iy);
    let moving = false, run = false;
    if (mag > 0.12) {
      const n = Math.min(1, mag); ix /= mag; iy /= mag;
      run = keys.ShiftLeft || keys.ShiftRight || (stick.id !== null && mag > 0.92);
      const sp = (run ? 5.6 : 3.1) * n;
      const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      const vx = fx * iy + rx * ix, vz = fz * iy + rz * ix;
      player.x += vx * sp * dt; player.z += vz * sp * dt;
      player.rot = lerpAngle(player.rot, Math.atan2(vx, vz), Math.min(1, dt * 12));
      moving = true;
      stepAcc += dt * (run ? 3.4 : 2.3);
      if (stepAcc > 1) { stepAcc = 0; G.sfx.step(); }
    }
    // push out of people, then world
    const push = function (c, r) {
      if (!c.g.visible) return;
      const dx = player.x - c.x, dz = player.z - c.z, d = Math.hypot(dx, dz);
      if (d < r && d > 1e-4) { player.x = c.x + dx / d * r; player.z = c.z + dz / d * r; }
    };
    for (const id in npcs) push(npcs[id], 0.62);
    for (let i = 0; i < walkers.length; i++) push(walkers[i], 0.55);
    resolve(player, 0.34);
    player.c.g.position.set(player.x, 0, player.z); player.c.g.rotation.y = player.rot;
    animChar(player.c, dt, moving, run ? 13 : 8.5);

    // cast
    for (const id in npcs) {
      const c = npcs[id]; if (!c.g.visible) continue;
      let mv = false;
      if (c.walkTo) {
        const dx = c.walkTo.x - c.x, dz = c.walkTo.z - c.z, d = Math.hypot(dx, dz);
        if (d < 0.15) c.walkTo = null;
        else { c.x += dx / d * c.walkTo.s * dt; c.z += dz / d * c.walkTo.s * dt; c.rot = lerpAngle(c.rot, Math.atan2(dx, dz), Math.min(1, dt * 10)); mv = true; }
      }
      c.g.position.set(c.x, 0, c.z); c.g.rotation.y = c.rot;
      animChar(c, dt, mv, 8);
      c.tag.visible = c.known && Math.hypot(player.x - c.x, player.z - c.z) < 9;
    }
    for (let i = 0; i < walkers.length; i++) stepWalker(walkers[i], dt);

    // camera
    tgt.set(player.x, 1.55, player.z);
    const cp = Math.cos(cam.pitch), ox = Math.sin(cam.yaw) * cp, oy = Math.sin(cam.pitch), oz = Math.cos(cam.yaw) * cp;
    const want = cam.dist * (G.portrait ? 1.3 : 1);
    let d = want;
    for (let s = 0.5; s <= want; s += 0.2) {
      if (pointBlocked(tgt.x + ox * s, tgt.y + oy * s, tgt.z + oz * s)) { d = Math.max(0.5, s - 0.3); break; }
    }
    cam.cur += (d - cam.cur) * Math.min(1, dt * (d < cam.cur ? 30 : 5));
    camera.position.set(tgt.x + ox * cam.cur, tgt.y + oy * cam.cur, tgt.z + oz * cam.cur);
    camera.lookAt(tgt);
    player.c.g.visible = cam.cur > 0.9;

    sun.target.position.set(player.x, 0, player.z);
    sun.position.set(player.x + sunDir.x * 70, sunDir.y * 70, player.z + sunDir.z * 70);

    if (G.alarm) {
      const p = 0.5 + 0.5 * Math.sin(now / 160);
      hemi.color.setRGB(1, 0.55 + 0.35 * (1 - p), 0.5 + 0.4 * (1 - p)); hemi.intensity = G.skyBase.hi * (0.75 + 0.5 * p);
    } else if (G.skyBase) { hemi.color.setHex(0xdfe9f5); hemi.intensity = G.skyBase.hi; }

    if (beacon.visible) { ring.scale.setScalar(1 + 0.15 * Math.sin(now / 250)); beam.material.opacity = 0.13 + 0.05 * Math.sin(now / 400); }
    for (let i = 0; i < G.updates.length; i++) G.updates[i](dt, now);
    renderer.render(scene, camera);
  }

  G.boot = function () {
    buildWorld(); buildCast(); buildWalkers();
    player.c = makeChar({ skin: 0xc99774, hair: 0x3a2a1c, w: 1.0 });
    G.setSky('dawn'); G.setCrowd('normal'); resize();
    G.teleport(0, -6, Math.PI, 0.5); cam.pitch = 0.2;
    requestAnimationFrame(frame);
  };
})();
