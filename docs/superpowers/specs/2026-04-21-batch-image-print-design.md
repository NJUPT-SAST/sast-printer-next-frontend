# Batch Image Print — Design Spec

**Goal:** Allow users to upload multiple images, reorder them, and print them as a single merged PDF using existing print settings.

**Date:** 2026-04-21

---

## Architecture

### Core Approach

`Printers.tsx` gains a parallel "image mode" alongside the existing single-file mode. The two modes are mutually exclusive:

- **Single-file mode** (PDF, Word, etc.): existing behavior, unchanged.
- **Image mode** (jpg/jpeg/png/gif/webp/bmp): new `imageFiles: File[]` state; images are merged into a PDF Blob via `pdf-lib` before preview/submit.

The merged PDF is wrapped as `new File([blob], 'images.pdf', { type: 'application/pdf' })` and assigned to the existing `file` state. All downstream logic (preview, submit, duplex, page range) is unchanged.

### New Files

| File | Responsibility |
|------|---------------|
| `src/components/ImageFileList.tsx` | Renders the image list with thumbnails, reorder handles, replace/delete actions, and drop-zone overlays |

### Modified Files

| File | Change |
|------|--------|
| `src/pages/Printers.tsx` | Add `imageFiles`, `merging` state; detect image uploads; trigger merge on list change; wire `ImageFileList` |
| `src/lib/utils.ts` | Add `imagesToPdf(files: File[]): Promise<Blob>` |
| `src/lib/i18n.json` | Add batch image translation keys |

### Dependencies (new)

- `pdf-lib` — client-side PDF creation from images
- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-to-reorder within the list

---

## Data Flow

```
User uploads image(s)
  → imageFiles updated
  → imagesToPdf(imageFiles) called
  → mergedPdfBlob stored, file = new File([blob], 'images.pdf')
  → existing preview useEffect fires → POST /jobs/preview
  → existing submit handler fires → POST /jobs
```

---

## UI / Interaction

### Mode Detection

- First file uploaded is an image → enter image mode, show `ImageFileList`
- First file uploaded is non-image → enter single-file mode, show existing upload area
- Switching modes clears the other mode's state

### ImageFileList Component

Each row:
- Drag handle (left) for reorder
- Thumbnail (64×64, `URL.createObjectURL`)
- Filename + file size
- "更换" button (opens single-file picker)
- "删除" button (removes from list; if last item, exits image mode)

Footer:
- "添加更多图片" button — opens multi-select file picker (image types only)
- "共 N 张图片" count label
- Limit: max 20 images; toast shown if exceeded

### Drag Interactions

Two independent drag systems:

**1. List reorder (internal, via @dnd-kit/sortable)**
- Drag handle on each row
- Drag an item → placeholder shown at target position
- Drop → `onReorder` callback with new order

**2. External file drop (from OS, via HTML5 drag events)**

Three drop zones with distinct visual feedback:

| Drop target | Visual feedback | Result |
|-------------|----------------|--------|
| On an existing image row | Row highlighted + "松开替换" badge | Replace that image directly |
| Between two rows | Blue insertion line appears | Insert at that position |
| Bottom "add" zone | Zone highlighted + blue border + "松开添加" | Append to list |

Drop feedback labels:
- On image: "松开替换"
- Between images: "松开插入"
- Add zone: "松开添加"

### Merging State

- `merging: boolean` — true while `imagesToPdf` is running
- During merge: preview area shows spinner + "正在合并..." text
- Submit button disabled while `merging === true`

### Limits

- Max 20 images. If user tries to add more (via picker or drop), show toast: "最多上传 20 张图片"
- Excess files silently dropped (only first N that fit are accepted)

---

## `imagesToPdf` Implementation

```typescript
// src/lib/utils.ts
export const imagesToPdf = async (files: File[]): Promise<Blob> => {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const ext = file.name.split('.').pop()?.toLowerCase();
    let image;
    if (ext === 'png') {
      image = await pdf.embedPng(arrayBuffer);
    } else {
      image = await pdf.embedJpg(arrayBuffer);
    }
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
};
```

Note: `pdf-lib` supports PNG and JPEG natively. GIF/WebP/BMP must be converted to JPEG/PNG first via `canvas.toBlob()` before embedding.

---

## i18n Keys (new)

| Key | 中文 | English |
|-----|------|---------|
| `printer.addMoreImages` | 添加更多图片 | Add more images |
| `printer.imageCount` | 共 {count} 张图片 | {count} images |
| `printer.merging` | 正在合并... | Merging... |
| `printer.replaceImage` | 更换 | Replace |
| `printer.imageLimitReached` | 最多上传 20 张图片 | Maximum 20 images allowed |
| `printer.dropToReplace` | 松开替换 | Drop to replace |
| `printer.dropToInsert` | 松开插入 | Drop to insert |
| `printer.dropToAdd` | 松开添加 | Drop to add |

---

## Print Settings

Unchanged. All existing settings (copies, duplex, collate, page range, page set) apply to the merged PDF as a whole. No per-image settings.

---

## Out of Scope

- Per-image print settings
- Server-side image merging
- Image rotation/cropping
- Reordering via keyboard
