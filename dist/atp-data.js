// ATP 合成互动课程的内容层：只放文案与结构化的教学数据，不含任何绘制或交互逻辑。
// 科学边界（与 docs/下一轮任务-ATP互动课程.md 一致）：
// - 电子传递可支持 H⁺ 从基质侧向膜间隙侧转移；电化学梯度支持 ATP 合酶合成 ATP；O₂ 是末端电子受体。
// - 不把电化学梯度仅等同于粒子数差，也不把电子画成经 ATP 合酶回流的粒子。
// - 泄漏情境只定性呈现"梯度减弱 + 这条途径的 ATP 合成受影响"，不宣称细胞 ATP 归零或电子传递必然停止。
// - 第一轮不呈现精确质子/ATP 比、每葡萄糖 ATP 总量或药物干预。

export const atpIntro = '在结构探索的基础上按顺序看清一件事：电子传递怎样建立起质子梯度，质子回流又怎样与 ATP 合成相连，以及内膜漏质子时为什么会影响这条途径的 ATP 合成。';

export const atpSteps = [
  {
    id: 'locate',
    name: '定位',
    title: '先看清：膜的两侧分别是什么',
    tag: '定位 · 内膜局部',
    lead: '把内膜放大成一条剖面。膜的上面是膜间隙侧，下面是基质侧，ATP 合酶横跨在这层膜上。',
    points: [
      '内膜把线粒体分成两个空间：膜间隙（内膜与外膜之间）和基质（内膜围成的内部）。',
      '两个空间里溶解的物质可以不一样——这正是后面能建立起梯度的前提。',
      '本图只是内膜的一小段局部放大，不是整个线粒体；膜上还有很多没有画出的蛋白。',
    ],
  },
  {
    id: 'gradient',
    name: '建立梯度',
    title: '电子传递释放的能量，把 H⁺ 泵到膜间隙侧',
    tag: '建立梯度 · 电子与质子',
    lead: '电子沿着膜上的复合体依次传递，途中释放的能量把 H⁺ 从基质侧搬到膜间隙侧。',
    points: [
      '电子（e⁻）和质子（H⁺）是两种不同的粒子，走两条不同的路线：电子在膜上横向传递，H⁺ 从膜的一侧穿到另一侧。',
      '复合体 I 和复合体 II 是两条并列的电子入口，不是前后串联：I 把电子交给膜上的移动载体，II 也把电子交给同一批载体，之后才一起经 III、IV 传给 O₂。',
      '复合体 II 不把 H⁺ 泵过膜，所以它参与电子传递、却不直接贡献这条梯度。',
      'H⁺ 在膜间隙侧越积越多，膜两侧出现浓度差；同时两侧电荷分布也不同。两者合起来叫电化学梯度（也叫质子动力势）。',
      '所以梯度不只是"粒子数差"：浓度差和电荷差都在起作用，只数粒子个数会漏掉电荷这一半。',
      '传到末端的电子由 O₂ 接收，生成水；因此 O₂ 是这条链末端的电子受体。',
    ],
  },
  {
    id: 'synthase',
    name: '合成 ATP',
    title: 'H⁺ 经 ATP 合酶回流，驱动 ADP 与 Pi 结合',
    tag: '合成 ATP · 化学渗透',
    lead: 'H⁺ 顺着电化学梯度，从膜间隙侧经 ATP 合酶回到基质侧；这一步驱动 ADP 与 Pi 结合成 ATP。',
    points: [
      '经 ATP 合酶回到基质侧的是 H⁺，不是电子——电子不会从 ATP 合酶回来，也不会变成 ATP。',
      'ATP 合酶把 H⁺ 回流释放的能量用于把 ADP 和 Pi 接到一起，生成 ATP，这一步常被称为化学渗透。',
      'ATP 在基质侧生成，随后可以供细胞里需要能量的活动使用。',
      '整个过程（电子传递 + 由梯度驱动的 ATP 合成）合起来叫氧化磷酸化。',
    ],
  },
  {
    id: 'predict',
    name: '预测干预',
    title: '如果内膜开始漏 H⁺，会发生什么？',
    tag: '预测干预 · 先预测再看',
    lead: '先做出预测，再开启情境。情境是：内膜上出现了一条不受 ATP 合酶控制的 H⁺ 回流途径（质子泄漏）。',
    points: [
      '提交预测之后才会显示结果，提交前不揭示答案。',
      '答错会说明原因，并可以重新预测；可以带着新判断再进入下一步对照。',
    ],
  },
  {
    id: 'compare',
    name: '对照解释',
    title: '同一阶段，两种情境放在一起看',
    tag: '对照解释 · 正常 vs 泄漏',
    lead: '把正常情境和泄漏情境放在同一个阶段对照：同一段内膜、同样的电子传递，只有"H⁺ 从哪里回流"不同。',
    points: [
      '泄漏时，一部分 H⁺ 绕过 ATP 合酶回到基质侧，梯度被消耗得更快、维持得更弱。',
      '于是经 ATP 合酶回流的 H⁺ 变少，这条途径合成的 ATP 随之减少。',
      '但泄漏不等于电子传递停止：H⁺ 被移走后膜两侧的"反向压力"减小，电子传递通常仍在进行，甚至更快。',
      '本图只针对这一条途径，不表示细胞里所有 ATP 立刻归零——细胞还有别的 ATP 来源。',
    ],
  },
];

