// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiGet, docsPickerMock, h5sdkConfigMock } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  docsPickerMock: vi.fn(),
  h5sdkConfigMock: vi.fn((options: { onSuccess?: () => void }) => {
    options.onSuccess?.();
  }),
}));

vi.mock("@/lib/api", () => ({
  default: {
    get: apiGet,
  },
}));

async function loadFeishuModule() {
  return import("./feishu");
}

function installFeishuGlobals() {
  window.tt = {
    docsPicker: docsPickerMock,
  };
  window.h5sdk = {
    config: h5sdkConfigMock,
    ready: vi.fn((callback: () => void) => callback()),
    error: vi.fn(),
  };
}

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    get length() {
      return store.size;
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
}

function getCacheKey() {
  return `feishu:jssdk-config:${window.location.href.split("#")[0]}`;
}

describe("Feishu JSSDK config cache", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await vi.resetModules();
    installLocalStorageMock();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/feishu-test");
    installFeishuGlobals();
  });

  it("stores config in localStorage after the first successful config", async () => {
    apiGet.mockResolvedValueOnce({
      data: {
        appId: "app-1",
        timestamp: "1234567890",
        nonceStr: "nonce-1",
        signature: "signature-1",
      },
    });
    docsPickerMock.mockImplementation((options: {
      success: (res: { errMsg: string; fileList: [] }) => void;
    }) => {
      options.success({ errMsg: "", fileList: [] });
    });

    const { openDocPicker } = await loadFeishuModule();

    await new Promise<void>((resolve, reject) => {
      openDocPicker({
        success: () => resolve(),
        fail: reject,
      });
    });

    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(getCacheKey()) ?? "null")).toEqual(
      expect.objectContaining({
        pageURL: window.location.href.split("#")[0],
        appId: "app-1",
        timestamp: "1234567890",
        nonceStr: "nonce-1",
        signature: "signature-1",
      }),
    );
  });

  it("reuses cached config after reloading the module", async () => {
    localStorage.setItem(
      getCacheKey(),
      JSON.stringify({
        pageURL: window.location.href.split("#")[0],
        cachedAt: Date.now(),
        appId: "cached-app",
        timestamp: "9876543210",
        nonceStr: "cached-nonce",
        signature: "cached-signature",
      }),
    );

    const { openDocPicker } = await loadFeishuModule();

    await new Promise<void>((resolve, reject) => {
      openDocPicker({
        success: () => resolve(),
        fail: reject,
      });
    });

    expect(apiGet).not.toHaveBeenCalled();
    expect(h5sdkConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "cached-app",
        timestamp: 9876543210,
        nonceStr: "cached-nonce",
        signature: "cached-signature",
      }),
    );
  });
});