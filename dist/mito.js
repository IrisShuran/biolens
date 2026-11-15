// 线粒体结构探索 · 交互模块（第一轮：结构与功能定位）
//
// 约定：
//  - 独立命名空间，所有 DOM id / class 以 mito 前缀，避免与 cell.js、DNA 课程冲突。
//  - 只读全局 window.showBioWorld 做世界切换，不修改旧模块的状态变量。
//  - 按需渲染：只在视角、选择或尺寸变化时绘制一帧，不持续播放动画。
//  - 文字目录、详解与理解题先建立；Three.js 初始化失败时它们仍然可用。

import * as THREE from './vendor/three.module.js';
import {mitoParts, mitoIntro, mitoQuestion, mitoLimits, mitoSources} from './mito-data.js';

const $ = id => document.getElementById(id);
const byId = Object.fromEntries(mitoParts.map(p => [p.id, p]));

// 模型尺寸（教学示意，非真实比例）。长轴沿 X，剖面缺口朝 +Z，便于侧向观察内部。
const CUT = {phiStart: Math.PI * 0.75, phiLength: Math.PI * 1.5};
const OUTER = [3.15, 1.46, 1.46];
const IMS_SHELL = [3.02, 1.32, 1.32];
const INNER = [2.9, 1.2, 1.2];
const MATRIX = [2.78, 1.05, 1.05];
const HOME = {azimuth: 0.34, elevation: 0.3};
// 取景用的模型半宽/半高（含余量）与目标填充比例：X 方向最长，斜看时投影还会更宽。
const FIT = {halfWidth: 3.45, halfHeight: 1.95, fill: .86};
const ZOOM = {min: .55, max: 2.2};

let renderer, scene, camera, root, ready = false, needsRender = true, framePending = false, started = false;
let selected = 'inner';
let azimuth = HOME.azimuth, elevation = HOME.elevation, zoom = 1, homeDist = 6;
// 视线中心的横向偏移与几个复用的临时向量（避免每帧新建对象）。
const pan = new THREE.Vector3();
const dir = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const groups = {}, meshes = [], labelNodes = {}, markers = {};
const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();

