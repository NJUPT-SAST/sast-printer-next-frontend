# Batch Image Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to upload multiple images, reorder them via drag-and-drop, and print them as a single merged PDF using existing print settings.

**Architecture:** Add `imageFiles: File[]` state to `PrinterContent`; when images are detected, merge them client-side into a PDF Blob via `pdf-lib` and assign to the existing `file` state so all downstream preview/submit logic is unchanged. A new `ImageFileList` component handles the list UI, internal reorder (via `@dnd-kit/sortable`), and external file drop interactions.

**Tech Stack:** React 19, TypeScript, pdf-lib, @dnd-kit/core, @dnd-kit/sortable, Tailwind CSS 3, Vitest

---

## File Map



| Action | Path | What changes |
|--------|------|-------------|
| Modify | `src/lib/utils.ts` | Add `imagesToPdf`, `normalizeImageToJpeg` |
| Modify | `src/lib/i18n.json` | Add 8 new translation keys |
| Create | `src/components/ImageFileList.tsx` | New component: list + drag interactions |
| Modify | `src/pages/Printers.tsx` | Wire image mode: state, detection, merge trigger |
| Create | `src/lib/utils.imagesToPdf.test.ts` | Unit tests for `imagesToPdf` |

---

## Task 1: Install dependencies

**Files:** `package.json`

- [ ] **Step 1: Install pdf-lib and dnd-kit**

```bash
pnpm add pdf-lib @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: packages added to `dependencies` in `package.json`.

- [ ] **Step 2: Verify build still passes**

```bash
pnpm build
```

Expected: `✓ built in ...`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add pdf-lib and dnd-kit dependencies"
```

---

## Task 2: Add i18n keys

**Files:** `src/lib/i18n.json`

- [ ] **Step 1: Add keys to zh locale** — insert after `"printer.timeLeft"` line:

```json
"printer.addMoreImages": "添加更多图片",
"printer.imageCount": "共 {count} 张图片",
"printer.merging": "正在合并...",
"printer.replaceImage": "更换",
"printer.imageLimitReached": "最多上传 20 张图片",
"printer.dropToReplace": "松开替换",
"printer.dropToInsert": "松开插入",
"printer.dropToAdd": "松开添加",
```

- [ ] **Step 2: Add keys to en locale** — insert after `"printer.timeLeft"` line:

```json
"printer.addMoreImages": "Add more images",
"printer.imageCount": "{count} images",
"printer.merging": "Merging...",
"printer.replaceImage": "Replace",
"printer.imageLimitReached": "Maximum 20 images allowed",
"printer.dropToReplace": "Drop to replace",
"printer.dropToInsert": "Drop to insert",
"printer.dropToAdd": "Drop to add",
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n.json
git commit -m "feat(i18n): add batch image print translation keys"
```

---

## Task 3: Add `imagesToPdf` to utils

**Files:** `src/lib/utils.ts`, `src/lib/utils.imagesToPdf.test.ts`

