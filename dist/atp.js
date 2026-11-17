// ATP 合成互动课程：显示与交互逻辑。
// 内容全部来自 atp-data.js；本文件不含科学表述，只负责把状态画出来。
//
// 关键设计：画面是 (步骤, 进度 t, 情境) 的纯函数——每一步都从头画，不保留上一步的粒子对象。
// 因此跳步、重播、来回切换都不会累积重复粒子或重复计数。
import {
  atpIntro, atpSteps, atpLegend, atpSceneTag, atpSceneNote, atpPrediction,
  atpCompare, atpLimits, atpSources, atpScope, atpLockNote, atpStepLockMark,
} from './atp-data.js';

const $ = id => document.getElementById(id);
const STEP_MS = 3600;          // 每一步动画的时长
const SW = 1000, SH = 520;     // 画面的逻辑坐标系（与画布像素无关）

// 画面配色（显示层，不属于内容）
const C = {
  bg: '#0a1c26',
  ims: 'rgba(56,189,248,.07)',
  matrix: 'rgba(250,204,21,.055)',
  mem: '#17313f',
  memEdge: '#3d6a83',
  block: '#26485c',
  blockEdge: '#5d8fa9',
  proton: '#7dd3fc',
  electron: '#fbbf24',
  oxygen: '#f472b6',
  adp: '#a7f3d0',
  pi: '#fde68a',
  atp: '#34d399',
  text: '#e2eefc',
  dim: '#8aa9bd',
  warn: '#fb923c',
};

// 内膜与各元件在逻辑坐标里的位置
const MEM_TOP = 220, MEM_BOT = 300, MEM_MID = (MEM_TOP + MEM_BOT) / 2;
// 电子从 I 与 II 两条入口进入，汇入膜上的同一条通路后经 III、IV 交给 O₂。
// II 不泵 H⁺、也不与 I 串联：因此画得比其它复合体更短、更靠基质侧，让 I→III 的
// 电子通路从它上方通过，避免把支路画成串联。
const COMPLEXES = [
  {x: 150, label: 'I', pump: true, cy: MEM_MID, h: 140},
  {x: 290, label: 'II', pump: false, cy: MEM_MID + 34, h: 84},
  {x: 430, label: 'III', pump: true, cy: MEM_MID, h: 140},
  {x: 570, label: 'IV', pump: true, cy: MEM_MID, h: 140},
];
const LEAK_X = 716, SYNTHASE_X = 858, O2 = {x: 648, y: 368};
const LANE_Y = MEM_MID - 32;                     // 电子在膜上的横向通路
const II_JOIN = {x: 290, y: COMPLEXES[1].cy - COMPLEXES[1].h / 2};  // II 汇入通路的起点
const ADP_Y = 452;                               // 基质侧 ADP + Pi → ATP 一行

let canvas, ctx, base = 1, pxRatio = 1, ready = false, started = false;
let raf = 0, last = 0, drawn = 0, electrons = [];
// 窄屏紧凑模式：逻辑坐标系不变，但把文字与符号放大，抵消整体缩放带来的变小。
let compact = false, K = 1, stackedCompare = false;
const view = {x: 0, y: 0, zoom: 1};

const st = {index: 0, t: 0, playing: false, variant: 'normal', picked: null, predicted: null, wrong: false, unlocked: false};
let locked = false;   // 上一次跳转是否因为"未提交预测"被拦截

function step() { return atpSteps[st.index]; }
function isPredict() { return step().id === 'predict'; }
function isCompare() { return step().id === 'compare'; }

// ---------- 绘图基元 ----------

function text(s, x, y, o = {}) {
  const size = stackedCompare ? Math.max(18, o.size || 16) : (o.size || 16) * K;
  ctx.font = `${o.weight ? o.weight + ' ' : ''}${size}px system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif`;
  ctx.fillStyle = o.color || C.text;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.baseline || 'middle';
  ctx.fillText(BioI18n.t(s), x, y);
}

// 窄屏时用更短的同义标注，避免放大后的文字互相压住。
const L = (wide, small) => (compact ? small : wide);

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 每种粒子一种形状：颜色之外还能靠轮廓分辨（图例与画面用的是同一个函数）。
function drawGlyph(kind, x, y, r0) {
  const r = r0 * K;
  drawn++;
  ctx.save();
  ctx.lineWidth = Math.max(1, r * .24);
  if (kind === 'proton') {
    ctx.strokeStyle = C.proton;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r * .5, y); ctx.lineTo(x + r * .5, y);
    ctx.moveTo(x, y - r * .5); ctx.lineTo(x, y + r * .5);
    ctx.stroke();
  } else if (kind === 'electron') {
    ctx.strokeStyle = C.electron;
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - r * .5, y); ctx.lineTo(x + r * .5, y); ctx.stroke();
  } else if (kind === 'oxygen') {
    ctx.strokeStyle = C.oxygen;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.stroke();
  } else if (kind === 'pi') {
    ctx.strokeStyle = C.pi;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    text('Pi', x, y + 1, {size: r * 1.05, color: C.pi, align: 'center'});
  } else if (kind === 'adp' || kind === 'atp') {
    const col = kind === 'atp' ? C.atp : C.adp;
    const w = r * 2.5, h = r * 1.5;
    ctx.strokeStyle = col;
    ctx.fillStyle = kind === 'atp' ? 'rgba(52,211,153,.18)' : 'rgba(167,243,208,.1)';
    roundRect(x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fill(); ctx.stroke();
    text(kind.toUpperCase(), x, y + 1, {size: r * .95, color: col, align: 'center', weight: '600'});
  }
  ctx.restore();
}

