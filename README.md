# UTHM Hydroelectric Power System Simulator

This wraps the original Gemini-generated React TSX simulator as a Vite website project.

## Local setup

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal.

## Publish via GitHub + Vercel

1. Upload all contents of this folder to the root of a GitHub repository (do not upload just the ZIP).
2. Open https://vercel.com/new and import the repository.
3. Framework: Vite; Build Command: `npm run build`; Output Directory: `dist`.
4. Deploy and check the website.

## Notes

- The 3D view in `src/App.tsx` loads Three.js r128 from cdnjs at runtime. The browser needs internet access to render the 3D scene.
- The original Gemini-generated simulation logic was preserved, not independently engineering-validated.
- A `.tsx` file alone is a React component, not a standalone website.
