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
  width = 100;
  height = 100;
  set src(_v: string) { setTimeout(() => this.onload?.(), 0); }
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