const vec = p => new THREE.Vector3(p[0], p[1], p[2]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BLACK = new THREE.Color('#000000');

function material(color, opacity = 1) {
  const m = new THREE.MeshStandardMaterial({
    color, roughness: .55, metalness: .04,
    transparent: opacity < 1, opacity,
    side: THREE.DoubleSide, depthWrite: opacity >= 1,
  });
  m.userData.baseOpacity = opacity;
  // 强调时用结构自身的色相自发光，避免整体变暗或偏色。
  m.userData.glow = new THREE.Color(color);
  return m;
}

// 与 three.js SphereGeometry 的顶点公式保持一致，供剖面边缘使用。
function shellPoint(scale, phi, theta) {
  return [
    -scale[0] * Math.cos(phi) * Math.sin(theta),
    scale[1] * Math.cos(theta),
    scale[2] * Math.sin(phi) * Math.sin(theta),
  ];
}

function addMesh(parent, geometry, color, opacity, part) {
  const m = new THREE.Mesh(geometry, material(color, opacity));
  m.userData.mitoPart = part;
  parent.add(m);
  meshes.push(m);
  return m;
}

// 四个壳体共用半径为 1 的球面会把尺寸漏掉：尺寸要烘进几何体本身。
// 直接缩放网格（或缩放整个 group）会连世界坐标下的轮廓线一起缩放，所以在这里 g.scale。
function shellGeometry(radii, segW = 72, segH = 40) {
  const g = new THREE.SphereGeometry(1, segW, segH, CUT.phiStart, CUT.phiLength);
  g.scale(radii[0], radii[1], radii[2]);
  return g;
}

function group(id) {
  const g = new THREE.Group();
  g.userData.mitoPart = id;
  root.add(g);
  groups[id] = g;
  return g;
}

function build() {
  root = new THREE.Group();
  scene.add(root);

  const color = id => byId[id].color;

  // 外膜：最外层，剖面缺口处露出内部。
  const outer = group('outer');
  const shells = {};
  shells.outer = addMesh(outer, shellGeometry(OUTER), color('outer'), .3, 'outer');

  // 膜间隙：外膜与内膜之间的一层很薄的空间，用半透明薄壳表示（厚度被夸大）。
  const ims = group('ims');
  shells.ims = addMesh(ims, shellGeometry(IMS_SHELL, 64, 34), color('ims'), .16, 'ims');

  // 内膜：外膜以内，同样切出缺口。
  const inner = group('inner');
  shells.inner = addMesh(inner, shellGeometry(INNER), color('inner'), .34, 'inner');

  // 嵴：内膜向基质折叠的部分。每片都是与内膜同一缺口、同一轮廓的薄椭球，
  // 边缘贴住内膜（留 3% 间隙避免共面闪烁），这样看起来是内膜的折叠而非游离的薄片。
  const cristae = new THREE.Group();
  root.add(cristae);
  const ridgeX = [-2.05, -1.4, -0.72, 0, 0.72, 1.4, 2.05];
  ridgeX.forEach((x, i) => {
    const t = x / INNER[0];
    const shrink = Math.sqrt(Math.max(.06, 1 - t * t)) * .97;
    const m = addMesh(cristae, shellGeometry([1, 1, 1], 40, 22), color('inner'), 1, 'inner');
    m.position.x = x;
    m.scale.set(.07 + (i % 3) * .018, INNER[1] * shrink, INNER[2] * shrink);
  });

  // 基质：内膜围成的内部空间，用低不透明度填充表示。
  const matrix = group('matrix');
  shells.matrix = addMesh(matrix, shellGeometry(MATRIX, 56, 30), color('matrix'), .2, 'matrix');

  // 诊断用：记录四个壳体实际生效的半轴长度。四个壳体曾经因为几何体没烘进尺寸而
  // 全部退化成同一个单位球（区室重叠），这个字段让回归测试能直接发现那类错误。
  const extent = mesh => {
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    return [bb.max.x, bb.max.y, bb.max.z].map(v => +v.toFixed(3));
  };
  $('mitoCanvas').dataset.mitoShells = JSON.stringify(
    Object.fromEntries(Object.entries(shells).map(([id, m]) => [id, extent(m)])),
  );

  // 剖面边缘的两条轮廓线，帮助分辨外膜与内膜的层次。
  [['outer', OUTER], ['inner', INNER]].forEach(([id, scale]) => {
    [CUT.phiStart, CUT.phiStart + CUT.phiLength].forEach(phi => {
      const pts = [];
      for (let i = 0; i <= 48; i++) pts.push(vec(shellPoint(scale, phi, i / 48 * Math.PI)));
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, .022, 6, false);
      addMesh(groups[id], g, color(id), .95, id);
    });
  });

  // 标签锚点（世界坐标，模型本身不旋转）。外膜的锚点不放在椭球最高点：
  // 模型占满画布后最高点会落进标签的上边距，反而被安全边距挡掉。
  markers.outer = vec([0, OUTER[1] * .86, 0]);
  markers.ims = vec([-1.55, IMS_SHELL[1] * .93, .55]);
  markers.inner = vec([1.62, INNER[1] * .82, .35]);
  markers.matrix = vec([0, -MATRIX[1] * .5, .1]);
}

// 取景：先按画布比例解析地估一个距离，再用真实投影迭代收敛。
// 只用半轴估算会低估斜看细长椭球时的投影宽度，所以必须量真实轮廓。
function refit() {
  const half = Math.tan(camera.fov * Math.PI / 360);
  const perWidth = half * Math.max(camera.aspect, .5);
  let d = clamp(Math.max(FIT.halfWidth / perWidth, FIT.halfHeight / half), 3, 30);
  pan.set(0, 0, 0);
  for (let i = 0; i < 4; i++) {
    homeDist = d;
    cameraPosition();
    root.updateMatrixWorld(true);
    const f = silhouette();
    const span = Math.max(f.right - f.left, f.bottom - f.top);
    if (Math.abs(span - FIT.fill) < .01) break;
    d = clamp(d * span / FIT.fill, 3, 30);
  }
  homeDist = d;
  // 模型被切掉一个楔形，投影重心并不在原点：只调距离会让一侧顶到画布边缘，
  // 所以再把视线中心横向平移，把轮廓摆到画布正中。
  for (let i = 0; i < 4; i++) {
    cameraPosition();
    root.updateMatrixWorld(true);
    const f = silhouette();
    const nx = f.left + f.right - 1;
    const ny = 1 - f.top - f.bottom;
    if (Math.abs(nx) < .004 && Math.abs(ny) < .004) break;
    // nx / ny 是模型轮廓中心相对画布中心的 NDC 偏移；把视线中心朝模型中心平移同样的量，
    // 所以符号与偏移动量同号（反向修正会让每次迭代把误差翻倍）。
    const k = d * half;
    pan.addScaledVector(right.setFromMatrixColumn(camera.matrixWorld, 0), nx * k * camera.aspect);
    pan.addScaledVector(up.setFromMatrixColumn(camera.matrixWorld, 1), ny * k);
  }
  cameraPosition();
}

