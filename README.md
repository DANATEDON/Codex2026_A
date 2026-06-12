# Remote Sensing Band Explorer

Standalone static app for exploring real remote sensing sources, bands, formulas, map overlays, and public scene metadata.

## Run Locally

No Docker or build step is required. From this folder:

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:8070/index.html
```

On Windows, you can also double-click:

```text
run-explorer.bat
```

If port `8070` is already busy:

```powershell
npm run dev -- --port 8071
```

## Data Notes

- Sentinel-2 real scene metadata and tile links are read from public STAC/Planetary Computer style endpoints configured in the app.
- Cloud filtering is set to keep scenes under 30% cloud where provider metadata supports it.
- Map formula/index controls are screening tools and should be validated with field observations or authoritative analysis for operational decisions.
