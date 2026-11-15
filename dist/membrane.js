// 细胞膜结构探索 · 独立页面模块
//
// 约定：
//  - 只读 ./membrane-data.json（定稿文案），页面文字不在此处改写。
//  - 所有 DOM id / class 使用 membrane 前缀，样式自带于 membrane.css，不依赖 style.css。
//  - 按需渲染：只有视角、选择或尺寸变化时绘制一帧，没有常驻动画循环、没有播放按钮。
//  - 结构目录、详解与理解题先建立；Three.js 或 WebGL 不可用时它们仍然可用。
//  - 模型尺寸是确定性教学布局（非纳米、非真实比例）。
//
// Y 向上：+Y 为细胞外侧，−Y 为胞质溶胶侧；X 横向，Z 深度。

import * as THREE from './vendor/three.module.js';

const DATA_URL = './membrane-data.json';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------- 教学布局常数 ---------------- */

const HEAD_R = 0.16;                       // 亲水头部半径
const HEAD_PLANE = 1.2;                    // 两层头部中心所在 Y
const TAIL_TIP = 0.1;                      // 尾端止点（不越过膜中心）
const TAIL_R = 0.045;                      // 尾链粗细
const GRID = {x0: -4.2, x1: 4.2, z0: -1.8, z1: 1.8, step: 0.6};

const TM = {x: -1.5, z: 0, r: 0.5, half: 1.6};          // 普通跨膜蛋白：胶囊
const GP = {x: 1.7, z: -0.8, r: 0.42, half: 1.5};       // 糖蛋白的膜蛋白主体
const PERI = {x: 1.2, y: -1.66, z: 0.9, rx: 0.66, ry: 0.27, rz: 0.52};  // 外周蛋白：扁椭球
const GL = {x: 3.3, z: 0.8};                            // 糖脂锚定（外侧头部）

// 让位区：这些位置不生成普通磷脂，避免脂质几何体穿过蛋白；糖脂锚定处也留出同一分子的空间。
const KEEPOUT = [
  {x: TM.x, z: TM.z, r: 0.72},
  {x: GP.x, z: GP.z, r: 0.66},
  {x: GL.x, z: GL.z, r: 0.6, leaflet: 1},
];

// 胆固醇插在四个磷脂之间的空隙中心；极性端朝向所在层的头部。
const CHOLESTEROL = [
  {x: 0.9, z: 0.3, leaflet: 1},
  {x: -0.3, z: -0.3, leaflet: 1},
  {x: 2.7, z: 1.5, leaflet: 1},
  {x: 1.5, z: 1.5, leaflet: 1},
  {x: -2.1, z: 0.9, leaflet: -1},
  {x: 1.5, z: -1.5, leaflet: -1},
];

const HOME = {azimuth: 0.26, elevation: 0.3};
const ELEVATION_LIMIT = {min: 0.18, max: 1.22};   // 约 10°–70°，避免翻转混淆上/下
const ZOOM_LIMIT = {min: 0.5, max: 2.6};
const FIT = {fill: 0.86};                         // 轮廓占画布比例，四周留 ≥7% 余量
const BOX_MARGIN = 0.25;                          // 缩放时相机与模型体的最小余量

// 标签锚点：锚在模型坐标上（不贴画布上下边），随相机一起投影。
const MARKERS = {
  head: {pos: [0, HEAD_PLANE, 1.8], dir: 'above'},
  tail: {pos: [-0.6, 0.75, 1.8], dir: 'above'},
  transmembrane: {pos: [TM.x, TM.half, TM.z], dir: 'above'},
  peripheral: {pos: [PERI.x, PERI.y - PERI.ry, PERI.z], dir: 'below'},
  cholesterol: {pos: [2.7, 0.95, 1.5], dir: 'above'},
  glycoprotein: {pos: [GP.x, 1.9, GP.z], dir: 'above'},
  glycolipid: {pos: [GL.x, 1.82, GL.z], dir: 'above'},
};
const SIDE_MARKERS = [
  {id: 'outside', pos: [-3.35, 1.62, 0], dir: 'above', className: 'membrane-label-side'},
  {id: 'inside', pos: [-3.35, -1.58, 0], dir: 'below', className: 'membrane-label-inside'},
];

/* ---------------- 状态 ---------------- */

let DATA = null;
const PARTS = [];
const PART_BY_ID = {};

let renderer = null, scene = null, camera = null, root = null;
let ready = false, degraded = false, started = false;
let needsRender = true, framePending = false;
let selected = 'head';
let azimuth = HOME.azimuth, elevation = HOME.elevation, zoom = 1, homeDist = 12;