- [ ] **Step 1: Write failing test** — create `src/lib/utils.imagesToPdf.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pdf-lib
const mockDrawImage = vi.fn();
const mockAddPage = vi.fn(() => ({ drawImage: mockDrawImage }));
const mockEmbedPng = vi.fn(async () => ({ width: 100, height: 200 }));
const mockEmbedJpg = vi.fn(async () => ({ width: 300, height: 400 }));
const mockSave = vi.fn(async () => new Uint8Array([1, 2, 3]));
const mockCreate = vi.fn(async () => ({
  embedPng: mockEmbedPng,
  embedJpg: mockEmbedJpg,
  addPage: mockAddPage,
  save: mockSave,
}));

vi.mock('pdf-lib', () => ({
  PDFDocument: { create: mockCreate },
}));

// Mock canvas for non-PNG/JPEG conversion
const mockToBlob = vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['fake'], { type: 'image/jpeg' })));
const mockGetContext = vi.fn(() => ({ drawImage: vi.fn() }));
vi.stubGlobal('document', {
  createElement: vi.fn((tag: string) => {
    if (tag === 'canvas') return { getContext: mockGetContext, toBlob: mockToBlob, width: 0, height: 0 };
    return {};
  }),
});
vi.stubGlobal('Image', class {
  onload: (() => void) | null = null;
  src = '';
  width = 100;
  height = 100;
  set src(v: string) { setTimeout(() => this.onload?.(), 0); }
});
vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() });

import { imagesToPdf } from './utils';

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue({
    embedPng: mockEmbedPng,
    embedJpg: mockEmbedJpg,
    addPage: mockAddPage,
    save: mockSave,
  });
  mockAddPage.mockReturnValue({ drawImage: mockDrawImage });
  mockEmbedPng.mockResolvedValue({ width: 100, height: 200 });
  mockEmbedJpg.mockResolvedValue({ width: 300, height: 400 });
  mockSave.mockResolvedValue(new Uint8Array([1, 2, 3]));
});

describe('imagesToPdf', () => {
  it('returns a PDF Blob', async () => {
    const file = new File(['fake png data'], 'test.png', { type: 'image/png' });
    vi.spyOn(file, 'arrayBuffer').mockResolvedValue(new ArrayBuffer(8));
    const result = await imagesToPdf([file]);
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('application/pdf');
  });

  it('uses embedPng for .png files', async () => {
    const file = new File([''], 'photo.png', { type: 'image/png' });
    vi.spyOn(file, 'arrayBuffer').mockResolvedValue(new ArrayBuffer(8));
    await imagesToPdf([file]);
    expect(mockEmbedPng).toHaveBeenCalledTimes(1);
    expect(mockEmbedJpg).not.toHaveBeenCalled();
  });

  it('uses embedJpg for .jpg files', async () => {
    const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
    vi.spyOn(file, 'arrayBuffer').mockResolvedValue(new ArrayBuffer(8));
    await imagesToPdf([file]);
    expect(mockEmbedJpg).toHaveBeenCalledTimes(1);
    expect(mockEmbedPng).not.toHaveBeenCalled();
  });

  it('adds one page per image', async () => {
    const files = [
      new File([''], 'a.png', { type: 'image/png' }),
      new File([''], 'b.jpg', { type: 'image/jpeg' }),
    ];
    for (const f of files) vi.spyOn(f, 'arrayBuffer').mockResolvedValue(new ArrayBuffer(8));
    await imagesToPdf(files);
    expect(mockAddPage).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/lib/utils.imagesToPdf.test.ts
```

Expected: FAIL — `imagesToPdf is not a function` or similar.

- [ ] **Step 3: Implement `imagesToPdf` in `src/lib/utils.ts`** — append after the existing `createApiClient` export:

```typescript
const normalizeImageToJpeg = (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) { reject(new Error('canvas.toBlob failed')); return; }
        blob.arrayBuffer().then(resolve).catch(reject);
      }, 'image/jpeg', 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
    img.src = objectUrl;
  });

export const imagesToPdf = async (files: File[]): Promise<Blob> => {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    let image;
    if (ext === 'png') {
      const buf = await file.arrayBuffer();
      image = await pdf.embedPng(buf);
    } else if (ext === 'jpg' || ext === 'jpeg') {
      const buf = await file.arrayBuffer();
      image = await pdf.embedJpg(buf);
    } else {
      const buf = await normalizeImageToJpeg(file);
      image = await pdf.embedJpg(buf);
    }
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run src/lib/utils.imagesToPdf.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.ts src/lib/utils.imagesToPdf.test.ts
git commit -m "feat: add imagesToPdf utility with canvas fallback for non-PNG/JPEG"
```

---

## Task 4: Create `ImageFileList` component

**Files:**
- Create: `src/components/ImageFileList.tsx`

This component receives the image list and all callbacks from `Printers.tsx`. It handles:
1. Internal drag-to-reorder via `@dnd-kit/sortable`
2. External file drop (replace / insert / add) via HTML5 drag events
3. Thumbnail display, replace button (single-file picker), delete button

