/* =========================================================================
   ELIJAH'S TRAIN MAYHEM
   A 3D D-train subway run. Three.js r128, no build step, no assets.

   Everything the train does is parameterised by ONE number: `s`, the
   distance travelled along a closed arc-length curve. That is why the
   train can never derail — it is mathematically welded to the rails —
   while still being free to launch off construction ramps on the Y axis.
   ========================================================================= */

(function () {
  'use strict';

  var T = window.THREE;

  if (!T) {
    var l = document.getElementById('loading');
    var n = document.getElementById('nowebgl');
    if (l) l.classList.add('hidden');
    if (n) n.classList.remove('hidden');
    return;
  }

  /* ---------------------------------------------------------------- config */

  var CFG = {
    LOOP_RADIUS: 340,
    CTRL_POINTS: 18,
    STATION_COUNT: 5,
    PLATFORM_SEGS: 16,
    PLATFORM_SEG_LEN: 6,
    PLATFORM_OFFSET: -32,   // platform centre sits behind the stop marker

    CAR_LEN: 18,
    CAR_GAP: 1.6,
    CAR_COUNT: 4,
    HALF_GAUGE: 0.74,

    MAX_SPEED: 42,        // m/s  ~ 94 mph
    MAX_REV_SPEED: 11,
    ACCEL: 7.2,
    BRAKE: 13,
    EBRAKE: 24,
    GRAVITY: 32,

    REQUIRED_RIDERS: 5,
    STOP_ZONE: 13,        // metres either side of the station marker
    RAMP_LEN: 22,
    RAMP_HEIGHT: 3.4,
    RAMP_GAP: 28,

    GROUND_Y: -2
  };

  var STATION_NAMES = [
    'Elijah Square', 'Grand Concourse', '145 St', 'Mayhem Av', 'Coney Island'
  ];

  var CAM_MODES = ['Chase', 'Cab', 'Cinematic', 'Overhead', 'Orbit'];

  var COATS = [0xe8483f, 0x2f6fd0, 0xf0a626, 0x2fa86a, 0x8b5cf6,
               0xef5da8, 0x14b8c6, 0xf1f5f9, 0x64748b, 0xc2410c];
  var SKINS = [0xf1c9a5, 0xd9a06b, 0xa9713f, 0x6f4626, 0x4a2f1b];

  /* ----------------------------------------------------------------- utils */

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
  function sign(v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rng = mulberry32(731983);
  function rand(a, b) { return a + (b - a) * rng(); }
  function pick(arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }

  /* -------------------------------------------------------------- textures */

  function canvas2d(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return { c: c, x: c.getContext('2d') };
  }

  function texBullet(letter) {
    var o = canvas2d(256, 256), x = o.x;
    x.clearRect(0, 0, 256, 256);
    x.fillStyle = '#ff6319';
    x.beginPath(); x.arc(128, 128, 122, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff';
    x.font = 'bold 176px Helvetica, Arial, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(letter, 128, 138);
    var t = new T.CanvasTexture(o.c);
    t.anisotropy = 4;
    return t;
  }

  function texSign(text, sub) {
    var o = canvas2d(1024, 256), x = o.x;
    x.fillStyle = '#0a0a0c'; x.fillRect(0, 0, 1024, 256);
    x.strokeStyle = '#ff6319'; x.lineWidth = 12;
    x.strokeRect(6, 6, 1012, 244);
    x.fillStyle = '#ff6319';
    x.beginPath(); x.arc(112, 128, 62, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff';
    x.font = 'bold 88px Helvetica, Arial, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('D', 112, 134);
    x.textAlign = 'left';
    x.font = 'bold 92px Helvetica, Arial, sans-serif';
    x.fillText(text.toUpperCase(), 200, sub ? 104 : 132);
    if (sub) {
      x.fillStyle = '#9aa1ab';
      x.font = '46px Helvetica, Arial, sans-serif';
      x.fillText(sub.toUpperCase(), 200, 180);
    }
    var t = new T.CanvasTexture(o.c);
    t.anisotropy = 4;
    return t;
  }

  function texRollsign(text) {
    var o = canvas2d(512, 128), x = o.x;
    x.fillStyle = '#050505'; x.fillRect(0, 0, 512, 128);
    x.fillStyle = '#ffb43a';
    x.font = 'bold 62px Helvetica, Arial, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text.toUpperCase(), 256, 70);
    var t = new T.CanvasTexture(o.c);
    t.anisotropy = 4;
    return t;
  }

  function texWindows() {
    var o = canvas2d(128, 256), x = o.x;
    x.fillStyle = '#0c1018'; x.fillRect(0, 0, 128, 256);
    for (var yy = 6; yy < 250; yy += 14) {
      for (var xx = 6; xx < 122; xx += 12) {
        var lit = rng();
        x.fillStyle = lit > 0.55
          ? 'rgba(255,214,150,' + (0.35 + lit * 0.6) + ')'
          : 'rgba(30,40,58,0.85)';
        x.fillRect(xx, yy, 7, 8);
      }
    }
    var t = new T.CanvasTexture(o.c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }

  function texHazard() {
    var o = canvas2d(256, 64), x = o.x;
    x.fillStyle = '#2a2c31'; x.fillRect(0, 0, 256, 64);
    x.fillStyle = '#f5d30a';
    for (var i = -64; i < 256; i += 48) {
      x.beginPath();
      x.moveTo(i, 64); x.lineTo(i + 24, 64); x.lineTo(i + 56, 0); x.lineTo(i + 32, 0);
      x.closePath(); x.fill();
    }
    var t = new T.CanvasTexture(o.c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(28, 1);
    return t;
  }

  function texGround() {
    var o = canvas2d(256, 256), x = o.x;
    x.fillStyle = '#20232b'; x.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 1800; i++) {
      x.fillStyle = 'rgba(255,255,255,' + (rng() * 0.035) + ')';
      x.fillRect(rng() * 256, rng() * 256, 2, 2);
    }
    x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 2;
    for (var g = 0; g <= 256; g += 64) {
      x.beginPath(); x.moveTo(g, 0); x.lineTo(g, 256); x.stroke();
      x.beginPath(); x.moveTo(0, g); x.lineTo(256, g); x.stroke();
    }
    var t = new T.CanvasTexture(o.c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(180, 180);
    return t;
  }

  function texSky() {
    var o = canvas2d(64, 512), x = o.x;
    var g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0.00, '#0a1330');
    g.addColorStop(0.34, '#1d3a6b');
    g.addColorStop(0.60, '#4d6fa0');
    g.addColorStop(0.80, '#c98a5a');
    g.addColorStop(0.92, '#ffb46b');
    g.addColorStop(1.00, '#ffd9a1');
    x.fillStyle = g; x.fillRect(0, 0, 64, 512);
    var t = new T.CanvasTexture(o.c);
    t.magFilter = T.LinearFilter;
    return t;
  }

  function texTile() {
    var o = canvas2d(128, 128), x = o.x;
    x.fillStyle = '#e8e4da'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#c9c3b5';
    for (var yy = 0; yy < 128; yy += 16) {
      for (var xx = 0; xx < 128; xx += 16) {
        x.fillRect(xx + 1, yy + 1, 14, 14);
      }
    }
    x.fillStyle = '#0f5f3f';
    x.fillRect(0, 0, 128, 16);
    var t = new T.CanvasTexture(o.c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(3, 1);
    return t;
  }

  /* ------------------------------------------------------------- app state */

  var dom = {};
  ['loading', 'loadFill', 'loadLabel', 'menu', 'how', 'pause', 'hud', 'nowebgl',
   'btnStart', 'btnHow', 'btnHowClose', 'btnQuality', 'btnSound',
   'btnResume', 'btnMenuBack', 'score', 'riders', 'lap', 'stationName',
   'stationDist', 'alignWrap', 'alignFill', 'alignLabel', 'objective', 'toasts',
   'gaugeFg', 'speedVal', 'gearVal', 'doorVal', 'camVal', 'warn',
   'btnThrottle', 'btnBrake', 'btnDoors', 'btnRev', 'btnHorn', 'btnCam', 'btnPause',
   'pauseScore', 'pauseRiders'].forEach(function (id) { dom[id] = document.getElementById(id); });

  var STATE = 'boot';           // boot | menu | play | pause
  var QUALITY = 2;              // 0 low, 1 medium, 2 high
  var QUALITY_NAMES = ['Low', 'Medium', 'High'];
  var SOUND_ON = true;

  var renderer, scene, camera, clock;
  var TRACK = null;
  var STATIONS = [];
  var RAMPS = [];
  var passengers = [];
  var sparks = null;

  var train = {
    s: 0, speed: 0, gear: 1,
    jumpY: 0, jumpV: 0, jumpYPrev: 0, airborne: false,
    lastRamp: null, airStartS: 0, airTime: 0,
    doorOpen: 0, doorTarget: 0,
    wheelSpin: 0, pitch: 0, roll: 0,
    cars: [], group: null, riderSlots: []
  };

  var game = {
    score: 0, riders: 0, lap: 1,
    target: 0, boarded: 0, cleared: false,
    docked: false, distTotal: 0, spawnedFor: -1
  };

  var input = { throttle: 0, brake: 0, ebrake: false };
  var camState = { mode: 0, pos: new T.Vector3(), look: new T.Vector3(), shake: 0, orbit: 0, fov: 62 };

  var WORLD_UP = new T.Vector3(0, 1, 0);
  var _v1 = new T.Vector3(), _v2 = new T.Vector3(), _v3 = new T.Vector3();
  var _m = new T.Matrix4(), _q = new T.Quaternion();
  var dummy = new T.Object3D();

  // reusable curve frames — the render loop must not allocate
  var POOL = [];
  for (var _p = 0; _p < 12; _p++) POOL.push({});
  function pf(slot, s) { return frameAt(s, POOL[slot]); }

  /* ------------------------------------------------------------ curve math */

  function frameAt(s, out) {
    var L = TRACK.length;
    var u = (((s % L) + L) % L) / L;
    out = out || {};
    out.p = TRACK.curve.getPointAt(u, out.p || new T.Vector3());
    out.t = TRACK.curve.getTangentAt(u, out.t || new T.Vector3()).normalize();
    out.right = (out.right || new T.Vector3()).crossVectors(out.t, WORLD_UP).normalize();
    out.up = (out.up || new T.Vector3()).crossVectors(out.right, out.t).normalize();
    return out;
  }

  function quatFromFrame(f, q) {
    q = q || new T.Quaternion();
    _m.makeBasis(f.right, f.up, _v3.copy(f.t).negate());
    return q.setFromRotationMatrix(_m);
  }

  // shortest signed difference around the loop
  function wrapDelta(d) {
    var L = TRACK.length;
    d = ((d % L) + L) % L;
    return d > L / 2 ? d - L : d;
  }

  function curvatureAt(s) {
    var a = frameAt(s), b = frameAt(s + 6);
    return a.t.distanceTo(b.t) / 6;
  }

  /* --------------------------------------------------------------- 1. boot */

  function initRenderer() {
    var canvas = document.getElementById('scene');
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: QUALITY > 0, powerPreference: 'high-performance' });
    } catch (e) {
      return false;
    }
    if (!renderer || !renderer.getContext()) return false;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY === 2 ? 2 : 1.35));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = QUALITY === 2;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    scene = new T.Scene();
    scene.fog = new T.Fog(0x6f86ab, 420, 2600);

    camera = new T.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 6000);
    camera.position.set(0, 60, 200);

    clock = new T.Clock();
    return true;
  }

  function buildSky() {
    var sky = new T.Mesh(
      new T.SphereGeometry(4200, 32, 20),
      new T.MeshBasicMaterial({ map: texSky(), side: T.BackSide, fog: false, depthWrite: false })
    );
    scene.add(sky);

    var hemi = new T.HemisphereLight(0x9dbbe8, 0x2b2b33, 0.62);
    scene.add(hemi);

    var sun = new T.DirectionalLight(0xffd9a8, 1.45);
    sun.position.set(-620, 480, 340);
    {
      sun.castShadow = true;
      sun.shadow.mapSize.set(1536, 1536);
      sun.shadow.camera.near = 10;
      sun.shadow.camera.far = 1400;
      var d = 190;
      sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
      sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
      sun.shadow.bias = -0.0009;
    }
    scene.add(sun);
    scene.add(sun.target);
    scene.userData.sun = sun;

    var glow = new T.Mesh(
      new T.SphereGeometry(120, 16, 12),
      new T.MeshBasicMaterial({ color: 0xffd9a0, fog: false, transparent: true, opacity: 0.55 })
    );
    glow.position.set(-2400, 1600, 1300);
    scene.add(glow);
  }

  function buildTrack() {
    var pts = [];
    for (var i = 0; i < CFG.CTRL_POINTS; i++) {
      var a = i / CFG.CTRL_POINTS * Math.PI * 2;
      var r = CFG.LOOP_RADIUS * (0.86 + 0.16 * Math.sin(a * 2 + 0.7) + 0.07 * Math.sin(a * 3 + 2.1));
      var y = 16 + 6.5 * Math.sin(a * 3 + 0.4) + 3.5 * Math.sin(a * 5 + 1.9);
      pts.push(new T.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    var curve = new T.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    curve.arcLengthDivisions = 4000;
    TRACK = { curve: curve, length: curve.getLength() };
  }

  function placeStationsAndRamps() {
    var L = TRACK.length;
    var slice = L / CFG.STATION_COUNT;
    for (var i = 0; i < CFG.STATION_COUNT; i++) {
      // inside each slice, pick the flattest, straightest metre for a platform
      var best = i * slice, bestC = Infinity;
      for (var k = 0; k < 44; k++) {
        var s = i * slice + slice * 0.18 + (slice * 0.64) * (k / 43);
        var c = curvatureAt(s) + curvatureAt(s - 30) + curvatureAt(s + 30);
        if (c < bestC) { bestC = c; best = s; }
      }
      STATIONS.push({ index: i, s: best, name: STATION_NAMES[i % STATION_NAMES.length], group: null, spawned: false });
    }
    // ramps sit in the middle of every other gap, far from any platform
    for (var g = 0; g < CFG.STATION_COUNT; g += 2) {
      var a2 = STATIONS[g].s;
      var b2 = STATIONS[(g + 1) % CFG.STATION_COUNT].s;
      var gap = wrapDelta(b2 - a2); if (gap < 0) gap += L;
      var rs = a2 + gap * 0.42;
      RAMPS.push({
        s0: rs, len: CFG.RAMP_LEN, h: CFG.RAMP_HEIGHT,
        gapEnd: rs + CFG.RAMP_LEN + CFG.RAMP_GAP,
        clearS: rs + CFG.RAMP_LEN + CFG.RAMP_GAP
      });
    }
  }

  function inRailGap(s) {
    for (var i = 0; i < RAMPS.length; i++) {
      var r = RAMPS[i];
      var d = wrapDelta(s - r.s0);
      if (d > -3 && d < r.len + CFG.RAMP_GAP + 4) return true;
    }
    return false;
  }

  /* Builds a flat ribbon (the concrete viaduct deck) following the curve. */
  function ribbon(halfWidth, dy, material, step) {
    step = step || 3;
    var n = Math.floor(TRACK.length / step);
    var pos = [], uv = [], idx = [];
    for (var i = 0; i <= n; i++) {
      var f = frameAt(i * step);
      var lx = _v1.copy(f.p).addScaledVector(f.right, -halfWidth).addScaledVector(f.up, dy);
      var rx = _v2.copy(f.p).addScaledVector(f.right, halfWidth).addScaledVector(f.up, dy);
      pos.push(lx.x, lx.y, lx.z, rx.x, rx.y, rx.z);
      uv.push(0, i / 5, 1, i / 5);
    }
    for (var j = 0; j < n; j++) {
      var a = j * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    var mesh = new T.Mesh(geo, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  function buildRails() {
    var railMat = new T.MeshStandardMaterial({ color: 0xb9c0c8, metalness: 0.92, roughness: 0.32 });

    // work out the ranges where rails exist (everything except ramp gaps)
    var breaks = [];
    RAMPS.forEach(function (r) {
      var a = ((r.s0 - 3) % TRACK.length + TRACK.length) % TRACK.length;
      breaks.push({ a: a, b: a + r.len + CFG.RAMP_GAP + 7 });
    });
    breaks.slice().forEach(function (br) {
      if (br.b > TRACK.length) breaks.push({ a: 0, b: br.b - TRACK.length });
    });
    breaks.sort(function (x, y) { return x.a - y.a; });

    var ranges = [];
    var cursor = 0;
    breaks.forEach(function (br) {
      if (br.a > cursor) ranges.push([cursor, br.a]);
      cursor = Math.max(cursor, br.b);
    });
    if (cursor < TRACK.length) ranges.push([cursor, TRACK.length]);

    ranges.forEach(function (rg) {
      [-1, 1].forEach(function (side) {
        var pts = [];
        for (var s = rg[0]; s <= rg[1]; s += 3.5) {
          var f = frameAt(s);
          pts.push(new T.Vector3().copy(f.p)
            .addScaledVector(f.right, side * CFG.HALF_GAUGE)
            .addScaledVector(f.up, 0.06));
        }
        if (pts.length < 4) return;
        var c = new T.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
        var tube = new T.TubeGeometry(c, Math.max(12, pts.length * 2), 0.085, 5, false);
        var m = new T.Mesh(tube, railMat);
        m.castShadow = false;
        scene.add(m);
      });
    });

    // sleepers
    var tieGeo = new T.BoxGeometry(2.9, 0.2, 0.3);
    var tieMat = new T.MeshStandardMaterial({ color: 0x4a4238, roughness: 0.95 });
    var step = 2.4;
    var list = [];
    for (var s2 = 0; s2 < TRACK.length; s2 += step) {
      if (inRailGap(s2)) continue;
      list.push(s2);
    }
    var ties = new T.InstancedMesh(tieGeo, tieMat, list.length);
    for (var i = 0; i < list.length; i++) {
      var f2 = frameAt(list[i]);
      dummy.position.copy(f2.p).addScaledVector(f2.up, -0.09);
      dummy.quaternion.copy(quatFromFrame(f2));
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      ties.setMatrixAt(i, dummy.matrix);
    }
    ties.instanceMatrix.needsUpdate = true;
    scene.add(ties);
  }

  function buildViaduct() {
    // deck
    var deckMat = new T.MeshStandardMaterial({ color: 0x3a3d45, roughness: 0.94, metalness: 0.05 });
    scene.add(ribbon(3.5, -0.32, deckMat, 3));

    // side parapets
    var edgeMat = new T.MeshStandardMaterial({ color: 0x2a2d34, roughness: 0.8, metalness: 0.3 });
    var railingGeo = new T.BoxGeometry(0.22, 1.0, 2.0);
    var count = Math.floor(TRACK.length / 2);
    var railing = new T.InstancedMesh(railingGeo, edgeMat, count * 2);
    var n = 0;
    for (var i = 0; i < count; i++) {
      var f = frameAt(i * 2 + 1);
      for (var k = -1; k <= 1; k += 2) {
        dummy.position.copy(f.p).addScaledVector(f.right, k * 3.5).addScaledVector(f.up, 0.18);
        dummy.quaternion.copy(quatFromFrame(f));
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        railing.setMatrixAt(n++, dummy.matrix);
      }
    }
    railing.instanceMatrix.needsUpdate = true;
    scene.add(railing);

    // support columns down to the street
    var colGeo = new T.CylinderGeometry(0.55, 0.8, 1, 8);
    colGeo.translate(0, 0.5, 0);
    var colMat = new T.MeshStandardMaterial({ color: 0x33363d, roughness: 0.9 });
    var cols = [];
    for (var s = 0; s < TRACK.length; s += 22) cols.push(s);
    var pillars = new T.InstancedMesh(colGeo, colMat, cols.length * 2);
    var p = 0;
    for (var c = 0; c < cols.length; c++) {
      var ff = frameAt(cols[c]);
      for (var side = -1; side <= 1; side += 2) {
        var h = ff.p.y - CFG.GROUND_Y - 0.4;
        dummy.position.set(
          ff.p.x + ff.right.x * side * 2.6,
          CFG.GROUND_Y,
          ff.p.z + ff.right.z * side * 2.6
        );
        dummy.quaternion.identity();
        dummy.scale.set(1, Math.max(h, 1), 1);
        dummy.updateMatrix();
        pillars.setMatrixAt(p++, dummy.matrix);
      }
    }
    pillars.instanceMatrix.needsUpdate = true;
    pillars.castShadow = true;
    scene.add(pillars);
  }

  function buildRamps() {
    var hazMat = new T.MeshStandardMaterial({ map: texHazard(), roughness: 0.75, metalness: 0.35 });
    var steelMat = new T.MeshStandardMaterial({ color: 0x6b5340, roughness: 0.85, metalness: 0.5 });
    var segGeo = new T.BoxGeometry(6.6, 0.55, 1.06);

    RAMPS.forEach(function (r) {
      // the kicker
      var N = 24;
      for (var i = 0; i < N; i++) {
        var t0 = i / N, t1 = (i + 0.5) / N;
        var h = r.h * Math.pow(t1, 1.7);
        var f = frameAt(r.s0 + t1 * r.len);
        var m = new T.Mesh(segGeo, hazMat);
        m.position.copy(f.p).addScaledVector(f.up, h - 0.22);
        m.quaternion.copy(quatFromFrame(f));
        m.scale.z = r.len / N + 0.06;
        m.castShadow = true;
        m.receiveShadow = true;
        scene.add(m);
      }
      // steel work zone deck across the gap
      var gN = Math.floor(CFG.RAMP_GAP / 3);
      var plate = new T.BoxGeometry(6.6, 0.3, 3.1);
      for (var g = 0; g < gN; g++) {
        var fg = frameAt(r.s0 + r.len + (g + 0.5) * 3);
        var pm = new T.Mesh(plate, steelMat);
        pm.position.copy(fg.p).addScaledVector(fg.up, -0.2);
        pm.quaternion.copy(quatFromFrame(fg));
        scene.add(pm);
        if (g % 3 === 0) {
          for (var sd = -1; sd <= 1; sd += 2) {
            var truss = new T.Mesh(new T.BoxGeometry(0.3, 2.2, 0.3), steelMat);
            truss.position.copy(fg.p).addScaledVector(fg.right, sd * 3.1).addScaledVector(fg.up, 1.0);
            truss.quaternion.copy(quatFromFrame(fg));
            scene.add(truss);
          }
        }
      }
      // warning gantry before the ramp
      var fw = frameAt(r.s0 - 26);
      var sign = new T.Mesh(
        new T.PlaneGeometry(7, 2.2),
        new T.MeshBasicMaterial({ map: texSign('Ramp ahead', 'clear the gap above 60 mph'), transparent: true, side: T.DoubleSide })
      );
      sign.position.copy(fw.p).addScaledVector(fw.up, 7.4);
      sign.quaternion.copy(quatFromFrame(fw));
      scene.add(sign);
      for (var sd2 = -1; sd2 <= 1; sd2 += 2) {
        var post = new T.Mesh(new T.BoxGeometry(0.35, 8, 0.35), steelMat);
        post.position.copy(fw.p).addScaledVector(fw.right, sd2 * 3.4).addScaledVector(fw.up, 4);
        post.quaternion.copy(quatFromFrame(fw));
        scene.add(post);
      }
    });
  }

  function buildCity() {
    var ground = new T.Mesh(
      new T.PlaneGeometry(9000, 9000),
      new T.MeshStandardMaterial({ map: texGround(), roughness: 1, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = CFG.GROUND_Y;
    ground.receiveShadow = true;
    scene.add(ground);

    var count = QUALITY === 0 ? 60 : (QUALITY === 1 ? 110 : 170);
    var geo = new T.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    var mat = new T.MeshStandardMaterial({
      color: 0x4a5160, roughness: 0.82, metalness: 0.08,
      map: texWindows(), emissive: 0x121820, emissiveIntensity: 1
    });
    mat.map.repeat.set(2, 6);
    var mesh = new T.InstancedMesh(geo, mat, count);
    var col = new T.Color();
    for (var i = 0; i < count; i++) {
      var ang = rng() * Math.PI * 2;
      var inner = rng() < 0.4;
      var rad = inner ? rand(20, 190) : rand(470, 1500);
      var h = inner ? rand(14, 70) : rand(26, 150);
      var w = rand(16, 40), d = rand(16, 40);
      dummy.position.set(Math.cos(ang) * rad, CFG.GROUND_Y, Math.sin(ang) * rad);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.6 + rng() * 0.08, 0.12 + rng() * 0.12, 0.20 + rng() * 0.16);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = false;
    scene.add(mesh);
  }

  /* ----------------------------------------------------------- 2. stations */

  function buildStations() {
    var tileMat = new T.MeshStandardMaterial({ map: texTile(), roughness: 0.6 });
    var slabMat = new T.MeshStandardMaterial({ color: 0x8d8f95, roughness: 0.92 });
    var edgeMat = new T.MeshStandardMaterial({ color: 0xf5d30a, roughness: 0.7, emissive: 0x3a3200 });
    var steelMat = new T.MeshStandardMaterial({ color: 0x1d2027, roughness: 0.6, metalness: 0.5 });
    var glassMat = new T.MeshStandardMaterial({ color: 0x9fd0e8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.35 });

    var segLen = CFG.PLATFORM_SEG_LEN, segs = CFG.PLATFORM_SEGS;
    var slabGeo = new T.BoxGeometry(4.0, 1.1, segLen + 0.08);
    var edgeGeo = new T.BoxGeometry(0.5, 0.06, segLen + 0.08);
    var wallGeo = new T.BoxGeometry(0.24, 3.2, segLen + 0.08);
    var roofGeo = new T.BoxGeometry(4.6, 0.22, segLen + 0.08);
    var postGeo = new T.BoxGeometry(0.26, 3.5, 0.26);

    var slabs = [], edges = [], walls = [], roofs = [], posts = [];

    STATIONS.forEach(function (st) {
      var start = st.s + CFG.PLATFORM_OFFSET - (segs * segLen) / 2;
      st.doorAnchors = [];
      for (var i = 0; i < segs; i++) {
        var f = frameAt(start + i * segLen + segLen / 2);
        var q = quatFromFrame(f);
        for (var side = -1; side <= 1; side += 2) {
          // platform slab: inner edge 1.75m from centreline
          slabs.push({ p: new T.Vector3().copy(f.p).addScaledVector(f.right, side * 3.75).addScaledVector(f.up, 0.45), q: q });
          edges.push({ p: new T.Vector3().copy(f.p).addScaledVector(f.right, side * 2.0).addScaledVector(f.up, 1.03), q: q });
          walls.push({ p: new T.Vector3().copy(f.p).addScaledVector(f.right, side * 5.72).addScaledVector(f.up, 2.6), q: q });
          roofs.push({ p: new T.Vector3().copy(f.p).addScaledVector(f.right, side * 3.9).addScaledVector(f.up, 4.6), q: q });
          if (i % 3 === 1) {
            posts.push({ p: new T.Vector3().copy(f.p).addScaledVector(f.right, side * 5.3).addScaledVector(f.up, 2.75), q: q });
          }
        }
      }

      // name signs hanging over each platform, readable from the train
      for (var sd = -1; sd <= 1; sd += 2) {
        for (var j = 0; j < 2; j++) {
          var fs = frameAt(st.s + CFG.PLATFORM_OFFSET + (j === 0 ? -26 : 26));
          var board = new T.Mesh(
            new T.PlaneGeometry(6.2, 1.55),
            new T.MeshBasicMaterial({ map: texSign(st.name, 'D Sixth Avenue Express'), side: T.DoubleSide })
          );
          board.position.copy(fs.p).addScaledVector(fs.right, sd * 4.2).addScaledVector(fs.up, 3.5);
          board.quaternion.copy(quatFromFrame(fs));
          board.rotateY(sd > 0 ? -Math.PI / 2 : Math.PI / 2);
          scene.add(board);
        }
      }

      // the stop marker: where the front car should end up
      var fm = frameAt(st.s);
      var marker = new T.Mesh(
        new T.PlaneGeometry(0.7, 2.4),
        new T.MeshBasicMaterial({ color: 0xff6319, side: T.DoubleSide })
      );
      marker.position.copy(fm.p).addScaledVector(fm.right, 2.35).addScaledVector(fm.up, 1.08);
      marker.quaternion.copy(quatFromFrame(fm));
      marker.rotateX(-Math.PI / 2);
      scene.add(marker);

      st.frame = { p: fm.p.clone(), right: fm.right.clone(), up: fm.up.clone(), t: fm.t.clone() };
    });

    function instance(geo, mat, list, cast) {
      var im = new T.InstancedMesh(geo, mat, list.length);
      for (var i = 0; i < list.length; i++) {
        dummy.position.copy(list[i].p);
        dummy.quaternion.copy(list[i].q);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      im.receiveShadow = true;
      im.castShadow = !!cast;
      scene.add(im);
      return im;
    }

    instance(slabGeo, slabMat, slabs);
    instance(edgeGeo, edgeMat, edges);
    instance(wallGeo, tileMat, walls);
    instance(roofGeo, steelMat, roofs, true);
    instance(postGeo, steelMat, posts);
    void glassMat;
  }

  /* --------------------------------------------------------- 3. passengers */

  function buildPassenger() {
    var g = new T.Group();
    var coat = pick(COATS), skin = pick(SKINS);

    var legs = new T.Mesh(
      new T.BoxGeometry(0.36, 0.72, 0.26),
      new T.MeshStandardMaterial({ color: 0x24262c, roughness: 0.9 })
    );
    legs.position.y = 0.36;
    g.add(legs);

    var body = new T.Mesh(
      new T.CylinderGeometry(0.23, 0.27, 0.86, 9),
      new T.MeshStandardMaterial({ color: coat, roughness: 0.75, emissive: coat, emissiveIntensity: 0.12 })
    );
    body.position.y = 1.14;
    g.add(body);

    var head = new T.Mesh(
      new T.SphereGeometry(0.2, 10, 8),
      new T.MeshStandardMaterial({ color: skin, roughness: 0.85 })
    );
    head.position.y = 1.75;
    g.add(head);

    if (rng() > 0.5) {
      var bag = new T.Mesh(
        new T.BoxGeometry(0.3, 0.34, 0.16),
        new T.MeshStandardMaterial({ color: pick(COATS), roughness: 0.8 })
      );
      bag.position.set(0.3, 1.0, 0);
      g.add(bag);
    }

    body.castShadow = true; head.castShadow = true;
    g.userData = { legs: legs, body: body, phase: rng() * 6.28, state: 'wait', target: null, speed: rand(1.9, 2.9) };
    return g;
  }

  function spawnPassengers(st) {
    clearPassengers();
    var n = 5 + Math.floor(rng() * 5);
    var half = (CFG.PLATFORM_SEGS * CFG.PLATFORM_SEG_LEN) / 2 - 7;
    for (var i = 0; i < n; i++) {
      var side = rng() < 0.5 ? -1 : 1;
      var off = rand(-half, half);
      var f = frameAt(st.s + CFG.PLATFORM_OFFSET + off);
      var p = buildPassenger();
      p.position.copy(f.p)
        .addScaledVector(f.right, side * rand(2.6, 5.0))
        .addScaledVector(f.up, 1.0);
      p.quaternion.copy(quatFromFrame(f));
      p.rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2);
      p.userData.side = side;
      p.userData.homeY = p.position.y;
      scene.add(p);
      passengers.push(p);
    }
    st.spawned = true;
  }

  function clearPassengers() {
    passengers.forEach(function (p) { scene.remove(p); });
    passengers.length = 0;
  }

  function doorAnchors() {
    var out = [];
    train.cars.forEach(function (car) {
      car.userData.doorways.forEach(function (dw) {
        out.push(car.localToWorld(new T.Vector3(dw.side * 1.75, 1.02, dw.dz)));
      });
    });
    return out;
  }

  function updatePassengers(dt, time) {
    var anchors = null;
    var boarding = train.doorOpen > 0.8 && Math.abs(train.speed) < 0.4 && game.docked;
    if (boarding) anchors = doorAnchors();

    for (var i = passengers.length - 1; i >= 0; i--) {
      var p = passengers[i], u = p.userData;

      if (u.state === 'wait') {
        p.rotation.y += Math.sin(time * 1.4 + u.phase) * 0.004;
        u.legs.rotation.x = Math.sin(time * 1.6 + u.phase) * 0.06;
        p.position.y = u.homeY + Math.sin(time * 1.9 + u.phase) * 0.015;
        if (boarding && anchors) {
          var best = null, bd = Infinity;
          for (var a = 0; a < anchors.length; a++) {
            var d = anchors[a].distanceToSquared(p.position);
            if (d < bd) { bd = d; best = anchors[a]; }
          }
          if (best && bd < 900) { u.target = best.clone(); u.state = 'walk'; }
        }
      } else if (u.state === 'walk') {
        _v1.copy(u.target).sub(p.position);
        var dist = _v1.length();
        if (dist < 0.55) {
          u.state = 'board';
        } else {
          _v1.normalize();
          p.position.addScaledVector(_v1, Math.min(u.speed * dt, dist));
          p.position.y = lerp(p.position.y, u.target.y + 0.02, 1 - Math.exp(-3 * dt));
          var yaw = Math.atan2(_v1.x, _v1.z);
          p.rotation.set(0, yaw, 0);
          u.legs.rotation.x = Math.sin(time * 11 + u.phase) * 0.55;
          p.position.y += Math.sin(time * 22 + u.phase) * 0.006;
        }
      } else if (u.state === 'board') {
        p.scale.multiplyScalar(1 - 5 * dt);
        p.position.y += 0.6 * dt;
        if (p.scale.x < 0.15) {
          scene.remove(p);
          passengers.splice(i, 1);
          onBoarded();
        }
      }
    }
  }

  /* -------------------------------------------------------------- 4. train */

  var TEX = {};
  function sharedBullet() { if (!TEX.bullet) TEX.bullet = texBullet('D'); return TEX.bullet; }
  function sharedRoll() { if (!TEX.roll) TEX.roll = texRollsign('D  Coney Island'); return TEX.roll; }

  function buildCar(isFront) {
    var g = new T.Group();

    var bodyMat = new T.MeshStandardMaterial({ color: 0xc3c8cf, metalness: 0.68, roughness: 0.34 });
    var darkMat = new T.MeshStandardMaterial({ color: 0x191c22, metalness: 0.5, roughness: 0.6 });
    var blueMat = new T.MeshStandardMaterial({ color: 0x1b4fa8, metalness: 0.35, roughness: 0.45 });
    var glassMat = new T.MeshStandardMaterial({
      color: 0x0e1a26, metalness: 0.3, roughness: 0.12,
      transparent: true, opacity: 0.62, emissive: 0x0a1420
    });
    var doorMat = new T.MeshStandardMaterial({ color: 0xacb3bb, metalness: 0.6, roughness: 0.36 });

    var L = CFG.CAR_LEN;

    var body = new T.Mesh(new T.BoxGeometry(3.05, 2.4, L), bodyMat);
    body.position.y = 2.2;
    body.castShadow = true;
    g.add(body);

    var roofGeo = new T.CylinderGeometry(1.525, 1.525, L, 14, 1);
    roofGeo.rotateX(Math.PI / 2);
    var roof = new T.Mesh(roofGeo, bodyMat);
    roof.position.y = 3.4;
    roof.scale.y = 0.5;
    roof.castShadow = true;
    g.add(roof);

    var skirt = new T.Mesh(new T.BoxGeometry(2.86, 0.9, L - 0.4), darkMat);
    skirt.position.y = 0.55;
    g.add(skirt);

    var stripe = new T.Mesh(new T.BoxGeometry(3.09, 0.32, L - 0.1), blueMat);
    stripe.position.y = 1.32;
    g.add(stripe);

    var windows = new T.Mesh(new T.BoxGeometry(3.08, 0.95, L - 1.6), glassMat);
    windows.position.y = 2.85;
    g.add(windows);

    // doorways: three per side
    var doorways = [];
    var panels = [];
    var dzList = [-5.4, 0, 5.4];
    dzList.forEach(function (dz) {
      [-1, 1].forEach(function (side) {
        var recess = new T.Mesh(new T.BoxGeometry(0.16, 2.2, 1.9), darkMat);
        recess.position.set(side * 1.5, 2.06, dz);
        g.add(recess);

        var frame = new T.Mesh(new T.BoxGeometry(0.06, 2.34, 2.1), blueMat);
        frame.position.set(side * 1.48, 2.06, dz);
        g.add(frame);

        [-1, 1].forEach(function (dir) {
          var panel = new T.Mesh(new T.BoxGeometry(0.11, 2.12, 0.9), doorMat);
          panel.position.set(side * 1.57, 2.05, dz + dir * 0.46);
          g.add(panel);
          var win = new T.Mesh(new T.BoxGeometry(0.03, 0.85, 0.6), glassMat);
          win.position.set(side * 1.63, 2.42, dz + dir * 0.46);
          g.add(win);
          panels.push({ panel: panel, win: win, dz: dz, dir: dir, side: side });
        });

        doorways.push({ dz: dz, side: side });
      });
    });

    // bogies + wheels
    var wheelGeo = new T.CylinderGeometry(0.52, 0.52, 0.26, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    var wheelMat = new T.MeshStandardMaterial({ color: 0x2b2e35, metalness: 0.8, roughness: 0.4 });
    var wheels = [];
    [-6.2, 6.2].forEach(function (bz) {
      var truck = new T.Mesh(new T.BoxGeometry(2.2, 0.45, 3.6), darkMat);
      truck.position.set(0, 0.85, bz);
      g.add(truck);
      [-1, 1].forEach(function (wx) {
        [-1.25, 1.25].forEach(function (wz) {
          var w = new T.Mesh(wheelGeo, wheelMat);
          w.position.set(wx * 1.02, 0.52, bz + wz);
          g.add(w);
          wheels.push(w);
        });
      });
    });

    // side bullets + rollsigns
    var bulletTex = sharedBullet();
    [-1, 1].forEach(function (side) {
      var b = new T.Mesh(
        new T.PlaneGeometry(1.0, 1.0),
        new T.MeshBasicMaterial({ map: bulletTex, transparent: true })
      );
      b.position.set(side * 1.56, 2.6, -7.2);
      b.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(b);

      var rs = new T.Mesh(
        new T.PlaneGeometry(2.6, 0.62),
        new T.MeshBasicMaterial({ map: sharedRoll() })
      );
      rs.position.set(side * 1.55, 3.62, -3.4);
      rs.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(rs);
    });

    if (isFront) {
      var nose = new T.Mesh(new T.BoxGeometry(3.0, 2.3, 0.6), bodyMat);
      nose.position.set(0, 2.25, -L / 2 - 0.25);
      g.add(nose);

      var windshield = new T.Mesh(new T.BoxGeometry(2.5, 1.1, 0.16), glassMat);
      windshield.position.set(0, 3.05, -L / 2 - 0.56);
      g.add(windshield);

      var frontSign = new T.Mesh(
        new T.PlaneGeometry(2.1, 0.5),
        new T.MeshBasicMaterial({ map: sharedRoll() })
      );
      frontSign.position.set(0, 3.72, -L / 2 - 0.57);
      frontSign.rotation.y = Math.PI;   // planes face +Z; the cab faces -Z
      g.add(frontSign);

      var fb = new T.Mesh(
        new T.PlaneGeometry(1.15, 1.15),
        new T.MeshBasicMaterial({ map: sharedBullet(), transparent: true })
      );
      fb.position.set(0, 1.95, -L / 2 - 0.58);
      fb.rotation.y = Math.PI;
      g.add(fb);

      var lampMat = new T.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xfff0c0, emissiveIntensity: 2.2 });
      [-1, 1].forEach(function (lx) {
        var lamp = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), lampMat);
        lamp.position.set(lx * 1.05, 1.25, -L / 2 - 0.5);
        g.add(lamp);
      });

      var head = new T.PointLight(0xffe6b8, 1.4, 90, 2);
      head.position.set(0, 1.6, -L / 2 - 2);
      g.add(head);
    }

    // tail lights on the last car
    g.userData = { doorways: doorways, panels: panels, wheels: wheels };
    return g;
  }

  function buildTrain() {
    train.cars = [];
    for (var i = 0; i < CFG.CAR_COUNT; i++) {
      var car = buildCar(i === 0);
      scene.add(car);
      train.cars.push(car);
    }

    // standing riders inside car 2 — they appear as people board
    train.riderSlots = [];
    var host = train.cars[1] || train.cars[0];
    for (var r = 0; r < 14; r++) {
      var fig = new T.Group();
      var coat = COATS[r % COATS.length];
      var b = new T.Mesh(
        new T.CylinderGeometry(0.2, 0.24, 0.8, 7),
        new T.MeshStandardMaterial({ color: coat, emissive: coat, emissiveIntensity: 0.45, roughness: 0.8 })
      );
      b.position.y = 1.5;
      fig.add(b);
      var h = new T.Mesh(
        new T.SphereGeometry(0.17, 8, 6),
        new T.MeshStandardMaterial({ color: SKINS[r % SKINS.length], emissive: 0x221100, emissiveIntensity: 0.3 })
      );
      h.position.y = 2.06;
      fig.add(h);
      fig.position.set((r % 2 ? 0.85 : -0.85), 0, -7.6 + (r % 7) * 2.5 + (r > 6 ? 0.6 : 0));
      fig.visible = false;
      host.add(fig);
      train.riderSlots.push(fig);
    }
  }

  function buildSparks() {
    var N = 90;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(N * 3);
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    var mat = new T.PointsMaterial({
      color: 0xffc266, size: 0.42, transparent: true, opacity: 0.95,
      blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    var pts = new T.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    sparks = { points: pts, life: new Float32Array(N), vel: new Float32Array(N * 3), n: N, cursor: 0 };
    for (var i = 0; i < N; i++) { pos[i * 3 + 1] = -9999; }
  }

  function emitSparks(origin, count, power) {
    if (!sparks) return;
    var arr = sparks.points.geometry.attributes.position.array;
    for (var i = 0; i < count; i++) {
      var c = sparks.cursor = (sparks.cursor + 1) % sparks.n;
      arr[c * 3] = origin.x; arr[c * 3 + 1] = origin.y; arr[c * 3 + 2] = origin.z;
      sparks.vel[c * 3] = rand(-1, 1) * power;
      sparks.vel[c * 3 + 1] = rand(0.4, 1.6) * power;
      sparks.vel[c * 3 + 2] = rand(-1, 1) * power;
      sparks.life[c] = rand(0.35, 0.8);
    }
    sparks.points.geometry.attributes.position.needsUpdate = true;
  }

  function updateSparks(dt) {
    if (!sparks) return;
    var arr = sparks.points.geometry.attributes.position.array;
    var any = false;
    for (var i = 0; i < sparks.n; i++) {
      if (sparks.life[i] <= 0) continue;
      sparks.life[i] -= dt;
      sparks.vel[i * 3 + 1] -= 22 * dt;
      arr[i * 3] += sparks.vel[i * 3] * dt;
      arr[i * 3 + 1] += sparks.vel[i * 3 + 1] * dt;
      arr[i * 3 + 2] += sparks.vel[i * 3 + 2] * dt;
      if (sparks.life[i] <= 0) arr[i * 3 + 1] = -9999;
      any = true;
    }
    if (any) sparks.points.geometry.attributes.position.needsUpdate = true;
  }

  /* ------------------------------------------------------------ 5. physics */

  function rampAt(s) {
    for (var i = 0; i < RAMPS.length; i++) {
      var r = RAMPS[i];
      var d = wrapDelta(s - r.s0);
      if (d >= 0 && d <= r.len) return { ramp: r, t: d / r.len };
    }
    return null;
  }

  function updateTrain(dt) {
    var doorsShut = train.doorOpen < 0.03;

    // ---- longitudinal motion
    if (STATE === 'menu') {
      train.speed = damp(train.speed, 27, 1.1, dt);
    } else {
      if (!doorsShut) {
        // parking brake while the doors are open — that's the rule
        train.speed = damp(train.speed, 0, 9, dt);
        if (Math.abs(train.speed) < 0.05) train.speed = 0;
      } else {
        if (input.throttle > 0) {
          train.speed += CFG.ACCEL * input.throttle * train.gear * dt;
        }
        var braking = input.ebrake ? CFG.EBRAKE : CFG.BRAKE * input.brake;
        if (braking > 0 && Math.abs(train.speed) > 0) {
          var dv = braking * dt;
          if (dv >= Math.abs(train.speed)) train.speed = 0;
          else train.speed -= sign(train.speed) * dv;
        }
        // rolling resistance + drag
        var drag = (0.42 + Math.abs(train.speed) * 0.012) * dt;
        if (Math.abs(train.speed) <= drag) train.speed = 0;
        else train.speed -= sign(train.speed) * drag;
      }
      var cap = train.gear > 0 ? CFG.MAX_SPEED : CFG.MAX_REV_SPEED;
      train.speed = clamp(train.speed, -CFG.MAX_REV_SPEED, CFG.MAX_SPEED);
      if (train.gear > 0) train.speed = Math.min(train.speed, cap);
      else train.speed = Math.max(train.speed, -cap);
    }

    var ds = train.speed * dt;
    train.s += ds;
    game.distTotal += Math.abs(ds);
    train.wheelSpin -= ds / 0.52;

    // ---- vertical: ramps and airtime
    train.jumpYPrev = train.jumpY;
    if (train.airborne) {
      train.jumpV -= CFG.GRAVITY * dt;
      train.jumpY += train.jumpV * dt;
      train.airTime += dt;
      if (train.jumpY <= 0) {
        train.jumpY = 0;
        train.airborne = false;
        onLanding();
      }
    } else {
      var onRamp = rampAt(train.s);
      if (onRamp) {
        train.jumpY = onRamp.ramp.h * Math.pow(onRamp.t, 1.7);
        train.lastRamp = onRamp.ramp;
      } else {
        if (train.lastRamp && train.speed > 8 && wrapDelta(train.s - train.lastRamp.s0) > train.lastRamp.len) {
          // launched off the kicker
          train.airborne = true;
          train.jumpV = clamp(train.speed * 0.72, 6, 26);
          train.airTime = 0;
          train.airStartS = train.s;
          camState.shake = Math.min(0.6, train.speed * 0.012);
          sfx.launch();
          train.lastRamp = null;
        } else {
          train.jumpY = damp(train.jumpY, 0, 12, dt);
          if (train.jumpY < 0.02) { train.jumpY = 0; train.lastRamp = null; }
        }
      }
    }

    // pitch from vertical rate, roll from curvature
    var vRate = (train.jumpY - train.jumpYPrev) / Math.max(dt, 0.0001);
    var targetPitch = Math.atan2(vRate, Math.max(Math.abs(train.speed), 6)) * 0.85;
    train.pitch = damp(train.pitch, clamp(targetPitch, -0.5, 0.5), 12, dt);

    var f0 = pf(0, train.s), f1 = pf(1, train.s + 12);
    var turn = f0.right.dot(f1.t);
    var targetRoll = clamp(-turn * Math.abs(train.speed) * 0.055, -0.22, 0.22);
    train.roll = damp(train.roll, targetRoll, 6, dt);

    // wheel squeal / sparks when a curve is taken too hot
    var lateral = Math.abs(turn) * Math.abs(train.speed) * 0.9;
    var hot = lateral > 3.2 && !train.airborne;
    if (dom.warn) dom.warn.classList.toggle('hidden', !(hot && STATE === 'play'));
    if (hot && rng() > 0.55) {
      var fw = pf(2, train.s - 6);
      _v1.copy(fw.p).addScaledVector(fw.right, sign(turn) * -0.8).addScaledVector(fw.up, 0.1);
      emitSparks(_v1, 3, 2.2);
      sfx.squeal(clamp(lateral / 9, 0, 1));
    } else {
      sfx.squeal(0);
    }

    // ---- doors
    train.doorOpen = damp(train.doorOpen, train.doorTarget, 5.5, dt);
    if (Math.abs(train.doorOpen - train.doorTarget) < 0.004) train.doorOpen = train.doorTarget;

    // ---- place the cars along the curve
    for (var i = 0; i < train.cars.length; i++) {
      var car = train.cars[i];
      var cs = train.s - i * (CFG.CAR_LEN + CFG.CAR_GAP);
      var f = pf(3 + i, cs);
      car.position.copy(f.p).addScaledVector(f.up, train.jumpY);
      quatFromFrame(f, car.quaternion);
      car.rotateZ(train.roll);
      car.rotateX(train.pitch);

      var u = car.userData;
      for (var d = 0; d < u.panels.length; d++) {
        var pd = u.panels[d];
        var z = pd.dz + pd.dir * (0.46 + train.doorOpen * 1.02);
        pd.panel.position.z = z;
        pd.win.position.z = z;
      }
      for (var w = 0; w < u.wheels.length; w++) u.wheels[w].rotation.x = train.wheelSpin;
    }
  }

  /* ------------------------------------------------------------- 6. camera */

  var _camMid = new T.Vector3();

  function updateCamera(dt) {
    var trainLen = CFG.CAR_COUNT * (CFG.CAR_LEN + CFG.CAR_GAP);
    var f = pf(7, train.s);                                  // nose of the train
    var fMid = pf(9, train.s - trainLen / 2);                // middle of the consist
    var head = _v1.copy(f.p).addScaledVector(f.up, train.jumpY);
    var mid = _camMid.copy(fMid.p).addScaledVector(fMid.up, train.jumpY);

    var mode = CAM_MODES[camState.mode];
    var targetPos = _v2, lookAt = _v3;
    var spd = Math.abs(train.speed);
    camera.up.set(0, 1, 0);

    if (STATE === 'menu') {
      camState.orbit += dt * 0.22;
      var rad = 58 + Math.sin(camState.orbit * 0.6) * 14;
      targetPos.set(
        mid.x + Math.cos(camState.orbit) * rad,
        mid.y + 16 + Math.sin(camState.orbit * 0.8) * 7,
        mid.z + Math.sin(camState.orbit) * rad
      );
      lookAt.copy(mid);
    } else if (mode === 'Chase') {
      // high behind the cab: you can see the road ahead and the nose below
      targetPos.copy(head)
        .addScaledVector(f.t, -(18 + spd * 0.12))
        .addScaledVector(f.up, 9.5 + spd * 0.05);
      lookAt.copy(head).addScaledVector(f.t, 20).addScaledVector(f.up, 1.0);
    } else if (mode === 'Cab') {
      // nose camera, just outside the windshield
      targetPos.copy(head).addScaledVector(f.t, 10.2).addScaledVector(f.up, 3.05);
      lookAt.copy(head).addScaledVector(f.t, 70).addScaledVector(f.up, 2.2);
    } else if (mode === 'Cinematic') {
      // side-on, framing all four cars
      targetPos.copy(mid).addScaledVector(fMid.right, 34).addScaledVector(fMid.up, 7);
      lookAt.copy(mid).addScaledVector(fMid.t, 6);
    } else if (mode === 'Overhead') {
      targetPos.copy(mid).addScaledVector(fMid.up, 78);
      lookAt.copy(mid);
      camera.up.copy(fMid.t);
    } else { // Orbit
      camState.orbit += dt * 0.45;
      targetPos.copy(mid)
        .addScaledVector(fMid.right, Math.cos(camState.orbit) * 42)
        .addScaledVector(fMid.t, Math.sin(camState.orbit) * 42)
        .addScaledVector(fMid.up, 14);
      lookAt.copy(mid);
    }

    var snap = (mode === 'Cab') ? 24 : (mode === 'Overhead' ? 14 : 7);
    camera.position.lerp(targetPos, 1 - Math.exp(-snap * dt));
    camState.look.lerp(lookAt, 1 - Math.exp(-11 * dt));

    if (camState.shake > 0.001) {
      camera.position.x += rand(-1, 1) * camState.shake;
      camera.position.y += rand(-1, 1) * camState.shake;
      camera.position.z += rand(-1, 1) * camState.shake;
      camState.shake = damp(camState.shake, 0, 6, dt);
    }

    camera.lookAt(camState.look);

    var wantFov = 62 + Math.min(spd * 0.38, 17) + (train.airborne ? 4 : 0);
    camState.fov = damp(camState.fov, wantFov, 4, dt);
    if (Math.abs(camera.fov - camState.fov) > 0.02) {
      camera.fov = camState.fov;
      camera.updateProjectionMatrix();
    }

    var sun = scene.userData.sun;
    if (sun) {
      sun.position.set(head.x - 260, head.y + 300, head.z + 190);
      sun.target.position.copy(head);
      sun.target.updateMatrixWorld();
    }
  }


  /* ---------------------------------------------------- 7. station logic */

  function currentStation() { return STATIONS[game.target]; }

  function updateStationLogic(dt) {
    if (STATE !== 'play') return;
    var st = currentStation();
    var delta = wrapDelta(st.s - train.s);   // + means the station is ahead

    // spawn riders as we get close
    if (game.spawnedFor !== game.target && Math.abs(delta) < 260) {
      spawnPassengers(st);
      game.spawnedFor = game.target;
    }

    var inZone = Math.abs(delta) < CFG.STOP_ZONE;
    var stopped = Math.abs(train.speed) < 0.25;
    game.docked = inZone && stopped;

    // alignment bar
    if (Math.abs(delta) < 90) {
      dom.alignWrap.classList.add('on');
      var pct = clamp(50 - (delta / 90) * 50, 2, 98);
      dom.alignFill.style.left = pct + '%';
      if (game.docked) {
        dom.alignLabel.textContent = 'In the zone — open the doors';
        dom.alignLabel.classList.add('good');
        dom.alignFill.style.background = '#35d07f';
      } else if (inZone) {
        dom.alignLabel.textContent = 'Brake — you are in the zone';
        dom.alignLabel.classList.remove('good');
        dom.alignFill.style.background = '#f5d30a';
      } else {
        dom.alignLabel.textContent = delta > 0 ? 'Station ahead' : 'Overshot — try reverse';
        dom.alignLabel.classList.remove('good');
        dom.alignFill.style.background = delta > 0 ? '#f5d30a' : '#ff3b3b';
      }
    } else {
      dom.alignWrap.classList.remove('on');
    }

    dom.btnDoors.classList.toggle('ready', game.docked && train.doorTarget === 0);

    // left the station area for good?
    if (Math.abs(delta) > 150 && game.boarded > 0 && !game.cleared) {
      // rolled away without finishing the pickup
      penaltyDepart();
    }
    if (Math.abs(delta) > 150 && game.boarded === 0 && game.spawnedFor === game.target && wrapDelta(train.s - st.s) > 150) {
      penaltyDepart();
    }
  }

  function onBoarded() {
    forceHUD();
    game.boarded++;
    game.riders++;
    game.score += 100;
    sfx.blip();
    var slot = train.riderSlots[(game.riders - 1) % train.riderSlots.length];
    if (slot) slot.visible = true;

    if (game.boarded === CFG.REQUIRED_RIDERS && !game.cleared) {
      game.cleared = true;
      var st = currentStation();
      var off = Math.abs(wrapDelta(st.s - train.s));
      var precision = Math.round(clamp(250 * (1 - off / CFG.STOP_ZONE), 0, 250));
      game.score += 400 + precision;
      toast(st.name + ' cleared  +' + (400 + precision), 'good', true);
      if (precision > 200) toast('Perfect berth  +' + precision, 'good');
      setObjective('Close the doors and roll out');
      sfx.chime();
    } else if (!game.cleared) {
      setObjective('Riders aboard: ' + game.boarded + ' of ' + CFG.REQUIRED_RIDERS);
    }
  }

  function penaltyDepart() {
    forceHUD();
    game.score = Math.max(0, game.score - 200);
    toast('Stop missed  −200', 'bad');
    advanceStation();
  }

  function advanceStation() {
    forceHUD();
    clearPassengers();
    var prev = game.target;
    game.target = (game.target + 1) % STATIONS.length;
    game.boarded = 0;
    game.cleared = false;
    game.docked = false;
    game.spawnedFor = -1;
    if (game.target === 0 && prev === STATIONS.length - 1) {
      game.lap++;
      game.score += 750;
      toast('Lap ' + game.lap + '  +750', 'good', true);
    }
    setObjective('Next stop: ' + currentStation().name + ' — pick up ' + CFG.REQUIRED_RIDERS);
  }

  function toggleDoors() {
    if (STATE !== 'play') return;
    forceHUD();
    if (train.doorTarget === 0) {
      if (Math.abs(train.speed) > 0.4) { toast('Stop the train first', 'bad'); return; }
      if (!game.docked) { toast('Not at a platform', 'bad'); return; }
      train.doorTarget = 1;
      sfx.doors();
      setObjective('Riders aboard: 0 of ' + CFG.REQUIRED_RIDERS);
    } else {
      train.doorTarget = 0;
      sfx.doors();
      if (game.cleared) {
        toast('Stand clear of the closing doors', 'good');
        advanceStation();
      } else {
        setObjective('Reopen and finish the pickup — ' + game.boarded + ' of ' + CFG.REQUIRED_RIDERS);
      }
    }
  }

  function onLanding() {
    var f = pf(8, train.s);
    camState.shake = 0.55;
    emitSparks(_v1.copy(f.p).addScaledVector(f.up, 0.2), 22, 3.4);
    sfx.thud();
    if (train.lastRamp) train.lastRamp = null;

    if (STATE !== 'play') return;
    var cleared = false;
    for (var i = 0; i < RAMPS.length; i++) {
      var d = wrapDelta(train.s - RAMPS[i].gapEnd);
      if (d > 0 && d < 60) cleared = true;
    }
    var airPts = Math.round(train.airTime * 260);
    if (cleared) {
      game.score += 300 + airPts;
      toast('Gap cleared  +' + (300 + airPts), 'good', true);
    } else if (train.airTime > 0.45) {
      game.score += airPts;
      toast('Air time  +' + airPts, 'good');
    }
  }

  /* ---------------------------------------------------------------- 8. HUD */

  function toast(text, kind, big) {
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '') + (big ? ' big' : '');
    el.textContent = text;
    dom.toasts.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2400);
  }

  function setObjective(text) { dom.objective.textContent = text; }

  var hudTick = 0;
  function forceHUD() { hudTick = 1; }

  function updateHUD(dt) {
    hudTick += dt;

    var mph = Math.abs(train.speed) * 2.2369;
    dom.speedVal.textContent = Math.round(mph);
    var frac = clamp(mph / 100, 0, 1);
    dom.gaugeFg.style.strokeDashoffset = String(251.3 * (1 - frac));
    dom.gaugeFg.style.stroke = mph > 82 ? '#ff3b3b' : (mph > 55 ? '#f5d30a' : '#ff6319');

    if (hudTick < 0.1) return;
    hudTick = 0;

    dom.score.textContent = game.score.toLocaleString();
    dom.riders.textContent = String(game.riders);
    dom.lap.textContent = String(game.lap);

    var st = currentStation();
    dom.stationName.textContent = st.name;
    var raw = wrapDelta(st.s - train.s);
    var d = raw < 0 ? raw + TRACK.length : raw;
    dom.stationDist.textContent = game.docked
      ? 'At the platform'
      : (raw < -1 && raw > -150 ? Math.round(-raw) + ' m behind' : Math.round(d) + ' m ahead');

    dom.gearVal.textContent = train.gear > 0 ? 'FWD' : 'REV';
    dom.gearVal.classList.toggle('rev', train.gear < 0);
    dom.doorVal.textContent = train.doorTarget === 1 ? 'Doors open' : 'Doors closed';
    dom.doorVal.classList.toggle('open', train.doorTarget === 1);
    dom.camVal.textContent = CAM_MODES[camState.mode];
  }

  /* -------------------------------------------------------------- 9. audio */

  var sfx = (function () {
    var ctx = null, master = null, rumbleGain = null, squealGain = null, squealOsc = null, started = false;

    function noiseBuffer() {
      var len = ctx.sampleRate * 2;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      var last = 0;
      for (var i = 0; i < len; i++) {
        var w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.2;
      }
      return buf;
    }

    function init() {
      if (started) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      master = ctx.createGain();
      master.gain.value = SOUND_ON ? 0.85 : 0;
      master.connect(ctx.destination);

      var src = ctx.createBufferSource();
      src.buffer = noiseBuffer(); src.loop = true;
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320;
      rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0;
      src.connect(lp); lp.connect(rumbleGain); rumbleGain.connect(master);
      src.start();

      squealOsc = ctx.createOscillator();
      squealOsc.type = 'sawtooth';
      squealOsc.frequency.value = 2100;
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 9;
      squealGain = ctx.createGain(); squealGain.gain.value = 0;
      squealOsc.connect(bp); bp.connect(squealGain); squealGain.connect(master);
      squealOsc.start();

      started = true;
    }

    function beep(freq, dur, type, vol, slideTo) {
      if (!started || !SOUND_ON) return;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(vol || 0.25, ctx.currentTime + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur + 0.05);
    }

    return {
      init: init,
      resume: function () { if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume(); },
      setMute: function (on) {
        SOUND_ON = on;
        if (master) master.gain.value = on ? 0.85 : 0;
      },
      rumble: function (v) {
        if (!started) return;
        rumbleGain.gain.value = SOUND_ON ? clamp(v, 0, 1) * 0.5 : 0;
      },
      squeal: function (v) {
        if (!started) return;
        squealGain.gain.value = SOUND_ON ? clamp(v, 0, 1) * 0.055 : 0;
      },
      horn: function () { beep(196, 0.9, 'sawtooth', 0.3); beep(262, 0.9, 'sawtooth', 0.22); },
      chime: function () { beep(784, 0.22, 'sine', 0.3); setTimeout(function () { beep(587, 0.35, 'sine', 0.3); }, 190); },
      doors: function () { beep(880, 0.13, 'square', 0.14); setTimeout(function () { beep(660, 0.2, 'square', 0.12); }, 130); },
      blip: function () { beep(1180, 0.07, 'triangle', 0.12); },
      thud: function () { beep(90, 0.3, 'sine', 0.4, 40); },
      launch: function () { beep(300, 0.35, 'triangle', 0.2, 900); }
    };
  })();

  /* -------------------------------------------------------------- 10. input */

  var keys = {};
  window.addEventListener('keydown', function (e) {
    if (keys[e.code]) return;
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'Space', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
    if (e.code === 'KeyE') toggleDoors();
    if (e.code === 'KeyC') cycleCamera();
    if (e.code === 'KeyH') sfx.horn();
    if (e.code === 'KeyR') toggleGear();
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });

  function readKeys() {
    input.throttle = (keys.KeyW || keys.ArrowUp) ? 1 : 0;
    input.brake = (keys.KeyS || keys.ArrowDown) ? 1 : 0;
    input.ebrake = !!keys.Space;
  }

  // iOS suspends the audio context on backgrounding; re-arm on any gesture.
  function armAudio() {
    sfx.init();
    sfx.resume();
  }
  window.addEventListener('pointerdown', armAudio);
  window.addEventListener('keydown', armAudio);

  function hold(el, on, off) {
    if (!el) return;
    var down = function (e) { e.preventDefault(); armAudio(); el.classList.add('on'); on(); };
    var up = function (e) { if (e) e.preventDefault(); el.classList.remove('on'); off(); };
    el.addEventListener('pointerdown', function (e) {
      if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (err) {} }
      down(e);
    });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);
  }

  var touchThrottle = 0, touchBrake = 0;
  hold(dom.btnThrottle, function () { touchThrottle = 1; }, function () { touchThrottle = 0; });
  hold(dom.btnBrake, function () { touchBrake = 1; }, function () { touchBrake = 0; });

  function tap(el, fn) {
    if (!el) return;
    el.addEventListener('click', function (e) { e.preventDefault(); sfx.init(); fn(); });
  }
  tap(dom.btnDoors, toggleDoors);
  tap(dom.btnRev, toggleGear);
  tap(dom.btnHorn, function () { sfx.horn(); });
  tap(dom.btnCam, cycleCamera);
  tap(dom.btnPause, togglePause);

  function toggleGear() {
    if (STATE !== 'play') return;
    if (Math.abs(train.speed) > 0.8) { toast('Come to a stop to change direction', 'bad'); return; }
    train.gear = -train.gear;
    train.speed = 0;
    forceHUD();
    toast(train.gear > 0 ? 'Forward' : 'Reverse');
  }

  function cycleCamera() {
    camState.mode = (camState.mode + 1) % CAM_MODES.length;
    dom.camVal.textContent = CAM_MODES[camState.mode];
  }

  /* --------------------------------------------------- 11. screens / flow */

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function goMenu() {
    STATE = 'menu';
    hide(dom.hud); hide(dom.pause); hide(dom.how);
    show(dom.menu);
    clearPassengers();
    train.doorTarget = 0;
  }

  function startRun() {
    sfx.init();
    hide(dom.menu); hide(dom.how); hide(dom.pause);
    show(dom.hud);
    STATE = 'play';

    game.score = 0; game.riders = 0; game.lap = 1;
    game.boarded = 0; game.cleared = false; game.docked = false; game.spawnedFor = -1;
    train.riderSlots.forEach(function (r) { r.visible = false; });

    // start the run 300 m before the first platform
    game.target = 0;
    train.s = STATIONS[0].s - 300;
    train.speed = 0;
    train.gear = 1;
    train.doorOpen = train.doorTarget = 0;
    train.airborne = false; train.jumpY = 0; train.jumpV = 0; train.lastRamp = null;
    camState.mode = 0;
    setObjective('Next stop: ' + STATIONS[0].name + ' — pick up ' + CFG.REQUIRED_RIDERS);
    toast("Elijah's Train Mayhem", 'good', true);
  }

  function togglePause() {
    if (STATE === 'play') {
      STATE = 'pause';
      dom.pauseScore.textContent = game.score.toLocaleString();
      dom.pauseRiders.textContent = String(game.riders);
      show(dom.pause);
      sfx.rumble(0); sfx.squeal(0);
    } else if (STATE === 'pause') {
      STATE = 'play';
      hide(dom.pause);
    }
  }

  tap(dom.btnStart, startRun);
  tap(dom.btnHow, function () { hide(dom.menu); show(dom.how); });
  tap(dom.btnHowClose, function () { hide(dom.how); show(dom.menu); });
  tap(dom.btnResume, togglePause);
  tap(dom.btnMenuBack, function () { hide(dom.pause); goMenu(); });
  tap(dom.btnQuality, function () {
    QUALITY = (QUALITY + 1) % 3;
    dom.btnQuality.textContent = 'Quality: ' + QUALITY_NAMES[QUALITY];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY === 2 ? 2 : 1.35));
    renderer.shadowMap.enabled = QUALITY === 2;
    scene.traverse(function (o) { if (o.isMesh || o.isInstancedMesh) o.material.needsUpdate = true; });
  });
  tap(dom.btnSound, function () {
    sfx.setMute(!SOUND_ON);
    dom.btnSound.textContent = 'Sound: ' + (SOUND_ON ? 'On' : 'Off');
  });

  window.addEventListener('resize', function () {
    if (!renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && STATE === 'play') togglePause();
  });

  /* ---------------------------------------------------------- 12. main loop */

  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05);
    var time = clock.elapsedTime;

    if (STATE === 'play' || STATE === 'menu') {
      if (STATE === 'play') {
        readKeys();
        input.throttle = Math.max(input.throttle, touchThrottle);
        input.brake = Math.max(input.brake, touchBrake);
        // holding both pads on touch is the emergency brake
        if (touchThrottle && touchBrake) { input.ebrake = true; input.throttle = 0; }
      } else {
        input.throttle = 0; input.brake = 0; input.ebrake = false;
      }
      updateTrain(dt);
      updateStationLogic(dt);
      updatePassengers(dt, time);
      updateSparks(dt);
      sfx.rumble(Math.min(Math.abs(train.speed) / CFG.MAX_SPEED, 1) * (train.airborne ? 0.2 : 1));
    }

    updateCamera(dt);
    if (STATE === 'play') updateHUD(dt);

    renderer.render(scene, camera);
  }

  /* --------------------------------------------------------------- 13. boot */

  var steps = [
    ['Laying track…', function () { buildTrack(); placeStationsAndRamps(); }],
    ['Raising the viaduct…', function () { buildSky(); buildViaduct(); }],
    ['Spiking the rails…', function () { buildRails(); }],
    ['Pouring the ramps…', function () { buildRamps(); }],
    ['Tiling the stations…', function () { buildStations(); }],
    ['Building the skyline…', function () { buildCity(); }],
    ['Rolling out the D…', function () { buildTrain(); buildSparks(); }]
  ];

  function boot() {
    var mobile = ('ontouchstart' in window) && Math.min(window.innerWidth, window.innerHeight) < 900;
    if (mobile) QUALITY = 1;
    dom.btnQuality.textContent = 'Quality: ' + QUALITY_NAMES[QUALITY];

    if (!initRenderer()) { show(dom.nowebgl); hide(dom.loading); return; }

    var i = 0;
    function next() {
      if (i >= steps.length) {
        dom.loadFill.style.width = '100%';
        setTimeout(function () {
          hide(dom.loading);
          train.s = STATIONS[0].s - 200;
          goMenu();
          frame();
        }, 260);
        return;
      }
      dom.loadLabel.textContent = steps[i][0];
      dom.loadFill.style.width = Math.round((i / steps.length) * 100) + '%';
      requestAnimationFrame(function () {
        try {
          steps[i][1]();
        } catch (err) {
          console.error('Build step failed:', steps[i][0], err);
        }
        i++;
        setTimeout(next, 16);
      });
    }
    next();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