const pan = new THREE.Vector3();
const dir = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const tmpVec = new THREE.Vector3();
const modelBox = new THREE.Box3();
const modelMeshes = [];
const labelNodes = {};                    // id -> {el, marker}
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let allPoints = null;                     // 全部模型顶点（取景用）
let samplePoints = null;                  // 抽样顶点（每帧轮廓诊断用）

/* ---------------- 数据 ---------------- */

async function loadData() {
  const res = await fetch(DATA_URL, {cache: 'no-store'});
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (!data || !Array.isArray(data.structures) || data.structures.length !== 7) {
    throw new Error('membrane-data.json 结构不完整');
  }
  return data;
}

function partList(data) {
  PARTS.length = 0;
  for (const key of Object.keys(PART_BY_ID)) delete PART_BY_ID[key];
  for (const s of data.structures) {
    const part = {...s, meshes: []};
    PARTS.push(part);
    PART_BY_ID[s.id] = part;
  }
}

/* ---------------- 文字与列表 ---------------- */

function buildTexts() {
  document.title = DATA.title;
  $('membraneTitle').textContent = DATA.title;
  $('membraneSubtitle').textContent = DATA.subtitle;
  $('membraneContext').textContent = DATA.context;
  // 模型说明沿用数据里的限制原文，不新写科学表述。
  $('membraneModelNote').textContent = DATA.limits[1];
  $('membraneDirectoryNote').textContent = DATA.structures.length + ' 个结构 · 不依赖三维模型也可使用';

  const ul = $('membraneLimitList');
  ul.replaceChildren();
  for (const text of DATA.limits) {
    const li = document.createElement('li');
    li.textContent = text;
    ul.append(li);
  }

  const line = $('membraneSourceLine');
  line.replaceChildren();
  line.append(document.createTextNode('来源：'));
  for (const src of DATA.sources) {
    const a = document.createElement('a');
    a.href = src.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = src.title;
    line.append(a);
    if (src.checked) line.append(document.createTextNode('（核对日期 ' + src.checked + '）'));
    line.append(document.createTextNode('。'));
  }
}

function buildDirectory() {
  const box = $('membraneDirectory');
  box.replaceChildren();
  for (const part of PARTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.membraneId = part.id;
    b.style.setProperty('--membrane-part', part.color);
    b.setAttribute('aria-pressed', String(part.id === selected));
    b.append(document.createTextNode(part.name));
    b.addEventListener('click', () => select(part.id));
    box.append(b);
  }
}

function buildQuestion() {
  const q = DATA.question;
  $('membraneQuestionPrompt').textContent = q.prompt;
  $('membraneQuestionRetry').textContent = q.retryLabel;
  const box = $('membraneQuestionChoices');
  const feedback = $('membraneQuestionFeedback');
  const retry = $('membraneQuestionRetry');

  const reset = () => {
    box.replaceChildren();
    feedback.textContent = '';
    retry.hidden = true;
    q.options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.membraneOption = opt.id;
      const key = document.createElement('span');
      key.className = 'membrane-option-key';
      key.setAttribute('aria-hidden', 'true');
      key.textContent = String.fromCharCode(65 + i);
      const text = document.createElement('span');
      text.className = 'membrane-option-text';
      text.textContent = opt.text;
      b.append(key, text);
      b.addEventListener('click', () => {
        // 锁定本次选项：只显示所选答案对应的反馈，不改变模型状态。
        [...box.children].forEach((el, j) => {
          el.disabled = true;
          el.classList.toggle('correct', q.options[j].correct);
          el.classList.toggle('wrong', j === i && !opt.correct);
        });
        feedback.textContent = opt.feedback;
        retry.hidden = false;
      });
      box.append(b);
    });
  };
  retry.addEventListener('click', reset);   // 重新作答只清空题目状态，不重置模型
  reset();
}

/* ---------------- 几何工具 ---------------- */

const matrixAt = (pos, scale, rotY = 0) => new THREE.Matrix4().compose(
  new THREE.Vector3(pos[0], pos[1], pos[2]),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
  new THREE.Vector3(scale ? scale[0] : 1, scale ? scale[1] : 1, scale ? scale[2] : 1),
);

function capsuleGeometry(radius, halfHeight) {
  return new THREE.CapsuleGeometry(radius, Math.max(0.01, halfHeight * 2 - radius * 2), 5, 22);
}