// 图例：颜色之外，每种粒子还有各自的符号形状，色觉差异下也能分辨。
// kind 同时决定画布上的绘制方式（见 atp.js 的 drawGlyph）。
export const atpLegend = [
  {kind: 'proton', name: 'H⁺ 质子', note: '从基质侧被搬到膜间隙侧，再经 ATP 合酶回流'},
  {kind: 'electron', name: 'e⁻ 电子', note: '只在膜上沿复合体横向传递，不穿膜、不参与回流'},
  {kind: 'oxygen', name: 'O₂ / H₂O', note: '在链末端接收电子，生成水'},
  {kind: 'adp', name: 'ADP', note: '在基质侧与 Pi 结合'},
  {kind: 'pi', name: 'Pi', note: '磷酸基团，与 ADP 一起被接到 ATP 上'},
  {kind: 'atp', name: 'ATP', note: '在基质侧生成，供细胞使用'},
];

export const atpSceneTag = '定性示意 · 非真实比例与速率';

export const atpSceneNote = '画布是定性示意：复合体只画成带编号的方块，粒子大小、数量与位置都不表示真实比例或真实速率；膜上的移动电子载体（如泛醌、细胞色素 c）没有单独画出。';

export const atpPrediction = {
  prompt: '如果内膜上出现一条不受 ATP 合酶控制的 H⁺ 回流途径（质子泄漏），下面哪个判断最合理？',
  options: [
    {
      text: '经 ATP 合酶回流的 H⁺ 变少，这条途径合成的 ATP 减少',
      ok: true,
      why: '泄漏让一部分 H⁺ 走了别的路，膜两侧的梯度维持得更弱，经 ATP 合酶回流的 H⁺ 因此变少，这条途径合成的 ATP 减少。',
    },
    {
      text: '梯度会变强，因为 H⁺ 回流得更快了',
      ok: false,
      why: '回流本身是在消耗梯度。泄漏途径只让 H⁺ 漏回去，并不会建立梯度，所以梯度是变弱而不是变强。',
    },
    {
      text: '电子会经这条泄漏途径变成 ATP',
      ok: false,
      why: '经泄漏途径回到基质侧的是 H⁺，不是电子；而且泄漏途径本身不合成 ATP。电子不会变成 ATP，回流的粒子也不是电子。',
    },
    {
      text: '电子传递会立刻停止，细胞里所有 ATP 都归零',
      ok: false,
      why: '泄漏不等于电子传递停止，通常仍在进行；而且这只影响经 ATP 合酶合成的那一条途径，不表示细胞里所有 ATP 立刻归零。',
    },
  ],
  before: '先选一个判断，再点击"提交预测"。提交前不会显示结果。',
  correct: '预测正确。',
  wrong: '这个判断不成立：',
  retryNote: '重新预测会清空本次作答与反馈，可以再选一次。对照解释已解锁，重试不会重新上锁。',
};

// 未提交预测时想跳到"对照解释"会被拦下，用这两条文案说明原因。
export const atpLockNote = '对照解释是这道预测题的答案：先在第 4 步选一个判断并提交，它才会开放。已经带你回到第 4 步。';
export const atpStepLockMark = '未解锁';

// 对照数据只用于定性长条，长条长度表示"相对多少"，不是测量值。
export const atpCompare = {
  heading: '同一阶段：正常 vs 内膜质子泄漏',
  label: '示意 · 非实验测量',
  normalName: '正常',
  leakName: '内膜质子泄漏',
  rows: [
    {name: '电子传递', normal: '仍在进行', leak: '通常仍在进行（可能更快）', normalLevel: .78, leakLevel: .84},
    {name: '内膜两侧的电化学梯度', normal: '维持得较好', leak: '明显减弱', normalLevel: .8, leakLevel: .34},
    {name: '经 ATP 合酶合成的 ATP', normal: '较多', leak: '减少', normalLevel: .78, leakLevel: .28},
  ],
  caveat: '长条只表示相对多少，是教学示意，不是实验测量；本图只针对经 ATP 合酶合成 ATP 的这一条途径。',
};

export const atpLimits = [
  '本模块只画一段内膜上的定性示意，不呈现完整细胞呼吸全过程，也不做真实分子动力学模拟。',
  '不给出精确的质子/ATP 比、每分子葡萄糖的 ATP 总量，也不呈现药物剂量、干预实验或测量数据。',
  '膜上的复合体只画成带编号的示意方块，不表示真实形状、亚基组成、数量或排列方式。',
  '"正常 / 泄漏"对照里的长条只表示相对多少，是示意而非实验测量，不能当作数据引用。',
  '真实内膜折叠成嵴，膜上还有大量其它转运蛋白与代谢过程；本图只保留与这条途径直接相关的部分。',
  '本模块未覆盖：底物水平磷酸化、细胞中其它 ATP 来源，以及线粒体的其它功能。',
];

export const atpSources = [
  {name: 'OpenStax Biology 2e · 7.4 Oxidative Phosphorylation', url: 'https://openstax.org/books/biology-2e/pages/7-4-oxidative-phosphorylation'},
  {name: 'OpenStax Biology 2e · 7.3 Oxidation of Pyruvate and the Citric Acid Cycle', url: 'https://openstax.org/books/biology-2e/pages/7-3-oxidation-of-pyruvate-and-the-citric-acid-cycle'},
  {name: 'NCBI Bookshelf · 分子生物学教材插图：电化学质子梯度的两个组成部分', url: 'https://www.ncbi.nlm.nih.gov/books/NBK28412/figure/A3495/'},
  {name: 'Frontiers in Physiology · Mitochondrial uncoupling proteins and energy metabolism（开放获取，论述 H⁺ 经不依赖 ATP 合酶的途径回流）', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4322621/'},
];

export const atpScope = '本轮只做这条途径的定性顺序与因果；反应的化学计量、能量换算与分子机制留给后续轮次。';
