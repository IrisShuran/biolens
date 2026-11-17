# BioLens · AP Biology 课程对照草稿

核查日期：2026-11-16；6.2 复核与补写 2026-11-17。代码基线：`4be5dc92e231ef561084a5edae6c6f8e061229bc`。以下为根据源码功能与官方框架建立的编辑判断；尚待浏览器逐项验收，不代表完整课程覆盖或 College Board 认可。

## 依据与版本

- [官方课程页](https://apcentral.collegeboard.org/courses/ap-biology)当前仍提供秋季 2025 生效版 CED。
- [Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf)。表中页码为 PDF 页码（从 1 开始），便于直接定位；学习目标用现版编号。
- [勘误](https://apcentral.collegeboard.org/media/pdf/ap-biology-ced-clarifications-and-corrections.pdf)包含 June 2026 更新：资源迁移及 Progress Checks 用语调整。未列出下列学习目标编号的改动。不得据此声称存在独立的“2026–27 新版”。

## 页面、证据和覆盖范围

以下英文目标描述为简短自述概括。所有条目均为部分支持（partial support），没有宣称完整达成目标。

| 页面 / 源码证据 | 可操作现象 | Topic / 学习目标与概括 | 实际范围与未覆盖部分 | 官方依据 |
| --- | --- | --- | --- | --- |
| `index.html#cell`；`cell.js`、`cell-data.js` | 选择细胞器、旋转模型、逐步查看分泌蛋白旅程与理解题 | 2.1 / 2.1.A — Relate organelles to cell function | 动物细胞结构与协作；植物细胞仅文字对照。比例、数量与位置为示意；不模拟完整细胞代谢 | [PDF 56–58 页](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf#page=56) |
| `membrane.html`；`membrane.js`、`membrane-data.json` | 选择膜组分，查看结构和解释 | 2.3 / 2.3.A、2.3.B — Membrane components and fluid mosaic model；2.4 / 2.4.A — Selective permeability | 磷脂双层与膜组分；不把几何外观当作分子尺度定量结果，不覆盖 2.4.B 细胞壁主题 | [PDF 61–62 页](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf#page=61) |
| `passive.html`；`passive.js`、`passive-learning.js` | 先预测，再比较氧气与葡萄糖、载体条件、双向跨膜计数和等浓度情境 | 2.5 / 2.5.A，重点 EK 2.5.A.2 — Passive movement；2.6 / 2.6.A — Molecular properties and membrane passage | 简单扩散与载体介导的易化扩散。未覆盖主动运输、渗透、水势、胞吞胞吐；不代表完整 2.5 或 2.6 | [PDF 63–64 页](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf#page=63) |
| `index.html#mito`；`mito.js`、`mito-data.js` | 选择内膜、嵴及区室，回答结构功能问题 | 2.1 / 2.1.A；3.5 / 3.5.A — Mitochondrial structure and energy conversion | 结构定位与功能联系，不计算 ATP 产量 | [PDF 57 页](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf#page=57)、[83–84 页](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf#page=83) |
| `index.html#atp`；`atp.js`、`atp-data.js` | 五步观察电子传递、质子回流；预测内膜漏质子的影响并比较情境 | 3.5 / 3.5.A，重点 EK 3.5.A.3 — Electron transfer, gradient and ATP synthesis；关联 3.5.B | 定性示意；不覆盖糖酵解、完整三羧酸循环或发酵。质子驱动力为电化学梯度，不能只写浓度差 | [PDF 83–85 页](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf#page=83) |
| `mitosis.html`；`mitosis.js` | 沿时间轴查看分离、迁移、成核及胞质分裂 | 4.5 / 4.5.B — Chromosome inheritance through mitosis；关联 4.5.A | 动物细胞有丝分裂及胞质分裂；前期与前中期合并。不是完整细胞周期，不覆盖检查点、减数分裂或植物细胞板形成 | [PDF 96–97 页](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf#page=96) |
| `index.html#dna`；`app.js`、`experiments.js`、`dna-course.js`、`helicase.js` | 查看复制叉、互补配对；预测并比较引物酶/连接酶干预；展开“AP Biology 6.2 考纲要点”核对七条必备知识 | 6.2 / 6.2.A；EK 6.2.A.1 — Copying genetic information | 6.2.A.1 的七条均有文字覆盖；拓扑异构酶只在文本与要点清单中说明，未画入 3D 模型；不模拟整条染色体或真实反应动力学；酶干预采用单因素简化。引物酶、DnaB 等超出考纲点名的五种酶，作补充说明，不作考点要求 | [PDF 120 页](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf#page=120) |
| `structure-viewer.html`；`structure-viewer.js`、`data/4esv.cif` | 查看实验结构及分步说明 | 6.2 的结构补充，不单独记作学习目标覆盖 | 结构查看不是实时复制实验；不能从一个结构外推完整细胞过程 | [PDF 120 页](https://apcentral.collegeboard.org/media/pdf/ap-biology-course-and-exam-description.pdf#page=120) |
| `curriculum.html`、首页 | 沿路线跳转；阅读复制/分裂及梯度/能量的联系 | 导航与跨单元联系，不独立计覆盖 | 转录、翻译、表达调控、主动运输、渗透、细胞周期专题等“规划中”内容不得计入已实现课程 | 同上各单元 |

## 科学与展示约束

动态平衡仍存在双向随机运动，短时间计数允许波动。只有模型两侧体积相同，粒子数才可直接作为浓度比较的代理。模拟秒不是生理时间。姐妹染色单体分开后称子染色体；DNA 含量翻倍不等同于复制后立即增加染色体条数。

推荐英文表述：**BioLens supports selected topics in AP Biology through simplified interactive models.**

推荐中文表述：**BioLens 以简化交互模型支持 AP Biology 部分主题的学习。**

This mapping is an independent interpretation of the published framework. BioLens is not an official AP course and is not endorsed by College Board. Interactive models do not replace a full course, laboratory investigations, or assessment of learning.

发布前仍须：逐项在浏览器验证表中功能、确认所有模型限制在两种语言中可见，并重查官方版本链接。
