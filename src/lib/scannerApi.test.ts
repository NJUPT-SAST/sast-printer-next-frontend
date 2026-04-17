import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import scannerApi, { fetchContext, submitScan, getScanFiles, deleteScanFile } from './scannerApi';

describe('scannerApi', () => {
  let mock: MockAdapter;

  beforeAll(() => {
    mock = new MockAdapter(scannerApi);
    globalThis.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
  });

  afterEach(() => {
    mock.reset();
  });

  afterAll(() => {
    mock.restore();
  });

  it('fetchContext should call GET /context and return data', async () => {
    const mockDevices = [{ id: '1', name: 'Scanner 1' }];
    const mockData = { devices: mockDevices, config: {} };
    mock.onGet(/\/context\?_t=\d+/).reply(200, mockData);

    const data = await fetchContext();
    expect(data.devices).toEqual(mockDevices);
    expect(mock.history.get[0].url).toMatch(/\/context\?_t=\d+/);
  });

  it('submitScan should call POST /scan and return data', async () => {
    const request = {
      params: { deviceId: '1', resolution: '300', mode: 'Color' },
      pipeline: 'JPG',
    };
    const mockData = { jobId: '123' };
    mock.onPost(/\/scan\?_t=\d+/).reply(200, mockData);

    const data = await submitScan(request as any);
    expect(data).toEqual(mockData);
    expect(mock.history.post[0].url).toMatch(/\/scan\?_t=\d+/);
    expect(JSON.parse(mock.history.post[0].data)).toEqual(request);
  });

  it('getScanFiles should call GET /files and return data', async () => {
    const mockFiles = [
      {
        fullname: 'scan1.jpg',
        extension: '.jpg',
        lastModified: 123456789,
        size: 1024,
        sizeString: '1 KB',
        isDirectory: false,
        name: 'scan1',
        path: '/scan1.jpg'
      }
    ];
    mock.onGet('/files').reply(200, mockFiles);

    const data = await getScanFiles();
    expect(data).toEqual(mockFiles);
    expect(mock.history.get[0].url).toBe('/files');
  });

  it('deleteScanFile should call DELETE /files/{filename}', async () => {
    const filename = 'test-file.pdf';
    mock.onDelete(`/files/${filename}`).reply(200);

    await deleteScanFile(filename);
    expect(mock.history.delete[0].url).toBe(`/files/${filename}`);
  });
});
