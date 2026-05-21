import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import MockAdapter from "axios-mock-adapter";
import scannerApi, {
  fetchContext,
  submitScan,
  getScanFiles,
  deleteScanFile,
  downloadScanFile,
  getScanFileDisplayName,
  isPdfScanFile,
  type ScanRequest,
  type ScanFile,
} from "./scannerApi";

describe("scannerApi", () => {
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

  it("fetchContext should call GET /context and return data", async () => {
    const mockDevices = [{ id: "1", name: "Scanner 1" }];
    const mockData = { devices: mockDevices, config: {} };
    mock.onGet(/\/context\?_t=\d+/).reply(200, mockData);

    const data = await fetchContext();
    expect(data.devices).toEqual(mockDevices);
    expect(mock.history.get[0].url).toMatch(/\/context\?_t=\d+/);
  });

  it("submitScan should call POST /scan and return data", async () => {
    const request = {
      params: { deviceId: "1", resolution: "300", mode: "Color" },
      pipeline: "JPG",
    };
    const mockData = { jobId: "123" };
    mock.onPost(/\/scan\?_t=\d+/).reply(200, mockData);

    const data = await submitScan(request as ScanRequest);
    expect(data).toEqual(mockData);
    expect(mock.history.post[0].url).toMatch(/\/scan\?_t=\d+/);
    expect(JSON.parse(mock.history.post[0].data)).toEqual(request);
  });

  it("getScanFiles should call GET /files and return data", async () => {
    const mockFiles = [
      {
        fullname: "scan1.jpg",
        extension: ".jpg",
        lastModified: 123456789,
        size: 1024,
        sizeString: "1 KB",
        isDirectory: false,
        name: "scan1",
        path: "/scan1.jpg",
      },
    ];
    mock.onGet("/files").reply(200, mockFiles);

    const data = await getScanFiles();
    expect(data).toEqual(mockFiles);
    expect(mock.history.get[0].url).toBe("/files");
  });

  it("deleteScanFile should call DELETE /files/{filename}", async () => {
    const filename = "test-file.pdf";
    mock.onDelete(`/files/${filename}`).reply(200);

    await deleteScanFile(filename);
    expect(mock.history.delete[0].url).toBe(`/files/${filename}`);
  });

  it("downloadScanFile should infer MIME type from scan file metadata", async () => {
    const file: ScanFile = {
      fullname: "scan1.jpg",
      extension: ".jpg",
      lastModified: 123456789,
      size: 4,
      sizeString: "4 B",
      isDirectory: false,
      name: "scan1",
      path: "/scan1.jpg",
    };
    mock
      .onGet("/files/scan1")
      .reply(
        200,
        new Blob(["fake"], { type: "application/octet-stream" }),
        { "content-type": "application/octet-stream" },
      );

    const blob = await downloadScanFile(file);

    expect(mock.history.get[0].url).toBe("/files/scan1");
    expect(blob.type).toBe("image/jpeg");
    expect(await blob.text()).toBe("fake");
  });

  it("downloadScanFile should prefer byte signature over metadata", async () => {
    const file: ScanFile = {
      fullname: "scan1.jpg",
      extension: ".jpg",
      lastModified: 123456789,
      size: 12,
      sizeString: "12 B",
      isDirectory: false,
      name: "scan1",
      path: "/scan1.jpg",
    };
    const pngSignature = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    mock
      .onGet("/files/scan1")
      .reply(
        200,
        new Blob([pngSignature], { type: "application/octet-stream" }),
        { "content-type": "application/octet-stream" },
      );

    const blob = await downloadScanFile(file);

    expect(blob.type).toBe("image/png");
  });

  it("getScanFileDisplayName should restore extension when name omits it", () => {
    const file = {
      fullname: "",
      extension: ".png",
      name: "scan1",
    } as ScanFile;

    expect(getScanFileDisplayName(file)).toBe("scan1.png");
  });

  it("isPdfScanFile should use scan file extension metadata", () => {
    const file = {
      fullname: "",
      extension: ".pdf",
      name: "scan1",
      path: "/scan1.pdf",
    } as ScanFile;

    expect(isPdfScanFile(file)).toBe(true);
  });
});
