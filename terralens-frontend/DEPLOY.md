# Deploying TERRALENS

The app is a static site (no server needed in mock mode).

1. Check it builds: `npm install` then `npm run build`. The output goes to `dist/`.
2. Try it locally: `npm run preview`.
3. Host `dist/` on any static host, for example:
   - Netlify or Vercel: connect the repository, build command `npm run build`, publish directory `dist`.
   - GitHub Pages: if the site is served from a sub-path, set `base: '/<repo-name>/'` in `vite.config.ts`.
4. The app uses `#/` links for its screens, so no special rewrite rules are needed.
5. When the backend is ready, set `VITE_API_BASE` (see `API_CONTRACT.md`) before building.

Notes
- Map imagery comes from Esri and Microsoft Planetary Computer over the internet; visitors need a connection.
- Progress, coins, conclusions and avatar colours are saved in the visitor's browser (localStorage).