function cameraPosition() {
  const d = homeDist * zoom;
  const ce = Math.cos(elevation);
  dir.set(ce * Math.sin(azimuth), Math.sin(elevation), ce * Math.cos(azimuth));
  camera.position.copy(pan).addScaledVector(dir, d);
  camera.lookAt(pan);
  camera.updateMatrixWorld(true);
}

function invalidate() { needsRender = true; schedule(); }

// 按需渲染：只有 invalidate() 才会排一帧，空闲时没有 rAF 循环在跑。
function schedule() {
  if (framePending) return;
  framePending = true;
  requestAnimationFrame(frame);
}

function emphasis() {
  const isolate = $('mitoIsolate').checked;
  for (const m of meshes) {
    const active = m.userData.mitoPart === selected;
    const base = m.material.userData.baseOpacity;
    m.material.opacity = isolate && !active ? Math.min(base, .07) : active ? Math.min(.82, base * 1.45) : base;
    m.material.transparent = m.material.opacity < 1;
    m.material.depthWrite = m.material.opacity >= 1;
    m.material.emissive.copy(active ? m.material.userData.glow : BLACK);
    m.material.emissiveIntensity = active ? .3 : 0;
  }
}

function select(id, {manual = true} = {}) {
  if (!byId[id]) return;
  selected = id;
  const p = byId[id];
  $('mitoPartTag').textContent = p.tag;
  $('mitoPartName').textContent = p.name;
  $('mitoPartEn').textContent = p.en;
  $('mitoPartAt').textContent = p.at;
  $('mitoPartShape').textContent = p.shape;
  $('mitoPartJob').textContent = p.job;
  $('mitoPartLink').textContent = p.link;
  $('mitoPartNote').textContent = p.note;
  $('mitoPartLimit').textContent = p.limit;
  $('mitoSelectionStatus').textContent = '已选择：' + p.name;
  // ATP 合成课程从"内膜与嵴"进入：只有选中它时才出现入口。
  $('atpEnter').hidden = id !== 'inner';
  document.querySelectorAll('[data-mito-part]').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.mitoPart === id));
  });
  if (ready) { emphasis(); invalidate(); }
}

// 与 cell.js 的 select() 保持同样的调用形态；线粒体模块本身没有播放状态。

function buildDirectory() {
  const list = $('mitoPartList');
  const tags = [...new Set(mitoParts.map(p => p.tag))];
  for (const tag of tags) {
    const section = document.createElement('div');
    section.className = 'mito-part-group';
    const h = document.createElement('h3');
    h.textContent = tag;
    const row = document.createElement('div');
    mitoParts.filter(p => p.tag === tag).forEach(p => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.mitoPart = p.id;
      b.textContent = p.name;
      b.style.setProperty('--mito-part', p.color);
      b.addEventListener('click', () => select(p.id));
      row.append(b);
    });
    section.append(h, row);
    list.append(section);
  }
}

function buildQuestion() {
  $('mitoQuestionPrompt').textContent = mitoQuestion.prompt;
  const box = $('mitoQuestionChoices');
  const retry = $('mitoQuestionRetry');
  const feedback = $('mitoQuestionFeedback');

  const reset = () => {
    box.replaceChildren();
    feedback.textContent = '';
    retry.hidden = true;
    mitoQuestion.options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String.fromCharCode(65 + i) + ' · ' + opt.text;
      b.addEventListener('click', () => {
        [...box.children].forEach((x, j) => {
          x.disabled = true;
          x.classList.toggle('correct', mitoQuestion.options[j].correct);
          x.classList.toggle('wrong', j === i && !opt.correct);
        });
        feedback.textContent = opt.feedback;
        retry.hidden = false;
      });
      box.append(b);
    });
  };
  retry.addEventListener('click', reset);
  reset();
}

