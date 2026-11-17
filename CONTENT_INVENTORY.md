# 当前整合状态：2026-11-17

六个入口与四个内嵌视图已接入本地词库。动态 DOM 使用 MutationObserver 和原文记录进行可逆显示替换，Canvas 在绘制/测量边界调用 BioI18n.t；下方早期“不依赖 MutationObserver”的方案已被实现取代。已修复查询参数保留；已补测 DNA 全流程和语言切换状态。README 图已检查并标明中文嵌字。最终验证与范围见 `MERGE_NOTES.md` 和 `validation/`；下方为历史追踪记录。

---

# 文案盘点与实施状态

2026-11-16。基线 `4be5dc92e231ef561084a5edae6c6f8e061229bc`，源仓库工作区干净。独立副本由 `git archive HEAD` 导出，未复制或修改源仓库 Git 配置。

## 线上核对

已下载线上首页为 `online-index.html`。与 `dist/index.html` 使用 `git diff --no-index --ignore-space-at-eol` 比较无内容差异（CRLF/LF 不同）。只确认首页 HTML，其他线上脚本、图片与交互仍待逐项检查。

## 页面及运行时文案入口

| 用户入口 | 静态与动态来源 | 必查状态 | 双语状态（2026-11-17 复核） |
| --- | --- | --- | --- |
| 首页 `/` | `index.html` 的 homeMain；`visual-system.js`、内联 showBioWorld | 导航、路线、规划中标记、页面标题、ARIA | 已实现：`home-i18n.js`（首页导航），四视图为词典即时替换 |
| 课程地图 | `curriculum.html` | 课程联系、锚点、规划中标记 | 已实现：`curriculum-i18n.js`；锚点与 `?lang=` 同时保留 |
| 细胞 `/#cell` | `index.html` cellMain；`cell.js`、`cell-data.js` | 13 结构、标签、旅程、测验、反馈、WebGL 加载 | 已实现：13 个细胞器逐个通过英文覆盖检查（orgName/orgShape/orgJob/orgLink/orgNote） |
| DNA `/#dna` | `index.html` dnaMain；`app.js`、`experiments.js`、`lesson-player.js`、`helicase.js`、`dna-course.js` | 各步骤、预测、酶干预、正常对照、播放状态、Canvas 图例 | 已实现：`fillText/strokeText/measureText` 在渲染边界包 `BioI18n.t()`，`app.js` 订阅重绘 |
| 线粒体 `/#mito` | `index.html` mitoMain；`mito.js`、`mito-data.js` | 4 结构、测验、限制、标签与来源 | 已实现：4 个结构逐个通过；数据文件原件不改，替换发生在 DOM 层 |
| ATP `/#atp` | `index.html` atpMain；`atp.js`、`atp-data.js` | 5 步、预测锁定、漏质子对照、降级状态、Canvas 文字 | 已实现：5 步 + 预测通过；切换语言后 `atpScene` 保持不变 |
| 被动运输 | `passive.html`、`passive.js`、`passive-learning.js` | 5 步、欢迎/帮助/聚光教程、两方向统计、初次/回访、题目反馈、证据回看 | 已实现：5 步、观察态与答题通过；切换语言后粒子数、计数、预测与步骤不变 |
| 细胞膜 | `membrane.html`、`membrane.js`、`membrane-data.json` | 结构选择、图例、描述与模型限制 | 已实现：静态文案 + 动态选择结果 |
| 分裂 | `mitosis.html`、`mitosis.js` | 5 阶段、染色体计数、SVG 文字、时间轴与辅助说明 | 已实现：6 个时间点通过；SVG `<text>` 与 `measureText` 一并替换，状态保持 |
| 实验结构查看器 | `structure-viewer.html`、`structure-viewer.js`、Mol* | 加载成功/失败、结构说明、第三方界面与来源 | 部分实现：本站文案已双语；Mol* 自带工具栏保持英文，不宣称为已本地化 |

`dist/cell.html` 是旧的页面片段，不是实际 `/#cell` 的完整运行入口。以 `index.html` 中 cellMain 为主，避免只翻译旧片段。

运行 `node tools/inventory.cjs` 生成 `CONTENT_CANDIDATES.json`。记录文件、行号和含中文的原文行，包含注释和整行 HTML；这是可检索候选清单，不是已审定的翻译键或运行时覆盖证明。

