# N-up Printing (缩印) — Design Spec

## Summary

Add client-side N-up printing support to the Printers page, allowing users to combine 2, 4, or 6 document pages onto a single sheet of paper. The PDF is transformed in-browser using pdf-lib before submission; the server receives a ready-to-print N-up PDF with no API changes needed.

## Approach

**Client-side PDF transformation via pdf-lib page embedding.** The original PDF is opened with pdf-lib (already a project dependency), source pages are embedded as FormXObjects at scaled positions into new N-up output pages, and the result is saved as a new PDF blob. This preserves vector quality and requires no backend changes.

## UI

### Controls (in print settings panel, below Page Set / above Page Range)

- **N-up dropdown** (`printer.nup`): Off (1-up) / 2-up / 4-up / 6-up. Select element styled identically to Collate and Page Set.
- **Direction toggle** (`printer.nupDirection`): Horizontal-first / Vertical-first. Two radio-style card buttons (matching Duplex pattern), visible only when N-up > 1. Uses `py-2 px-3` for height alignment with sibling select.

### Preview

When N-up > 1, the DocumentPreview component groups existing page images in a CSS grid matching the N-up layout. No extra PDF rendering or API call needed — same `renderPdfToImages()` output, reflowed visually.

Grid dimensions:
| N-up | Grid |
|------|------|
| 2-up | 2 cols × 1 row |
| 4-up | 2 cols × 2 rows |
| 6-up | 3 cols × 2 rows |

Groups are labeled "Sheet N — Pages X–Y". Horizontal-first fills left→right then top→bottom. Vertical-first fills top→bottom then left→right.

## PDF Transformation

### `createNupPdf(file: File, nup: 2 | 4 | 6, direction: 'horizontal' | 'vertical'): Promise<Blob>`

New function in `src/lib/utils.ts`. Uses pdf-lib:

1. Open source PDF with `PDFDocument.load()`
2. Determine grid dimensions from N-up value
3. For each group of N source pages:
   - Create a new output page at A4 (595×842 pt)
   - For each slot: embed the source page via `pdf.embedPage()`, scale to fit the cell, draw at the correct grid position
4. If the last group has fewer than N pages, remaining slots are left blank
5. Call `pdf.save()` and return the blob

Page ordering per direction:
- **Horizontal-first**: fill row 0 left to right, then row 1 left to right, ...
- **Vertical-first**: fill column 0 top to bottom, then column 1 top to bottom, ...

## Data Flow

### On file select (no change)
POST `/jobs/preview` → `renderPdfToImages(blob)` → store images + page count

### On N-up setting change
- Re-group preview images via CSS grid (pure presentation change, no re-fetch)
- No effect on stored preview data

### On submit
1. If `nup === 1`: send original file (unchanged path)
2. If `nup > 1`: call `createNupPdf(file, nup, direction)` → get transformed blob, then:
   - Show loading state ("Transforming..." / spinner)
   - Send transformed blob as `file` in FormData to `POST /jobs?...`
   - All other params (copies, duplex, collate, pages) sent as-is

## State

Two new state variables in `Printers.tsx`:
- `nup`: `1 | 2 | 4 | 6` (default `1`)
- `nupDirection`: `'horizontal' | 'vertical'` (default `'horizontal'`)

## Edge Cases

| Case | Handling |
|------|----------|
| Single-page document | N-up controls disabled (nup forced to 1), matching existing duplex-disabled pattern |
| Page count not divisible by N | Last sheet has blank slots |
| N-up + page range | N-up applies to selected pages. If selection has ≤1 pages, N-up disabled |
| N-up + duplex | Duplex applies to output sheets (physical paper handling), works naturally |
| N-up + collate | Works naturally — N-up happens before collation logic |
| pdf-lib memory error | Catch and show error toast |

## Files Changed

| File | Change |
|------|--------|
| `src/lib/utils.ts` | Add `createNupPdf()` |
| `src/pages/Printers.tsx` | State, controls, preview grouping, submit transform |
| `src/components/DocumentPreview.tsx` | Accept optional `nup`/`nupDirection` props for grid layout |
| `src/lib/i18n.json` | Add keys: `printer.nup`, `printer.nupOff`, `printer.nupDirection`, `printer.nupHorizontal`, `printer.nupVertical`, `printer.nupTransforming` |
| `src/lib/utils.createNupPdf.test.ts` | New test file |

## i18n Keys

```
zh:
  printer.nup: "缩印"
  printer.nupOff: "关闭"
  printer.nupDirection: "排列方向"
  printer.nupHorizontal: "横向"
  printer.nupVertical: "纵向"
  printer.nupTransforming: "正在生成缩印..."

en:
  printer.nup: "N-up"
  printer.nupOff: "Off"
  printer.nupDirection: "Direction"
  printer.nupHorizontal: "Horizontal"
  printer.nupVertical: "Vertical"
  printer.nupTransforming: "Generating N-up layout..."
```