- [ ] **Step 1: Create `src/components/ImageFileList.tsx`**

```tsx
import { useRef, useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, ImageIcon } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,image/bmp';
const MAX_IMAGES = 20;

interface ImageFileListProps {
  files: File[];
  onReorder: (files: File[]) => void;
  onReplace: (index: number, file: File) => void;
  onDelete: (index: number) => void;
  onAdd: (files: File[]) => void;
  limitReached: boolean;
}

// ── Sortable row ──────────────────────────────────────────────────────────────

interface RowProps {
  file: File;
  index: number;
  id: string;
  onReplace: (index: number, file: File) => void;
  onDelete: (index: number) => void;
  onExternalDragOver: (e: React.DragEvent, zone: 'replace' | 'insert-before') => void;
  onExternalDrop: (e: React.DragEvent, zone: 'replace' | 'insert-before', index: number) => void;
  onExternalDragLeave: () => void;
  dropTarget: { type: 'replace' | 'insert-before' | 'add'; index: number } | null;
}

function SortableRow({
  file, index, id, onReplace, onDelete,
  onExternalDragOver, onExternalDrop, onExternalDragLeave, dropTarget,
}: RowProps) {
  const { t } = useTranslation();
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const thumbnailUrl = URL.createObjectURL(file);

  const isReplaceTarget = dropTarget?.type === 'replace' && dropTarget.index === index;
  const isInsertTarget = dropTarget?.type === 'insert-before' && dropTarget.index === index;

  return (
    <>
      {/* Insert-before line */}
      {isInsertTarget && (
        <div className="h-0.5 bg-blue-500 rounded mx-2 relative">
          <span className="absolute -top-3 left-2 text-xs text-blue-600 bg-white px-1 rounded shadow">
            {t('printer.dropToInsert')}
          </span>
        </div>
      )}

      <div
        ref={setNodeRef}
        style={style}
        className={`relative flex items-center gap-3 p-3 rounded-xl border transition-colors
          ${isReplaceTarget
            ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-300'
            : 'border-gray-200 bg-white hover:border-gray-300'}`}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const zone = e.clientY < rect.top + rect.height / 2 ? 'insert-before' : 'replace';
          onExternalDragOver(e, zone);
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const zone = e.clientY < rect.top + rect.height / 2 ? 'insert-before' : 'replace';
          onExternalDrop(e, zone, index);
        }}
        onDragLeave={onExternalDragLeave}
      >
        {/* Drag handle */}
        <button
          type="button"
          className="cursor-grab text-gray-400 hover:text-gray-600 shrink-0 touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Thumbnail */}
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
          <img
            src={thumbnailUrl}
            alt={file.name}
            className="w-full h-full object-cover"
            onLoad={() => URL.revokeObjectURL(thumbnailUrl)}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
          <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>

        {/* Replace */}
        <button
          type="button"
          className="text-xs text-blue-600 hover:text-blue-800 shrink-0 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
          onClick={() => replaceInputRef.current?.click()}
        >
          {t('printer.replaceImage')}
        </button>
        <input
          ref={replaceInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onReplace(index, f);
            e.target.value = '';
          }}
        />

        {/* Delete */}
        <button
          type="button"
          className="text-gray-400 hover:text-red-500 shrink-0 transition-colors"
          onClick={() => onDelete(index)}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Replace overlay badge */}
        {isReplaceTarget && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="bg-orange-500 text-white text-xs font-semibold px-2 py-1 rounded-full shadow">
              {t('printer.dropToReplace')}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ImageFileList({ files, onReorder, onReplace, onDelete, onAdd, limitReached }: ImageFileListProps) {
  const { t } = useTranslation();
  const addInputRef = useRef<HTMLInputElement>(null);
  const [dropTarget, setDropTarget] = useState<{ type: 'replace' | 'insert-before' | 'add'; index: number } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const ids = files.map((_, i) => `img-${i}`);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      onReorder(arrayMove(files, oldIndex, newIndex));
    }
  };

  const handleExternalDragOver = useCallback((
    e: React.DragEvent,
    zone: 'replace' | 'insert-before',
    index?: number,
  ) => {
    e.preventDefault();
    setDropTarget(index !== undefined ? { type: zone, index } : null);
  }, []);

  const handleExternalDrop = useCallback((
    e: React.DragEvent,
    zone: 'replace' | 'insert-before',
    index: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const incoming = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (!incoming.length) return;
    if (zone === 'replace') {
      onReplace(index, incoming[0]);
    } else {
      // insert-before: splice at index
      const next = [...files];
      const toInsert = incoming.slice(0, MAX_IMAGES - files.length);
      next.splice(index, 0, ...toInsert);
      onReorder(next);
    }
  }, [files, onReplace, onReorder]);

  const handleAddZoneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const incoming = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (incoming.length) onAdd(incoming);
  }, [onAdd]);

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {files.map((file, index) => (
            <SortableRow
              key={`${file.name}-${index}`}
              id={ids[index]}
              file={file}
              index={index}
              onReplace={onReplace}
              onDelete={onDelete}
              onExternalDragOver={(e, zone) => handleExternalDragOver(e, zone, index)}
              onExternalDrop={handleExternalDrop}
              onExternalDragLeave={() => setDropTarget(null)}
              dropTarget={dropTarget}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add zone */}
      <div
        className={`flex items-center justify-between p-3 rounded-xl border-2 border-dashed transition-colors
          ${dropTarget?.type === 'add'
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 hover:border-blue-300'}`}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          setDropTarget({ type: 'add', index: -1 });
        }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={handleAddZoneDrop}
      >
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ImageIcon className="w-4 h-4" />
          <span>{t('printer.imageCount', { count: files.length })}</span>
          {dropTarget?.type === 'add' && (
            <span className="text-blue-600 font-medium">{t('printer.dropToAdd')}</span>
          )}
        </div>
        {!limitReached && (
          <button
            type="button"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            onClick={() => addInputRef.current?.click()}
          >
            + {t('printer.addMoreImages')}
          </button>
        )}
        <input
          ref={addInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files || []);
            if (picked.length) onAdd(picked);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | head -30