// ---------- 场景：内膜剖面（逻辑 1000×520） ----------

function drawComplexes(opts) {
  for (const c of COMPLEXES) {
    const w = compact ? 116 : 72, h = c.h;
    ctx.fillStyle = C.block;
    ctx.strokeStyle = C.blockEdge;
    ctx.lineWidth = 2;
    roundRect(c.x - w / 2, c.cy - h / 2, w, h, 12);
    ctx.fill(); ctx.stroke();
    // 编号放在区块下半部：电子通路走上半部，两者不叠在一起
    text(c.label, c.x - (compact ? 3 : 0), c.cy + 26, {size: 30, align: 'center', weight: '600'});
    if (opts.showPumpNote && !c.pump) {
      text('不泵 H⁺', c.x, MEM_BOT + (compact ? 62 : 46), {size: 14, align: 'center', color: C.dim});
    }
  }
  // II 与 I 是两条并列的入口，不是串联：标出 II 汇入的是同一条通路。
  // 放在复杂体方块上方（方块从 y=190 开始），不然会压在方块上。
  if (opts.showPumpNote) {
    text(L('II 也是电子入口', 'II 也是入口'), COMPLEXES[1].x, 170,
      {size: 14, align: 'center', color: C.dim});
  }
}

function drawSynthase(opts) {
  const x = SYNTHASE_X;
  ctx.strokeStyle = C.blockEdge;
  ctx.fillStyle = C.block;
  ctx.lineWidth = 2;
  roundRect(x - 34, MEM_TOP - 32, 68, 32, 8); ctx.fill(); ctx.stroke();   // 膜间隙侧头部
  roundRect(x - 22, MEM_TOP, 44, MEM_BOT - MEM_TOP, 6); ctx.fill(); ctx.stroke(); // 跨膜部分
  ctx.beginPath(); ctx.arc(x, MEM_BOT + 40, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // 基质侧头部
  text('ATP 合酶', x, MEM_BOT + 88, {size: 14, align: 'center', weight: '600'});
  if (opts.showRole) text('H⁺ 从这里回流', x, MEM_TOP - 78, {size: 14, align: 'center', color: C.proton});
}

function drawLeakChannel() {
  const x = LEAK_X;
  ctx.save();
  ctx.setLineDash([7, 6]);
  ctx.strokeStyle = C.warn;
  ctx.lineWidth = 3;
  roundRect(x - 30, MEM_TOP - 10, 60, MEM_BOT - MEM_TOP + 20, 10);
  ctx.stroke();
  ctx.restore();
  // 泄漏方向：从膜间隙侧绕过 ATP 合酶回到基质侧（与泵 H⁺ 的方向相反）。
  vArrow(x, MEM_TOP - 2, MEM_BOT + 2, C.warn, 13);
  text(L('泄漏途径（示意）', '泄漏途径'), x, 190, {size: 14, align: 'center', color: C.warn});
  // 窄屏这两行字号放大后要避开 O₂ 的六边形和 ATP 合酶的头部，所以整体右移一格。
  text(L('不受 ATP 合酶控制', '绕过合酶'), compact ? 760 : x, compact ? MEM_BOT + 30 : MEM_BOT + 24,
    {size: 13, align: 'center', color: C.warn});
}

function drawSideLabels() {
  ctx.fillStyle = C.ims;
  ctx.fillRect(60, 76, 880, MEM_TOP - 76);
  ctx.fillStyle = C.matrix;
  ctx.fillRect(60, MEM_BOT, 880, 150);
  // 区室名放在两条带子的外侧：H⁺ 符号会沿复杂体一路走过 196–346 这段高度。
  text('膜间隙侧', 76, 120, {size: 21, weight: '600', color: C.proton});
  text('基质侧', 76, 400, {size: 21, weight: '600', color: '#facc15'});
  // 窄屏把这两条括注留给右侧详解，画面里只保留区室名，避免放大后压住 H⁺。
  if (!compact) {
    text('（内膜与外膜之间）', 76, 150, {size: 14, color: C.dim});
    text('（内膜围成的内部空间）', 76, 430, {size: 14, color: C.dim});
  }
}

function drawMembrane() {
  ctx.fillStyle = C.mem;
  ctx.fillRect(60, MEM_TOP, 880, MEM_BOT - MEM_TOP);
  ctx.strokeStyle = C.memEdge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, MEM_TOP); ctx.lineTo(940, MEM_TOP);
  ctx.moveTo(60, MEM_BOT); ctx.lineTo(940, MEM_BOT);
  ctx.stroke();
}

