(() => {
  'use strict';

  const TOTAL_PARTICLES = 100;
  const FIXED_DT = 1 / 60;
  const MAX_FRAME_DELTA = 0.2;
  const MAX_CATCHUP_STEPS = 7;
  const WINDOW_SECONDS = 5;
  const DEFAULT_SEED = 20261113;
  const CARRIER_COUNT = 4;
  const CARRIER_DURATION = 1.6;
  const DIRECT_DURATION = 0.9;
  const OXYGEN_RATE = 0.025;
  const GLUCOSE_RATE = 0.0035;
  const Y_MIN = 0.08;
  const Y_MAX = 0.92;
  const STEP_LABELS = ['预测', '观察扩散', '比较通路', '动态平衡', '检查理解'];

  const $ = id => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomBetween(rng, min, max) {
    return min + rng() * (max - min);
  }

  function shuffled(rng, source) {
    const result = source.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const temporary = result[i];
      result[i] = result[j];
      result[j] = temporary;
    }
    return result;
  }

  function parseSeed() {
    const raw = new URLSearchParams(window.location.search).get('seed');
    if (raw === null || !/^\d+$/.test(raw)) return DEFAULT_SEED;
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed >>> 0 : DEFAULT_SEED;
  }

  function sceneLabel(scene) {
    const ratio = `${scene.left}:${scene.right}`;
    if (scene.material === 'oxygen') return `氧气 · ${ratio}`;
    return `葡萄糖 · ${scene.carriers ? '有载体' : '无载体'} · ${ratio}`;
  }

  function makeScene(material, left, right, carriers) {
    return {
      material,
      left,
      right,
      carriers: material === 'glucose' && Boolean(carriers),
      label: ''
    };
  }

  const SCENE_OXYGEN_80 = makeScene('oxygen', 80, 20, false);
  const SCENE_GLUCOSE_80_CARRIER = makeScene('glucose', 80, 20, true);
  const SCENE_GLUCOSE_80_NOCARRIER = makeScene('glucose', 80, 20, false);
  const SCENE_OXYGEN_20 = makeScene('oxygen', 20, 80, false);
  const SCENE_OXYGEN_50 = makeScene('oxygen', 50, 50, false);

  const dom = {
    canvas: $('passiveCanvas'),
    viewport: $('passiveViewport'),
    fallback: $('passiveCanvasFallback'),
    fallbackLeft: $('passiveFallbackLeft'),
    fallbackRight: $('passiveFallbackRight'),
    nav: $('passiveStepNav'),
    navButtons: $$('#passiveStepNav button'),
    panels: [null, $('passiveStepPanel1'), $('passiveStepPanel2'), $('passiveStepPanel3'), $('passiveStepPanel4'), $('passiveStepPanel5')],
    guide: $('passiveGuide'),
    guideStep: $('passiveGuideStep'),
    guideTag: $('passiveGuideTag'),
    next: $('passiveNext'),
    restart: $('passiveRestart'),
    predictSubmit: $('passivePredictSubmit'),
    predictFeedback: $('passivePredictFeedback'),
    gateNote: $('passiveGateNote'),
    quizSubmit: $('passiveQuizSubmit'),
    quizFeedback: $('passiveQuizFeedback'),
    quizRetry: $('passiveQuizRetry'),
    summary: $('passiveSummary'),
    materialOxygen: $('passiveMaterialOxygen'),
    materialGlucose: $('passiveMaterialGlucose'),
    carrierControls: $('passiveCarrierControls'),
    sceneNotice: $('passiveSceneNotice'),
    balanceNotice: $('passiveBalanceNotice'),
    equalStart: $('passiveEqualStart'),
    presetLeft80: $('passivePresetLeft80'),
    presetRight80: $('passivePresetRight80'),
    presetEqual: $('passivePresetEqual'),
    play: $('passivePlay'),
    singleStep: $('passiveSingleStep'),
    replay: $('passiveReplay'),
    simStatus: $('passiveSimStatus'),
    backNotice: $('passiveBackNotice'),
    motionNote: $('passiveMotionNote'),
    countLeft: $('passiveCountLeft'),
    countRight: $('passiveCountRight'),
    cumulativeL2R: $('passiveCumulativeL2R'),
    cumulativeR2L: $('passiveCumulativeR2L'),
    windowL2R: $('passiveWindowL2R'),
    windowR2L: $('passiveWindowR2L'),
    windowDiff: $('passiveWindowDiff'),
    windowPeriod: $('passiveWindowPeriod'),
    simClock: $('passiveSimClock'),
    sceneBadge: $('passiveSceneBadge'),
    carrierActivity: $('passiveCarrierActivity'),
    legendOxygen: $('passiveLegendOxygen'),
    legendGlucose: $('passiveLegendGlucose'),
    carrierLegend: $('passiveCarrierLegend')
  };

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let ctx = null;
  try {
    ctx = dom.canvas ? dom.canvas.getContext('2d', { alpha: false }) : null;
  } catch (error) {
    ctx = null;
  }

  const state = {
    seed: parseSeed(),
    step: 1,
    predictionSubmitted: false,
    predictionChoice: null,
    quizSubmitted: false,
    quizChoice: null,
    scene: { ...SCENE_OXYGEN_80 },
    sim: null,
    running: false,
    started: false,
    accumulator: 0,
    lastFrameTime: null,
    lastStatsAt: 0,
    dirty: true,
    status: '已暂停 · 先提交预测',
    balanceNotice: '点击按钮后建立新的氧气 50:50 情境，并暂停。',
    backNoticeVisible: false,
    canvasAvailable: Boolean(ctx),
    resetCount: 0
  };

  function copyScene(scene) {
    const copy = {
      material: scene.material,
      left: scene.left,
      right: scene.right,
      carriers: scene.material === 'glucose' && Boolean(scene.carriers)
    };
    copy.label = sceneLabel(copy);
    return copy;
  }

  function sideBounds(side) {
    return side === 'left' ? [0.028, 0.452] : [0.548, 0.972];
  }

  function createParticles(rng, scene) {
    const ids = shuffled(rng, Array.from({ length: TOTAL_PARTICLES }, (_, index) => index));
    const countLeft = scene.left;
    return ids.map((id, index) => {
      const side = index < countLeft ? 'left' : 'right';
      const bounds = sideBounds(side);
      const angle = randomBetween(rng, 0, Math.PI * 2);
      const speed = randomBetween(rng, 0.018, 0.038);
      return {
        id,
        side,
        gx: randomBetween(rng, bounds[0] + 0.008, bounds[1] - 0.008),
        gy: randomBetween(rng, Y_MIN + 0.02, Y_MAX - 0.02),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        transit: null
      };
    });
  }

  function createCarriers(rng) {
    return Array.from({ length: CARRIER_COUNT }, (_, index) => ({
      id: index,
      y: 0.2 + index * 0.2,
      openSide: rng() < 0.5 ? 'left' : 'right',
      phase: 'idle',
      particleId: null,
      idleTime: randomBetween(rng, 0, 1.6)
    }));
  }

  function createSimulation(scene) {
    const rng = mulberry32(state.seed);
    const particles = createParticles(rng, scene);
    const carriers = scene.material === 'glucose' && scene.carriers ? createCarriers(rng) : [];
    return {
      rng,
      time: 0,
      stepCount: 0,
      particles,
      carriers,
      counts: { leftToRight: 0, rightToLeft: 0 },
      pathCounts: { direct: 0, carrier: 0 },
      events: [],
      scene: copyScene(scene)
    };
  }

  function currentSideCounts() {
    let left = 0;
    let right = 0;
    for (const particle of state.sim.particles) {
      if (particle.side === 'left') left += 1;
      else right += 1;
    }
    return { left, right };
  }

  function recentWindow() {
    const sim = state.sim;
    const span = Math.min(WINDOW_SECONDS, sim.time);
    const threshold = sim.time - WINDOW_SECONDS;
    let leftToRight = 0;
    let rightToLeft = 0;
    for (const event of sim.events) {
      if (event.time > threshold) {
        if (event.direction === 'l2r') leftToRight += 1;
        else rightToLeft += 1;
      }
    }
    return { span, leftToRight, rightToLeft, difference: leftToRight - rightToLeft };
  }

  function recordCrossing(direction, kind) {
    const sim = state.sim;
    if (direction === 'l2r') sim.counts.leftToRight += 1;
    else sim.counts.rightToLeft += 1;
    if (kind === 'carrier') sim.pathCounts.carrier += 1;
    else sim.pathCounts.direct += 1;
    sim.events.push({ time: sim.time, direction, kind });
    const cutoff = sim.time - (WINDOW_SECONDS + 2);
    if (sim.events.length > 80) {
      while (sim.events.length && sim.events[0].time < cutoff) sim.events.shift();
    }
    state.dirty = true;
  }

  function eligibleParticles(side) {
    return state.sim.particles.filter(particle => particle.side === side && !particle.transit);
  }

  function beginDirectTransit(particle, fromSide) {
    const toSide = fromSide === 'left' ? 'right' : 'left';
    const rng = state.sim.rng;
    particle.transit = {
      kind: 'direct',
      fromSide,
      toSide,
      elapsed: 0,
      duration: DIRECT_DURATION,
      startGx: particle.gx,
      startGy: particle.gy,
      targetGx: toSide === 'right' ? randomBetween(rng, 0.565, 0.578) : randomBetween(rng, 0.422, 0.435),
      targetGy: clamp(particle.gy, Y_MIN + 0.02, Y_MAX - 0.02)
    };
  }

  function availableCarrier() {
    return state.sim.carriers.find(carrier => !carrier.particleId) || null;
  }

  function beginCarrierTransit(particle, fromSide, carrier) {
    const toSide = fromSide === 'left' ? 'right' : 'left';
    carrier.particleId = particle.id;
    carrier.phase = 'binding';
    carrier.openSide = fromSide;
    carrier.idleTime = 0;
    particle.transit = {
      kind: 'carrier',
      fromSide,
      toSide,
      elapsed: 0,
      duration: CARRIER_DURATION,
      startGx: particle.gx,
      startGy: particle.gy,
      carrierId: carrier.id,
      carrierY: carrier.y,
      releaseGx: toSide === 'right' ? 0.572 : 0.428
    };
  }

  function attemptTransports() {
    const sim = state.sim;
    const sideCounts = currentSideCounts();
    if (sim.scene.material === 'oxygen') {
      const leftChance = OXYGEN_RATE * sideCounts.left * FIXED_DT;
      const rightChance = OXYGEN_RATE * sideCounts.right * FIXED_DT;
      if (sim.rng() < leftChance) {
        const candidates = eligibleParticles('left');
        if (candidates.length) beginDirectTransit(candidates[Math.floor(sim.rng() * candidates.length)], 'left');
      }
      if (sim.rng() < rightChance) {
        const candidates = eligibleParticles('right');
        if (candidates.length) beginDirectTransit(candidates[Math.floor(sim.rng() * candidates.length)], 'right');
      }
      return;
    }

    if (!sim.carriers.length) return;
    const freeCarriers = sim.carriers.filter(carrier => !carrier.particleId).length;
    if (!freeCarriers) return;
    const leftChance = GLUCOSE_RATE * sideCounts.left * freeCarriers * FIXED_DT;
    const rightChance = GLUCOSE_RATE * sideCounts.right * freeCarriers * FIXED_DT;
    const totalChance = leftChance + rightChance;
    if (totalChance <= 0 || sim.rng() >= totalChance) return;
    const pickLeft = sim.rng() < (totalChance > 0 ? leftChance / totalChance : 0.5);
    const side = pickLeft ? 'left' : 'right';
    const candidates = eligibleParticles(side);
    const carrier = availableCarrier();
    if (!candidates.length || !carrier) return;
    beginCarrierTransit(candidates[Math.floor(sim.rng() * candidates.length)], side, carrier);
  }

  function completeTransit(particle) {
    const transit = particle.transit;
    if (!transit) return;
    if (transit.kind === 'carrier') {
      const carrier = state.sim.carriers.find(item => item.id === transit.carrierId);
      if (carrier) {
        carrier.particleId = null;
        carrier.phase = 'idle';
        carrier.openSide = transit.toSide;
        carrier.idleTime = 0;
      }
    }
    particle.side = transit.toSide;
    particle.gx = transit.kind === 'carrier' ? transit.releaseGx : transit.targetGx;
    particle.gy = clamp(transit.kind === 'carrier' ? transit.carrierY : transit.targetGy, Y_MIN + 0.02, Y_MAX - 0.02);
    const angle = randomBetween(state.sim.rng, 0, Math.PI * 2);
    const speed = randomBetween(state.sim.rng, 0.018, 0.038);
    particle.vx = Math.cos(angle) * speed;
    particle.vy = Math.sin(angle) * speed;
    particle.transit = null;
    recordCrossing(transit.fromSide === 'left' ? 'l2r' : 'r2l', transit.kind);
  }

  function updateTransit(particle, dt) {
    const transit = particle.transit;
    if (!transit) return;
    transit.elapsed += dt;
    const progress = clamp(transit.elapsed / transit.duration, 0, 1);

    if (transit.kind === 'direct') {
      const eased = smooth(progress);
      particle.gx = lerp(transit.startGx, transit.targetGx, eased);
      particle.gy = lerp(transit.startGy, transit.targetGy, Math.min(1, eased * 1.35));
    } else {
      const carrier = state.sim.carriers.find(item => item.id === transit.carrierId);
      if (!carrier) {
        particle.transit = null;
        particle.gx = transit.releaseGx;
        particle.gy = transit.carrierY;
        particle.side = transit.toSide;
        recordCrossing(transit.fromSide === 'left' ? 'l2r' : 'r2l', 'carrier');
        return;
      }
      const sideSign = transit.fromSide === 'left' ? -1 : 1;
      const oppositeSign = -sideSign;
      const pocketFrom = 0.5 + sideSign * 0.035;
      const pocketTo = 0.5 + oppositeSign * 0.035;
      const release = 0.5 + oppositeSign * 0.072;
      if (progress < 0.36) {
        const q = smooth(progress / 0.36);
        particle.gx = lerp(transit.startGx, pocketFrom, q);
        particle.gy = lerp(transit.startGy, transit.carrierY, q);
        carrier.phase = 'binding';
        carrier.openSide = transit.fromSide;
      } else if (progress < 0.7) {
        const q = smooth((progress - 0.36) / 0.34);
        particle.gx = lerp(pocketFrom, pocketTo, q);
        particle.gy = transit.carrierY;
        carrier.phase = 'conform';
        carrier.openSide = q < 0.5 ? transit.fromSide : transit.toSide;
      } else {
        const q = smooth((progress - 0.7) / 0.3);
        particle.gx = lerp(pocketTo, release, q);
        particle.gy = transit.carrierY;
        carrier.phase = 'release';
        carrier.openSide = transit.toSide;
      }
    }

    if (progress >= 1) completeTransit(particle);
  }

  function fixedStep() {
    const sim = state.sim;
    if (!sim) return;
    sim.stepCount += 1;
    sim.time = sim.stepCount / 60;

    for (const particle of sim.particles) {
      if (particle.transit) continue;
      particle.vx += (sim.rng() - 0.5) * 0.12 * FIXED_DT;
      particle.vy += (sim.rng() - 0.5) * 0.12 * FIXED_DT;
      particle.vx *= 0.995;
      particle.vy *= 0.995;
      const speed = Math.hypot(particle.vx, particle.vy);
      if (speed > 0.06) {
        particle.vx = (particle.vx / speed) * 0.06;
        particle.vy = (particle.vy / speed) * 0.06;
      } else if (speed < 0.009) {
        const angle = sim.rng() * Math.PI * 2;
        particle.vx = Math.cos(angle) * 0.014;
        particle.vy = Math.sin(angle) * 0.014;
      }
      const bounds = sideBounds(particle.side);
      particle.gx += particle.vx * FIXED_DT;
      particle.gy += particle.vy * FIXED_DT;
      if (particle.gx < bounds[0]) {
        particle.gx = bounds[0];
        particle.vx = Math.abs(particle.vx);
      } else if (particle.gx > bounds[1]) {
        particle.gx = bounds[1];
        particle.vx = -Math.abs(particle.vx);
      }
      if (particle.gy < Y_MIN) {
        particle.gy = Y_MIN;
        particle.vy = Math.abs(particle.vy);
      } else if (particle.gy > Y_MAX) {
        particle.gy = Y_MAX;
        particle.vy = -Math.abs(particle.vy);
      }
    }

    for (const carrier of sim.carriers) {
      if (carrier.particleId) continue;
      carrier.idleTime += FIXED_DT;
      if (carrier.idleTime >= 2.6) {
        carrier.idleTime = 0;
        carrier.openSide = carrier.openSide === 'left' ? 'right' : 'left';
      }
    }

    attemptTransports();
    for (const particle of sim.particles) {
      if (particle.transit) updateTransit(particle, FIXED_DT);
    }
  }

  function formatSigned(value) {
    if (value > 0) return `+${value}`;
    return String(value);
  }

  function renderStats() {
    if (!state.sim) return;
    const sim = state.sim;
    const counts = currentSideCounts();
    const windowData = recentWindow();
    const runningText = state.running ? '运行中' : '已暂停';
    dom.countLeft.textContent = String(counts.left);
    dom.countRight.textContent = String(counts.right);
    dom.fallbackLeft.textContent = String(counts.left);
    dom.fallbackRight.textContent = String(counts.right);
    dom.cumulativeL2R.textContent = String(sim.counts.leftToRight);
    dom.cumulativeR2L.textContent = String(sim.counts.rightToLeft);
    dom.windowL2R.textContent = String(windowData.leftToRight);
    dom.windowR2L.textContent = String(windowData.rightToLeft);
    dom.windowDiff.textContent = formatSigned(windowData.difference);
    dom.windowPeriod.textContent = windowData.span >= WINDOW_SECONDS
      ? '窗口 5.0 / 5 模拟秒（滑动窗口）'
      : `窗口 ${windowData.span.toFixed(1)} / 5 模拟秒（不足5秒，按实际时长）`;
    dom.simClock.textContent = `模拟时钟 ${sim.time.toFixed(1)} 秒 · ${runningText}`;
    dom.sceneBadge.textContent = sim.scene.label;

    if (sim.scene.material === 'oxygen') {
      dom.carrierActivity.textContent = '氧气不经过载体，直接通过脂双层。';
    } else if (!sim.carriers.length) {
      dom.carrierActivity.textContent = '无可用载体：葡萄糖仍在区域内运动，跨膜事件为 0。';
    } else {
      let binding = 0;
      let conform = 0;
      let release = 0;
      let idle = 0;
      for (const carrier of sim.carriers) {
        if (carrier.phase === 'binding') binding += 1;
        else if (carrier.phase === 'conform') conform += 1;
        else if (carrier.phase === 'release') release += 1;
        else idle += 1;
      }
      dom.carrierActivity.textContent = `载体活动：结合 ${binding} · 构象变化 ${conform} · 释放 ${release} · 空闲 ${idle}（共 ${CARRIER_COUNT} 个）`;
    }

    const statusText = state.running ? '运行中' : '已暂停';
    dom.canvas.setAttribute('aria-label', `被动运输模型：${sim.scene.label}，左侧 ${counts.left} 个粒子，右侧 ${counts.right} 个粒子，${statusText}。`);
  }

  function updateMaterialUI() {
    const isOxygen = state.scene.material === 'oxygen';
    const isGlucose = !isOxygen;
    dom.materialOxygen.setAttribute('aria-pressed', String(isOxygen));
    dom.materialGlucose.setAttribute('aria-pressed', String(isGlucose));
    dom.carrierControls.hidden = !isGlucose;
    const carrierValue = state.scene.carriers ? 'yes' : 'no';
    for (const input of $$('input[name="passiveCarrier"]')) input.checked = input.value === carrierValue;
    dom.legendOxygen.hidden = !isOxygen;
    dom.legendGlucose.hidden = !isGlucose;
    dom.carrierLegend.hidden = !isGlucose || !state.scene.carriers;
    if (isOxygen) {
      dom.sceneNotice.textContent = `当前为氧气 ${state.scene.left}:${state.scene.right}：分子可直接穿过脂双层。`;
    } else if (state.scene.carriers) {
      dom.sceneNotice.textContent = `当前为葡萄糖 ${state.scene.left}:${state.scene.right}：只经 4 个载体跨膜，载体可双向运输。`;
    } else {
      dom.sceneNotice.textContent = `当前为葡萄糖 ${state.scene.left}:${state.scene.right}：无可用载体，跨膜通路已移除。`;
    }
  }

  function updateSimulationControls() {
    const canRun = state.canvasAvailable && state.predictionSubmitted && state.step >= 2;
    dom.play.disabled = !canRun;
    dom.singleStep.disabled = !canRun || state.running;
    dom.replay.disabled = !canRun;
    dom.play.textContent = state.running ? '暂停' : (state.started ? '继续' : '开始');
    dom.simStatus.textContent = state.status;
    dom.backNotice.hidden = !state.backNoticeVisible;
    if (!state.canvasAvailable) {
      dom.play.disabled = true;
      dom.singleStep.disabled = true;
      dom.replay.disabled = true;
      dom.simStatus.textContent = '动画不可用 · Canvas 2D 不可用';
    }
  }

  function setStatus(text) {
    state.status = text;
    dom.simStatus.textContent = text;
  }

  function updatePredictionSubmitState() {
    if (state.predictionSubmitted) {
      dom.predictSubmit.disabled = true;
      dom.predictSubmit.textContent = '已提交预测';
      return;
    }
    const selected = document.querySelector('input[name="passivePrediction"]:checked');
    dom.predictSubmit.disabled = !selected;
    dom.predictSubmit.textContent = '提交预测';
  }

  function applyPredictionState() {
    const inputs = $$('input[name="passivePrediction"]');
    for (const input of inputs) {
      input.disabled = state.predictionSubmitted;
      if (state.predictionSubmitted && state.predictionChoice === input.value) input.checked = true;
    }
    if (state.predictionSubmitted) {
      dom.predictFeedback.hidden = false;
      dom.predictFeedback.classList.remove('passive-feedback-wrong');
      dom.predictFeedback.textContent = '预测已记录并锁定。先不公布结论；请进入实验，用跨膜计数检验自己的想法。';
      dom.gateNote.textContent = '预测已提交。实验后会回看你的原始选择，并给出科学解释。';
      dom.predictSubmit.disabled = true;
      dom.predictSubmit.textContent = '已提交预测';
    } else {
      dom.predictFeedback.hidden = true;
      dom.predictFeedback.textContent = '';
      dom.predictFeedback.classList.remove('passive-feedback-wrong');
      dom.gateNote.textContent = '提交后才能进入后续步骤或开始模拟。';
      updatePredictionSubmitState();
    }
  }

  function updateQuizSubmitState() {
    if (state.quizSubmitted) {
      dom.quizSubmit.disabled = true;
      dom.quizSubmit.textContent = '已提交答案';
      return;
    }
    const selected = document.querySelector('input[name="passiveQuiz5"]:checked');
    dom.quizSubmit.disabled = !selected;
    dom.quizSubmit.textContent = '提交答案';
  }

  function applyQuizState() {
    const inputs = $$('input[name="passiveQuiz5"]');
    for (const input of inputs) {
      input.disabled = state.quizSubmitted;
      if (state.quizSubmitted && state.quizChoice === input.value) input.checked = true;
    }
    if (state.quizSubmitted) {
      const correct = state.quizChoice === 'A';
      dom.quizFeedback.hidden = false;
      dom.quizFeedback.classList.toggle('passive-feedback-wrong', !correct);
      dom.quizFeedback.textContent = `${correct ? '观察得很准确。' : '再看看第 2 步的两方向计数。'}氧气分子在两个方向持续运动；起初左侧更多，统计上左到右的事件通常更多。`;
      dom.quizSubmit.disabled = true;
      dom.quizSubmit.textContent = '已提交答案';
      dom.quizRetry.hidden = false;
      dom.summary.hidden = false;
    } else {
      dom.quizFeedback.hidden = true;
      dom.quizFeedback.textContent = '';
      dom.quizFeedback.classList.remove('passive-feedback-wrong');
      dom.quizRetry.hidden = true;
      dom.summary.hidden = true;
      updateQuizSubmitState();
    }
  }

  function focusCurrentHeading() {
    const heading = dom.panels[state.step] ? dom.panels[state.step].querySelector('h2') : null;
    if (heading) heading.focus({ preventScroll: true });
  }

  function updateStepUI(options = {}) {
    const focus = Boolean(options.focus);
    for (const button of dom.navButtons) {
      const number = Number(button.dataset.step);
      button.setAttribute('aria-current', number === state.step ? 'step' : 'false');
      button.disabled = !state.predictionSubmitted && number > 1;
    }
    for (let number = 1; number <= 5; number += 1) {
      dom.panels[number].hidden = number !== state.step;
    }
    dom.guideStep.textContent = `第 ${state.step} 步 / 5`;
    dom.guideTag.textContent = STEP_LABELS[state.step - 1];
    dom.guide.setAttribute('aria-labelledby', dom.panels[state.step].querySelector('h2').id);
    dom.next.hidden = state.step === 5;
    dom.next.disabled = !state.predictionSubmitted;
    const labels = {
      1: '进入第 2 步：观察扩散',
      2: '下一步：比较通路',
      3: '下一步：动态平衡',
      4: '下一步：检查理解'
    };
    dom.next.textContent = labels[state.step];
    if (focus) focusCurrentHeading();
  }

  function refreshAll() {
    renderStats();
    updateMaterialUI();
    updateStepUI();
    updatePredictionSubmitState();
    updateQuizSubmitState();
    updateSimulationControls();
    state.dirty = true;
  }

  function pauseSimulation(statusText) {
    if (state.running) {
      state.running = false;
      state.lastFrameTime = null;
      state.accumulator = 0;
    }
    if (statusText) setStatus(statusText);
    if (state.sim) renderStats();
    updateSimulationControls();
    state.dirty = true;
  }

  function startSimulation() {
    const canRun = state.canvasAvailable && state.predictionSubmitted && state.step >= 2;
    if (!canRun) return;
    if (state.running) {
      pauseSimulation('已暂停');
      return;
    }
    state.running = true;
    state.started = true;
    state.accumulator = 0;
    state.lastFrameTime = null;
    state.backNoticeVisible = false;
    setStatus('运行中');
    if (state.sim) renderStats();
    updateSimulationControls();
    state.dirty = true;
  }

  function advanceSimulation(seconds) {
    const sim = state.sim;
    if (!sim) return;
    const steps = Math.max(1, Math.round(seconds / FIXED_DT));
    for (let index = 0; index < steps; index += 1) fixedStep();
    state.lastStatsAt = sim.time;
    renderStats();
    updateSimulationControls();
    state.dirty = true;
  }

  function singleStep() {
    const canRun = state.canvasAvailable && state.predictionSubmitted && state.step >= 2;
    if (!canRun || state.running) return;
    state.started = true;
    advanceSimulation(0.5);
    setStatus('已单步 +0.5 模拟秒 · 暂停');
    updateSimulationControls();
  }

  function resetSimulation(scene, statusText) {
    const wasRunning = state.running;
    state.running = false;
    state.lastFrameTime = null;
    state.accumulator = 0;
    state.lastStatsAt = 0;
    state.started = false;
    state.scene = copyScene(scene);
    state.sim = createSimulation(state.scene);
    state.sim.scene = copyScene(state.scene);
    state.resetCount += 1;
    state.backNoticeVisible = false;
    setStatus(statusText || '已重置并暂停');
    renderStats();
    updateMaterialUI();
    updateSimulationControls();
    state.dirty = true;
    if (wasRunning) state.lastFrameTime = null;
  }

  function setScene(scene, options = {}) {
    resetSimulation(scene, options.status || `已重置并暂停：${sceneLabel(copyScene(scene))}`);
    if (state.step === 4 && options.balanceNotice) {
      state.balanceNotice = options.balanceNotice;
      dom.balanceNotice.textContent = state.balanceNotice;
    }
    if (options.focus) {
      const target = options.focus === 'equal' ? dom.equalStart : dom.sceneNotice;
      if (target === dom.equalStart) dom.equalStart.focus({ preventScroll: true });
    }
  }

  function selectMaterial(material) {
    if (material === 'oxygen') {
      setScene(SCENE_OXYGEN_80, { status: '已重置并暂停：氧气 80:20' });
    } else {
      setScene(SCENE_GLUCOSE_80_CARRIER, { status: '已重置并暂停：葡萄糖 · 有载体 · 80:20' });
    }
  }

  function selectCarrier(hasCarrier) {
    setScene(
      hasCarrier ? SCENE_GLUCOSE_80_CARRIER : SCENE_GLUCOSE_80_NOCARRIER,
      { status: `已重置并暂停：葡萄糖 · ${hasCarrier ? '有' : '无'}载体 · 80:20` }
    );
  }

  function establishBalance(kind) {
    let scene;
    let status;
    let notice;
    if (kind === 'equal') {
      scene = SCENE_OXYGEN_50;
      status = '已建立新的等浓度情境并暂停';
      notice = '这是新的等浓度情境，不是前一个场景的最终读数。';
    } else if (kind === 'left') {
      scene = SCENE_OXYGEN_80;
      status = '已重置并暂停：氧气 80:20';
      notice = '已建立左侧较多的 80:20 情境并暂停；计数已清零。';
    } else {
      scene = SCENE_OXYGEN_20;
      status = '已重置并暂停：氧气 20:80';
      notice = '已建立右侧较多的 20:80 情境并暂停；计数已清零。';
    }
    setScene(scene, { status, balanceNotice: notice });
  }

  function submitPrediction() {
    if (state.predictionSubmitted) return;
    const selected = document.querySelector('input[name="passivePrediction"]:checked');
    if (!selected) return;
    state.predictionChoice = selected.value;
    state.predictionSubmitted = true;
    state.started = false;
    state.running = false;
    state.lastFrameTime = null;
    state.accumulator = 0;
    applyPredictionState();
    updateStepUI();
    updateSimulationControls();
    setStatus('预测已提交 · 进入第 2 步后可开始');
  }

  function submitQuiz() {
    if (state.quizSubmitted) return;
    const selected = document.querySelector('input[name="passiveQuiz5"]:checked');
    if (!selected) return;
    state.quizChoice = selected.value;
    state.quizSubmitted = true;
    applyQuizState();
    dom.quizFeedback.scrollIntoView({ block: 'nearest' });
  }

  function retryQuiz() {
    state.quizSubmitted = false;
    state.quizChoice = null;
    for (const input of $$('input[name="passiveQuiz5"]')) {
      input.checked = false;
      input.disabled = false;
    }
    applyQuizState();
    const first = document.querySelector('input[name="passiveQuiz5"]');
    if (first) first.focus({ preventScroll: true });
  }

  function restartLesson() {
    pauseSimulation('已暂停 · 重新学习');
    state.step = 1;
    state.predictionSubmitted = false;
    state.predictionChoice = null;
    state.quizSubmitted = false;
    state.quizChoice = null;
    state.started = false;
    state.running = false;
    state.accumulator = 0;
    state.lastFrameTime = null;
    state.balanceNotice = '点击按钮后建立新的氧气 50:50 情境，并暂停。';
    dom.balanceNotice.textContent = state.balanceNotice;
    for (const input of $$('input[name="passivePrediction"]')) {
      input.checked = false;
      input.disabled = false;
    }
    for (const input of $$('input[name="passiveQuiz5"]')) {
      input.checked = false;
      input.disabled = false;
    }
    resetSimulation(SCENE_OXYGEN_80, '已暂停 · 先提交预测');
    applyPredictionState();
    applyQuizState();
    updateStepUI({ focus: true });
    updatePredictionSubmitState();
    updateQuizSubmitState();
    updateSimulationControls();
    renderStats();
  }

  function goToStep(number, options = {}) {
    if (!Number.isInteger(number) || number < 1 || number > 5) return;
    if (number > 1 && !state.predictionSubmitted) return;
    if (number === state.step) {
      if (options.focus) focusCurrentHeading();
      return;
    }
    pauseSimulation('已暂停：切换步骤不会继续计时');
    state.step = number;
    let restoredOxygenScene = false;
    if (number === 1 || number === 2) {
      resetSimulation(SCENE_OXYGEN_80, '已恢复本步氧气80:20情境 · 已暂停');
      restoredOxygenScene = true;
    }
    const switchedFromGlucose = number === 4 && state.scene.material === 'glucose';
    if (switchedFromGlucose) {
      resetSimulation(SCENE_OXYGEN_80, '已切回氧气 80:20 · 第 4 步比较氧气的浓度情境');
      state.balanceNotice = '本步使用氧气模型。已从葡萄糖切回氧气 80:20；第 3 步的对照可返回重看。';
      dom.balanceNotice.textContent = state.balanceNotice;
    }
    if (number === 4 && !switchedFromGlucose && (state.scene.material !== 'oxygen' || state.scene.left !== 50 || state.scene.right !== 50)) {
      state.balanceNotice = `当前情境为 ${state.scene.label}。点击“从等浓度开始”建立新的 50:50 情境。`;
      dom.balanceNotice.textContent = state.balanceNotice;
    }
    if (state.predictionSubmitted && !restoredOxygenScene) {
      if (!state.started) {
        setStatus('已暂停 · 点击开始');
      }
    }
    updateStepUI({ focus: options.focus !== false });
    updateSimulationControls();
    renderStats();
    state.dirty = true;
  }

  function nextStep() {
    if (state.step >= 5) return;
    if (state.step === 1 && !state.predictionSubmitted) return;
    goToStep(state.step + 1, { focus: true });
  }

  function handleKey(event) {
    if (event.key === 'Escape' && state.running) {
      pauseSimulation('已暂停');
      dom.play.focus({ preventScroll: true });
    }
  }

  function scheduleFrame() {
    window.requestAnimationFrame(frameLoop);
  }

  function frameLoop(now) {
    scheduleFrame();
    if (!state.running) {
      if (state.dirty) {
        drawScene();
        state.dirty = false;
      }
      return;
    }
    if (state.lastFrameTime === null) state.lastFrameTime = now;
    let delta = (now - state.lastFrameTime) / 1000;
    state.lastFrameTime = now;
    if (!Number.isFinite(delta) || delta < 0) delta = 0;
    delta = Math.min(delta, MAX_FRAME_DELTA);
    state.accumulator += delta;
    let steps = 0;
    while (state.accumulator >= FIXED_DT && steps < MAX_CATCHUP_STEPS) {
      fixedStep();
      state.accumulator -= FIXED_DT;
      steps += 1;
    }
    if (state.accumulator >= FIXED_DT * 2) {
      state.accumulator = 0;
      pauseSimulation('渲染落后，已暂停以避免追赶');
    }
    if (state.running) {
      if (state.sim.time - state.lastStatsAt >= 0.1) {
        state.lastStatsAt = state.sim.time;
        renderStats();
      }
      drawScene();
      state.dirty = false;
    } else if (state.dirty) {
      drawScene();
      state.dirty = false;
    }
  }

  function roundedPath(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function resizeCanvas() {
    if (!ctx || !dom.canvas) return;
    const rect = dom.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (dom.canvas.width !== width || dom.canvas.height !== height) {
      dom.canvas.width = width;
      dom.canvas.height = height;
    }
  }

  function drawScene() {
    if (!ctx || !state.sim) return;
    resizeCanvas();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = dom.canvas.width / dpr;
    const height = dom.canvas.height / dpr;
    if (!width || !height) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    const sim = state.sim;
    const counts = currentSideCounts();

    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#0c1a27');
    background.addColorStop(0.5, '#0d2231');
    background.addColorStop(1, '#0a1723');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const padX = clamp(width * 0.05, 20, 42);
    const top = 66;
    const bottom = height - 34;
    const mid = width / 2;
    const membraneHalf = width < 430 ? 16 : 20;
    const areaHeight = bottom - top;
    const gxToX = gx => padX + gx * (width - padX * 2);
    const gyToY = gy => top + gy * areaHeight;
    const leftEdge = padX;
    const rightEdge = width - padX;

    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = '#4f7d8b';
    ctx.lineWidth = 1;
    for (let x = padX; x < width - padX; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    for (let y = top; y < bottom; y += 28) {
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(width - padX, y);
      ctx.stroke();
    }
    ctx.restore();

    const leftPanelWidth = mid - membraneHalf - 7 - leftEdge;
    const rightPanelX = mid + membraneHalf + 7;
    const rightPanelWidth = rightEdge - rightPanelX;
    roundedPath(ctx, leftEdge, top - 8, leftPanelWidth, areaHeight + 16, 14);
    ctx.fillStyle = 'rgba(18, 52, 70, 0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(103, 157, 173, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    roundedPath(ctx, rightPanelX, top - 8, rightPanelWidth, areaHeight + 16, 14);
    ctx.fillStyle = 'rgba(15, 46, 62, 0.78)';
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#a9c8d5';
    ctx.font = '600 14px Inter, "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.fillText('左侧', leftEdge + leftPanelWidth / 2, 22);
    ctx.fillText('右侧', rightPanelX + rightPanelWidth / 2, 22);
    ctx.fillStyle = '#8ef0df';
    ctx.font = '700 24px Inter, "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.fillText(String(counts.left), leftEdge + leftPanelWidth / 2, 50);
    ctx.fillText(String(counts.right), rightPanelX + rightPanelWidth / 2, 50);

    roundedPath(ctx, mid - 34, 11, 68, 24, 12);
    ctx.fillStyle = 'rgba(12, 32, 45, 0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(122, 181, 172, 0.45)';
    ctx.stroke();
    ctx.fillStyle = '#bcd9d4';
    ctx.font = '600 14px Inter, "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.fillText('细胞膜', mid, 28);

    drawMembrane(ctx, mid, membraneHalf, top - 10, bottom + 4);
    drawCarriers(ctx, sim, mid, gyToY);
    drawParticles(ctx, sim, gxToX, gyToY);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#89a6b4';
    ctx.font = '12px Inter, "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.fillText('点 = 相对浓度 · 非真实比例', mid, height - 11);
    ctx.restore();
  }

  function drawMembrane(context, mid, half, top, bottom) {
    const gradient = context.createLinearGradient(mid - half, 0, mid + half, 0);
    gradient.addColorStop(0, '#163b46');
    gradient.addColorStop(0.5, '#1d4550');
    gradient.addColorStop(1, '#153a45');
    roundedPath(context, mid - half, top, half * 2, bottom - top, 9);
    context.fillStyle = gradient;
    context.fill();
    context.strokeStyle = 'rgba(119, 184, 175, 0.32)';
    context.lineWidth = 1;
    context.stroke();

    const headLeft = mid - half + 6;
    const headRight = mid + half - 6;
    for (let y = top + 9; y < bottom - 4; y += 13) {
      context.beginPath();
      context.arc(headLeft, y, 3.3, 0, Math.PI * 2);
      context.fillStyle = 'rgba(126, 202, 190, 0.82)';
      context.fill();
      context.beginPath();
      context.arc(headRight, y, 3.3, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(207, 185, 120, 0.56)';
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(headLeft + 3.2, y - 1.4);
      context.quadraticCurveTo(mid - 5, y + 2.2, mid - 1.5, y - 1.2);
      context.moveTo(headLeft + 3.2, y + 1.8);
      context.quadraticCurveTo(mid - 5, y + 5.2, mid - 1.5, y + 1.7);
      context.moveTo(headRight - 3.2, y - 1.4);
      context.quadraticCurveTo(mid + 5, y + 2.2, mid + 1.5, y - 1.2);
      context.moveTo(headRight - 3.2, y + 1.8);
      context.quadraticCurveTo(mid + 5, y + 5.2, mid + 1.5, y + 1.7);
      context.stroke();
    }
  }

  function drawCarriers(context, sim, mid, gyToY) {
    for (const carrier of sim.carriers) {
      const y = gyToY(carrier.y);
      const active = Boolean(carrier.particleId);
      const openLeft = carrier.openSide === 'left';
      context.save();
      if (active) {
        context.shadowColor = 'rgba(255, 195, 112, 0.5)';
        context.shadowBlur = 12;
      }
      context.fillStyle = active ? '#ecc27e' : '#c79e61';
      context.strokeStyle = active ? '#ffe0ad' : '#e6c28c';
      context.lineWidth = 1.2;
      roundedPath(context, mid - 18, y - 24, 36, 19, 8);
      context.fill();
      context.stroke();
      roundedPath(context, mid - 18, y + 5, 36, 19, 8);
      context.fill();
      context.stroke();
      context.shadowBlur = 0;
      context.fillStyle = active ? '#d6a45f' : '#ae854c';
      const hingeX = openLeft ? mid + 13 : mid - 17;
      context.fillRect(hingeX, y - 5, 4, 10);
      context.fillStyle = 'rgba(12, 32, 44, 0.68)';
      if (openLeft) context.fillRect(mid - 18, y - 5, 25, 10);
      else context.fillRect(mid - 7, y - 5, 25, 10);
      context.restore();

      if (active) {
        const labels = { binding: '结合', conform: '构象变化', release: '释放' };
        const text = labels[carrier.phase] || '运输';
        context.save();
        context.font = '600 14px Inter, "Segoe UI", "Microsoft YaHei", sans-serif';
        const textWidth = context.measureText(text).width;
        const labelGap = 34;
        const labelX = mid + (openLeft ? -labelGap - textWidth : labelGap);
        roundedPath(context, labelX - 7, y - 12, textWidth + 14, 24, 7);
        context.fillStyle = 'rgba(18, 46, 59, 0.96)';
        context.fill();
        context.strokeStyle = 'rgba(233, 190, 120, 0.62)';
        context.lineWidth = 1;
        context.stroke();
        context.fillStyle = '#ffd8a2';
        context.textAlign = 'left';
        context.fillText(text, labelX, y + 5);
        context.restore();
      }
    }
  }

  function drawParticles(context, sim, gxToX, gyToY) {
    const isGlucose = sim.scene.material === 'glucose';
    for (const particle of sim.particles) {
      const x = gxToX(particle.gx);
      const y = gyToY(particle.gy);
      ctx.save();
      if (isGlucose) {
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = particle.transit ? '#ffe0a9' : '#ffd18d';
        ctx.strokeStyle = '#8e652c';
        ctx.lineWidth = 1;
        ctx.fillRect(-3.8, -3.8, 7.6, 7.6);
        ctx.strokeRect(-3.8, -3.8, 7.6, 7.6);
      } else {
        if (particle.transit) {
          ctx.shadowColor = 'rgba(142, 240, 223, 0.65)';
          ctx.shadowBlur = 9;
        }
        ctx.beginPath();
        ctx.arc(x, y, particle.transit ? 4 : 3.4, 0, Math.PI * 2);
        ctx.fillStyle = particle.transit ? '#c9fff5' : '#8ef0df';
        ctx.fill();
        ctx.strokeStyle = '#2c746b';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
      context.restore();
    }
  }

  function makeSnapshot() {
    const sim = state.sim;
    const counts = currentSideCounts();
    const windowData = recentWindow();
    const uniqueIds = new Set(sim.particles.map(particle => particle.id));
    return {
      version: 1,
      seed: state.seed,
      simTime: sim.time,
      lessonStep: state.step,
      predictionSubmitted: state.predictionSubmitted,
      running: state.running,
      status: state.status,
      scene: {
        material: sim.scene.material,
        carriers: sim.scene.carriers,
        initialLeft: sim.scene.left,
        initialRight: sim.scene.right,
        label: sim.scene.label
      },
      totalParticles: sim.particles.length,
      uniqueIds: uniqueIds.size,
      counts: {
        leftToRight: sim.counts.leftToRight,
        rightToLeft: sim.counts.rightToLeft,
        leftSide: counts.left,
        rightSide: counts.right
      },
      pathCounts: { ...sim.pathCounts },
      window: {
        spanSeconds: windowData.span,
        leftToRight: windowData.leftToRight,
        rightToLeft: windowData.rightToLeft,
        difference: windowData.difference
      },
      particles: sim.particles.map(particle => ({
        id: particle.id,
        side: particle.side,
        gx: Number(particle.gx.toFixed(5)),
        gy: Number(particle.gy.toFixed(5)),
        inTransit: Boolean(particle.transit),
        transitType: particle.transit ? particle.transit.kind : null
      })),
      carriers: sim.carriers.map(carrier => ({
        id: carrier.id,
        y: carrier.y,
        openSide: carrier.openSide,
        phase: carrier.phase,
        particleId: carrier.particleId
      }))
    };
  }

  function exposeDebugApi() {
    const constants = Object.freeze({
      totalParticles: TOTAL_PARTICLES,
      fixedStepSeconds: FIXED_DT,
      windowSeconds: WINDOW_SECONDS,
      carrierCount: CARRIER_COUNT,
      oxygenRate: OXYGEN_RATE,
      glucoseRate: GLUCOSE_RATE,
      carrierDuration: CARRIER_DURATION,
      directDuration: DIRECT_DURATION
    });
    window.passiveDebug = Object.freeze({
      constants,
      snapshot: () => makeSnapshot(),
      advance: seconds => {
        if (!state.predictionSubmitted) throw new Error('Prediction gate: submit the prediction before advancing the model.');
        if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 600) throw new Error('advance(seconds) expects 0 < seconds <= 600.');
        if (state.running) pauseSimulation('测试推进 · 已暂停');
        advanceSimulation(seconds);
        drawScene();
        state.dirty = false;
        return makeSnapshot();
      }
    });
  }

  function updateReducedMotionNote() {
    if (reducedMotionQuery.matches) {
      dom.motionNote.textContent = '系统偏好减少动态：进入观察步骤后保持暂停；可用单步查看 0.5 模拟秒。';
    } else {
      dom.motionNote.textContent = '进入观察步骤后会自动播放。暂停会冻结模型时钟与计数窗口；单步每次推进 0.5 模拟秒。';
    }
  }

  function handleReducedMotionChange() {
    if (reducedMotionQuery.matches && state.running) pauseSimulation('检测到减少动态偏好，已暂停');
    updateReducedMotionNote();
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      if (state.running) {
        pauseSimulation('页面转入后台，模拟已暂停');
        state.backNoticeVisible = true;
      }
    } else {
      state.lastFrameTime = null;
      state.accumulator = 0;
      if (state.backNoticeVisible) {
        setStatus('已暂停：从后台返回，不追赶');
        renderStats();
        updateSimulationControls();
      }
    }
  }

  function bindEvents() {
    for (const button of dom.navButtons) {
      button.addEventListener('click', () => goToStep(Number(button.dataset.step), { focus: true }));
    }
    dom.next.addEventListener('click', nextStep);
    dom.restart.addEventListener('click', restartLesson);
    dom.predictSubmit.addEventListener('click', submitPrediction);
    for (const input of $$('input[name="passivePrediction"]')) {
      input.addEventListener('change', updatePredictionSubmitState);
    }
    dom.quizSubmit.addEventListener('click', submitQuiz);
    dom.quizRetry.addEventListener('click', retryQuiz);
    for (const input of $$('input[name="passiveQuiz5"]')) {
      input.addEventListener('change', updateQuizSubmitState);
    }
    dom.materialOxygen.addEventListener('click', () => selectMaterial('oxygen'));
    dom.materialGlucose.addEventListener('click', () => selectMaterial('glucose'));
    for (const input of $$('input[name="passiveCarrier"]')) {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        selectCarrier(input.value === 'yes');
      });
    }
    dom.equalStart.addEventListener('click', () => establishBalance('equal'));
    dom.presetLeft80.addEventListener('click', () => establishBalance('left'));
    dom.presetRight80.addEventListener('click', () => establishBalance('right'));
    dom.presetEqual.addEventListener('click', () => establishBalance('equal'));
    dom.play.addEventListener('click', startSimulation);
    dom.singleStep.addEventListener('click', singleStep);
    dom.replay.addEventListener('click', () => {
      if (!state.predictionSubmitted || state.step < 2) return;
      resetSimulation(state.scene, '已重播并暂停：粒子与计数已重置');
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('keydown', handleKey);
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(() => {
        resizeCanvas();
        state.dirty = true;
      });
      observer.observe(dom.viewport);
    } else {
      window.addEventListener('resize', () => {
        resizeCanvas();
        state.dirty = true;
      });
    }
    if (typeof reducedMotionQuery.addEventListener === 'function') {
      reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
    }
  }

  function initialize() {
    for (let number = 1; number <= 5; number += 1) {
      const heading = dom.panels[number].querySelector('h2');
      if (heading) heading.tabIndex = -1;
    }
    state.scene = copyScene(SCENE_OXYGEN_80);
    state.sim = createSimulation(state.scene);
    state.sim.scene = copyScene(state.scene);
    if (!state.canvasAvailable) {
      dom.canvas.hidden = true;
      dom.fallback.hidden = false;
      dom.play.disabled = true;
      dom.singleStep.disabled = true;
      dom.replay.disabled = true;
      dom.simStatus.textContent = '动画不可用 · Canvas 2D 不可用';
    }
    bindEvents();
    updateReducedMotionNote();
    applyPredictionState();
    applyQuizState();
    updateStepUI();
    updateMaterialUI();
    renderStats();
    updateSimulationControls();
    resizeCanvas();
    drawScene();
    state.dirty = false;
    document.documentElement.dataset.passiveReady = 'true';
    scheduleFrame();
  }

  exposeDebugApi();
  initialize();
})();