```

Expected: no TypeScript errors related to `ImageFileList.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ImageFileList.tsx
git commit -m "feat: add ImageFileList component with sortable reorder and external drop"
```

---

## Task 5: Wire image mode into `Printers.tsx`

**Files:** `src/pages/Printers.tsx`

This task adds `imageFiles` state, mode detection, merge trigger, and replaces the upload area with `ImageFileList` when in image mode.

- [ ] **Step 1: Add imports and state** — at the top of `PrinterContent`, add after existing imports:

```tsx
import ImageFileList from '@/components/ImageFileList';
import { imagesToPdf } from '@/lib/utils';
```

Add these state variables after the existing `const [isDragging, setIsDragging] = useState(false);` line:

```tsx
const [imageFiles, setImageFiles] = useState<File[]>([]);
const [merging, setMerging] = useState(false);
```

- [ ] **Step 2: Add image type detection helper** — add after `isSupportedFile`:

```tsx
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);
const isImageFile = (f: File) => IMAGE_EXTS.has(getFileExtension(f.name));
const MAX_IMAGES = 20;
```

- [ ] **Step 3: Add merge effect** — add after the existing `useEffect` for `previewPdfUrl` cleanup (around line 299):

```tsx
useEffect(() => {
  if (imageFiles.length === 0) return;
  let cancelled = false;
  const merge = async () => {
    setMerging(true);
    try {
      const blob = await imagesToPdf(imageFiles);
      if (!cancelled) {
        setFile(new File([blob], 'images.pdf', { type: 'application/pdf' }));
      }
    } finally {
      if (!cancelled) setMerging(false);
    }
  };
  merge();
  return () => { cancelled = true; };
}, [imageFiles]);
```

- [ ] **Step 4: Update `handleFileChange` to detect image mode** — replace the existing `handleFileChange` function:

```tsx
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  if (isImageFile(files[0])) {
    const valid = files.filter(isImageFile);
    handleAddImages(valid);
  } else {
    if (!isSupportedFile(files[0])) { rejectUnsupportedFile(); return; }
    setImageFiles([]);
    setFile(files[0]);
  }
  if (fileInputRef.current) fileInputRef.current.value = '';
};
```

- [ ] **Step 5: Add image management handlers** — add after `handleFileChange`:

```tsx
const handleAddImages = (incoming: File[]) => {
  setImageFiles((prev) => {
    const available = MAX_IMAGES - prev.length;
    if (available <= 0) {
      toast({ message: t('printer.imageLimitReached'), type: 'error' });
      return prev;
    }
    const toAdd = incoming.slice(0, available);
    if (incoming.length > available) {
      toast({ message: t('printer.imageLimitReached'), type: 'error' });
    }
    return [...prev, ...toAdd];
  });
};