## 图片和非 DOM 内容

- README 引用 `assets/plate-membrane.png`、`plate-passive.png`、`plate-mitosis.png`；须逐张视觉检查嵌字与当前布局，当前状态为**待检查**，不能宣称已更新截图。
- Canvas 和 SVG 由多个脚本生成；DOM 文本替换不能覆盖画布绘字。
- 第三方 Mol* 工具栏需单独确定语言边界，不能因教学说明双语就宣称查看器全部本地化。

## 实施决定与验收门槛

1. 优先语言顺序：有效 URL `lang` 参数 → 本地偏好 → 中文。保存失败时仍允许当次切换。
2. `showBioWorld('home')` 目前会用 `location.pathname` 替换 URL，清掉查询参数；实现分享语言前必须修正。
3. 切换仅重绘文案，不重建模拟。被动运输的预测、运行时间、统计、题目选择和当前步骤须保留。使用显式翻译键和整句参数，不依赖全局 MutationObserver 猜译。
4. 先交付首页/课程地图/被动运输纵切面。首页各内嵌世界未完成前，需要准确标明该视图语言范围，不能挂一个假定全站可用的 EN 按钮。
5. 已执行真实浏览器验收（2026-11-17 12:17）：桌面 1440 与手机 390 刷新、深链接、跨页返回、语言保留、全部实验状态保持均通过。

## 首批交付状态（历史记录，已被 2026-11-17 12:17 复核取代）

已完成独立副本、源码入口盘点、官方目标编号核查、课程映射草稿、术语表与双语 README 草稿。README 明确网站目前为中文。尚未修改网站源码或发布。后续从显式 i18n 接口和被动运输状态重绘开始，逐页扩展。

## 2026-11-17 实施更新（优先于上方初始状态）

首页 homeMain、首页导航与课程地图已接入中英文。`i18n.js` 使用显式文案字典注册文本节点和属性，切换不会替换整棵 DOM；语言按 URL → 本地偏好 → 中文选择，URL 使用 `lang=zh/en`。导航保留参数，首页 showBioWorld 已修正为保留查询字符串。

六个入口页（`index.html`、`curriculum.html`、`passive.html`、`membrane.html`、`mitosis.html`、`structure-viewer.html`）全部接线：`tools/wire-i18n.cjs` 注入 `en-copy.js`、`i18n.js`、`i18n.css` 与页头语言按钮；`fillText` / `strokeText` / `measureText` 在渲染边界统一包成 `BioI18n.t()`，`app.js`、`passive.js`、`atp.js` 订阅重绘，因此 Canvas 与 SVG 文字随语言切换更新，而不动模拟状态。

## 2026-11-17 12:17 复核（当前状态）

- 词表：`dist/en-copy.js` 共 **1225** 条；来源为 `TRANSLATION_DRAFT.json`（1204）、`TRANSLATION_SINGLE_CHECKED.json`（754 条校对稿）与 `COPY_REVIEW.json`，由 `tools/build-copy.cjs` 合并。754 条校对稿全部在包内，其中 293 条替换了旧译法；余下 89 条保留原有修正，因为校对稿在该处更差（如把内膜写成 `endometrium`、`intima`）。过程与残差见 `TRANSLATION_REVIEW.md`。
- 本轮修掉的缺陷：`细胞骨架` 曾按规则被译成 `cytobackbone`（现 `cytoskeleton`）；`已选择：…`、`：…` 这类拼接键丢失冒号后空格（现 `Selected: Nucleus`）。
- 验证：`node tools/check-all-i18n.cjs` **60/60 通过**，`missing: []`、`errors: []`（`qa/all-checks.json`）；`node tools/check-i18n.cjs` **20/20 通过**（`qa/checks.json`）。覆盖四档宽度、6 个入口页、13 个细胞器、4 个线粒体结构、ATP 5 步与预测、被动运输 5 步/答题/状态保持、分裂 6 个时间点、URL 优先级、跨页带参、中文恢复、无运行时异常。截图见 `qa/`。
- 仍未完成：线上部署（公开仓库仍在 `4be5dc9`）；三张 README 配图中是否含旧版中文界面待逐张核对；Mol* 工具栏未本地化；89 条残差译法仍需人工过一遍。

下一步：核对配图嵌字并重拍，人工抽检残差译法，取得确认后再提交、推送与发布。
