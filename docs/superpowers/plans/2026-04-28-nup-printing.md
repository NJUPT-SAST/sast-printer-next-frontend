# N-up Printing (缩印) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side N-up printing support (2-up, 4-up, 6-up) with horizontal/vertical direction, preview grid, and pdf-lib PDF transformation.

**Architecture:** New `createNupPdf()` utility in `src/lib/utils.ts` transforms the source PDF via pdf-lib page embedding. Printers.tsx gains two new state variables (`nup`, `nupDirection`) and UI controls. DocumentPreview accepts optional `nup`/`nupDirection` props to render a CSS grid instead of a page stack.

**Tech Stack:** React 19, TypeScript, pdf-lib (existing dep), Tailwind CSS 3, Vitest.

---

### Task 1: Add i18n keys

**Files:**
- Modify: `src/lib/i18n.json`

- [ ] **Step 1: Add zh keys after `"printer.collate": "逐份打印",` (around line 29)**

Insert these 6 keys into the `zh` section:

```json
"printer.nup": "缩印",
"printer.nupOff": "关闭",
"printer.nupDirection": "排列方向",
"printer.nupHorizontal": "横向",
"printer.nupVertical": "纵向",
"printer.nupTransforming": "正在生成缩印...",
```

- [ ] **Step 2: Add en keys after `"printer.collate": "Collate",` (around line 185)**

Insert these 6 keys into the `en` section:

```json
"printer.nup": "N-up",
"printer.nupOff": "Off",
"printer.nupDirection": "Direction",
"printer.nupHorizontal": "Horizontal",
"printer.nupVertical": "Vertical",
"printer.nupTransforming": "Generating N-up layout...",
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n.json
git commit -m "feat: add N-up printing i18n keys"
```

---

### Task 2: Add `createNupPdf()` to utils.ts

**Files:**
- Modify: `src/lib/utils.ts`
- Create: `src/lib/utils.createNupPdf.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/utils.createNupPdf.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createNupPdf } from './utils';
import { PDFDocument } from 'pdf-lib';

async function pdfPageCount(blob: Blob): Promise<number> {
  const doc = await PDFDocument.load(await blob.arrayBuffer());
  return doc.getPageCount();
}

async function makePdfBlob(pageCount: number): Promise<Blob> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([595, 842]);
  }
  const bytes = await doc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

function blobToFile(blob: Blob, name = 'test.pdf'): File {
  return new File([blob], name, { type: 'application/pdf' });
}

describe('createNupPdf', () => {
  it('2-up: 4-page doc produces 2 output sheets', async () => {
    const src = blobToFile(await makePdfBlob(4));
    const out = await createNupPdf(src, 2, 'horizontal');
    expect(await pdfPageCount(out)).toBe(2);
  });

  it('4-up: 8-page doc produces 2 output sheets', async () => {
    const src = blobToFile(await makePdfBlob(8));
    const out = await createNupPdf(src, 4, 'horizontal');
    expect(await pdfPageCount(out)).toBe(2);
  });

  it('6-up: 6-page doc produces 1 output sheet', async () => {
    const src = blobToFile(await makePdfBlob(6));
    const out = await createNupPdf(src, 6, 'horizontal');
    expect(await pdfPageCount(out)).toBe(1);
  });

  it('odd page count: 5 pages, 4-up produces 2 sheets (last has blank slots)', async () => {
    const src = blobToFile(await makePdfBlob(5));
    const out = await createNupPdf(src, 4, 'horizontal');
    expect(await pdfPageCount(out)).toBe(2);
  });

  it('single page with 4-up produces 1 sheet', async () => {
    const src = blobToFile(await makePdfBlob(1));
    const out = await createNupPdf(src, 4, 'horizontal');
    expect(await pdfPageCount(out)).toBe(1);
  });

  it('output page size is A4 (595x842)', async () => {
    const src = blobToFile(await makePdfBlob(4));
    const out = await createNupPdf(src, 2, 'horizontal');
    const doc = await PDFDocument.load(await out.arrayBuffer());
    const page = doc.getPage(0);
    expect(page.getSize().width).toBe(595);
    expect(page.getSize().height).toBe(842);
  });

  it('vertical-first direction', async () => {
    const src = blobToFile(await makePdfBlob(4));
    const out = await createNupPdf(src, 4, 'vertical');
    expect(await pdfPageCount(out)).toBe(1);
  });

  it('nup=1 returns same page count unchanged', async () => {
    const src = blobToFile(await makePdfBlob(3));
    const out = await createNupPdf(src, 1, 'horizontal');
    expect(await pdfPageCount(out)).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/lib/utils.createNupPdf.test.ts
```
Expected: FAIL — `createNupPdf is not exported`

