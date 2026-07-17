---
name: kanari-design
description: Use this skill to generate well-branded interfaces and assets for Kanari (kanari.io, app de détection précoce des feux de forêt), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Points clés : tokens dans `styles.css` (→ `tokens/`), logos dans `assets/` (ne jamais redessiner le logo), composants React dans `components/`, homepage de référence dans `ui_kits/website/index.html`. Jaune canari #FFC72E + charbon #1B1C1E sur blancs chauds ; braise #E8622C avec parcimonie ; Fredoka (titres) + DM Sans (corps) ; pill buttons, radius généreux, animation signature `kanari-wave`.
