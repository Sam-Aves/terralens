# TERRALENS frontend ↔ backend contract

> **Current state (live backend connected).** With `VITE_API_BASE` set (the included
> `.env` points at `http://127.0.0.1:8000`) the FastAPI backend owns the **player side**:
> progress, callsign, journal, rank, XP, coins, reset, and server-side answer checking on
> submit. Routes live under `/api/game` (`src/gamification/player_api.py`):
>
> | Frontend function | Endpoint |
> |---|---|
> | `getPlayerProgress()` | `GET /api/game/players/{id}/progress` |
> | `savePlayerProfile()` | `PUT /api/game/players/{id}` |
> | `getPlayerJournal()` | `GET /api/game/players/{id}/journal` |
> | `getPlayerRank()` | `GET /api/game/players/{id}/rank` |
> | `resetPlayer()` | `DELETE /api/game/players/{id}` |
> | `awardXp()` | `POST /api/game/players/{id}/xp` (capped at 150 per call) |
> | `spendCoins()` | `POST /api/game/players/{id}/coins/spend` |
> | `submitInvestigation()` | `POST /api/game/investigations/{mission}/players/{id}/submit` |
>
> `{id}` is a random id this browser keeps in localStorage. Missions, scenes, analysis
> numbers, mark checking and map layers are still served from the browser (the backend
> has no per-mission data for them). Mark counts and bonus XP are reported by the browser
> and only capped, not re-verified, by the server. If the backend is not running, player
> calls fall back to localStorage so the game keeps working offline.
>
> The sections below are the original full-backend plan.


The frontend talks to the backend only through `src/api/terralensApi.ts`.
Right now that file answers every call with **mock data** in the browser.

## Switching to the real backend

1. Create `frontend/.env` with `VITE_API_BASE=http://127.0.0.1:8000` (your FastAPI address).
2. Restart `npm run dev`.

Every function then calls the endpoint below instead of the mock. Allow CORS
for `http://localhost:5173` in FastAPI.

## Endpoints

| Function in `terralensApi.ts` | Endpoint | Returns (TypeScript type) |
|---|---|---|
| `getMissions()` | `GET /missions` | `MissionSummary[]` |
| `getMission(id)` | `GET /missions/{id}` | `MissionSummary` |
| `getScenes(id)` | `GET /scenes/{id}` | `ScenesResponse` |
| `getAnalysis(id)` | `GET /analysis/{id}` | `AnalysisResponse` |
| `checkMarks(id, payload)` | `POST /investigations/{id}/marks` | `CheckMarksResponse` |
| `submitInvestigation(id, payload)` | `POST /investigations/{id}/submit` | `SubmitResponse` |
| `getPlayerProgress()` | `GET /players/{playerId}/progress` | `PlayerProgress` |
| `savePlayerProfile({callsign})` | `PUT /players/{playerId}` | `PlayerProgress` |
| `getPlayerJournal()` | `GET /players/{playerId}/journal` | `JournalEntry[]` |
| `getPlayerRank()` | `GET /players/{playerId}/rank` | `{ rank, xp, nextRankAtXp }` |
| `resetPlayer()` | `DELETE /players/{playerId}` | `PlayerProgress` |

`playerId` is the fixed string `local` until login exists.
The exact field names are the exported interfaces in `terralensApi.ts`,
`src/types/api.ts` and `src/types/mission.ts`. JSON keys must match them.

## What is mock today

| Data | Mock source | Backend should provide |
|---|---|---|
| Missions, questions | `src/data/mission0X.ts` | Same shape from the database |
| Scene records | Fixture list in `getScenes` | Real scene metadata per mission |
| Analysis numbers | `ANALYSIS_FIXTURES` (all three missions) | Pipeline results per date |
| Answer checking, XP, coins | `submitInvestigation` in the browser | Server-side checking and totals |
| Progress, journal | Browser `localStorage` | Player tables |

## Map data (backend-owned)

Two things on the map are placeholders until the backend serves its own:

- **Radar imagery** — `ScenesResponse.imagery[i].tiles` is an XYZ tile URL
  template (`{z}/{x}/{y}`) per date. The mock points at public Sentinel-1 RTC
  tiles; replace with your tile server (e.g. TiTiler over your COGs).
- **Change layer** — `AnalysisResponse.overlays[i]` is `{ url, coordinates }`,
  an image plus its four corner coordinates (top-left, top-right, bottom-right,
  bottom-left, each `[lon, lat]`). The mock draws it in the browser in
  `src/data/sentinel1.ts`; replace with your change-detection output.

Note: `RadarMap.tsx` still reads the imagery tile URL from
`src/data/sentinel1.ts` directly. When the backend tiles exist, pass
`imagery` from `getScenes` into `RadarMap` instead.

## Analysis fixtures

Sentinel-1A RTC. Water = VH backscatter below −20 dB. New water = water on the
date that was not water on the first (baseline) date. Experimental, not
validated. Scene IDs and study areas are in `src/data/sentinel1.ts`.

| Mission | Date | Open water km² | New water km² |
|---|---|---|---|
| 01 Jamuna (orbit 114) | 2024-05-17 | 122.9 | baseline |
| | 2024-06-22 | 196.7 | 80.9 |
| | 2024-07-16 | 281.9 | 162.2 |
| | 2024-09-02 | 187.9 | 68.5 |
| 02 Brahmaputra, Kaziranga (orbit 143) | 2024-05-19 | 199.8 | baseline |
| | 2024-06-24 | 229.5 | 38.3 |
| | 2024-07-06 | 382.6 | 184.7 |
| | 2024-08-23 | 249.2 | 53.5 |
| 03 Solimões near Coari (orbit 156) | 2023-11-22 | 327.7 | baseline |
| | 2024-01-09 | 534.1 | 209.0 |
| | 2024-06-01 | 580.3 | 254.9 |
| | 2024-10-11 | 339.3 | 40.3 |

## Change Detective marks

`checkMarks(id, { stageIndex, marks })` → `POST /investigations/{id}/marks`
returns `CheckMarksResponse`. A mark is a 1 km circle; it is correct when at
least 25% of the circle is new water and it is 3 km or more from another
correct mark. The mock checks against the browser-computed mask and, on
submit, trusts the count the screen sends (`correctMarks`); the backend
should re-check marks itself.