function buildStaticText() {
  $('mitoLead').textContent = mitoIntro.lead;
  $('mitoSchematic').textContent = mitoIntro.schematic;
  $('mitoScope').textContent = mitoIntro.scope;
  $('mitoModelNote').textContent = mitoIntro.schematic;
  $('mitoQuestionRetryNote').textContent = mitoQuestion.retryNote;
  const ul = $('mitoLimitList');
  mitoLimits.forEach(t => {
    const li = document.createElement('li');
    li.textContent = t;
    ul.append(li);
  });
  const src = $('mitoSourceList');
  mitoSources.forEach((s, i) => {
    if (i) src.append(document.createTextNode(' · '));
    const a = document.createElement('a');
    a.href = s.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = s.label;
    src.append(a);
  });
}

function buildLabels() {
  for (const p of mitoParts) {
    const b = document.createElement('span');
    b.className = 'mito-label';
    b.textContent = p.name;
    labelNodes[p.id] = b;
    $('mitoLabels').append(b);
  }
}

function updateLabels() {
  const box = $('mitoViewport');
  const rect = box.getBoundingClientRect();
  if (rect.width < 1) return;
  const show = $('mitoShowLabels').checked;
  const placed = [];
  const order = [selected, 'outer', 'inner', 'ims', 'matrix'];
  for (const node of Object.values(labelNodes)) node.hidden = true;
  if (!show) return;
  for (const id of new Set(order)) {
    const p = markers[id].clone().project(camera);
    const x = (p.x * .5 + .5) * rect.width;
    const y = (-p.y * .5 + .5) * rect.height;
    if (p.z > 1 || x < 52 || x > rect.width - 52) continue;
    // 与已放置的标签撞车或顶到上下边距时，先上下挪一点再放，实在放不下才隐藏。
    // 窄屏上几个锚点本来就挤在一起，直接隐藏会让某个结构没有名字。
    let top = null;
    for (const dy of [0, -26, 26, -52, 52]) {
      const yy = y + dy;
      if (yy < 30 || yy > rect.height - 16) continue;
      if (placed.some(q => Math.abs(q[0] - x) < 96 && Math.abs(q[1] - yy) < 30)) continue;
      top = yy;
      break;
    }
    if (top === null) continue;
    const label = labelNodes[id];
    label.hidden = false;
    label.style.left = x + 'px';
    label.style.top = top + 'px';
    label.classList.toggle('selected', id === selected);
    placed.push([x, top]);
  }
}

function pick(clientX, clientY) {
  const canvas = $('mitoCanvas');
  const r = canvas.getBoundingClientRect();
  pointer.set((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(pointer, camera);
  // 淡化其他结构时只在该结构内部拾取，否则点到的其实是已经淡出的外层壳体。
  const pool = $('mitoIsolate').checked ? meshes.filter(m => m.userData.mitoPart === selected) : meshes;
  const hits = ray.intersectObjects(pool, false).filter(h => h.object.visible);
  if (!hits.length) return null;
  // 剖面缺口让内部结构直接可见，最近的一次命中就是点击到的结构。
  return hits[0].object.userData.mitoPart || null;
}

function controls() {
  const canvas = $('mitoCanvas');
  let down = null, moved = false;
  canvas.addEventListener('pointerdown', e => {
    down = [e.clientX, e.clientY];
    moved = false;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - down[0], dy = e.clientY - down[1];
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    azimuth -= dx * .006;
    elevation = clamp(elevation + dy * .005, .1, 1.45);
    down = [e.clientX, e.clientY];
    cameraPosition();
    invalidate();
  });
  const end = e => {
    if (!down) return;
    down = null;
    if (moved) return;
    const id = pick(e.clientX, e.clientY);
    if (id) select(id);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', () => { down = null; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    zoom = clamp(zoom + e.deltaY * .0008, ZOOM.min, ZOOM.max);
    cameraPosition();
    invalidate();
  }, {passive: false});
  canvas.addEventListener('keydown', e => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'ArrowLeft') azimuth -= .1;
    if (e.key === 'ArrowRight') azimuth += .1;
    if (e.key === 'ArrowUp') elevation = clamp(elevation + .1, .1, 1.45);
    if (e.key === 'ArrowDown') elevation = clamp(elevation - .1, .1, 1.45);
    if (e.key === '+' || e.key === '=') zoom = clamp(zoom - .12, ZOOM.min, ZOOM.max);
    if (e.key === '-') zoom = clamp(zoom + .12, ZOOM.min, ZOOM.max);
    cameraPosition();
    invalidate();
  });
  $('mitoReset').addEventListener('click', () => {
    azimuth = HOME.azimuth;
    elevation = HOME.elevation;
    zoom = 1;
    refit();
    invalidate();
  });
  $('mitoShowLabels').addEventListener('change', invalidate);
  $('mitoIsolate').addEventListener('change', () => { emphasis(); invalidate(); });
}

