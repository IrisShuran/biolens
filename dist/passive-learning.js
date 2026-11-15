/* Guided learning layer: onboarding, spotlight tour and evidence reflection. */
(() => {
  const $ = id => document.getElementById(id);
  const key = 'biolens.passive.guidance.v2';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let preference = null;
  try { preference = JSON.parse(localStorage.getItem(key)); } catch (_) {}
  let tips = preference?.tips !== false;
  let tutorialArmed = false;
  let autoStartedForVisit = false;
  let autoStartPending = false;
  let tourStages = [];
  let tourIndex = 0;
  let tourPositionToken = 0;
  let tourKind = 'prediction';
  let oxygenObservation = null;

  const welcome = $('learningWelcome');
  const help = $('learningHelp');
  const task = $('learningTask');
  const stats = document.querySelector('.passive-stats');
  const controls = document.querySelector('.passive-controls');
  const model = document.querySelector('.passive-model-card');
  const save = extra => {
    try { localStorage.setItem(key, JSON.stringify({ seen: true, tips, ...extra })); } catch (_) {}
  };

  welcome.hidden = preference?.seen === true;
  $('passiveHelpOpen').hidden = false;
  model.after(controls);

  const windowBlock = $('passiveWindowTitle').closest('.passive-stat-block');
  const detail = document.createElement('details');
  detail.className = 'learning-window';
  const summary = document.createElement('summary');
  summary.textContent = '展开最近 5 个模拟秒的统计';
  windowBlock.before(detail);
  detail.append(summary, windowBlock);
  detail.addEventListener('toggle', () => {
    summary.textContent = detail.open ? '收起窗口统计' : '展开最近 5 个模拟秒的统计';
  });

  const tour = document.createElement('div');
  tour.className = 'learning-tour';
  tour.hidden = true;
  tour.innerHTML = `
    <div class="learning-tour-shade" data-side="top"></div>
    <div class="learning-tour-shade" data-side="left"></div>
    <div class="learning-tour-shade" data-side="right"></div>
    <div class="learning-tour-shade" data-side="bottom"></div>
    <div class="learning-tour-ring" aria-hidden="true"></div>
    <section class="learning-tour-card" role="dialog" aria-modal="true" aria-labelledby="learningTourTitle" aria-describedby="learningTourText">
      <span class="learning-tour-count"></span>
      <h2 id="learningTourTitle"></h2>
      <p id="learningTourText"></p>
      <div class="learning-tour-actions">
        <button type="button" class="passive-button learning-tour-skip">跳过引导</button>
        <button type="button" class="passive-button passive-button-primary learning-tour-next">下一处</button>
      </div>
    </section>`;
  document.body.append(tour);
  const ring = tour.querySelector('.learning-tour-ring');
  const card = tour.querySelector('.learning-tour-card');
  const tourTitle = tour.querySelector('h2');
  const tourText = tour.querySelector('#learningTourText');
  const tourCount = tour.querySelector('.learning-tour-count');
  const tourNext = tour.querySelector('.learning-tour-next');

  const predictionStages = [
    { selector: '#passiveGuideHeading', title: '先留下你的猜想', text: '观察左 80、右 20 的初始分布，选出你预期的整体变化。你的选择会留到实验后一起回看。' },
    { selector: '#passivePredictSubmit', title: '带着预测进入实验', text: '提交后，进入下一步观察分子运动与跨膜计数，再回看这次选择。' }
  ];
  const experimentStages = [
    { selector: '.passive-model-card', title: '先观察分子的运动', text: '亮点代表氧气分子。看看它们如何在两侧移动；实验进入本步后已自动开始。' },
    { selector: '.passive-controls', title: '你随时掌握实验节奏', text: '这里可以暂停、继续、单步和重播。想看清一次变化时，先暂停再单步。' },
    { selector: '.passive-stats', title: '比较两个方向的计数', text: '观察左→右与右→左的累计事件，看看总体变化与刚才的预测是否一致。' },
    { selector: '#passiveStepNav', title: '五步形成完整学习路径', text: '之后继续比较运输通路、观察动态平衡并检查理解；顶部步骤可以随时返回。' }
  ];
  const mobileExperimentStages = [
    { selector: '#passiveGuideHeading2', title: '实验已经开始', text: '先观察分子运动，再向下浏览模型控制与累计计数。暂停、单步和重播按钮旁都有对应说明。' }
  ];

  function currentStep() {
    return Number(document.querySelector('#passiveStepNav [aria-current="step"]')?.dataset.step || 1);
  }

  function positionTour() {
    if (tour.hidden || !tourStages[tourIndex]) return;
    const target = document.querySelector(tourStages[tourIndex].selector);
    if (!target) return;
    const raw = target.getBoundingClientRect();
    const gap = 8;
    const rect = {
      top: Math.max(8, raw.top - gap), left: Math.max(8, raw.left - gap),
      right: Math.min(innerWidth - 8, raw.right + gap), bottom: Math.min(innerHeight - 8, raw.bottom + gap)
    };
    const shades = Object.fromEntries([...tour.querySelectorAll('.learning-tour-shade')].map(node => [node.dataset.side, node]));
    Object.assign(shades.top.style, { left: '0px', top: '0px', width: '100vw', height: `${rect.top}px` });
    Object.assign(shades.bottom.style, { left: '0px', top: `${rect.bottom}px`, width: '100vw', height: `${Math.max(0, innerHeight - rect.bottom)}px` });
    Object.assign(shades.left.style, { left: '0px', top: `${rect.top}px`, width: `${rect.left}px`, height: `${Math.max(0, rect.bottom - rect.top)}px` });
    Object.assign(shades.right.style, { left: `${rect.right}px`, top: `${rect.top}px`, width: `${Math.max(0, innerWidth - rect.right)}px`, height: `${Math.max(0, rect.bottom - rect.top)}px` });
    Object.assign(ring.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${Math.max(0, rect.right - rect.left)}px`, height: `${Math.max(0, rect.bottom - rect.top)}px` });
    const cardWidth = Math.min(360, innerWidth - 24);
    card.style.width = `${cardWidth}px`;
    const estimatedHeight = card.offsetHeight || 210;
    const below = rect.bottom + 14;
    const desiredTop = below + estimatedHeight <= innerHeight - 10 ? below : rect.top - estimatedHeight - 14;
    const top = Math.max(10, Math.min(desiredTop, innerHeight - estimatedHeight - 10));
    const left = Math.min(Math.max(12, rect.left), innerWidth - cardWidth - 12);
    Object.assign(card.style, { left: `${left}px`, top: `${top}px` });
  }

  function showTourStage() {
    const stage = tourStages[tourIndex];
    const target = stage && document.querySelector(stage.selector);
    if (!stage || !target) return finishTour();
    tourTitle.textContent = stage.title;
    tourText.textContent = stage.text;
    tourCount.textContent = `${tourIndex + 1} / ${tourStages.length}`;
    tourNext.textContent = tourIndex === tourStages.length - 1 ? '我知道了' : '下一处';
    tour.classList.remove('is-visible');
    document.body.classList.remove('learning-tour-open');
    target.focus?.({ preventScroll: false });
    const targetRect = target.getBoundingClientRect();
    const targetTop = window.scrollY + targetRect.top - (window.innerHeight - targetRect.height) / 2;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: 'auto' });
    const positionToken = ++tourPositionToken;
    const settle = lock => {
      if (positionToken !== tourPositionToken || tour.hidden) return;
      positionTour();
      if (lock) {
        document.body.classList.add('learning-tour-open');
        tour.classList.add('is-visible');
        tourNext.focus({ preventScroll: true });
      }
    };
    window.setTimeout(() => settle(false), 40);
    window.setTimeout(() => settle(false), 240);
    window.setTimeout(() => settle(true), 520);
  }

  function startTour(kind) {
    tourKind = kind;
    const compact = window.innerWidth <= 520;
    tourStages = kind === 'experiment'
      ? (compact ? mobileExperimentStages : experimentStages)
      : (compact ? [predictionStages[0]] : predictionStages);
    tourIndex = 0;
    tour.hidden = false;
    showTourStage();
  }

  function finishTour(skipped = false) {
    const wasPrediction = tourKind === 'prediction';
    tourPositionToken += 1;
    tour.hidden = true;
    tour.classList.remove('is-visible');
    document.body.classList.remove('learning-tour-open');
    if (wasPrediction && !skipped) tutorialArmed = true;
    save({ tourSeen: !wasPrediction || preference?.tourSeen === true });
    const focusTarget = currentStep() === 1 ? document.querySelector('input[name="passivePrediction"]') : $('passivePlay');
    focusTarget?.focus({ preventScroll: true });
  }

  tourNext.addEventListener('click', () => {
    if (tourIndex < tourStages.length - 1) { tourIndex += 1; showTourStage(); }
    else finishTour();
  });
  tour.querySelector('.learning-tour-skip').addEventListener('click', () => finishTour(true));
  tour.addEventListener('keydown', event => { if (event.key === 'Escape') finishTour(true); });
  window.addEventListener('resize', positionTour);

  const hints = {
    1: '现在：选择一个预测并提交。答案会保留到实验结果出现后再对照。',
    2: '实验已自动开始：先观察粒子，再用两个方向的累计计数检验预测。',
    3: '现在：选择葡萄糖，比较有、无载体。每次切换都会重置并暂停，需要再次点击开始。',
    4: '现在：点击“从等浓度开始”建立情境，再点击模型下方的“开始”观察。',
    5: '现在：回看最初的预测与氧气实验计数，再回答一道有关双向运动的问题。'
  };

  function maybeAutoStart(step) {
    if (step !== 2) { autoStartedForVisit = false; autoStartPending = false; return; }
    if (autoStartedForVisit || autoStartPending || reducedMotion.matches) return;
    const snapshot = window.passiveDebug?.snapshot?.();
    if (!snapshot?.predictionSubmitted || snapshot.running || snapshot.simTime > 0) return;
    autoStartPending = true;
    window.setTimeout(() => {
      autoStartPending = false;
      if (currentStep() !== 2 || reducedMotion.matches) return;
      const play = $('passivePlay');
      if (!play.disabled) { play.click(); autoStartedForVisit = true; }
    }, 420);
  }

  function refresh() {
    const step = currentStep();
    stats.hidden = step === 1;
    controls.hidden = step === 1;
    task.hidden = !tips;
    task.textContent = step === 1 && !$('passiveNext').disabled ? '预测已锁定：进入第 2 步，让实验自动运行并检验想法。' : hints[step];
    $('learningTipsToggle').textContent = tips ? '收起操作提示' : '显示操作提示';
    maybeAutoStart(step);
    if (step === 2 && tutorialArmed && tour.hidden) {
      tutorialArmed = false;
      window.setTimeout(() => startTour('experiment'), 700);
    }
  }

  const predictionLabels = {
    A: '净移动从左到右', B: '净移动从右到左', C: '分子只会从左到右', D: '所有分子不再移动'
  };

  function updateEvidence() {
    const snapshot = window.passiveDebug?.snapshot?.();
    if (!snapshot) return;
    if (!snapshot.predictionSubmitted) oxygenObservation = null;
    const inObservation = currentStep() === 2;
    model.classList.toggle('learning-experiment-live', inObservation && snapshot.running);
    const state = $('learningExperimentState');
    state?.classList.toggle('is-running', inObservation && snapshot.running);
    if (inObservation) {
      $('learningExperimentLabel').textContent = snapshot.running ? '实验正在进行' : (snapshot.simTime > 0 ? '实验已暂停' : '实验准备完成');
      $('learningExperimentDetail').textContent = snapshot.running
        ? `已运行 ${snapshot.simTime.toFixed(1)} 模拟秒，正在累计两个方向的跨膜事件。`
        : `当前停在 ${snapshot.simTime.toFixed(1)} 模拟秒，可继续或单步观察。`;
    }
    const totalEvents = snapshot.counts.leftToRight + snapshot.counts.rightToLeft;
    const ready = inObservation && snapshot.simTime >= 6 && totalEvents >= 2;
    if (ready) oxygenObservation = { leftToRight: snapshot.counts.leftToRight, rightToLeft: snapshot.counts.rightToLeft };
    const selected = document.querySelector('input[name="passivePrediction"]:checked')?.value;
    $('learningFinalPrediction').textContent = predictionLabels[selected] || '等待预测';
    $('learningFinalObservation').textContent = oxygenObservation
      ? `左→右 ${oxygenObservation.leftToRight} · 右→左 ${oxygenObservation.rightToLeft}`
      : '还没有足够的氧气实验数据';
    $('learningFinalExplanation').textContent = oxygenObservation
      ? '分子在两方向持续运动。起初左侧浓度更高，左到右的跨膜事件通常更多；回看你的预测，想想它解释了哪一部分现象。'
      : '返回第 2 步，观察一段时间的氧气跨膜计数，再来对比最初的预测。';
    $('learningEvidence').hidden = !ready;
    if (!ready) return;
    const diff = snapshot.counts.leftToRight - snapshot.counts.rightToLeft;
    const actual = diff > 0 ? '净移动从左到右' : diff < 0 ? '净移动从右到左' : '目前两个方向累计相同';
    $('learningPredictionRecall').textContent = predictionLabels[selected] || '未记录';
    $('learningObservedResult').textContent = `${actual}（${snapshot.counts.leftToRight} : ${snapshot.counts.rightToLeft}）`;
    const supported = selected === 'A' && diff > 0;
    $('learningVerdict').textContent = supported ? '这组实验数据支持你的预测。' : '这组实验数据与原预测不同；这正是实验帮助我们修正想法的地方。';
    $('learningVerdict').classList.toggle('is-supported', supported);
    $('learningScienceExplanation').textContent = '科学解释：分子在两个方向都持续随机运动。左侧初始浓度更高，因此统计上左→右的跨膜机会更多，形成从高浓度到低浓度的净移动；单个分子仍可能向任一方向运动。';
  }

  function dismiss(showTips) {
    tips = showTips;
    welcome.hidden = true;
    save();
    refresh();
    if (showTips) startTour('prediction');
    else document.querySelector('input[name="passivePrediction"]')?.focus();
  }
  $('learningBegin').addEventListener('click', () => dismiss(true));
  $('learningSkip').addEventListener('click', () => dismiss(false));
  $('passiveHelpOpen').addEventListener('click', () => { help.hidden = false; $('learningHelpTitle').focus(); });
  function closeHelp() { help.hidden = true; $('passiveHelpOpen').focus(); }
  $('learningHelpClose').addEventListener('click', closeHelp);
  help.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); closeHelp(); } });
  $('learningTipsToggle').addEventListener('click', () => { tips = !tips; save(); refresh(); });
  $('learningReview').textContent = '重看聚光教程';
  $('learningReview').addEventListener('click', () => { help.hidden = true; startTour(currentStep() === 1 ? 'prediction' : 'experiment'); });
  new MutationObserver(refresh).observe($('passiveStepNav'), { subtree: true, attributes: true, attributeFilter: ['aria-current', 'disabled'] });
  window.setInterval(updateEvidence, 250);
  refresh();
  updateEvidence();
})();