// 合并若干几何体为一个（含每顶点分子号与层号），减少绘制批次。
function mergeItems(items) {
  let verts = 0, indices = 0;
  for (const it of items) {
    verts += it.geometry.attributes.position.count;
    indices += it.geometry.index ? it.geometry.index.count : it.geometry.attributes.position.count;
  }
  const position = new Float32Array(verts * 3);
  const normal = new Float32Array(verts * 3);
  const aMolecule = new Float32Array(verts).fill(-1);
  const aLeaflet = new Float32Array(verts);
  const index = new Uint32Array(indices);
  const normalMatrix = new THREE.Matrix3();
  let vo = 0, io = 0;
  for (const it of items) {
    const g = it.geometry, m = it.matrix || new THREE.Matrix4();
    const count = g.attributes.position.count;
    normalMatrix.getNormalMatrix(m);
    for (let i = 0; i < count; i++) {
      tmpVec.fromBufferAttribute(g.attributes.position, i).applyMatrix4(m);
      position[(vo + i) * 3] = tmpVec.x;
      position[(vo + i) * 3 + 1] = tmpVec.y;
      position[(vo + i) * 3 + 2] = tmpVec.z;
      tmpVec.fromBufferAttribute(g.attributes.normal, i).applyMatrix3(normalMatrix).normalize();
      normal[(vo + i) * 3] = tmpVec.x;
      normal[(vo + i) * 3 + 1] = tmpVec.y;
      normal[(vo + i) * 3 + 2] = tmpVec.z;
      aMolecule[vo + i] = it.molecule === undefined ? -1 : it.molecule;
      aLeaflet[vo + i] = it.leaflet === undefined ? 0 : it.leaflet;
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) index[io + i] = g.index.getX(i) + vo;
      io += g.index.count;
    } else {
      for (let i = 0; i < count; i++) index[io + i] = vo + i;
      io += count;
    }
    vo += count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setAttribute('aMolecule', new THREE.BufferAttribute(aMolecule, 1));
  out.setAttribute('aLeaflet', new THREE.BufferAttribute(aLeaflet, 1));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

function tintColor(base, k) {
  const c = base.clone();
  if (!k) return c;
  return k > 0 ? c.lerp(new THREE.Color('#ffffff'), k) : c.lerp(new THREE.Color('#000000'), -k);
}

/* ---------------- 模型 ---------------- */

const MESH_DEFS = [
  {key: 'heads', part: 'head', role: 'head'},
  {key: 'tails', part: 'tail', role: 'tail', doubleSide: true},
  {key: 'transmembrane', part: 'transmembrane', role: 'protein'},
  {key: 'peripheral', part: 'peripheral', role: 'protein'},
  {key: 'cholesterolRings', part: 'cholesterol', role: 'ring'},
  {key: 'cholesterolPolar', part: 'cholesterol', role: 'polar'},
  {key: 'glycoproteinProtein', part: 'glycoprotein', role: 'protein'},
  {key: 'glycoproteinGlycan', part: 'glycoprotein', role: 'glycan', tint: 0.32, doubleSide: true},
  {key: 'glycolipidAnchor', part: 'glycolipid', role: 'anchor'},
  {key: 'glycolipidTail', part: 'glycolipid', role: 'tail', tint: -0.14, doubleSide: true},
  {key: 'glycolipidGlycan', part: 'glycolipid', role: 'glycan', tint: 0.32, doubleSide: true},
];

const lipidGrid = (from, to) => {
  const out = [];
  for (let v = from; v <= to + 1e-9; v += GRID.step) out.push(Math.round(v * 100) / 100);
  return out;
};

function keepoutAt(leaflet, x, z) {
  for (const k of KEEPOUT) {
    if (k.leaflet && k.leaflet !== leaflet) continue;
    if (Math.hypot(x - k.x, z - k.z) < k.r) return true;
  }
  return false;
}

// 一个磷脂分子 = 1 个头部 + 同一分子的 2 条尾链；上下两层的分子各自独立，不连成一个分子。
function lipidMolecules() {
  const out = [];
  let id = 0;
  const xs = lipidGrid(GRID.x0, GRID.x1);
  const zs = lipidGrid(GRID.z0, GRID.z1);
  for (const leaflet of [1, -1]) {
    for (const x of xs) {
      for (const z of zs) {
        if (keepoutAt(leaflet, x, z)) continue;
        out.push({id: id++, leaflet, x, y: leaflet * HEAD_PLANE, z, part: 'head'});
      }
    }
  }
  // 糖脂：外侧磷脂上连着糖链，单独编号，仍是一个完整分子（锚定头部 + 双尾）。
  out.push({id: id++, leaflet: 1, x: GL.x, y: HEAD_PLANE, z: GL.z, part: 'glycolipid'});
  return out;
}

function tailCurve(mol, side) {
  const y0 = mol.leaflet * (HEAD_PLANE - HEAD_R);
  const y1 = mol.leaflet * TAIL_TIP;
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(mol.x + side * 0.085, y0, mol.z),
    new THREE.Vector3(mol.x + side * 0.12, (y0 + y1) / 2, mol.z + side * 0.03),
    new THREE.Vector3(mol.x + side * 0.105, y1, mol.z),
  ]);
}

