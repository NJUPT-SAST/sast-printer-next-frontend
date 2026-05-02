# CLAUDE.md

## Commands

```bash
pnpm dev         # dev server on port 3000
pnpm build       # production build → dist/
pnpm start       # preview production build
pnpm lint        # ESLint
```

Tests (Vitest + Testing Library + jsdom):
```bash
pnpm vitest run                            # all tests once
pnpm vitest run src/lib/scannerApi.test.ts # single file
pnpm vitest                                 # watch mode
```

## Environment

Create `.env` from `.env.example`:
```
VITE_API_URL=http://localhost:5001
```

`/api` and `/sane-api` are proxied to `VITE_API_URL` by Vite in dev. In production the backend serves the frontend directly — no env vars needed.

## Architecture

**Stack**: React 19, TypeScript, Vite, Tailwind CSS 3, React Router DOM 7, Axios, pdfjs-dist, pdf-lib.

**Provider tree** (`App.tsx`):
```
LanguageProvider (i18n zh/en)
  └─ UiProvider (toast/confirm context)
       └─ AuthChecker (Feishu OAuth gate)
            └─ Header + Routes (/, /printers, /scanner)
```

**Auth flow** (`AuthChecker.tsx`): checks `localStorage.token` → if absent, fetches `/api/auth/config` for Feishu `app_id`, redirects to Feishu OAuth. On callback, exchanges `?code=` via `POST /api/auth/config/code-login`. Both API clients auto-retry on 401 once, then clear token and redirect to `/`.

**API clients** (`src/lib/`):
- `api.ts` — axios for `/api` (GoPrint backend), attaches `Authorization: Bearer` from localStorage
- `scannerApi.ts` — axios for `/sane-api/api/v1` (scanner), typed exports

**Pages** (`src/pages/`):
- `Home` — service selector (print / scan)
- `Printers` — file upload, PDF preview, print submission (duplex, page range, N-up)
- `Scanner` — device discovery, scan settings, file history with download/delete

**Path alias**: `@/` → `src/`. **i18n**: `src/lib/i18n.tsx` + `src/lib/i18n.json`, `useTranslation()` hook.

**Feishu JSSDK** (`src/lib/feishu.ts`): `openDocPicker()` via `tt.docsPicker()`, `enableLeaveConfirm()` for navigation guard. JSSDK config from `GET /api/auth/config/jssdk-config`.

**PDF handling**: Client-side only — `pdf-lib` for N-up/imposition, `pdfjs-dist` for preview rendering.

## Key Design Decisions

- **No state management library** — `useState`/`useEffect` only, no Redux/Zustand
- **Tailwind-only** — no CSS modules, `index.css` only has Tailwind directives
- **`MAX_IMAGES = 20`** hard limit in `src/lib/constants.ts`
- **`polyfills.ts`** — Map/WeakMap `getOrInsert` for older browsers

## Testing Patterns

- `axios-mock-adapter` for HTTP interception
- `vi.mock('pdf-lib')` for PDF stubs
- `vi.stubGlobal` for browser APIs (Image, document)

## CI/CD

`.github/workflows/build-and-export.yml`: push/PR to main on `src/**`/`public/**` → build with `STATIC_EXPORT=true` → upload artifact → dispatch to backend repo for sync.