// 诊断用：当前视角下模型轮廓在画布里的归一化范围（0–1）。取外膜一层的真实顶点来投影，
// 而不是用包围盒的八个角——斜着看一个细长椭球时，包围盒的角远在模型之外，会高估很多。
function silhouette() {
  const v = new THREE.Vector3();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  groups.outer.traverse(o => {
    const pos = o.geometry && o.geometry.attributes && o.geometry.attributes.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).project(camera);
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }
  });
  if (!isFinite(minX)) return {left: 0, right: 1, top: 0, bottom: 1};
  return {
    left: +(minX * .5 + .5).toFixed(4), right: +(maxX * .5 + .5).toFixed(4),
    top: +(.5 - maxY * .5).toFixed(4), bottom: +(.5 - minY * .5).toFixed(4),
  };
}

function frame() {
  framePending = false;
  if (!ready || document.hidden || $('mitoMain').hidden || !needsRender) return;
  needsRender = false;
  renderer.render(scene, camera);
  updateLabels();
  $('mitoCanvas').dataset.mitoFraming = JSON.stringify(silhouette());
}

function startRenderer() {
  renderer = new THREE.WebGLRenderer({canvas: $('mitoCanvas'), antialias: true, alpha: false});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setClearColor('#101f30');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
  scene.add(new THREE.HemisphereLight('#e0f5ff', '#3b4f4a', 2.3));
  const key = new THREE.DirectionalLight('#fff4dd', 2.8);
  key.position.set(3, 7, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#a9c9ff', 1.1);
  fill.position.set(-6, 2, -5);
  scene.add(fill);
  build();
  refit();
  ready = true;
  emphasis();
  // 三维控制只在渲染器就绪后注册：否则降级时点击或拖动会访问尚未创建的 camera。
  controls();

  const resize = () => {
    const r = $('mitoViewport').getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    refit();
    invalidate();
  };
  new ResizeObserver(resize).observe($('mitoViewport'));
  resize();
  $('mitoLoading').hidden = true;
  $('mitoCanvas').dataset.ready = 'true';
  invalidate();
}

export function initMito() {
  if (started) return;
  started = true;

  buildStaticText();
  buildDirectory();
  buildQuestion();
  buildLabels();
  select(selected, {manual: false});

  $('mitoBack').addEventListener('click', () => window.showBioWorld('cell'));
  $('atpEnter').addEventListener('click', () => window.showBioWorld('atp'));

  try {
    startRenderer();
  } catch (e) {
    ready = false;
    $('mitoLoading').textContent = '此设备暂时无法显示三维模型。仍可使用下方的结构目录、详解与理解题学习。';
    // 降级时关掉所有依赖三维模型的控制，避免做出无效承诺。
    ['mitoReset', 'mitoShowLabels', 'mitoIsolate'].forEach(id => { const el = $(id); if (el) el.disabled = true; });
    $('mitoCanvas').removeAttribute('tabindex');
    document.querySelectorAll('.mito-view-hint, .mito-cut-tag').forEach(el => { el.hidden = true; });
    console.error('Mito renderer failed', e);
  }

  window.addEventListener('bioworldchange', invalidate);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) invalidate(); });
}