function glycanTube(points, radius) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  return new THREE.TubeGeometry(curve, 6, radius, 6, false);
}

function buildModel() {
  root = new THREE.Group();
  scene.add(root);

  const lists = new Map();
  const add = (key, geometry, matrix, molecule = -1, leaflet = 0) => {
    if (!lists.has(key)) lists.set(key, []);
    lists.get(key).push({geometry, matrix, molecule, leaflet});
  };

  const molecules = lipidMolecules();
  const headSphere = new THREE.SphereGeometry(HEAD_R, 14, 10);
  for (const mol of molecules) {
    const key = mol.part === 'glycolipid' ? 'glycolipidAnchor' : 'heads';
    const tailKey = mol.part === 'glycolipid' ? 'glycolipidTail' : 'tails';
    add(key, headSphere.clone(), matrixAt([mol.x, mol.y, mol.z]), mol.id, mol.leaflet);
    for (const side of [-1, 1]) {
      add(tailKey, new THREE.TubeGeometry(tailCurve(mol, side), 6, TAIL_R, 6, false), null, mol.id, mol.leaflet);
    }
  }

  // 普通跨膜蛋白：胶囊，Y 从 −1.6 到 +1.6，穿过两层；不画运输或孔道。
  add('transmembrane', capsuleGeometry(TM.r, TM.half), matrixAt([TM.x, 0, TM.z]));
  // 外周蛋白：扁椭球，贴在胞质溶胶侧，不穿过双层。
  add('peripheral', new THREE.SphereGeometry(1, 26, 16),
    matrixAt([PERI.x, PERI.y, PERI.z], [PERI.rx, PERI.ry, PERI.rz]));
  // 胆固醇：三个小环的组合 + 极性端小球 + 短烃尾；只在一层内部。
  for (const c of CHOLESTEROL) {
    const s = c.leaflet;
    [[-0.055, 0.86], [0.055, 0.86], [0, 0.67]].forEach(([dx, y]) => {
      add('cholesterolRings', new THREE.TorusGeometry(0.085, 0.03, 6, 14), matrixAt([c.x + dx, s * y, c.z]));
    });
    add('cholesterolRings', new THREE.CylinderGeometry(0.028, 0.028, 0.15, 8), matrixAt([c.x, s * 0.5, c.z]));
    add('cholesterolPolar', new THREE.SphereGeometry(0.08, 12, 8), matrixAt([c.x, s * 1.02, c.z]));
  }
  // 糖蛋白：跨膜的膜蛋白主体 + 连在主体上的分支糖链（不游离）。
  add('glycoproteinProtein', capsuleGeometry(GP.r, GP.half), matrixAt([GP.x, 0, GP.z]));
  const gpGlycan = [
    [[GP.x, 1.4, GP.z], [GP.x + 0.02, 1.68, GP.z], [GP.x, 1.9, GP.z]],
    [[GP.x, 1.88, GP.z], [1.45, 2.16, -0.9], [1.35, 2.45, -0.95]],
    [[GP.x, 1.88, GP.z], [1.72, 2.34, -0.72], [1.7, 2.6, -0.7]],
    [[GP.x, 1.88, GP.z], [1.95, 2.16, -0.94], [2.05, 2.4, -1]],
  ];
  for (const branch of gpGlycan) add('glycoproteinGlycan', glycanTube(branch, 0.042));
  for (const [tip, r] of [[[1.35, 2.45, -0.95], 0.07], [[1.7, 2.6, -0.7], 0.07],
    [[2.05, 2.4, -1], 0.07], [[GP.x, 1.88, GP.z], 0.078]]) {
    add('glycoproteinGlycan', new THREE.SphereGeometry(r, 10, 8), matrixAt(tip));
  }
  // 糖脂：锚定在外侧磷脂处，糖链从同一个分子向细胞外侧延伸。
  const glGlycan = [
    [[GL.x, 1.3, GL.z], [GL.x, 1.58, GL.z], [GL.x + 0.02, 1.82, GL.z]],
    [[GL.x + 0.02, 1.8, GL.z], [3.1, 2.04, 0.7], [3.02, 2.2, 0.7]],
    [[GL.x + 0.02, 1.8, GL.z], [3.34, 2.2, 0.86], [3.3, 2.4, 0.86]],
  ];
  for (const branch of glGlycan) add('glycolipidGlycan', glycanTube(branch, 0.04));
  for (const [tip, r] of [[[3.02, 2.2, 0.7], 0.065], [[3.3, 2.4, 0.86], 0.065],
    [[GL.x + 0.02, 1.8, GL.z], 0.072]]) {
    add('glycolipidGlycan', new THREE.SphereGeometry(r, 10, 8), matrixAt(tip));
  }

  const allPositions = [];
  for (const def of MESH_DEFS) {
    const items = lists.get(def.key);
    if (!items || !items.length) continue;
    const geometry = mergeItems(items);
    for (const it of items) it.geometry.dispose();
    const part = PART_BY_ID[def.part];
    const base = tintColor(new THREE.Color(part.color), def.tint || 0);
    const material = new THREE.MeshStandardMaterial({
      color: base.clone(), emissive: new THREE.Color('#000000'), roughness: 0.52, metalness: 0.04,
      side: def.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    });
    material.userData.base = base.clone();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.membranePart = def.part;
    mesh.userData.membraneRole = def.role;
    root.add(mesh);
    modelMeshes.push(mesh);
    part.meshes.push(mesh);
    allPositions.push(geometry.attributes.position.array);
  }

  let total = 0;
  for (const arr of allPositions) total += arr.length;
  allPoints = new Float32Array(total);
  let offset = 0;
  for (const arr of allPositions) { allPoints.set(arr, offset); offset += arr.length; }

  const sampleStep = 3;                     // 每 3 个顶点取 1 个做每帧轮廓诊断
  const sampleCount = Math.ceil(total / 3 / sampleStep) * 3;
  samplePoints = new Float32Array(sampleCount);
  let so = 0;
  for (let i = 0; i + 3 <= total; i += 3 * sampleStep) {
    samplePoints[so++] = allPoints[i];
    samplePoints[so++] = allPoints[i + 1];
    samplePoints[so++] = allPoints[i + 2];
  }
  samplePoints = samplePoints.subarray(0, so);

  modelBox.setFromArray(allPoints);
  // 诊断用：模型体尺寸（教学布局，非真实比例）。
  $('membraneCanvas').dataset.membraneBounds = JSON.stringify({
    min: modelBox.min.toArray().map(v => +v.toFixed(3)),
    max: modelBox.max.toArray().map(v => +v.toFixed(3)),
    molecules: molecules.length,
    meshes: modelMeshes.length,
  });
}

