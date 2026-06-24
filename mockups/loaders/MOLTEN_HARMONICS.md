# Molten Harmonics — a determinate loading-state philosophy

*The loading state for Palette Studio. Not an endless swirl — a **resolve**: it starts from
nothing, performs the act of making a palette, and ends on the finished palette. Themed
Grimdark or Playful by swapping only its colours.*

---

**A loader should resolve.** The earlier version mixed forever and never arrived; this one is
**determinate** — driven by a single `progress` value from 0→1 that, in production, maps to the
real dataset-load percentage. There is a beginning, a middle, and a finished result. The whole
thing reads as the product's own promise performed in miniature: colour, made honest, settling
into a palette you could paint from.

**Three acts.**
1. **The drop (0–0.25).** A single drop of colour falls and blooms at the centre — pigment
   entering water. Quiet, two seconds of "something is happening."
2. **The wheel (0.2–0.55).** The bloom's colours travel outward and arrange themselves on a
   harmony wheel, each settling at its true hue. This is the soul of the tool made literal: the
   palette is organised by **colour theory** — complementary, triadic, split — before your eyes.
3. **The wells (0.5–1.0).** The colours leave the wheel and pour down into a row of wells that
   **fill bottom-up**, like loading a wet palette. The wheel fades; labels rise; the row settles
   with a small bounce. The final frame is the finished palette — and nothing else.

**One algorithm, two temperaments.** Grimdark renders it as a forge — brass and ember on
near-black, additive light on the droplets. Playful renders the same motion as pigment in water —
vivid hues on a bright field. Only the palette and blend mode change; the choreography is
identical. Every easing curve and overlap was tuned so the three acts flow as one continuous
gesture rather than three stitched clips — the mark of a system refined across many passes.

**Restraint, because it is a loader.** It is short, calm, and self-effacing; it performs *behind*
the work and disappears the moment the real palette is ready. Under `prefers-reduced-motion` it
skips the performance and simply shows the finished palette.

---

### Parameters
`progress` (0→1, the load signal) · `seed` (which palette) · `harmony` (complementary / triadic /
split / tetradic → the wheel bearings) · `speed` (explorer only) · `theme`.

### Production note (no drift)
Plain **vanilla Canvas 2D** — no p5, no runtime dependency — so the deterministic
`render(progress)` core ships inside the app per `CLAUDE.md` §6, themed only through CSS tokens,
honouring `prefers-reduced-motion` (§3.4). The app feeds it real load progress; the explorer
(`loader.html`) wraps the same core with a play/scrub transport.
