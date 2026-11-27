# Plus Jakarta Sans

Pinned unmodified variable normal font from [Google Fonts](https://github.com/google/fonts/tree/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/plusjakartasans), commit `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`.

Source: `PlusJakartaSans[wght].ttf`; SHA-256 `89b3fb38aa0d275d7a731d0d817a4f1622b316b4d7fbdedcf02ee9099ff68bc8`. Redistributed under the included SIL Open Font License1.1.

Loaded with `next/font/local` at weights 400–800 using the existing
`--font-plus-jakarta` variable and `display: swap`. The bundled font retains
Vietnamese glyphs. This removes build-time Google CSS URL parsing, which blocked
MB-762 CI twice; it does not change the selected family or layout. Other existing
font families remain unchanged.

Upstream issue: [vercel/next.js#99114](https://github.com/vercel/next.js/issues/99114).
The two observed CI failures were in the Plus Jakarta Sans loader. The original
font family, weight selection and normal style are preserved; no dependency,
global CSS, theme token or page shell is changed.
