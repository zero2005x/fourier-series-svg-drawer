# Fourier Series SVG Drawer (傅立葉級數 SVG 描繪實驗室)

An interactive lab that traces and draws preset or custom SVG paths using
Fourier Series epicycles and the Discrete Fourier Transform (DFT).

Built with React 19, TypeScript, Vite, Tailwind CSS, and Motion. It is a
fully client-side application — there is no backend and no API key required.

## Features

- Visualize how rotating epicycles (Fourier coefficients) reconstruct a path.
- Choose from built-in preset paths or upload your own SVG.
- Adjust the number of active circles, animation speed, and rendering options.
- Multi-language UI (translations bundled in `src/translations.ts`).
- Export the rendered drawing.

## Tech Stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) (build tool / dev server)
- [Tailwind CSS](https://tailwindcss.com/)
- [Motion](https://motion.dev/) for animations
- [lucide-react](https://lucide.dev/) for icons

## Run Locally

**Prerequisites:** [Node.js](https://nodejs.org/) 18+

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
3. Open the URL printed in the terminal (default: http://localhost:5173).

## Build

```bash
npm run build      # outputs static files to ./dist
npm run preview    # preview the production build locally
```

## Deploy to Vercel

This project is configured for [Vercel](https://vercel.com/):

1. Push the repository to GitHub.
2. In Vercel, click **New Project** and import the repository.
3. Vercel auto-detects the Vite framework. The included
   [`vercel.json`](vercel.json) sets the build command (`npm run build`),
   output directory (`dist`), and SPA rewrites.
4. Click **Deploy**.

No environment variables are required.

## Project Structure

```
index.html            # App entry HTML
vite.config.ts        # Vite configuration
vercel.json           # Vercel deployment configuration
src/
  main.tsx            # React entry point
  App.tsx             # Main UI and animation logic
  fourier.ts          # DFT and SVG sampling utilities
  presets.ts          # Built-in preset paths
  translations.ts     # UI translations
  types.ts            # Shared TypeScript types
  index.css           # Tailwind entry
```

## License

Licensed under the Apache License 2.0.
