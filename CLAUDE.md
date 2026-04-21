# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # dev server on port 3000
pnpm build      # production build → dist/
pnpm lint       # ESLint
pnpm start      # preview production build
```

Tests (Vitest):
```bash
pnpm vitest run                               # all tests once
pnpm vitest run src/lib/scannerApi.test.ts    # single file
```

## Environment

Create `.env` in project root:
```
VITE_API_URL=http://localhost:5001
```

Both `/api` and `/sane-api` are proxied to `VITE_API_URL` by Vite in dev. In production the backend serves the frontend directly, so no env vars are needed.

## Architecture

**Stack**: React 19, TypeScript, Vite, Tailwind CSS 3, React Router DOM 7, Axios, pdfjs-dist.

**Provider tree** (`App.tsx`):
```
LanguageProvider (i18n context)
  └─ UiProvider (toast/confirm dialog context)
       └─ AuthChecker (Feishu OAuth gate)
            └─ Header + Routes (/, /printers, /jobs, /scanner)
```

**Auth flow** (`AuthChecker.tsx`): checks `localStorage.token` → if absent, fetches `/api/auth/config` for the Feishu `app_id`, then redirects to Feishu OAuth. On return, exchanges `?code=` via `POST /api/auth/config/code-login`. Both API clients retry a 401 once, then clear the token and redirect to `/`.

**API clients** (`src/lib/`):
- `api.ts` — axios instance for `/api` (GoPrint backend)
- `scannerApi.ts` — axios instance for `/sane-api/api/v1` (SANE scanner backend); exports typed functions: `fetchContext`, `submitScan`, `getScanFiles`, `deleteScanFile`, `downloadScanFile`

**Pages** (`src/pages/`):
- `Home` — landing/service selector
- `Printers` — file upload, PDF preview, print job submission (duplex, page ranges)
- `Jobs` — print queue viewer with manual duplex continuation
- `Scanner` — device discovery, scan settings, file history with download/delete

**Path alias**: `@/` → `src/`.

**i18n**: `src/lib/i18n.tsx` + `src/lib/i18n.json` (zh/en). Use `const { t } = useTranslation()` and add keys to both locales in the JSON file.