/* ---------------- 相机与渲染 ---------------- */

function projectionBounds(points) {
  let left = Infinity, right = -Infinity, top = -Infinity, bottom = Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i + 3 <= points.length; i += 3) {
    v.set(points[i], points[i + 1], points[i + 2]).project(camera);
    if (v.x < left) left = v.x;
    if (v.x > right) right = v.x;
    if (v.y > top) top = v.y;
    if (v.y < bottom) bottom = v.y;
  }
  if (!isFinite(left)) return {left: 0, right: 1, top: 0, bottom: 1};
  return {
    left: +(left * 0.5 + 0.5).toFixed(4), right: +(right * 0.5 + 0.5).toFixed(4),
    top: +(0.5 - top * 0.5).toFixed(4), bottom: +(0.5 - bottom * 0.5).toFixed(4),
  };
}

function cameraPositionAt(distance) {
  const d = distance;
  const ce = Math.cos(elevation);
  dir.set(ce * Math.sin(azimuth), Math.sin(elevation), ce * Math.cos(azimuth));
  return tmpVec.copy(pan).addScaledVector(dir, d);
}

function placeCamera(distance) {
  camera.position.copy(cameraPositionAt(distance));
  camera.lookAt(pan);
  camera.updateMatrixWorld(true);
}

function insideModelBox(p) {
  return p.x > modelBox.min.x - BOX_MARGIN && p.x < modelBox.max.x + BOX_MARGIN
    && p.y > modelBox.min.y - BOX_MARGIN && p.y < modelBox.max.y + BOX_MARGIN
    && p.z > modelBox.min.z - BOX_MARGIN && p.z < modelBox.max.z + BOX_MARGIN;
}