const handleReplaceImage = (index: number, newFile: File) => {
  setImageFiles((prev) => prev.map((f, i) => (i === index ? newFile : f)));
};

const handleDeleteImage = (index: number) => {
  setImageFiles((prev) => {
    const next = prev.filter((_, i) => i !== index);
    if (next.length === 0) setFile(null);
    return next;
  });
};
```

- [ ] **Step 6: Update `handleDrop` to detect image mode** — replace the existing `handleDrop` function:

```tsx
const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter.current = 0;
  setIsDragging(false);
  if (!e.dataTransfer.files?.length) return;
  const first = e.dataTransfer.files[0];
  if (isImageFile(first)) {
    const images = Array.from(e.dataTransfer.files).filter(isImageFile);
    handleAddImages(images);
  } else {
    if (isSupportedFile(first)) {
      setImageFiles([]);
      setFile(first);
    } else {
      rejectUnsupportedFile();
    }
  }
};
```

- [ ] **Step 7: Update file input to support multi-select for images** — in the JSX, find the `<input type="file" ...>` inside the upload area and add `multiple`:

```tsx
<input
  type="file"
  accept={acceptValue}
  multiple
  className="hidden"
  ref={fileInputRef}
  onChange={handleFileChange}
/>
```

- [ ] **Step 8: Replace upload area with `ImageFileList` when in image mode** — in the JSX, find the upload drop zone `<div className={`group border-2 border-dashed ...`}>` block. Replace the entire block (from the outer `<div className="mb-6">` wrapper through its closing `</div>`) with:

```tsx
<div className="mb-6">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    {t('printer.selectFile')} <span className="text-red-500">*</span>
  </label>

  {imageFiles.length > 0 ? (
    <ImageFileList
      files={imageFiles}
      onReorder={setImageFiles}
      onReplace={handleReplaceImage}
      onDelete={handleDeleteImage}
      onAdd={handleAddImages}
      limitReached={imageFiles.length >= MAX_IMAGES}
    />
  ) : (
    <div
      className={`group border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
        ${isDragging ? 'border-blue-500 bg-blue-50' : file ? 'border-green-300 bg-green-50 hover:border-blue-400 hover:bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 bg-gray-50'}`}
      onClick={() => fileInputRef.current?.click()}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept={acceptValue}
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      {file ? (
        <div className="flex flex-col items-center pointer-events-none">
          <FileText className={`w-10 h-10 mb-3 transition-colors ${isDragging ? 'text-blue-500' : 'text-green-600 group-hover:text-blue-500'}`} />
          <span className={`font-medium transition-colors ${isDragging ? 'text-blue-700' : 'text-green-800 group-hover:text-blue-700'}`}>{file.name}</span>
          <span className={`text-xs mt-1 transition-colors ${isDragging ? 'text-blue-600' : 'text-green-600 group-hover:text-blue-600'}`}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          <button type="button" className={`mt-3 text-xs underline pointer-events-auto transition-colors ${isDragging ? 'text-blue-600' : 'text-green-600 group-hover:text-blue-600'}`} onClick={(e) => {
            e.stopPropagation();
            setFile(null);
            setPreviewVersion(0);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}>{t('printer.changeFile')}</button>
        </div>
      ) : (
        <div className="flex flex-col items-center pointer-events-none">
          <UploadCloud className={`w-10 h-10 mb-3 transition-colors ${isDragging ? 'text-blue-500' : 'text-gray-400 group-hover:text-blue-500'}`} />
          <span className={`font-medium transition-colors ${isDragging ? 'text-blue-600' : 'text-gray-600 group-hover:text-blue-600'}`}>{t('printer.tapToSelectWithTypes')}</span>
          <span className="text-xs text-gray-400 mt-1">{supportedTypesText}</span>
        </div>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 9: Disable submit while merging** — find the submit button's `disabled` prop and add `|| merging`:

```tsx
disabled={!file || submitting || duplex === '' || merging}
```

Also update the button's disabled style condition:

```tsx
${!file || submitting || duplex === '' || merging
  ? 'bg-blue-300 cursor-not-allowed'
  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 hover:shadow'}
```

- [ ] **Step 10: Show merging state in preview area** — find the preview section (`{file && (...)}`). Inside `DocumentPreview`, add a merging overlay. Replace:

```tsx
<DocumentPreview
  images={previewImages}
  loading={previewLoading}
  error={previewError}
/>
```

with:

```tsx
<DocumentPreview
  images={previewImages}
  loading={previewLoading || merging}
  error={previewError}
/>
```

And update the preview section header to show merging text when merging:

```tsx
<h2 className="text-lg font-semibold text-gray-900 mb-4">
  {merging ? t('printer.merging') : t('printer.preview')}
</h2>
```

- [ ] **Step 11: Build and verify**

```bash
pnpm build 2>&1 | head -40
```

Expected: `✓ built in ...` with no errors.

- [ ] **Step 12: Commit**

```bash
git add src/pages/Printers.tsx
git commit -m "feat: wire image mode into Printers page with batch upload and merge"
```

---

## Task 6: Manual smoke test

- [ ] **Step 1: Start dev server** (run manually in terminal)

```bash
pnpm dev
```

- [ ] **Step 2: Test single-file mode (regression)**
  - Navigate to a printer page
  - Upload a PDF → verify preview loads, submit works
  - Upload a non-image non-PDF (e.g. .docx if supported) → verify it works

- [ ] **Step 3: Test image mode — basic upload**
  - Upload a single JPG → verify `ImageFileList` appears with thumbnail
  - Verify preview area shows merged PDF
  - Submit → verify job appears in queue

- [ ] **Step 4: Test image mode — add more**
  - Click "+ 添加更多图片" → select 2 more images → verify list shows 3 items
  - Verify count label updates

- [ ] **Step 5: Test image mode — reorder**
  - Drag a row by its handle to a different position → verify order changes
  - Verify preview updates after reorder

- [ ] **Step 6: Test image mode — replace**
  - Click "更换" on a row → select a different image → verify thumbnail updates

- [ ] **Step 7: Test image mode — delete**
  - Delete all but one image → verify list still shows
  - Delete last image → verify upload area returns to original state

- [ ] **Step 8: Test external drop — add zone**
  - Drag an image from OS onto the bottom add zone → verify it appends

- [ ] **Step 9: Test external drop — replace**
  - Drag an image from OS onto the lower half of an existing row → verify "松开替换" badge appears → drop → verify image replaced

- [ ] **Step 10: Test external drop — insert**
  - Drag an image from OS onto the upper half of an existing row → verify blue insertion line appears → drop → verify image inserted at that position

- [ ] **Step 11: Test limit**
  - Add images until 20 → verify "+ 添加更多图片" button disappears
  - Try dropping more → verify toast "最多上传 20 张图片"

- [ ] **Step 12: Run all tests**

```bash
pnpm vitest run
```

Expected: all tests pass.

- [ ] **Step 13: Final commit**

```bash
git add -A
git commit -m "feat: batch image print — merge images to PDF and print as single job"
```