- [ ] **Step 3: Implement `createNupPdf()` in `src/lib/utils.ts`**

Add after the `imagesToPdf` function (after line 87):

```typescript
type NupValue = 2 | 4 | 6;

const NUP_GRIDS: Record<NupValue, { cols: number; rows: number }> = {
  2: { cols: 2, rows: 1 },
  4: { cols: 2, rows: 2 },
  6: { cols: 3, rows: 2 },
};

const A4 = { width: 595, height: 842 };

export const createNupPdf = async (
  file: File,
  nup: NupValue | 1,
  direction: 'horizontal' | 'vertical',
): Promise<Blob> => {
  if (nup === 1) return new Blob([await file.arrayBuffer()], { type: 'application/pdf' });

  const { PDFDocument } = await import('pdf-lib');
  const srcBytes = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(srcBytes);
  const totalPages = srcDoc.getPageCount();

  const outDoc = await PDFDocument.create();
  const embeddedPages = await outDoc.embedPdf(srcDoc);

  const { cols, rows } = NUP_GRIDS[nup];
  const cellW = A4.width / cols;
  const cellH = A4.height / rows;

  const sheetCount = Math.ceil(totalPages / nup);

  for (let sheet = 0; sheet < sheetCount; sheet++) {
    const page = outDoc.addPage([A4.width, A4.height]);

    for (let slot = 0; slot < nup; slot++) {
      const srcIdx = sheet * nup + slot;
      if (srcIdx >= totalPages) break;

      let col: number;
      let row: number;
      if (direction === 'vertical') {
        col = Math.floor(slot / rows);
        row = slot % rows;
      } else {
        col = slot % cols;
        row = Math.floor(slot / cols);
      }

      const x = col * cellW;
      const y = A4.height - (row + 1) * cellH;

      page.drawPage(embeddedPages[srcIdx], { x, y, width: cellW, height: cellH });
    }
  }

  const bytes = await outDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run src/lib/utils.createNupPdf.test.ts
```
Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.ts src/lib/utils.createNupPdf.test.ts
git commit -m "feat: add createNupPdf utility for N-up printing"
```

---

### Task 3: Update DocumentPreview for N-up grid layout

**Files:**
- Modify: `src/components/DocumentPreview.tsx`
- Modify: `src/components/DocumentPreview.test.tsx`

- [ ] **Step 1: Add N-up props to the interface**

In `src/components/DocumentPreview.tsx`, change the `DocumentPreviewProps` interface (lines 38-44) to:

```typescript
export interface DocumentPreviewProps {
  images: string[];
  loading?: boolean;
  error?: string | null;
  loadingText?: string;
  fallbackNode?: React.ReactNode;
  nup?: 2 | 4 | 6;
  nupDirection?: 'horizontal' | 'vertical';
}
```

And update the destructuring (line 47):

```typescript
export function DocumentPreview({
  images,
  loading,
  error,
  loadingText,
  fallbackNode,
  nup,
  nupDirection = 'horizontal',
}: DocumentPreviewProps) {
```

- [ ] **Step 2: Replace the return statement (lines 55-87) with N-up grid support**

Replace the entire return block with:

```typescript
  const renderNupGrid = () => {
    if (!nup || nup <= 1) return null;
    const cols = nup === 6 ? 3 : 2;
    const rows = nup === 2 ? 1 : 2;
    const perSheet = nup;
    const sheetCount = Math.ceil(images.length / perSheet);
    const sheets: JSX.Element[] = [];

    for (let s = 0; s < sheetCount; s++) {
      const sheetImages: { idx: number; src: string }[] = [];
      for (let slot = 0; slot < perSheet; slot++) {
        const srcIdx = s * perSheet + slot;
        if (srcIdx >= images.length) break;
        sheetImages.push({ idx: srcIdx, src: images[srcIdx] });
      }

      const startPage = s * perSheet + 1;
      const endPage = Math.min((s + 1) * perSheet, images.length);

      sheets.push(
        <div key={`sheet-${s}`} className="bg-white rounded-lg border border-gray-200 shadow-sm p-2">
          <p className="text-xs text-gray-500 mb-2">
            Sheet {s + 1} — Pages {startPage}–{endPage}
          </p>
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
          >
            {sheetImages.map(({ idx, src }) => (
              <img
                key={`page-${idx}`}
                src={src}
                alt={t('printer.previewPage', { page: idx + 1 })}
                className="w-full h-auto rounded border border-gray-100"
              />
            ))}
            {Array.from({ length: perSheet - sheetImages.length }).map((_, i) => (
              <div key={`blank-${i}`} className="aspect-[3/4] bg-gray-100 rounded border border-gray-200" />
            ))}
          </div>
        </div>,
      );
    }
    return sheets;
  };

  const isNup = nup && nup > 1 && images.length > 0;

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex flex-col flex-1 min-h-0">
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          {loadingText || t('printer.previewGenerating')}
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center px-6 text-center text-red-600 text-sm">
          {error}
        </div>
      ) : isNup ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gray-100">
          {renderNupGrid()}
        </div>
      ) : images.length > 0 ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gray-100">
          {images.map((image, index) => (
            <div
              key={`preview-page-${index + 1}`}
              className="bg-white rounded-lg border border-gray-200 shadow-sm p-2"
            >
              <p className="text-xs text-gray-500 mb-2">
                {t('printer.previewPage', { page: index + 1 })}
              </p>
              <img
                src={image}
                alt={t('printer.previewPage', { page: index + 1 })}
                className="w-full h-auto rounded"
              />
            </div>
          ))}
        </div>
      ) : fallbackNode ?? null}
    </div>
  );
}
```

- [ ] **Step 3: Add new tests for N-up grid**

In `src/components/DocumentPreview.test.tsx`, add before the closing `});` of the describe block:

```typescript
  it('renders N-up grid layout for 4-up', () => {
    const images = ['p1.png', 'p2.png', 'p3.png', 'p4.png'];
    const { container } = render(
      <DocumentPreview images={images} nup={4} nupDirection="horizontal" />
    );
    expect(container.querySelectorAll('img')).toHaveLength(4);
    expect(screen.getByText(/Sheet 1/)).toBeInTheDocument();
  });

  it('renders blank slots for odd pages in N-up', () => {
    const images = ['p1.png', 'p2.png', 'p3.png'];
    const { container } = render(
      <DocumentPreview images={images} nup={4} nupDirection="horizontal" />
    );
    expect(container.querySelectorAll('img')).toHaveLength(3);
  });

  it('does not render N-up grid when nup is 1', () => {
    const images = ['p1.png', 'p2.png'];
    const { container } = render(
      <DocumentPreview images={images} nup={1} />
    );
    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(screen.getByText('printer.previewPage{"page":1}')).toBeInTheDocument();
  });
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run src/components/DocumentPreview.test.tsx
```
Expected: all 7 tests PASS (4 existing + 3 new)

- [ ] **Step 5: Commit**

```bash
git add src/components/DocumentPreview.tsx src/components/DocumentPreview.test.tsx
git commit -m "feat: add N-up grid layout to DocumentPreview"
```

---

### Task 4: Add N-up controls and submit transform to Printers.tsx

**Files:**
- Modify: `src/pages/Printers.tsx`

- [ ] **Step 1: Add `createNupPdf` to import**

Change line 12 from:
```typescript
import { apiErrMsg, parseGMTDate, downloadFile, imagesToPdf } from '@/lib/utils';
```
To:
```typescript
import { apiErrMsg, parseGMTDate, downloadFile, imagesToPdf, createNupPdf } from '@/lib/utils';
```

- [ ] **Step 2: Add state variables**

After line 56 (`const [pagesError, setPagesError] = useState('');`), add:
```typescript
  const [nup, setNup] = useState<1 | 2 | 4 | 6>(1);
  const [nupDirection, setNupDirection] = useState<'horizontal' | 'vertical'>('horizontal');