// 缩放限制：不把相机推进模型体内部。
function resolveDistance() {
  let d = homeDist * zoom;
  let guard = 0;
  while (guard++ < 60 && insideModelBox(cameraPositionAt(d))) d += 0.2;
  return d;
}

// 取景：先用模型体估一个距离，再用真实投影迭代收敛，并把轮廓摆到画布正中。
function refit() {
  const halfTan = Math.tan(camera.fov * Math.PI / 360);
  const perWidth = halfTan * Math.max(camera.aspect, 0.5);
  const size = modelBox.getSize(new THREE.Vector3());
  const halfWidth = Math.max(size.x, size.z) * 0.5 * 1.06;
  const halfHeight = size.y * 0.5 * 1.06;
  let d = clamp(Math.max(halfWidth / perWidth, halfHeight / halfTan), 4, 60);
  pan.copy(modelBox.getCenter(new THREE.Vector3()));
  for (let i = 0; i < 5; i++) {
    homeDist = d;
    placeCamera(d);
    const f = projectionBounds(samplePoints);
    const span = Math.max(f.right - f.left, f.bottom - f.top);
    if (Math.abs(span - FIT.fill) < 0.005) break;
    d = clamp(d * span / FIT.fill, 4, 60);
  }
  homeDist = d;
  for (let i = 0; i < 5; i++) {
    placeCamera(homeDist);
    const f = projectionBounds(samplePoints);
    const nx = f.left + f.right - 1;
    const ny = 1 - f.top - f.bottom;
    if (Math.abs(nx) < 0.003 && Math.abs(ny) < 0.003) break;
    const k = homeDist * halfTan;
    pan.addScaledVector(right.setFromMatrixColumn(camera.matrixWorld, 0), nx * k * camera.aspect);
    pan.addScaledVector(up.setFromMatrixColumn(camera.matrixWorld, 1), ny * k);
  }
  placeCamera(resolveDistance());
}

function applyCamera() {
  placeCamera(resolveDistance());
}

function invalidate() {
  needsRender = true;
  schedule();
}

function schedule() {
  if (framePending) return;
  framePending = true;
  requestAnimationFrame(frame);
}

function frame() {
  framePending = false;
  if (!ready || !needsRender) return;
  needsRender = false;
  renderer.render(scene, camera);
  updateLabels();
  $('membraneCanvas').dataset.membraneFraming = JSON.stringify(projectionBounds(samplePoints));
}

/* ---------------- 强调与选择 ---------------- */

function emphasis() {
  const white = new THREE.Color('#ffffff');
  for (const part of PARTS) {
    const active = part.id === selected;
    for (const mesh of part.meshes) {
      const m = mesh.material;
      const base = m.userData.base;                  // 已含材质之间的色调差
      m.color.copy(active ? base.clone().lerp(white, 0.22) : base);
      m.emissive.set(active ? part.color : '#000000');
      m.emissiveIntensity = active ? 0.42 : 0;
    }
  }
}

function select(id) {
  if (!PART_BY_ID[id]) return;
  selected = id;
  const part = PART_BY_ID[id];
  $('membranePartTag').textContent = '结构 ' + (PARTS.indexOf(part) + 1) + ' / ' + PARTS.length;
  $('membranePartName').textContent = part.name;
  $('membranePartEn').textContent = part.en;
  $('membranePartPosition').textContent = part.position;
  $('membranePartFunction').textContent = part.function;
  $('membranePartMisconception').textContent = part.misconception;
  $('membraneSelectionStatus').textContent = '已选择：' + part.name;
  const label = labelNodes.selected;
  if (label) label.el.textContent = part.name;
  document.querySelectorAll('[data-membrane-id]').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.membraneId === id));
  });
  $('membraneCanvas').dataset.membraneSelected = id;
  if (ready) { emphasis(); invalidate(); }
}

/* ---------------- 标签 ---------------- */

function buildLabels() {
  const box = $('membraneLabels');
  box.replaceChildren();
  const make = (id, className) => {
    const el = document.createElement('span');
    el.className = 'membrane-label' + (className ? ' ' + className : '');
    el.id = 'membraneLabel-' + id;
    el.dataset.membraneLabel = id;
    box.append(el);
    return el;
  };
  for (const side of SIDE_MARKERS) {
    const el = make(side.id, side.className);
    el.textContent = DATA.sides[side.id];      // 侧别文字用定稿数据原文
    labelNodes[side.id] = {el, marker: side};
  }
  const marker = MARKERS[selected] || MARKERS.head;
  labelNodes.selected = {
    el: make('selected', 'membrane-label-selected'),
    marker: {pos: marker.pos, dir: marker.dir, dynamic: true},
  };
}

