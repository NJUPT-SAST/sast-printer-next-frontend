// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createNupPdf, getOptimalLayout } from './utils';
import { PDFDocument, rgb } from 'pdf-lib';

async function pdfPageCount(blob: Blob): Promise<number> {
  const doc = await PDFDocument.load(await blob.arrayBuffer());
  return doc.getPageCount();
}

async function makePdfBlob(pageCount: number): Promise<Blob> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(1, 1, 1) });
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

  it('output page size is landscape A4 for 2-up with A4 source pages', async () => {
    const src = blobToFile(await makePdfBlob(4));
    const out = await createNupPdf(src, 2, 'horizontal');
    const doc = await PDFDocument.load(await out.arrayBuffer());
    const page = doc.getPage(0);
    expect(page.getSize().width).toBe(842);
    expect(page.getSize().height).toBe(595);
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

  it('selectedPages: 4-up with only pages 2-5 of 8 produces 1 sheet', async () => {
    const src = blobToFile(await makePdfBlob(8));
    const out = await createNupPdf(src, 4, 'horizontal', [2, 3, 4, 5]);
    expect(await pdfPageCount(out)).toBe(1);
  });

  it('selectedPages: out-of-range values are filtered', async () => {
    const src = blobToFile(await makePdfBlob(3));
    const out = await createNupPdf(src, 2, 'horizontal', [1, 2, 99]);
    expect(await pdfPageCount(out)).toBe(1);
  });
});

describe('getOptimalLayout', () => {
  it('A4 portrait with 2-up uses landscape sheet 2x1 for 100% coverage', () => {
    const r = getOptimalLayout(595, 842, 2);
    expect(r.cols).toBe(2);
    expect(r.rows).toBe(1);
    expect(r.rotate).toBe(true);
  });

  it('landscape 4:3 with 2-up prefers 1x2 on portrait sheet', () => {
    const r = getOptimalLayout(800, 600, 2);
    expect(r.cols).toBe(1);
    expect(r.rows).toBe(2);
    expect(r.rotate).toBe(false);
  });

  it('square source with 4-up uses 2x2', () => {
    const r = getOptimalLayout(500, 500, 4);
    expect(r.cols).toBe(2);
    expect(r.rows).toBe(2);
  });

  it('6-up returns valid factorization', () => {
    const r = getOptimalLayout(595, 842, 6);
    expect(r.cols * r.rows).toBe(6);
  });

  it('zero dimensions fall back to default', () => {
    const r = getOptimalLayout(0, 842, 4);
    expect(r.cols).toBe(2);
    expect(r.rows).toBe(2);
    expect(r.rotate).toBe(false);
  });
});