// H⁺ 在膜间隙侧越积越多：位置固定、数量随 t 增长，不会留下上一帧的对象。
function drawProtonPool(t) {
  const slots = [];
  // 窄屏每行只放 6 个、只放一行：放大后的 H⁺ 符号会占掉两行本来就不宽的地方。
  const cols = 6, rows = compact ? 1 : 2, step = compact ? 76 : 78;
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < cols; i++) slots.push({x: 300 + i * step + (row ? 39 : 0), y: 100 + row * 42});
  }
  const n = Math.round(slots.length * Math.min(1, t));
  for (let i = 0; i < n; i++) drawGlyph('proton', slots[i].x, slots[i].y, 13);
}

// 电子在膜上的通路：I 与 II 两条入口汇入同一条通路，再经 IV 交给 O₂。
// 用折线按弧长取点，段与段之间位置连续，不存在跃迁。
const E_PATH = {
  main: [[COMPLEXES[0].x, LANE_Y], [COMPLEXES[3].x, LANE_Y], [O2.x, O2.y - 20]],
  branch: [[COMPLEXES[1].x, II_JOIN.y], [COMPLEXES[1].x, LANE_Y],
    [COMPLEXES[3].x, LANE_Y], [O2.x, O2.y - 20]],
};

function polyPoint(pts, u) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    segs.push(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]));
    total += segs[i];
  }
  let want = Math.max(0, Math.min(1, u)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (want <= segs[i] || i === segs.length - 1) {
      const f = segs[i] ? want / segs[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
    }
    want -= segs[i];
  }
  return pts[pts.length - 1].slice();
}

function drawElectronFlow(t) {
  ctx.save();
  ctx.strokeStyle = 'rgba(251,191,36,.5)';
  ctx.lineWidth = 3;
  for (const pts of [E_PATH.main, E_PATH.branch]) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  ctx.restore();
  // 两条入口各自送出电子，沿线连续移动，不穿膜、不进入复合体 II 的方块。
  electrons = [];
  for (let i = 0; i < 3; i++) {
    const p = polyPoint(E_PATH.main, (t * 2 + i / 3) % 1);
    electrons.push(p); drawGlyph('electron', p[0], p[1], 12);
  }
  for (let i = 0; i < 2; i++) {
    const p = polyPoint(E_PATH.branch, (t * 2 + i / 2) % 1);
    electrons.push(p); drawGlyph('electron', p[0], p[1], 12);
  }
  drawGlyph('oxygen', O2.x, O2.y, 18);
  // 窄屏把 O₂ 的说明挪到左边：放大后的六边形会把正下方的字压住。
  if (compact) text('O₂ 接收电子', O2.x - 70, O2.y, {size: 14, align: 'right', color: C.oxygen});
  else text('O₂ 接收电子 → 生成水', O2.x, O2.y + 34, {size: 14, align: 'center', color: C.oxygen});
}

// 竖直箭头：从 yFrom 指向 yTo（逻辑坐标 y 向下增大）。
// 箭头是实心三角，小尺寸下比两条描边更看得出来朝哪边。
function vArrow(x, yFrom, yTo, color, head) {
  const dir = Math.sign(yTo - yFrom) || 1;
  const base = yTo - dir * head;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, yFrom);
  ctx.lineTo(x, base + dir * head * .3);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - head * .45, base);
  ctx.lineTo(x, yTo);
  ctx.lineTo(x + head * .45, base);
  ctx.closePath();
  ctx.fill();
}

function drawProtonPump(t) {
  // 质子从复合体的一侧穿过到另一侧：横向偏开 16，避免压住复合体编号。
  for (const c of COMPLEXES.filter(c => c.pump)) {
    for (let k = 0; k < 2; k++) {
      const u = (t * 1.5 + k / 2) % 1;
      const y = MEM_BOT + 34 - u * (MEM_BOT - MEM_TOP + 42);
      if (y > MEM_TOP - 12 && y < MEM_BOT + 38) drawGlyph('proton', c.x + 16, y, 12);
    }
  }
}

