# GeoSim – Land Surveying Simulator

Browser-based surveying simulator (TypeScript + Vite). No backend, static hosting.

## Run
```
npm install
npm run dev      # dev server
npm test         # unit tests
npm run build    # static build in dist/
```

## Status
- [x] Survey math core (`src/core/SurveyEngine.ts`): polar to coordinates, DMS, Bowditch adjustment
- [x] Traverse calculator page with plan map
- [ ] CSV / DXF export
- [ ] Leveling simulator, total station, telescope view (Three.js)
