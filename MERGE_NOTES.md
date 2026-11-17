# BioLens bilingual integration · 2026-11-17

## Provenance

Public-repository baseline: `4be5dc92e231ef561084a5edae6c6f8e061229bc`.
Integration uses the latest shared `BioLens-参赛项目/work/biolens-i18n` copy, including DeepSeek's terminology corrections, translation review, topoisomerase explanation, and AP 6.2 checklist. The source competition folder is not modified by this integration.

## Final corrections

- Clarified that the seven displayed AP 6.2 points are not the entire examination scope. The CED exclusion statement explicitly retains RNA polymerase as well as DNA polymerase, ligase, helicase, and topoisomerase.
- Corrected mitochondrial “stroma” to “matrix”, crista/cristae grammar, and the description of the two mitochondrial membranes.
- Extended the browser suite through DNA primer placement, an incorrect nucleotide, five correct nucleotide additions, finishing steps, primase/ligase interventions and their controls, and the helicase dialog.
- Verified that language switching preserves candidate nucleotides, the growing DNA strand, intervention state, passive-transport state, ATP scene state, and mitosis state in the tested scenarios.
- Made the full regression script exit unsuccessfully when any assertion fails. Test browsers use dedicated local ports and profiles.
- Included Acorn's MIT license with the development-only parser.

## Validation

Run `node tools/build-copy.cjs`, `node tools/check-all-i18n.cjs`, and `node tools/check-i18n.cjs` from the repository root. Browser tools require Node.js 22+ and a locally installed Edge/Chrome. JSON results and screenshots are written to ignored `qa/`; a compact copy of the final assertion results is included under `validation/`.

The English catalog contains 1,237 entries. It is local: the website does not call translation services. The Python translation scripts are optional authoring utilities, not runtime dependencies.

The three existing README illustrations were visually inspected: membrane and passive-transport images contain Chinese labels; the mitosis image is a schematic model. They remain Chinese illustrations, not screenshots claiming to demonstrate English UI. Mol* retains its own English controls in both site languages.

Automated coverage checks detect untranslated Chinese text, runtime exceptions, page overflow, and tested state changes. They do not prove every possible browser/device state or the correctness of every English sentence. Scientific review focused on membrane transport, DNA synthesis, chromosome distribution, mitochondrial terminology, and the published AP mapping.

## Delivery boundary

This integration is a local Git change. GitHub push and Vercel deployment are separate actions; no deployment is performed by the merge or test scripts.