function drawReturnFlow(t) {
  const x = SYNTHASE_X;
  for (let k = 0; k < 3; k++) {
    const u = (t * 1.6 + k / 3) % 1;
    drawGlyph('proton', x + (k - 1) * 13 * K, MEM_TOP - 26 + u * (MEM_BOT - MEM_TOP + 58), 12);
  }
  // 基质侧：ADP + Pi → ATP
  const p = Math.min(1, t * 1.4);
  const ax = compact ? 660 : 704, px = compact ? 750 : 760, tx = compact ? 860 : 836;
  const a1 = compact ? 790 : 784, a2 = compact ? 812 : 802;
  drawGlyph('adp', ax, ADP_Y, 15);
  drawGlyph('pi', px, ADP_Y, 13);
  ctx.strokeStyle = 'rgba(52,211,153,.6)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(a1, ADP_Y); ctx.lineTo(a2, ADP_Y); ctx.stroke();
  if (p > .5) {
    ctx.globalAlpha = Math.min(1, (p - .5) / .3);
    drawGlyph('atp', tx, ADP_Y, 16);
    ctx.globalAlpha = 1;
  }
  text('ATP 在基质侧生成', compact ? 760 : 770, compact ? 492 : ADP_Y + 40,
    {size: 14, align: 'center', color: C.atp});
}

function drawMainScene() {
  const s = step().id;
  const showGradient = s === 'gradient' || s === 'synthase' || isPredict() || isCompare();
  const showReturn = s === 'synthase' || isCompare();
  const leak = st.variant === 'leak' && (isPredict() || isCompare());

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SW, SH);
  drawSideLabels();
  drawMembrane();
  if (s !== 'locate') drawComplexes({showPumpNote: showGradient});
  drawSynthase({showRole: showReturn});
  if (leak) drawLeakChannel();
  if (showGradient) {
    drawElectronFlow(st.t);
    drawProtonPump(st.t);
    drawProtonPool(st.t);
  }
  if (showReturn) drawReturnFlow(st.t);
  if (s === 'locate') {
    text(L('这是一段内膜的局部放大：看清膜的两侧分别是什么。',
      '内膜的局部放大：看清膜的两侧'),
    SW / 2, 52, {size: 17, align: 'center', color: C.dim});
  }
}

// ---------- 场景：正常 / 泄漏对照面板 ----------