function updateLabels() {
  const box = $('membraneViewport');
  const rect = box.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  const show = $('membraneShowLabels').checked;
  const nodes = [labelNodes.outside, labelNodes.inside, labelNodes.selected].filter(Boolean);
  if (!show) {
    for (const node of nodes) node.el.hidden = true;
    return;
  }
  const insetX = Math.max(10, rect.width * 0.06);
  const insetY = Math.max(10, rect.height * 0.06);
  const placed = [];
  for (const node of nodes) {
    const el = node.el;
    const marker = node.marker;
    if (node === labelNodes.selected) {
      const m = MARKERS[selected] || MARKERS.head;
      marker.pos = m.pos;
      marker.dir = m.dir;
    }
    el.hidden = false;
    tmpVec.set(marker.pos[0], marker.pos[1], marker.pos[2]).project(camera);
    const ax = (tmpVec.x * 0.5 + 0.5) * rect.width;
    const ay = (-tmpVec.y * 0.5 + 0.5) * rect.height;
    const w = el.offsetWidth, h = el.offsetHeight;
    // 先按锚点方向摆，再在安全区内微调，避免标签出画或被其他标签压住。
    const baseY = marker.dir === 'below' ? ay + 10 : ay - h - 10;
    const candidates = [[ax - w / 2, baseY], [ax - w / 2, baseY - 26], [ax - w / 2, baseY + 26],
      [ax - w / 2, baseY - 52], [ax - w / 2, baseY + 52], [ax - w - 16, baseY], [ax + 16, baseY]];
    let chosen = null;
    for (const [cx, cy] of candidates) {
      const left = clamp(cx, insetX, Math.max(insetX, rect.width - insetX - w));
      const top = clamp(cy, insetY, Math.max(insetY, rect.height - insetY - h));
      const clash = placed.some(p => Math.abs(p[0] - left) < w * 0.9 && Math.abs(p[1] - top) < h + 6);
      if (!clash) { chosen = [left, top]; break; }
    }
    if (!chosen) {
      chosen = [clamp(ax - w / 2, insetX, Math.max(insetX, rect.width - insetX - w)),
        clamp(baseY, insetY, Math.max(insetY, rect.height - insetY - h))];
    }
    el.style.left = chosen[0] + 'px';
    el.style.top = chosen[1] + 'px';
    el.classList.toggle('selected', node === labelNodes.selected);
    placed.push(chosen);
  }
}

/* ---------------- 控制 ---------------- */

function pick(clientX, clientY) {
  const canvas = $('membraneCanvas');
  const r = canvas.getBoundingClientRect();
  pointer.set((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(modelMeshes, false);
  return hits.length ? hits[0].object.userData.membranePart : null;
}

function controls() {
  const canvas = $('membraneCanvas');
  let down = null, moved = false;

  canvas.addEventListener('pointerdown', e => {
    down = [e.clientX, e.clientY];
    moved = false;
    // 指针捕获失败（部分合成事件）不应影响旋转与点选。
    try { if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId); } catch { /* 忽略 */ }
  });
  canvas.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - down[0], dy = e.clientY - down[1];
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    azimuth -= dx * 0.006;
    elevation = clamp(elevation + dy * 0.005, ELEVATION_LIMIT.min, ELEVATION_LIMIT.max);
    down = [e.clientX, e.clientY];
    applyCamera();
    invalidate();
  });
  const end = e => {
    if (!down) return;
    down = null;
    if (moved) return;                    // 拖动只转视角，不改变选择
    const id = pick(e.clientX, e.clientY);
    if (id) select(id);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', () => { down = null; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    zoom = clamp(zoom + e.deltaY * 0.0008, ZOOM_LIMIT.min, ZOOM_LIMIT.max);
    applyCamera();
    invalidate();
  }, {passive: false});
  canvas.addEventListener('keydown', e => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'ArrowLeft') azimuth -= 0.1;
    if (e.key === 'ArrowRight') azimuth += 0.1;
    if (e.key === 'ArrowUp') elevation = clamp(elevation + 0.08, ELEVATION_LIMIT.min, ELEVATION_LIMIT.max);
    if (e.key === 'ArrowDown') elevation = clamp(elevation - 0.08, ELEVATION_LIMIT.min, ELEVATION_LIMIT.max);
    if (e.key === '+' || e.key === '=') zoom = clamp(zoom - 0.12, ZOOM_LIMIT.min, ZOOM_LIMIT.max);
    if (e.key === '-' || e.key === '_') zoom = clamp(zoom + 0.12, ZOOM_LIMIT.min, ZOOM_LIMIT.max);
    applyCamera();
    invalidate();
  });
  $('membraneReset').addEventListener('click', () => {
    // 只重置相机：不清空结构选择，也不动理解题。
    azimuth = HOME.azimuth;
    elevation = HOME.elevation;
    zoom = 1;
    refit();
    invalidate();
  });
  $('membraneShowLabels').addEventListener('change', invalidate);
}

