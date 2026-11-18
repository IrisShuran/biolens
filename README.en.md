# BioLens — See biology in action

[中文](README.md) | **English**

An interactive, bilingual learning site for exploring cell structures, membrane transport, DNA replication, cell division, and energy conversion.

**Explore the processes of cellular life through interactive models.** Start with cell structures, predict how molecules cross a membrane, observe DNA replication and chromosome separation, and connect these processes within the same cell.

[Explore BioLens](https://biolens-rouge.vercel.app/?lang=en) · [Start with passive transport](https://biolens-rouge.vercel.app/passive.html?lang=en) · [Explore cell division](https://biolens-rouge.vercel.app/mitosis.html?lang=en)

## Available in English and Chinese

Switch languages from the page header without resetting your simulation progress. English links use `?lang=en`, and internal navigation preserves your language choice. The surrounding structure-viewer interface is bilingual; the bundled Mol* toolbar uses English.

The live version includes serif English typography, a moving navigation indicator on single-row menus, transitions between learning units, and fades between pages. Narrow layouts keep navigation readable, while reduced-motion mode removes unit movement and page-transition overlays.

## Start with a question

**Do molecules stop moving at dynamic equilibrium?** In the passive transport unit, make a prediction, then watch oxygen molecules move on both sides of the membrane and cross in both directions. Compare glucose transport with and without an available carrier, then revisit your prediction.

The learning sequence is **predict → interact → observe → explain**. Pause, advance one step, change conditions, and describe the pattern in your own words.

## What you can explore

| Learning path | What you can do |
| --- | --- |
| Cells and membranes | Rotate models and select structures to explore organelles and the phospholipid bilayer |
| Passive transport | Compare concentration and carrier conditions; observe movement in both directions and dynamic equilibrium |
| DNA replication and structure | Explore unwinding, base pairing, and related structures |
| Cell division | Follow a timeline as chromosomes are distributed to two daughter cells |
| Mitochondria and ATP synthesis | Connect structure, proton gradients, and energy conversion |

The images in the [Chinese README](README.md) show the membrane model, a passive transport model with an initial 80:20 particle distribution, and the chromosome model used for cell division. They depict teaching models; the embedded labels in the membrane and passive-transport images are Chinese.

## Run locally

Use Node.js 22 or later and a recent version of Edge or Chrome. From the repository root, run:

```text
node tools/preview.cjs 4188
```

Open `http://127.0.0.1:4188/`. Source files and local assets are in `dist/`. No npm installation or API key is required. Use the local server rather than opening HTML files directly. The 3D structure pages require WebGL support.

## Scope and development

BioLens uses simplified models for high-school biology and selected AP Biology topics. Particle counts, motion speeds, and structural proportions illustrate concepts; they are not biological measurements. Learning outcomes have not been evaluated in a formal study.

BioLens is not a complete AP exam preparation course and is not endorsed by College Board. See the [curriculum mapping draft](AP_MAPPING.md) and [Chinese–English terminology guide](TERMINOLOGY_ZH_EN.md). Planned topics such as transcription, translation, osmosis, active transport, and a dedicated cell-cycle unit do not yet have standalone lessons and are not counted as covered. The [translation review](TRANSLATION_REVIEW.md) records where the English wording comes from, which terminology was chosen, and which entries still need a human pass.

The entrant defined the learning questions, course routes, scientific boundaries, and acceptance criteria, and collaborated with OpenAI Codex, DeepSeek Harness, and Doubao on development, visual updates, and revisions. The website does not call language models at runtime, require student accounts, or collect student learning profiles.

Three.js, Mol*, and their licenses are included in `dist/vendor/`. The development-only Acorn parser has its license in `tools/acorn-LICENSE.txt`. No separate open-source license has been granted for the project's own code. Third-party components remain subject to their respective licenses.

If you try BioLens, please share which step helped you understand a process and which step still felt unclear.