function drawComparePanel(x, y, w, h, variant) {
  const leak = variant === 'leak';
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255,255,255,.03)';
  roundRect(6, 6, w - 12, h - 12, 14); ctx.fill();
  ctx.strokeStyle = leak ? C.warn : C.blockEdge;
  ctx.lineWidth = 2;
  roundRect(6, 6, w - 12, h - 12, 14); ctx.stroke();

  // 窄屏图内文字整体放大 2.2 倍，原来的三条带子高度不够，会把区室名和"梯度较强"叠在一起，
  // 所以紧凑模式把带子重新排一遍（膜本身仍是 60 高，复合体与箭头的比例不变）。
  const imsTop = compact ? 64 : 76, top = compact ? 140 : 146;
  const bot = compact ? 200 : 206, matBot = compact ? 290 : 282;
  const rowY = compact ? 84 : 96, subY = compact ? 116 : 122;
  const matY = compact ? 214 : 224;
  const mid = (top + bot) / 2;
  text(leak ? atpCompare.leakName : atpCompare.normalName, w / 2, 34, {size: 21, align: 'center', weight: '600', color: leak ? C.warn : C.text});
  // 窄屏时这行会被放大到压住标题：改由整幅对照的说明统一标注"示意"。
  if (!compact) text(atpCompare.label, w / 2, 58, {size: 13, align: 'center', color: C.dim});

  ctx.fillStyle = C.ims; ctx.fillRect(20, imsTop, w - 40, top - imsTop);
  ctx.fillStyle = C.matrix; ctx.fillRect(20, bot, w - 40, matBot - bot);
  text('膜间隙侧', 28, rowY, {size: 13, color: C.proton});
  text('基质侧', 28, matY, {size: 13, color: '#facc15'});

  ctx.fillStyle = C.mem; ctx.fillRect(20, top, w - 40, bot - top);
  ctx.strokeStyle = C.memEdge; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, top); ctx.lineTo(w - 20, top);
  ctx.moveTo(20, bot); ctx.lineTo(w - 20, bot);
  ctx.stroke();

  // 三个示意复合体（编号在下半部，电子通路走上半部）
  [160, 235, 310].forEach((cx, i) => {
    ctx.fillStyle = C.block; ctx.strokeStyle = C.blockEdge; ctx.lineWidth = 2;
    roundRect(cx - 23, mid - 52, 46, 104, 9); ctx.fill(); ctx.stroke();
    text(['I', 'III', 'IV'][i], cx - 6, mid + 14, {size: 19, align: 'center', weight: '600'});
    // H⁺ 被泵出：两种情境都有，方向从基质侧指向膜间隙侧
    vArrow(cx + 14, bot + 22, top - 28, 'rgba(125,211,252,.9)', 10);
  });
  // 膜间隙侧积累的 H⁺：泄漏情境里明显更少——这正是"梯度减弱"要看出来的差别
  const poolStart = compact ? 176 : 150, poolStep = compact ? 46 : 40, poolR = compact ? 8 : 10;
  // 窄屏放大后一行的位置只够放 3 个（正常）/ 1 个（泄漏），对照仍然成立。
  const pool = Array.from({length: compact ? (leak ? 1 : 3) : (leak ? 2 : 4)},
    (_, i) => poolStart + i * poolStep);
  pool.forEach(px => drawGlyph('proton', px, rowY, poolR));
  text(leak ? '梯度较弱' : '梯度较强', 28, subY, {size: 12, color: leak ? C.warn : C.dim});
  // 电子横向传递
  ctx.strokeStyle = 'rgba(251,191,36,.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(160, mid - 20); ctx.lineTo(310, mid - 20); ctx.stroke();
  drawGlyph('electron', 197, mid - 20, 10);

  // 回流：正常经 ATP 合酶；泄漏则一部分走泄漏途径
  const sx = compact ? 400 : 420;
  ctx.fillStyle = C.block; ctx.strokeStyle = C.blockEdge; ctx.lineWidth = 2;
  roundRect(sx - 18, top, 36, bot - top, 6); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(sx, bot + 26, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  text('ATP 合酶', sx, bot + 60, {size: 12, align: 'center'});
  // 经 ATP 合酶回流：膜间隙侧 → 基质侧
  vArrow(sx, top - 6, bot + 6, 'rgba(125,211,252,.85)', 10);
  drawGlyph('proton', compact ? sx + 22 : sx - 14, mid, 10);

  if (leak) {
    const lx = 360;
    ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = C.warn; ctx.lineWidth = 2;
    // 通道画得比箭头长：箭头完整落在通道内，两者不相交，方向不会被边框盖住。
    roundRect(lx - 18, top - 16, 36, (bot - top) + 42, 8); ctx.stroke(); ctx.restore();
    // 泄漏方向：膜间隙侧 → 基质侧，与泵出方向相反
    vArrow(lx, top - 6, bot + 18, C.warn, 10);
    // 窄屏的通道两侧放不下放大的 H⁺ 符号（会压到复合体 IV），只留箭头，方向照样清楚。
    if (!compact) {
      drawGlyph('proton', lx - 15, mid, 10);
      drawGlyph('proton', lx + 15, mid + 22, 10);
    }
    text(L('泄漏途径', '泄漏'), lx, compact ? 118 : 84, {size: 12, align: 'center', color: C.warn});
  }

  // 窄屏的 ATP 记号与文字整体左移：右边要留给"ATP 合酶"。
  const atpX = compact ? 150 : 100, atpTxtX = compact ? 190 : 140;
  const atpY = compact ? 258 : 248;
  drawGlyph('atp', atpX, atpY, 11);
  text(L(leak ? '这条途径的 ATP 减少' : '这条途径的 ATP 较多',
    leak ? 'ATP 减少' : 'ATP 较多'), atpTxtX, atpY, {size: 14, color: leak ? C.warn : C.atp});
  ctx.restore();
}

function drawCompareScene() {
  if (stackedCompare) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, 500, 740);
    const savedCompact = compact, savedK = K;
    compact = false; K = 1;
    text('同一阶段对照 · 示意，非实验测量', 250, 38, {size: 20, align: 'center', color: C.dim});
    drawComparePanel(10, 70, 480, 300, 'normal');
    drawComparePanel(10, 400, 480, 300, 'leak');
    compact = savedCompact; K = savedK;
    return;
  }
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SW, SH);
  const panelW = 480, panelH = 300, top = (SH - panelH) / 2;
  drawComparePanel(10, top, panelW, panelH, 'normal');
  drawComparePanel(510, top, panelW, panelH, 'leak');
  text(L('同一阶段对照：同样的电子传递，只有 H⁺ 从哪里回流不同。',
    '同一阶段对照 · 示意，非实验测量'),
  SW / 2, top - 26, {size: 18, align: 'center', color: C.dim});
}

// ---------- 画布与视图 ----------

function fit() {
  const viewport = $('atpViewport');
  const width = viewport.getBoundingClientRect().width;
  if (width < 1) return false;
  compact = width < 560;
  K = compact ? 2.2 : 1;
  stackedCompare = compact && isCompare();
  viewport.style.height = stackedCompare ? '620px' : '';
  const r = viewport.getBoundingClientRect();
  if (r.height < 1) return false;
  pxRatio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(r.width * pxRatio);
  canvas.height = Math.round(r.height * pxRatio);
  canvas.style.width = r.width + 'px';
  canvas.style.height = r.height + 'px';
  base = Math.min(r.width / (stackedCompare ? 500 : SW), r.height / (stackedCompare ? 740 : SH)) * .97 * pxRatio;
  return true;
}

