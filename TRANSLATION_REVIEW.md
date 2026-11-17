# 当前合并复核：2026-11-17

词库现为 1,237 条；下方 12:17 记录为历史状态。已检查校对稿与最终译法的差异，保留逐条科学修正，并修复线粒体 matrix/stroma 和 crista/cristae 表述。三张 README 图已视觉核对，保留中文标注并在 README 双语说明。DNA 完整操作已补测；最新验证结果见 `validation/`，整合说明见 `MERGE_NOTES.md`。不把机器初译称为逐句人工翻译。

---

# 翻译校对记录 · Translation review

更新：2026-11-17 12:17。基线仓库 `4be5dc92e231ef561084a5edae6c6f8e061229bc`。本文件说明 `dist/en-copy.js` 这份英文字典是怎么来的、术语怎么定的、还差什么，便于后续人工复核。

## 一句话

英文字典不是逐句人工撰写，而是“机器初译 → 分批校对 → 规则修正 → 回归验收”的产物：1225 条词条覆盖六个入口页、四个内嵌视图与全部 Canvas/SVG 文字，实测 60 项中英回归全部通过；仍有 89 条校对稿与最终包不一致，需人工再过一遍。

## 生成链路

1. `tools/extract-copy.cjs` 扫描 `dist/*.html`、`*.js`、`*.json`，得到含中文的候选串清单（`CONTENT_CANDIDATES.json`，含文件与行号）。
2. `tools/translate-copy.py` / 人工分批生成初译，落成 `TRANSLATION_DRAFT.json`（1204 条）。
3. 校对批次写入 `TRANSLATION_SINGLE_CHECKED.json`（754 条），`COPY_REVIEW.json` 为追加的修订项。
4. `tools/build-copy.cjs` 按下方顺序合并，写出 `dist/en-copy.js`：

```text
TRANSLATION_DRAFT.json
  ← TRANSLATION_SINGLE_CHECKED.json（按 key 覆盖）
  ← 通用修正（术语与错译正则）
  ← 逐条修正（短词与整句）
  ← COPY_REVIEW.json（按 key 覆盖）
  ← 本次新增的拼接键空格修复
```

后合并者优先，因此**逐条修正会压过校对稿**，这是刻意的：校对稿在若干处给出更差的译法（见“残差”）。

## 术语约定

| 中文 | 采用 | 不采用 |
| --- | --- | --- |
| 易化扩散 / 协助扩散 | facilitated diffusion | assisted diffusion |
| 动态平衡 | dynamic equilibrium | dynamic balance / balancing |
| 电化学梯度 | electrochemical gradient | — |
| 质子动力势 | proton-motive force | proton dynamic potential |
| 内膜 / 外膜 | inner membrane / outer membrane | intima / endometrium / adventitia（解剖学用词，误译） |
| 嵴 | cristae | ridges / crests |
| 基质侧 | matrix side | stromal side |
| 细胞骨架 | cytoskeleton | cytobackbone（旧规则误译） |
| DNA 骨架 | (sugar–phosphate) backbone | skeleton |
| 缺口 / 断口 | nick | fracture / break |
| 半保留复制 | semiconservative replication | semi-preserving replication |
| 姐妹染色单体 | sister chromatids | sister chromatin |
| 冈崎片段 | Okazaki fragment | — |
| 胞质分裂 | cytokinesis | — |
| 载体 | carrier | vector |
| 无机磷酸 | inorganic phosphate | inorganic phosphoric acid |
| 教学示意、非真实比例与速率 | qualitative model · not to scale; not a measured rate | unreal proportions and rates |

教学口径同步：只说“支持 AP Biology 部分主题”，不写“官方课程”“College Board 认可”“覆盖 AP 考试”。

## 残差（89 条）

754 条校对稿全部在包内，其中 293 条替换了初译；剩 89 条保留原有修正。两类原因：

1. **校对稿更差**：把内膜写成 `endometrium`（子宫内膜）、`intima`（动脉内膜），把细胞骨架写成 `skeleton`；这些属于解剖学串词，构建脚本的术语修正更准。
2. **风格差异**：例如 ATP 段落校对稿是逐字直译（“H⁺ accumulates more and more … the proton dynamic potential”），现有版本是可读的改写，保留后者。

结论：这 89 条不是“漏翻”，是取舍；但仍是人工复核的第一优先级，尤其涉及膜结构、ATP 与 DNA 的表述。

## 已知未覆盖

- **Mol\* 工具栏**：`structure-viewer.html` 由 Mol* 渲染的第三方界面仍为英文，中文模式下也是英文；本站自己的标题、按钮、错误提示与来源说明已双语。不宣称查看器已本地化。
- **配图嵌字**：`dist/assets/plate-membrane.png`、`plate-passive.png`、`plate-mitosis.png` 是中文界面的截图，尚未逐张核对是否与当前版式一致；双语 README 引用它们，替换前需重拍。
- **拼接连句**：若干键是“标签 + 子句”的拼接（如 `已选择：`、`：姐妹染色单体…`）。当前用最长键优先匹配，已修掉冒号后空格，但英文语序与中文拼接假设不同，长句仍建议整句成键。

## 复现与验收

```text
node tools/build-copy.cjs      # 重建 dist/en-copy.js，输出条目数
node tools/check-all-i18n.cjs  # 全站 60 项：覆盖、溢出、状态保持
node tools/check-i18n.cjs      # 单页 20 项：URL 优先级、跨页带参、中文恢复
```

最近一次结果：60/60 与 20/20 通过，`missing: []`、`errors: []`，记录在 `qa/all-checks.json`、`qa/checks.json`，截图在 `qa/`。脚本依赖本机 Chromium（Edge/Chrome）与 Node.js 22+，通过 DevTools 协议驱动，不引入 npm 依赖。

## 维护约定

- 不要手改 `dist/en-copy.js`，它由脚本生成；改 `TRANSLATION_DRAFT.json` / `TRANSLATION_SINGLE_CHECKED.json` / `COPY_REVIEW.json` 或 `tools/build-copy.cjs` 的字典后重跑构建。
- 新增页面或动态文案时，先在 `extract-copy` 清单里确认该串被抓到，再补译；Canvas 文字必须包在 `BioI18n.t()` 里，否则不会随语言切换。
- 改完必须跑两条检查；`missing` 非空说明页面上还有中文残留。

---

English summary: `dist/en-copy.js` is a 1,225-entry catalogue produced by machine drafting, batch review, rule-based corrections, and regression checks (60/60 and 20/20). 293 reviewed entries replaced earlier wording; 89 reviewed entries were kept out because the older wording was more accurate (e.g. anatomy terms like *intima* for inner membrane). Mol*'s own toolbar stays English, README screenshots have not been re-captured, and the remaining 89 entries need a human pass before publication.
