# zbq610610.github.io

Personal portfolio for **Youyang Shang** — mathematics, code, and sound.

**Live site:** [https://zbq610610.github.io/](https://zbq610610.github.io/)

## What's inside

- A single-page, responsive portfolio built with plain HTML, CSS, and JavaScript.
- Generative Canvas scenes: particle field, 3D sphere, fractal tree, campus route, pixel-art world, quantum sphere, and audio spectrum.
- Interaction details: preloader, custom cursor, magnetic buttons, 3D tilt panels, scroll reveals, live Columbus clock, ambient audio, and a playable piano.
- Content based on the CV: OSU honors mathematics + CS minor, Math Cycle Program research, CampusPilot, Dimensional Adventure, Quantum Cryptograph, AstralNote, and Buckeyes ACG Piano Club.
- No build step, no framework, no runtime dependencies.

## Local preview

From this folder:

```bash
python -m http.server 8080
```

Then open <http://localhost:8080>.

Use `http://localhost:8080/?nopreload=1` to skip the intro when iterating on layout.

## Structure

```
index.html
assets/
  css/style.css
  js/main.js
  fonts/
  img/
  pdf/Youyang-Shang-CV.pdf
```

## Accessibility & performance notes

- Honors `prefers-reduced-motion`: all canvas scenes become static and transitions are disabled.
- Keyboard-accessible navigation, playable piano keys, skip link, and visible focus states.
- Canvas rendering is capped at 2× DPR and only animates while a scene is in view.
- Fonts are self-hosted; no third-party trackers or scripts.

## Deployment

The repository name is the GitHub Pages user site, so the site publishes at the root URL from the `main` branch. Pushing to `main` is enough; no Actions build is required.