function paint() {
  if (!ready) return;
  drawn = 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(base * view.zoom, 0, 0, base * view.zoom,
    canvas.width / 2 + view.x * base, canvas.height / 2 + view.y * base);
  ctx.translate(-(stackedCompare ? 500 : SW) / 2, -(stackedCompare ? 740 : SH) / 2);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, stackedCompare ? 500 : SW, stackedCompare ? 740 : SH); ctx.clip();
  if (isCompare()) drawCompareScene(); else drawMainScene();
  ctx.restore();
  $('atpCanvas').dataset.atpScene = JSON.stringify({
    step: step().id, index: st.index, t: +st.t.toFixed(3),
    variant: st.variant, particles: drawn, compact, stackedCompare, minLabelCss: stackedCompare ? 18 * base / pxRatio : 12 * K * base / pxRatio, k: K,
    unlocked: st.unlocked, locked,
    base: +base.toFixed(4), pxRatio,
    zoom: +view.zoom.toFixed(3), panX: +view.x.toFixed(3), panY: +view.y.toFixed(3),
    // 诊断用：本帧电子实际落点与两条通路的折线，供测试检查连续性。
    electrons: electrons.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]),
    pathMain: E_PATH.main, pathBranch: E_PATH.branch,
    iiBox: compact
      ? [COMPLEXES[1].x - 50, COMPLEXES[1].cy - COMPLEXES[1].h / 2, COMPLEXES[1].x + 50, COMPLEXES[1].cy + COMPLEXES[1].h / 2]
      : [COMPLEXES[1].x - 36, COMPLEXES[1].cy - COMPLEXES[1].h / 2, COMPLEXES[1].x + 36, COMPLEXES[1].cy + COMPLEXES[1].h / 2],
  });
}

// ---------- 文案与目录 ----------

function buildStaticText() {
  $('atpLead').textContent = atpIntro;
  $('atpSceneNote').textContent = atpSceneTag;
  $('atpModelNote').textContent = atpSceneNote;
  $('atpLimitList').innerHTML = atpLimits.map(t => `<li>${t}</li>`).join('');
  $('atpScope').textContent = atpScope;
  $('atpSourceList').innerHTML = atpSources
    .map(s => `<a href="${s.url}" target="_blank" rel="noopener">${s.name}</a>`).join(' · ');
  $('atpLegend').innerHTML = atpLegend.map(l => `
    <li><span class="atp-legend-mark" data-atp-glyph="${l.kind}" aria-hidden="true"></span>
    <span class="atp-legend-text"><strong>${l.name}</strong><span>${l.note}</span></span></li>`).join('');
  drawLegendMarks();
}

// 图例上的符号用同一套形状画出来，保证"看到的符号 = 画面里的符号"。
function drawLegendMarks() {
  document.querySelectorAll('.atp-legend-mark').forEach(el => {
    const c = document.createElement('canvas');
    const size = 40, dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr; c.height = size * dpr;
    c.style.width = size + 'px'; c.style.height = size + 'px';
    const g = c.getContext('2d');
    if (g) {
      const save = ctx; ctx = g;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, size, size);
      drawGlyph(el.dataset.atpGlyph, size / 2, size / 2, 13);
      ctx = save;
    }
    el.appendChild(c);
  });
}

function buildSteps() {
  $('atpStepList').innerHTML = atpSteps.map((s, i) => `
    <li><button type="button" data-atp-step="${i}" aria-current="${i === 0}">
      <span class="atp-step-no">${i + 1}</span>
      <span class="atp-step-name">${s.name}</span>
      <span class="atp-step-title">${s.title}</span>
      <span class="atp-step-lock" hidden>${atpStepLockMark}</span>
    </button></li>`).join('');
  $('atpStepList').addEventListener('click', e => {
    const b = e.target.closest('[data-atp-step]');
    if (b) go(Number(b.dataset.atpStep));
  });
}

function buildPrediction() {
  $('atpPredictPrompt').textContent = atpPrediction.prompt;
  $('atpPredictChoices').innerHTML = atpPrediction.options
    .map((o, i) => `<button type="button" data-atp-option="${i}">${o.text}</button>`).join('');
  $('atpPredictSubmit').onclick = submitPrediction;
  $('atpPredictRetry').onclick = () => {
    st.picked = null; st.predicted = null; st.wrong = false; st.variant = 'normal';
    refresh();
  };
  $('atpPredictChoices').addEventListener('click', e => {
    const b = e.target.closest('[data-atp-option]');
    if (!b) return;
    st.picked = Number(b.dataset.atpOption);
    refresh();
  });
}