/* ---------------- 启动 ---------------- */

function startRenderer() {
  const canvas = $('membraneCanvas');
  renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setClearColor('#101f30');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
  scene.add(new THREE.HemisphereLight('#e2f4ff', '#3a4a5a', 2.2));
  const key = new THREE.DirectionalLight('#fff4dd', 2.7);
  key.position.set(3, 7, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#a9c9ff', 1.2);
  fill.position.set(-6, 2, -5);
  scene.add(fill);
  buildModel();
  refit();
  ready = true;
  emphasis();
  // 三维控件只在渲染器就绪后注册，降级时不会访问不存在的 camera。
  controls();

  const resize = () => {
    const r = $('membraneViewport').getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    refit();
    invalidate();
  };
  new ResizeObserver(resize).observe($('membraneViewport'));
  resize();
  $('membraneLoading').hidden = true;
  document.documentElement.dataset.membraneReady = 'true';
  invalidate();
}

function degrade(err) {
  degraded = true;
  ready = false;
  const viewport = $('membraneViewport');
  viewport.classList.add('membrane-failed');
  $('membraneCanvas').hidden = true;
  $('membraneCanvas').removeAttribute('tabindex');
  $('membraneLoading').hidden = true;
  $('membraneViewHint').hidden = true;
  const note = $('membraneFallback');
  note.hidden = false;
  note.textContent = DATA.fallback;       // 降级提示用数据原文
  // 关掉所有依赖三维模型的控制，不做出无效承诺。
  $('membraneReset').disabled = true;
  $('membraneShowLabels').disabled = true;
  document.documentElement.dataset.membraneDegraded = 'true';
  console.error('Membrane renderer failed', err);
}

async function start() {
  if (started) return;
  started = true;
  try {
    DATA = await loadData();
  } catch (e) {
    const box = $('membraneLoading');
    box.textContent = '无法读取定稿数据 membrane-data.json。请通过本地预览服务器打开本页后重试。';
    console.error('Membrane data failed', e);
    return;
  }
  partList(DATA);
  selected = PART_BY_ID[DATA.defaultSelected] ? DATA.defaultSelected : DATA.structures[0].id;
  buildTexts();
  buildDirectory();
  buildQuestion();
  buildLabels();
  select(selected);
  try {
    startRenderer();
  } catch (e) {
    degrade(e);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) invalidate(); });
}

// 供验收脚本读取真实几何与相机状态（只读诊断，不改变页面行为）。
window.__membraneInspect = {
  ready: () => ready,
  degraded: () => degraded,
  data: () => DATA,
  THREE,
  scene: () => scene,
  camera: () => camera,
  renderer: () => renderer,
  meshes: () => modelMeshes,
  state: () => ({
    selected, azimuth, elevation, zoom, homeDist,
    distance: ready ? camera.position.distanceTo(pan) : null,
    position: ready ? camera.position.toArray() : null,
    pan: pan.toArray(),
    home: {...HOME},
    elevationLimit: {...ELEVATION_LIMIT},
    zoomLimit: {...ZOOM_LIMIT},
    labelsVisible: $('membraneShowLabels').checked,
  }),
  anchors: () => JSON.parse(JSON.stringify(MARKERS)),
  sideMarkers: () => JSON.parse(JSON.stringify(SIDE_MARKERS)),
  modelBox: () => (allPoints ? {min: modelBox.min.toArray(), max: modelBox.max.toArray()} : null),
  pickAt: (x, y) => (ready ? pick(x, y) : null),
  screenOf: (x, y, z) => {
    if (!ready) return null;
    const v = new THREE.Vector3(x, y, z).project(camera);
    const r = $('membraneViewport').getBoundingClientRect();
    return {x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height, z: v.z};
  },
};

start();
