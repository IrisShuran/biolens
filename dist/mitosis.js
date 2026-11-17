/* 细胞分裂 MVP · 独立页面逻辑（R1—R4 返工版）
   单一规范化时间状态 T ∈ [0,30]（秒）驱动阶段、文本、计数与图形。
   每阶段 6 秒，共 30 秒。所有形态变化由同一连续状态插值生成，
   不交叉淡入两个完整模型。无随机性；window.__mitosisSnapshot /
   __mitosisSeek / __mitosisState / __mitosisContainment 提供只读测试接口。
   关键判据分离：分离事件(unpin)、向极迁移(migrate)、成核(envNew)、
   胞质分裂(split) 各自独立，计数/文案/快照共用同一状态。 */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------- 常量 ---------- */
  var STAGES = [
    { n: 1, name: '前期（含前中期）', en: 'Prophase · Prometaphase',
      text: '染色质凝缩成可见的染色体；随后核膜逐渐解体，两极分开，纺锤体微管连接到着丝粒区域的动粒。',
      note: '本示意将前期与前中期合并展示，方便看到凝缩、核膜解体与连接的先后顺序。' },
    { n: 2, name: '中期', en: 'Metaphase',
      text: '复制后的染色体逐条排列在赤道面；每条染色体的两条姐妹染色单体分别与相反两极相连。',
      note: '四条染色体沿赤道面排成一列，不进行同源配对。' },
    { n: 3, name: '后期', en: 'Anaphase',
      text: '姐妹染色单体在着丝粒处分开，成为子染色体并移向两极；每极各获得 A1、A2、B1、B2 各一个拷贝。',
      note: '分离后不再称姐妹染色单体；同源染色体并未互相配对分离。' },
    { n: 4, name: '末期', en: 'Telophase',
      text: '两极的染色体逐渐解凝缩，各自被新的核膜包被；纺锤体消退，分裂沟开始出现。',
      note: '两个新核各保留 4 条染色体身份。' },
    { n: 5, name: '胞质分裂', en: 'Cytokinesis',
      text: '动物细胞的细胞膜在赤道处向内收缩（分裂沟），最终形成两个完整的子细胞。',
      note: '胞质分裂可与有丝分裂后段重叠，这里分步展示。' }
  ];

  // 四条原染色体：A1/A2 长，B1/B2 短。y 为中期赤道列上的纵坐标。
  // 单列顺序长/短交替（A1,B1,A2,B2），避免同源染色体相邻被误读为配对；
  // 间距经空间包含校验（核在膜内、染色体在核内）后确定。
  var CHROMS = [
    { id: 'A1', type: 'long',  color: '#5ce0bd', y0: 240, sx: -16, sy: 10 },
    { id: 'B1', type: 'short', color: '#ffb37a', y0: 295, sx: -12, sy: 6 },
    { id: 'A2', type: 'long',  color: '#74a9e8', y0: 350, sx: 16,  sy: -8 },
    { id: 'B2', type: 'short', color: '#ef8fc7', y0: 405, sx: 12,  sy: -5 }
  ];
  // half = 单条染色单体半长（棒全长 = 2*half）；X 半对角 = half/√2。
  var SIZES = { long: { half: 24 }, short: { half: 17 } };

  var CX = 500, CY = 320;          // 细胞中心
  var POLE_L = 390, POLE_R = 610;  // 两极（左右）
  var MEMB_R0 = 220, MEMB_RD = 165;// 母细胞半径 / 子细胞半径
  var NUC_R = 104;                  // 新核半径（含染色体簇且位于膜内）
  var ENV_OLD_R = 155;              // 前期核膜半径
  var FC = 0.82, GAP_MAX = 24;      // 分裂沟闭合/分开参数

  /* ---------- 工具 ---------- */
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ss(a, b, x) {
    if (b <= a) return x <= a ? 0 : 1;
    var t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }
  function circle(cx, cy, r) {
    return 'M ' + (cx - r) + ' ' + cy + ' A ' + r + ' ' + r + ' 0 1 0 ' + (cx + r) + ' ' + cy +
      ' A ' + r + ' ' + r + ' 0 1 0 ' + (cx - r) + ' ' + cy + ' Z';
  }

  /* ---------- 标量参数（均为 T 的连续函数；事件与迁移分离） ---------- */
  function params(T) {
    var f = 0.35 * ss(20, 24, T) + 0.65 * ss(24, 29, T); // 分裂沟进度
    var gap = GAP_MAX * ss(FC, 1, f);
    return {
      c: ss(0, 2.5, T) * (1 - ss(18, 23, T)),       // 凝缩度 1=紧凑 X，0=舒展
      unpin: ss(12, 13, T),                          // 姐妹分离事件（快，X→单棒）
      migrate: ss(12, 18, T),                        // 向极迁移（慢，独立于分离）
      align: ss(5.5, 9, T),                          // 染色体排到赤道面
      cluster: ss(18, 23, T),                        // 末期向两极核内收拢
      envOld: 1 - ss(2.5, 4.5, T),                   // 前期核膜消失
      envNew: ss(18.5, 22.5, T),                     // 末期新核膜出现
      poleAlpha: ss(1, 2.5, T) * (1 - ss(18, 21, T)),
      fiberAlpha: ss(4.3, 5.8, T) * (1 - ss(18, 22, T)),
      f: f,
      gap: gap,
      splitShift: f > FC ? gap / 2 : 0,              // 胞质分裂时内容随子细胞外移
      poleL: lerp(460, POLE_L, ss(1.5, 5, T)),
      poleR: lerp(540, POLE_R, ss(1.5, 5, T))
    };
  }

  /* ---------- 膜：单环花生形 → 两个子细胞圆 ---------- */
  function membranePaths(P) {
    var p = Math.min(1, P.f / FC);
    if (P.gap <= 0.01) {
      var N = 240, d = '';
      for (var i = 0; i <= N; i++) {
        var th = (i / N) * Math.PI * 2;
        var r = MEMB_R0 * (1 - p) + 2 * MEMB_RD * Math.abs(Math.cos(th)) * p;
        var x = CX + r * Math.cos(th), y = CY + r * Math.sin(th);
        d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      return [d + 'Z'];
    }
    var off = MEMB_RD + P.gap / 2;
    return [circle(CX - off, CY, MEMB_RD), circle(CX + off, CY, MEMB_RD)];
  }

  /* 点是否在膜内（测试/包含校验用） */
  function membraneContains(x, y, P) {
    var dx = x - CX, dy = y - CY;
    if (P.f > FC) {
      var off = MEMB_RD + P.gap / 2;
      var r2 = MEMB_RD * MEMB_RD + 9;
      return (dx + off) * (dx + off) + dy * dy <= r2 || (dx - off) * (dx - off) + dy * dy <= r2;
    }
    var p = Math.min(1, P.f / FC);
    var r = Math.sqrt(dx * dx + dy * dy);
    var th = Math.atan2(dy, dx);
    var rb = MEMB_R0 * (1 - p) + 2 * MEMB_RD * Math.abs(Math.cos(th)) * p;
    return r <= rb + 2;
  }

  /* ---------- 单条 DNA 拷贝的几何 ---------- */
  function copyGeom(chrom, sister, P) {
    var half = SIZES[chrom.type].half;
    var baseX = CX + chrom.sx * (1 - P.align);
    var baseY = chrom.y0 + chrom.sy * (1 - P.align);
    var yTel = CY + (chrom.y0 - CY) * 0.92;
    var poleX = sister === 'a' ? POLE_L : POLE_R;
    var targetX = sister === 'a' ? poleX - P.splitShift : poleX + P.splitShift;
    var targetY = lerp(chrom.y0, yTel, P.cluster);

    var mx = lerp(baseX, targetX, P.migrate);
    var my = lerp(baseY, targetY, P.migrate);

    // 未分离：对角棒（X）；已分离：竖直棒。方向按 unpin 插值，位置随 migrate。
    var u = 0.70710678, v = sister === 'a' ? 0.70710678 : -0.70710678;
    var e1m = { x: mx - half * u, y: my - half * v };
    var e2m = { x: mx + half * u, y: my + half * v };
    var e1a = { x: mx, y: my - half };
    var e2a = { x: mx, y: my + half };
    var e1 = { x: lerp(e1m.x, e1a.x, P.unpin), y: lerp(e1m.y, e1a.y, P.unpin) };
    var e2 = { x: lerp(e2m.x, e2a.x, P.unpin), y: lerp(e2m.y, e2a.y, P.unpin) };

    var separated = P.unpin > 0.5;
    var atPole = P.migrate > 0.9;
    return {
      id: chrom.id + sister,
      chromId: chrom.id,
      color: chrom.color,
      half: half,
      sister: sister,
      e1: e1, e2: e2,
      mid: { x: mx, y: my },
      separated: separated,
      atPole: atPole,
      pole: separated ? (sister === 'a' ? 'left' : 'right') : null,
      nucleus: P.envNew > 0.5 ? (sister === 'a' ? 'left' : 'right') : null
    };
  }

  /* ---------- 完整模型 ---------- */
  function computeModel(T) {
    T = clamp01(T / 30) * 30;
    var P = params(T);
    var stage = Math.min(5, Math.floor(T / 6) + 1);
    var copies = [];
    for (var i = 0; i < CHROMS.length; i++) {
      copies.push(copyGeom(CHROMS[i], 'a', P));
      copies.push(copyGeom(CHROMS[i], 'b', P));
    }
    var left = copies.filter(function (c) { return c.pole === 'left'; }).map(function (c) { return c.id; });
    var right = copies.filter(function (c) { return c.pole === 'right'; }).map(function (c) { return c.id; });
    return {
      T: T, stage: stage, P: P, copies: copies,
      membrane: membranePaths(P),
      separated: P.unpin > 0.5,
      atPole: P.migrate > 0.9,
      nucleated: P.envNew > 0.5,
      split: P.f > FC,
      left: left, right: right
    };
  }

  /* ---------- 摘要（由实际状态驱动，完成态文案不提前） ---------- */
  function countMain(model) {
    if (!model.separated) return '染色体：4 条复制染色体 · 8 条姐妹染色单体';
    if (!model.nucleated) return model.atPole ? '子染色体：8 条（左极 4 · 右极 4）' : '子染色体：8 条（各 4 条正移向左 / 右极）';
    if (!model.split) return '两个新核：各 4 条染色体（共 8 条）';
    return '两个子细胞：各 4 条染色体（共 8 条）';
  }
  function locText(chromId, model) {
    var a = chromId + 'a', b = chromId + 'b';
    if (!model.separated) return 'a·b 未分离';
    if (!model.atPole) return 'a 正移向左极 · b 正移向右极';
    if (!model.nucleated) return 'a → 左极 · b → 右极';
    if (!model.split) return 'a → 左核 · b → 右核';
    return 'a → 左子细胞 · b → 右子细胞';
  }

  /* ---------- 状态与 DOM ---------- */
  var T = 0;
  var playing = false;
  var rafId = null;
  var lastTs = 0;
  var reducedMotion = false;
  var els = {};

  function stageOf(t) { return Math.min(5, Math.floor(t / 6) + 1); }

  function rodPath(cp, c) {
    var e1 = cp.e1, e2 = cp.e2;
    if (c >= 0.999) return 'M ' + e1.x.toFixed(1) + ' ' + e1.y.toFixed(1) + ' L ' + e2.x.toFixed(1) + ' ' + e2.y.toFixed(1);
    var dx = e2.x - e1.x, dy = e2.y - e1.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var px = -dy / len, py = dx / len;
    var sign = cp.sister === 'a' ? 1 : -1;
    var bow = (1 - c) * 12 * sign;
    var cx = cp.mid.x + px * bow, cy = cp.mid.y + py * bow;
    return 'M ' + e1.x.toFixed(1) + ' ' + e1.y.toFixed(1) + ' Q ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + e2.x.toFixed(1) + ' ' + e2.y.toFixed(1);
  }

  /* ---------- SVG 构建（无缩放文字；身份文字移至 DOM 台账） ---------- */
  function buildSvg() {
    var svg = els.svg;
    function el(tag, attrs) {
      var n = document.createElementNS(SVGNS, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      return n;
    }
    var gMembrane = el('g', { id: 'gMembrane' });
    var gEnvelope = el('g', { id: 'gEnvelope' });
    var gEquator = el('g', { id: 'gEquator' });
    var gPoles = el('g', { id: 'gPoles' });
    var gFibers = el('g', { id: 'gFibers' });
    var gChrom = el('g', { id: 'gChrom' });

    els.envOld = el('circle', { cx: CX, cy: CY, r: ENV_OLD_R, fill: 'none' });
    els.envNewL = el('circle', { cx: POLE_L, cy: CY, r: NUC_R, fill: 'none' });
    els.envNewR = el('circle', { cx: POLE_R, cy: CY, r: NUC_R, fill: 'none' });
    gEnvelope.appendChild(els.envOld);
    gEnvelope.appendChild(els.envNewL);
    gEnvelope.appendChild(els.envNewR);

    els.equatorLine = el('line', { x1: CX, y1: 100, x2: CX, y2: 540 });
    gEquator.appendChild(els.equatorLine);

    els.poleL = el('circle', { cx: POLE_L, cy: CY, r: 7 });
    els.poleR = el('circle', { cx: POLE_R, cy: CY, r: 7 });
    gPoles.appendChild(els.poleL);
    gPoles.appendChild(els.poleR);

    els.fibers = [];
    for (var i = 0; i < 8; i++) {
      var ln = el('line', { x1: 0, y1: 0, x2: 0, y2: 0 });
      els.fibers.push(ln);
      gFibers.appendChild(ln);
    }

    els.rodPaths = [];
    els.kineto = [];
    for (var j = 0; j < 8; j++) {
      var p = el('path', { fill: 'none', 'stroke-linecap': 'round' });
      var k = el('circle', { r: 5 });
      els.rodPaths.push(p);
      els.kineto.push(k);
      gChrom.appendChild(p);
      gChrom.appendChild(k);
    }

    svg.appendChild(gMembrane);
    svg.appendChild(gEnvelope);
    svg.appendChild(gEquator);
    svg.appendChild(gPoles);
    svg.appendChild(gFibers);
    svg.appendChild(gChrom);
    els.gMembrane = gMembrane;
  }

  function renderMembrane(model) {
    var g = els.gMembrane;
    while (g.firstChild) g.removeChild(g.firstChild);
    var paths = model.membrane;
    for (var i = 0; i < paths.length; i++) {
      var p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', paths[i]);
      p.setAttribute('class', 'mitosis-membrane');
      g.appendChild(p);
    }
  }

  function renderLedger(model) {
    els.ledger.innerHTML = '';
    for (var i = 0; i < CHROMS.length; i++) {
      var chrom = CHROMS[i];
      var item = document.createElement('div');
      item.className = 'mitosis-ledger-item';
      var sw = document.createElement('span');
      sw.className = 'mitosis-swatch';
      sw.style.setProperty('--c', chrom.color);
      var nm = document.createElement('strong');
      nm.textContent = chrom.id;
      var txt = document.createElement('span');
      txt.textContent = locText(chrom.id, model);
      item.appendChild(sw);
      item.appendChild(nm);
      item.appendChild(txt);
      els.ledger.appendChild(item);
    }
  }

  function render() {
    var model = computeModel(T);
    var P = model.P;

    renderMembrane(model);

    els.envOld.setAttribute('stroke-opacity', P.envOld.toFixed(3));
    els.envNewL.setAttribute('stroke-opacity', P.envNew.toFixed(3));
    els.envNewR.setAttribute('stroke-opacity', P.envNew.toFixed(3));
    els.envNewL.setAttribute('cx', (POLE_L - P.splitShift).toFixed(1));
    els.envNewR.setAttribute('cx', (POLE_R + P.splitShift).toFixed(1));

    els.equatorLine.setAttribute('stroke-opacity', (model.stage === 2 ? 0.5 : 0).toFixed(3));

    els.poleL.setAttribute('cx', P.poleL);
    els.poleR.setAttribute('cx', P.poleR);
    els.poleL.setAttribute('opacity', P.poleAlpha.toFixed(3));
    els.poleR.setAttribute('opacity', P.poleAlpha.toFixed(3));

    // 微管：极 → 各拷贝着丝粒（动粒区域，不连末端）
    for (var i = 0; i < 8; i++) {
      var cp = model.copies[i];
      var fromX = cp.sister === 'a' ? P.poleL : P.poleR;
      var f = els.fibers[i];
      f.setAttribute('x1', fromX);
      f.setAttribute('y1', CY);
      f.setAttribute('x2', cp.mid.x.toFixed(1));
      f.setAttribute('y2', cp.mid.y.toFixed(1));
      f.setAttribute('opacity', P.fiberAlpha.toFixed(3));
    }

    for (var j = 0; j < 8; j++) {
      var c2 = model.copies[j];
      els.rodPaths[j].setAttribute('d', rodPath(c2, P.c));
      els.rodPaths[j].setAttribute('stroke', c2.color);
      els.rodPaths[j].setAttribute('stroke-width', lerp(5, 10, P.c).toFixed(1));
      els.kineto[j].setAttribute('cx', c2.mid.x.toFixed(1));
      els.kineto[j].setAttribute('cy', c2.mid.y.toFixed(1));
      els.kineto[j].setAttribute('fill', c2.color);
    }

    updateUI(model);
  }

  function updateUI(model) {
    var stage = model.stage;
    var st = STAGES[stage - 1];
    els.stageTag.textContent = '阶段 ' + stage + ' / 5';
    els.stageName.textContent = st.name;
    els.stageEn.textContent = st.en;
    els.stageText.textContent = st.text;
    els.stageNote.textContent = st.note;
    els.count.textContent = countMain(model);
    renderLedger(model);
    els.status.textContent = '第 ' + stage + ' 阶段 · ' + (playing ? '播放中' : '暂停');

    var btns = els.stageBtns;
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', String((i + 1) === stage));
    }
    els.prev.disabled = stage === 1;
    els.next.disabled = stage === 5;
    els.play.textContent = playing ? '暂停' : (T >= 29.999 ? '重播' : '播放');
  }

  /* ---------- 播放 ---------- */
  function setPlaying(p) {
    if (playing === p) return;
    playing = p;
    if (playing) {
      lastTs = 0;
      rafId = requestAnimationFrame(tick);
    } else if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    render();
  }

  function tick(ts) {
    if (!playing) { rafId = null; return; }
    if (!lastTs) lastTs = ts;
    var dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.25) dt = 0; // 后台或长时间掉帧：不追赶
    T = Math.min(30, T + dt);
    render();
    if (T >= 29.999) { setPlaying(false); return; }
    rafId = requestAnimationFrame(tick);
  }

  function seek(t) {
    T = clamp01(t / 30) * 30;
    setPlaying(false);
    render();
  }

  // 阶段 5 的代表帧用最终两子细胞帧（30s），避免停在未分开画面却称已完成。
  function keyframeOf(stage) { return stage === 5 ? 30 : (stage - 1) * 6 + 3; }

  /* ---------- 题目（统一重置，恢复选项可用） ---------- */
  function quizReset() {
    var radios = els.quizChoices.querySelectorAll('input[type=radio]');
    for (var i = 0; i < radios.length; i++) { radios[i].checked = false; radios[i].disabled = false; }
    var labels = els.quizChoices.querySelectorAll('label');
    for (var j = 0; j < labels.length; j++) labels[j].classList.remove('correct', 'wrong');
    els.quizFeedback.textContent = '';
    els.quizRetry.hidden = true;
    els.quizSubmit.disabled = true;
  }

  function quizSubmit() {
    var sel = els.quizChoices.querySelector('input[type=radio]:checked');
    if (!sel) return;
    var val = sel.value;
    var ok = val === 'B';
    var labels = els.quizChoices.querySelectorAll('label');
    for (var i = 0; i < labels.length; i++) {
      var inp = labels[i].querySelector('input');
      if (inp.checked) labels[i].classList.add(ok ? 'correct' : 'wrong');
    }
    var fb = '此前复制的 DNA 通过姐妹染色单体分离被分配到两侧；每个子细胞都保留 4 条染色体及完整的染色体组成。分裂分配了复制产物，并非把原有遗传信息减半。';
    els.quizFeedback.textContent = (ok ? '回答正确。' : '回答不正确，正确是 B。') + fb;
    var radios = els.quizChoices.querySelectorAll('input[type=radio]');
    for (var k = 0; k < radios.length; k++) radios[k].disabled = true;
    els.quizSubmit.disabled = true;
    els.quizRetry.hidden = false;
  }

  /* ---------- 快照与包含校验（只读，来自实际渲染模型） ---------- */
  function snapshot() {
    var model = computeModel(T);
    var copies = model.copies.map(function (c) {
      return {
        id: c.id, chromId: c.chromId, sister: c.sister,
        separated: c.separated, atPole: c.atPole, pole: c.pole, nucleus: c.nucleus,
        x: Math.round(c.mid.x * 100) / 100, y: Math.round(c.mid.y * 100) / 100,
        e1x: Math.round(c.e1.x * 100) / 100, e1y: Math.round(c.e1.y * 100) / 100,
        e2x: Math.round(c.e2.x * 100) / 100, e2y: Math.round(c.e2.y * 100) / 100
      };
    });
    return {
      stage: model.stage,
      time: Math.round(T * 1000) / 1000,
      playing: playing,
      reducedMotion: reducedMotion,
      separated: model.separated,
      atPole: model.atPole,
      nucleated: model.nucleated,
      split: model.split,
      totalCopies: copies.length,
      separatedCount: copies.filter(function (c) { return c.separated; }).length,
      leftPole: model.left.slice(),
      rightPole: model.right.slice(),
      nuclei: [
        { x: POLE_L - model.P.splitShift, y: CY, r: NUC_R, active: model.P.envNew > 0.05 },
        { x: POLE_R + model.P.splitShift, y: CY, r: NUC_R, active: model.P.envNew > 0.05 }
      ],
      copies: copies
    };
  }

  function containment(t) {
    var m = computeModel(t), P = m.P;
    var nuclei = [];
    for (var s = 0; s < 2; s++) {
      var nx = s === 0 ? POLE_L - P.splitShift : POLE_R + P.splitShift;
      var active = P.envNew > 0.05;
      var inside = true;
      if (active) {
        for (var k = 0; k < 24; k++) {
          var a = (k / 24) * Math.PI * 2;
          var px = nx + NUC_R * Math.cos(a), py = CY + NUC_R * Math.sin(a);
          if (!membraneContains(px, py, P)) { inside = false; break; }
        }
      }
      nuclei.push({ x: Math.round(nx * 100) / 100, y: CY, r: NUC_R, active: active, insideMembrane: inside });
    }
    var copies = m.copies.map(function (c) {
      var pts = [[c.e1.x, c.e1.y], [c.e2.x, c.e2.y], [c.mid.x, c.mid.y]];
      var inMemb = pts.every(function (p) { return membraneContains(p[0], p[1], P); });
      var inNuc = null;
      if (c.nucleus) {
        var nx = c.nucleus === 'left' ? POLE_L - P.splitShift : POLE_R + P.splitShift;
        inNuc = pts.every(function (p) { return (p[0] - nx) * (p[0] - nx) + (p[1] - CY) * (p[1] - CY) <= NUC_R * NUC_R + 1; });
      }
      return { id: c.id, insideMembrane: inMemb, insideNucleus: inNuc, x: Math.round(c.mid.x * 100) / 100, y: Math.round(c.mid.y * 100) / 100 };
    });
    var allInside = nuclei.every(function (n) { return n.insideMembrane; }) &&
      copies.every(function (c) { return c.insideMembrane && (c.insideNucleus === null || c.insideNucleus); });
    return { t: Math.round(t * 1000) / 1000, nuclei: nuclei, copies: copies, allInside: allInside };
  }

  /* ---------- 初始化 ---------- */
  function init() {
    els.svg = document.getElementById('mitosisSvg');
    els.play = document.getElementById('mitosisPlay');
    els.prev = document.getElementById('mitosisPrev');
    els.next = document.getElementById('mitosisNext');
    els.restart = document.getElementById('mitosisRestart');
    els.status = document.getElementById('mitosisStatus');
    els.count = document.getElementById('mitosisCount');
    els.ledger = document.getElementById('mitosisLedger');
    els.stageTag = document.getElementById('mitosisStageTag');
    els.stageName = document.getElementById('mitosisStageName');
    els.stageEn = document.getElementById('mitosisStageEn');
    els.stageText = document.getElementById('mitosisStageText');
    els.stageNote = document.getElementById('mitosisStageNote');
    els.stageBtns = Array.prototype.slice.call(document.querySelectorAll('.mitosis-stage-btn'));
    els.quizChoices = document.getElementById('mitosisQuizChoices');
    els.quizSubmit = document.getElementById('mitosisQuizSubmit');
    els.quizFeedback = document.getElementById('mitosisQuizFeedback');
    els.quizRetry = document.getElementById('mitosisQuizRetry');

    reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    buildSvg();

    els.play.addEventListener('click', function () {
      if (playing) { setPlaying(false); return; }
      if (T >= 29.999) T = 0; // 结束后从头重播
      setPlaying(true);
    });
    els.prev.addEventListener('click', function () {
      var s = stageOf(T);
      if (s <= 1) return;
      seek(keyframeOf(s - 1));
    });
    els.next.addEventListener('click', function () {
      var s = stageOf(T);
      if (s >= 5) return;
      seek(keyframeOf(s + 1));
    });
    els.restart.addEventListener('click', function () {
      seek(0);
      quizReset();
    });
    els.stageBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        seek(keyframeOf(parseInt(btn.getAttribute('data-stage'), 10)));
      });
    });

    var radios = els.quizChoices.querySelectorAll('input[type=radio]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].addEventListener('change', function () { els.quizSubmit.disabled = false; });
    }
    els.quizSubmit.addEventListener('click', quizSubmit);
    els.quizRetry.addEventListener('click', quizReset);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) setPlaying(false);
    });

    // 暴露只读测试接口
    window.__mitosisSnapshot = snapshot;
    window.__mitosisSeek = function (t) { seek(t); return snapshot(); };
    window.__mitosisState = function () { return { T: T, playing: playing, stage: stageOf(T), reducedMotion: reducedMotion }; };
    window.__mitosisContainment = containment;

    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