function buildCompare() {
  $('atpCompareHeading').textContent = atpCompare.heading;
  $('atpCompareLabel').textContent = atpCompare.label;
  $('atpCompareBody').innerHTML = atpCompare.rows.map(r => `
    <div class="atp-compare-row">
      <div class="atp-compare-name">${r.name}</div>
      <div class="atp-compare-cell">
        <span class="atp-compare-word">${r.normal}</span>
        <span class="atp-bar atp-bar-normal" style="--atp-level:${r.normalLevel}"></span>
      </div>
      <div class="atp-compare-cell">
        <span class="atp-compare-word">${r.leak}</span>
        <span class="atp-bar atp-bar-leak" style="--atp-level:${r.leakLevel}"></span>
      </div>
    </div>`).join('');
  $('atpCompareCaveat').textContent = atpCompare.caveat;
}

// ---------- 状态与渲染 ----------

function refresh() { paint(); syncDom(); }

function go(i) {
  const last = atpSteps.length - 1;
  let n = Math.max(0, Math.min(last, i));
  // 对照解释是本题的"答案"：没有提交过预测就不放行，手动点第 5 步或点"下一步"同样拦截。
  locked = atpSteps[n].id === 'compare' && !st.unlocked;
  if (locked) n = atpSteps.findIndex(s => s.id === 'predict');
  st.index = n;
  st.t = 0;
  st.playing = false;
  // 泄漏情境只在对照步骤、或已经提交过预测之后才出现。
  if (isCompare()) st.variant = 'leak';
  else if (isPredict()) st.variant = st.predicted === null ? 'normal' : 'leak';
  else st.variant = 'normal';
  if (ready) fit();
  refresh();
  if (locked) $('atpLockNote').focus?.();
}

function submitPrediction() {
  if (st.picked === undefined || st.picked === null) return;
  st.predicted = st.picked;
  st.unlocked = true;          // 提交过任意一次即解锁；重试只重置本题，不重新上锁
  st.wrong = !atpPrediction.options[st.picked].ok;
  st.variant = 'leak';
  locked = false;
  paint(); syncDom();
}

function syncDom() {
  const s = step();
  $('atpStepTag').textContent = s.tag;
  $('atpStepTitle').textContent = s.title;
  $('atpStepLead').textContent = s.lead;
  $('atpStepPoints').innerHTML = s.points.map(p => `<li>${p}</li>`).join('');
  $('atpStatus').textContent = `步骤 ${st.index + 1} / ${atpSteps.length} · ${s.name}`;
  $('atpPlay').textContent = st.playing ? '暂停' : '播放';
  $('atpPlay').setAttribute('aria-pressed', st.playing);
  $('atpPrev').disabled = st.index === 0;
  $('atpNext').disabled = st.index === atpSteps.length - 1;
  document.querySelectorAll('[data-atp-step]').forEach(b => {
    const i = Number(b.dataset.atpStep);
    b.setAttribute('aria-current', i === st.index);
    const isLocked = atpSteps[i].id === 'compare' && !st.unlocked;
    b.classList.toggle('is-locked', isLocked);
    if (isLocked) b.setAttribute('aria-disabled', 'true');
    else b.removeAttribute('aria-disabled');
    const mark = b.querySelector('.atp-step-lock');
    if (mark) mark.hidden = !isLocked;
  });

  $('atpLockNote').hidden = !locked;
  $('atpLockNote').textContent = locked ? atpLockNote : '';

  const showPredict = isPredict() || isCompare();
  $('atpPredictSection').hidden = !showPredict;
  $('atpCompareSection').hidden = !isCompare();

  if (showPredict) {
    document.querySelectorAll('[data-atp-option]').forEach(b => {
      const i = Number(b.dataset.atpOption);
      b.classList.toggle('picked', st.picked === i);
      b.classList.toggle('correct', st.predicted !== null && atpPrediction.options[i].ok);
      b.classList.toggle('wrong', st.predicted === i && !atpPrediction.options[i].ok);
      b.disabled = st.predicted !== null;
    });
    $('atpPredictSubmit').disabled = st.picked === undefined || st.picked === null || st.predicted !== null;
    const fb = $('atpPredictFeedback');
    if (st.predicted === null) {
      fb.textContent = atpPrediction.before;
      fb.className = 'atp-feedback';
    } else {
      fb.textContent = (st.wrong ? atpPrediction.wrong + ' ' : atpPrediction.correct + ' ')
        + atpPrediction.options[st.predicted].why;
      fb.className = 'atp-feedback ' + (st.wrong ? 'is-wrong' : 'is-correct');
    }
    $('atpPredictRetry').hidden = st.predicted === null;
    $('atpPredictRetryNote').textContent = atpPrediction.retryNote;
  }
}

function schedule() {
  if (raf) return;
  raf = requestAnimationFrame(tick);
}

function stopLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  st.playing = false;
}

function tick(now) {
  raf = 0;
  if (!st.playing) return;
  // 只累计可见期间的耗时，且单帧不超过 50ms：后台再久也不会一步跳到结束。
  const dt = Math.min(now - last, 50);
  last = now;
  st.t = Math.min(1, st.t + dt / STEP_MS);
  let done = false;
  if (st.t >= 1) {
    const next = atpSteps[st.index + 1];
    // 预测步骤必须由学习者提交后才放行，自动播放不能替他跳过。
    const gated = isPredict() && st.predicted === null;
    if (next && !gated && next.id !== 'predict') {
      st.index++;
      st.t = 0;
      st.variant = next.id === 'compare' ? 'leak' : 'normal';
    } else { done = true; }
  }
  paint(); syncDom();
  if (done) { st.playing = false; syncDom(); return; }
  schedule();
}

function play() {
  if (st.playing) { stopLoop(); syncDom(); return; }
  if (st.t >= 1) st.t = 0;
  st.playing = true;
  last = performance.now();
  syncDom();
  schedule();
}

// ---------- 交互 ----------

function controls() {
  const vp = $('atpViewport');
  $('atpPlay').onclick = play;
  $('atpNext').onclick = () => go(st.index + 1);
  $('atpPrev').onclick = () => go(st.index - 1);
  $('atpReplay').onclick = () => { st.t = 0; st.playing = false; paint(); syncDom(); };
  $('atpResetView').onclick = () => { view.x = 0; view.y = 0; view.zoom = 1; paint(); };
  $('atpBack').onclick = () => window.showBioWorld('mito');

  let pts = new Map(), pinch = 0;
  const spread = () => {
    const [a, b] = [...pts.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  canvas.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
    canvas.setPointerCapture(e.pointerId);
    if (pts.size === 2) pinch = spread();
  });
  canvas.addEventListener('pointermove', e => {
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pts.size === 1) {
      view.x += (e.clientX - prev.x) * pxRatio / base;
      view.y += (e.clientY - prev.y) * pxRatio / base;
      paint();
    } else if (pts.size === 2) {
      // 双指捏合缩放：触屏上没有滚轮，必须支持这一路。
      const d = spread();
      if (pinch > 0 && d > 0) view.zoom = Math.max(.6, Math.min(3, view.zoom * (d / pinch)));
      pinch = d;
      paint();
    }
  });
  const end = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    pinch = pts.size === 2 ? spread() : 0;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', end);
  vp.addEventListener('wheel', e => {
    e.preventDefault();
    view.zoom = Math.max(.6, Math.min(3, view.zoom * (e.deltaY > 0 ? .9 : 1.1)));
    paint();
  }, {passive: false});
  canvas.addEventListener('keydown', e => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const k = 60 * pxRatio / (base * view.zoom);   // 每次按键平移约 60 CSS 像素
    if (e.key === 'ArrowLeft') view.x -= k;
    if (e.key === 'ArrowRight') view.x += k;
    if (e.key === 'ArrowUp') view.y -= k;
    if (e.key === 'ArrowDown') view.y += k;
    if (e.key === '+' || e.key === '=') view.zoom = Math.min(3, view.zoom * 1.12);
    if (e.key === '-') view.zoom = Math.max(.6, view.zoom / 1.12);
    paint();
  });
  new ResizeObserver(() => { if (fit()) paint(); }).observe(vp);
}

// ---------- 初始化 ----------

export function initAtp() {
  if (started) return;          // 重复进入不重复注册
  started = true;
  canvas = $('atpCanvas');
  // 文字流程与预测题先建好：即使画布完全不可用，五个步骤仍能走完。
  buildStaticText();
  buildSteps();
  buildPrediction();
  buildCompare();
  controls();
  try {
    ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ready = true;
    fit();
    $('atpLoading').hidden = true;
    $('atpCanvas').dataset.ready = 'true';
  } catch (e) {
    degrade(e);
  }
  go(0);

  // 离开课程或页面隐藏时暂停：恢复后不会因为后台时间直接跳到结束。
  const pause = () => { if (st.playing) { stopLoop(); syncDom(); } };
  window.addEventListener('bioworldchange', () => {
    if ($('atpMain').hidden) pause();
    else if (ready && fit()) paint();   // 刚变成可见时画布尺寸才可测，需要重新适配
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('resize', () => { if (ready && fit()) paint(); });
}

function degrade(e) {
  ready = false;
  $('atpViewport').hidden = true;
  $('atpLoading').hidden = true;
  $('atpDegraded').hidden = false;
  ['atpPlay', 'atpReplay', 'atpResetView'].forEach(id => { const el = $(id); if (el) el.disabled = true; });
  console.error('ATP canvas failed', e);
}

BioI18n.subscribe(paint);
