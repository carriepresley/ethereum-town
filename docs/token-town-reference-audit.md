# Token Town public source audit

Inspected 2026-09-27 UTC. Reference: [sael.net/token-town](https://sael.net/token-town/). Downloaded public HTML and extracted its inline module into `/tmp/ethereum-token-town-reference/`; inspected and formatted it as text only. No reference JavaScript was executed by this audit and no source, artwork, logos or shaders were copied into the application.

The fetched HTML is 174,153 bytes, SHA-256 `69f8b9c48dd7d04df2e536ec5568fc2f2baa43166546726269f9204841d75126`. These observations describe that response; the remote site can change.

## Verified stack and assets

- One inline ES module plus an import map. The renderer is **Three.js 0.183.2**, loaded from [`three.module.js`](https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js). The addons import prefix is `https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/`.
- Imported addons: `EffectComposer`, `Pass`/`FullScreenQuad`, `GTAOPass`, `UnrealBloomPass`, `OutputPass`, `RoundedBoxGeometry`, and `mergeGeometries`.
- The page uses plain DOM/CSS and **DM Sans** from Google Fonts. No React, React Three Fiber, Babylon, Pixi, GSAP, GLTF loader, external 3D model, or external building texture import appears in the inspected application module.
- Logos are embedded SVG paths or PNG data URLs. Building signs, shop interiors, brickwork and pavement textures are generated with Canvas 2D. Exterior geometry is procedural.
- Other external script references are `https://dat.d1.tel/script.js` and `https://sael.net/sael.js`. The former is used by the visitor analytics integration. Those external scripts were not needed for the visual audit and were not downloaded or executed here.

This identifies the shipped runtime, not the author’s development tools. The source does not prove which editor, AI assistant, image tool or deployment service the author used.

## Verified rendering and composition

| Feature | Evidence in the application module |
| --- | --- |
| Camera | `PerspectiveCamera`: 30° field of view, near 0.5, far 160. Default distance is approximately 23.5 scene units, responsive to aspect ratio, building height and zoom. View elevation starts at 0.58 radians (about 33°). |
| Framing | Camera follows a selected shop with smoothed motion and a slight pullback during travel. User orbit and zoom are intentionally bounded. The active shop receives full color; other shops smoothly desaturate and dim. |
| Color/light | ACES filmic tone mapping, initial exposure 1.12; exponential distance fog starts at density 0.0165. Hemisphere plus warm directional lighting changes across an interpolated day/night palette. |
| Shadows | PCF directional shadows, 2048×2048 map, limited camera-centered shadow area. Shadow updates are manual, not unconditional each frame. |
| Extra light | A custom material extension selects ten nearby light contributions. Emissive shop interiors/signs and ground glow meshes supplement the main lighting. |
| Pipeline | Half-float multisampled scene render → half-resolution ground-truth ambient occlusion → half-resolution bloom → custom depth-of-field → output color pass. |
| Ambient occlusion | GTAO gives pavement edges, counters, street props and buildings contact depth. It uses 12 samples and a denoise pass. |
| Bloom | Initial strength 0.55, radius 0.6, threshold 0.95, with strength/threshold adjusted over the day. |
| Depth of field | A custom half-resolution blur focuses on the chosen shop. Focus distance updates with camera position. Near and far blur have different strengths. This creates the miniature-photography effect. |

The source establishes these mechanisms and numbers; calling the result “miniature photography” is a visual interpretation. Exact values are scene-scale-dependent and should not be transplanted blindly.

## Verified geometry, motion and performance strategy

Five building families vary silhouette and roofline: shop, brick, pavilion, studio and gable. A hero storefront contains layered frontage, an interior image behind window frames, counter objects, door handles, awnings, printed fascia, side signs, bulbs, roof plant/machinery and seating. This is a close-up environment, not a bird’s-eye grid of repeated boxes.

Static geometry is merged by material; repeated scenery, cars and people use instancing. Material and rounded-box geometry caches reduce duplication. Each shop packs signs/interiors into a 2048×1536 texture atlas, with inactive atlases rendered at half scale.

People follow defined sidewalk, queue, entry and exit paths, with walking motion in a vertex shader. Vehicles follow rounded road circuits and slow near corners. Shutter effects are route-following geometry for headlight trails and pedestrian smears, rather than unrelated glowing particles.

Pixel ratio starts capped at 1.5. Multisampling is two or four samples; AO, bloom and depth of field are reduced resolution. A low-frame-rate check lowers pixel ratio toward one. Once paused and visually settled, the app skips repeated rendering. Shader compilation is requested before removing the loading state.

## Verified data behavior

The application loads the [OpenRouter model catalog](https://openrouter.ai/api/v1/models) and rankings for [week](https://openrouter.ai/api/frontend/v1/rankings/models?view=week), [day](https://openrouter.ai/api/frontend/v1/rankings/models?view=day) and [month](https://openrouter.ai/api/frontend/v1/rankings/models?view=month) at startup, with a 4.5-second response race and a dated embedded fallback. The inspected module does not periodically refresh these model/ranking feeds. The separate live visitor count does poll.

Shop order follows weekly tokens. Relative weekly tokens are transformed with a power curve to drive illustrative crowds and queues; people are not individual real users. Its four chart columns are mixed summary periods, not a chronological four-day series. Ethereum Town should preserve our stricter polling, stale labels and measurement windows rather than borrow this data model.

## Why our previous version fell short

The previous local `financial-city-scene.js` used a broad orthographic camera, regular boxes and basic lighting without an AO/bloom/depth-of-field composer. It included small props, but the default framing spread attention across the whole map. The reference concentrates scale, contrast, detail and focus on a single place while retaining a surrounding town. This comparison explains an implementation gap; it is not evidence that one renderer alone guarantees quality.

## Original implementation priorities

1. **Art-direct the first view.** One memorable Ethereum Hall, one clearly readable health reading, two neighboring districts and a believable street foreground. Make overview an optional camera mode.
2. **Build four or five distinct hero places.** Hall, validator utility, L2 transit, gas/capacity workshop and financial market should have different silhouettes and useful architectural details. Keep wider context quiet.
3. **Add photographic depth deliberately.** Perspective framing, subtle AO/contact shadows, selective bloom, warm interiors against cool streets; optional restrained depth of field on close views. Keep labels and the active measurement sharp.
4. **Make selection do the organizing.** Ease the camera toward the chosen place, dim surrounding buildings modestly, and show one compact metric card. Do not place an equal-weight label over every building.
5. **Separate meaning from atmosphere.** A real block can trigger a hall pulse and an observed rollup publication a train. Decorative walkers/cars stay labeled illustrative; avoid implying each person is a transaction.
6. **Budget the scene before adding more.** Merge static detail, instance moving entities, cap pixels, reduce postprocessing resolution and honor reduced motion. Verify desktop and mobile composition after every camera change.

Use these rendering techniques and interaction principles in our own design. Do not transplant the reference’s source, custom shaders, signs, logos, layouts or branded artwork.