```

- [ ] **Step 3: Add `isNupDisabled` computed value**

After line 187 (`const isDuplexDisabled = ...`), add:
```typescript
  const isNupDisabled = (previewPageCount !== null && previewPageCount <= 1) || (selectedPageCount !== null && selectedPageCount <= 1);
```

- [ ] **Step 4: Add useEffect to force nup=1 when disabled**

After the duplex-disabled effect (after line 339), add:
```typescript
  useEffect(() => {
    if (isNupDisabled && nup !== 1) {
      setNup(1);
    }
  }, [isNupDisabled, nup]);
```

- [ ] **Step 5: Add N-up controls in settings panel**

Change the grid from `sm:grid-cols-3` to `sm:grid-cols-4` on line 773:
```typescript
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-4 mt-6 shrink-0">
```

Insert the N-up dropdown as the 3rd column (between Collate and Page Set). After the Collate `</select>` block ending `</div>` (end of line 796), add:
```tsx
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('printer.nup')}</label>
              <select
                value={nup}
                onChange={(e) => setNup(parseInt(e.target.value) as 1 | 2 | 4 | 6)}
                disabled={isNupDisabled}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white transition-shadow appearance-none disabled:opacity-50"
              >
                <option value={1}>{t('printer.nupOff')}</option>
                <option value={2}>2-up</option>
                <option value={4}>4-up</option>
                <option value={6}>6-up</option>
              </select>
            </div>
