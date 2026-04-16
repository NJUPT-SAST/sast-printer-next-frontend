import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import scannerApi, { fetchContext, submitScan } from './scannerApi';

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
    mock.onGet('/context').reply(200, mockData);

    const data = await fetchContext();
    expect(data).toEqual(mockDevices);
    expect(mock.history.get[0].url).toBe('/context');
  });

  it('submitScan should call POST /scan and return data', async () => {
    const request = {
      params: { deviceId: '1', resolution: '300', mode: 'Color' },
      pipeline: 'JPG',
    };
    const mockData = { jobId: '123' };
    mock.onPost('/scan').reply(200, mockData);

    const data = await submitScan(request);
    expect(data).toEqual(mockData);
    expect(mock.history.post[0].url).toBe('/scan');
    expect(JSON.parse(mock.history.post[0].data)).toEqual(request);
  });
});