```

After the 4-column row's Page Set select but before the Page Range row, add the direction toggle as a full-width conditional row:
```tsx
            {nup > 1 && (
              <div className="sm:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('printer.nupDirection')}</label>
                <div className="flex gap-4">
                  <label className={`flex-1 flex items-center py-2 px-3 border rounded-xl cursor-pointer transition-colors ${nupDirection === 'horizontal' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="nupDirection"
                      value="horizontal"
                      checked={nupDirection === 'horizontal'}
                      onChange={() => setNupDirection('horizontal')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-900">{t('printer.nupHorizontal')}</span>
                  </label>
                  <label className={`flex-1 flex items-center py-2 px-3 border rounded-xl cursor-pointer transition-colors ${nupDirection === 'vertical' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="nupDirection"
                      value="vertical"
                      checked={nupDirection === 'vertical'}
                      onChange={() => setNupDirection('vertical')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-900">{t('printer.nupVertical')}</span>
                  </label>
                </div>
              </div>
            )}
```

Also change all `sm:col-span-3` to `sm:col-span-4` since the grid now has 4 columns. This affects:
- Page Range row (line 811): change `sm:col-span-3` → `sm:col-span-4`
- Duplex row (line 832): change `sm:col-span-3` → `sm:col-span-4`

- [ ] **Step 6: Pass nup props to DocumentPreview**

On line 903, change:
```tsx
              <DocumentPreview
                images={previewImages}
                loading={previewLoading || merging}
                error={previewError}
              />
```
To:
```tsx
              <DocumentPreview
                images={previewImages}
                loading={previewLoading || merging}
                error={previewError}
                nup={nup === 1 ? undefined : nup}
                nupDirection={nupDirection}
              />
```

- [ ] **Step 7: Update submit handler to transform PDF**

In `handleSubmit`, after the page range validation block (after `setSubmitting(true);` line ~481 and the FormData construction), add the N-up transform. Find where `formData.append('file', file)` is (line 485) and replace the block from `setSubmitting(true);` through the FormData construction:

```typescript
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('printer_id', id || '');

      let fileToSubmit = file;
      if (nup > 1) {
        fileToSubmit = new File(
          [await createNupPdf(file, nup, nupDirection)],
          file.name.replace(/\.[^.]+$/, '') + '_nup.pdf',
          { type: 'application/pdf' },
        );
      }
      formData.append('file', fileToSubmit);
```

- [ ] **Step 8: Run TypeScript check and full test suite**

```bash
npx tsc --noEmit
pnpm vitest run
```
Expected: no type errors, all tests pass

- [ ] **Step 9: Commit**

```bash
git add src/pages/Printers.tsx
git commit -m "feat: add N-up controls and submit transform to Printers page"
```

---

### Task 5: Manual end-to-end verification

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Verify golden path**

1. Open http://localhost:3000/printers, select a printer
2. Upload a multi-page PDF
3. N-up dropdown is Off by default; preview shows single pages
4. Select 4-up → direction toggle appears; preview shows 2×2 grid
5. Toggle vertical → preview re-groups (columns fill top→bottom)
6. Select 2-up → preview shows 2-column layout
7. Select 6-up → preview shows 3×2 layout
8. Submit a print job with N-up enabled

- [ ] **Step 3: Verify edge cases**

1. Single-page PDF → N-up dropdown is disabled (grayed out)
2. Switch to a different printer → N-up resets to Off

- [ ] **Step 4: Run full test suite**

```bash
pnpm vitest run
```
Expected: all tests pass
