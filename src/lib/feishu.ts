import api from "@/lib/api";

interface DocPickerFile {
  filePath: string;
  fileName: string;
}

interface DocPickerResult {
  errMsg: string;
  fileList: DocPickerFile[];
}

interface DocPickerOptions {
  pickerTitle?: string;
  pickerConfirm?: string;
  success: (res: DocPickerResult) => void;
  fail: (res: { errMsg: string }) => void;
}

interface LeaveConfirmOptions {
  success?: (res: unknown) => void;
  fail?: (res: { errMsg: string }) => void;
}

interface H5SDKConfigOptions {
  appId: string;
  timestamp: number;
  nonceStr: string;
  signature: string;
  jsApiList: string[];
  onSuccess?: (res: unknown) => void;
  onFail?: (res: { errMsg: string }) => void;
}

interface JSSDKConfigResponse {
  appId: string;
  timestamp: string;
  nonceStr: string;
  signature: string;
}

interface CachedJSSDKConfig extends JSSDKConfigResponse {
  pageURL: string;
  cachedAt: number;
}

const JSSDK_CONFIG_CACHE_PREFIX = "feishu:jssdk-config:";

declare global {
  interface Window {
    tt?: {
      docsPicker?: (options: DocPickerOptions) => void;
      enableLeaveConfirm?: (options: LeaveConfirmOptions) => void;
      disableLeaveConfirm?: (options: LeaveConfirmOptions) => void;
    };
    h5sdk?: {
      config?: (options: H5SDKConfigOptions) => void;
      ready?: (callback: () => void) => void;
      error?: (callback: (err: { errMsg: string }) => void) => void;
    };
  }
}

export function isInFeishu(): boolean {
  return typeof window !== "undefined" && !!window.tt?.docsPicker;
}

let configPromise: Promise<void> | null = null;

function getJSSDKConfigCacheKey(pageURL: string): string {
  return `${JSSDK_CONFIG_CACHE_PREFIX}${pageURL}`;
}

function readCachedJSSDKConfig(pageURL: string): JSSDKConfigResponse | null {
  try {
    const raw = window.localStorage.getItem(getJSSDKConfigCacheKey(pageURL));
    if (!raw) return null;

    const cached = JSON.parse(raw) as Partial<CachedJSSDKConfig>;
    if (
      cached.pageURL !== pageURL ||
      typeof cached.appId !== "string" ||
      typeof cached.timestamp !== "string" ||
      typeof cached.nonceStr !== "string" ||
      typeof cached.signature !== "string"
    ) {
      return null;
    }

    return {
      appId: cached.appId,
      timestamp: cached.timestamp,
      nonceStr: cached.nonceStr,
      signature: cached.signature,
    };
  } catch {
    window.localStorage.removeItem(getJSSDKConfigCacheKey(pageURL));
    return null;
  }
}

function saveJSSDKConfigCache(
  pageURL: string,
  data: JSSDKConfigResponse,
): void {
  try {
    const cached: CachedJSSDKConfig = {
      ...data,
      pageURL,
      cachedAt: Date.now(),
    };
    window.localStorage.setItem(
      getJSSDKConfigCacheKey(pageURL),
      JSON.stringify(cached),
    );
  } catch {
    // Ignore storage failures and fall back to in-memory config.
  }
}

function clearJSSDKConfigCache(pageURL: string): void {
  try {
    window.localStorage.removeItem(getJSSDKConfigCacheKey(pageURL));
  } catch {
    // Ignore storage failures.
  }
}

async function ensureJSAPIConfig(): Promise<void> {
  if (configPromise) return configPromise;

  configPromise = (async () => {
    const h5sdk = window.h5sdk;
    if (!h5sdk?.config) return;

    const pageURL = window.location.href.split("#")[0];
    const cachedData = readCachedJSSDKConfig(pageURL);
    const data =
      cachedData ??
      (
        await api.get<JSSDKConfigResponse>("/auth/config/jssdk-config", {
          params: { url: pageURL },
          timeout: 10000,
        })
      ).data;

    if (!cachedData) {
      saveJSSDKConfigCache(pageURL, data);
    }

    await new Promise<void>((resolve, reject) => {
      const onReady = () => resolve();
      const onError = (err: unknown) => {
        const detail = (() => {
          try {
            return JSON.stringify(err);
          } catch {
            return String(err);
          }
        })();
        reject(new Error(`h5sdk config failed: ${detail}`));
      };
      h5sdk.ready?.(onReady);
      h5sdk.error?.(onError);
      h5sdk.config?.({
        appId: data.appId,
        timestamp: Number(data.timestamp),
        nonceStr: data.nonceStr,
        signature: data.signature,
        jsApiList: ["docsPicker"],
        onSuccess: onReady,
        onFail: onError,
      });
    });
  })();

  try {
    await configPromise;
  } catch (err) {
    clearJSSDKConfigCache(window.location.href.split("#")[0]);
    configPromise = null;
    throw err;
  }
}

export async function openDocPicker(options: {
  pickerTitle?: string;
  pickerConfirm?: string;
  success: (files: DocPickerFile[]) => void;
  fail?: (err: string) => void;
  complete?: () => void;
}): Promise<void> {
  const tt = window.tt;
  if (!tt?.docsPicker) {
    options.fail?.("docsPicker not available");
    options.complete?.();
    return;
  }

  try {
    await ensureJSAPIConfig();
  } catch (err: unknown) {
    options.fail?.(err instanceof Error ? err.message : String(err));
    options.complete?.();
    return;
  }

  try {
    tt.docsPicker({
      pickerTitle: options.pickerTitle ?? "选择云文档",
      pickerConfirm: options.pickerConfirm ?? "选择",
      success(res) {
        options.success(res.fileList ?? []);
        options.complete?.();
      },
      fail(res) {
        const msg = res.errMsg ?? "";
        if (
          msg === "" ||
          /cancel|denied|取消|no.?perm|internal.?error/i.test(msg)
        ) {
          options.complete?.();
          return;
        }
        options.fail?.(msg || "docsPicker failed");
        options.complete?.();
      },
    });
  } catch (err: unknown) {
    options.fail?.(err instanceof Error ? err.message : String(err));
    options.complete?.();
  }
}

export function enableLeaveConfirm(): void {
  window.tt?.enableLeaveConfirm?.({});
}

export function disableLeaveConfirm(): void {
  window.tt?.disableLeaveConfirm?.({});
}
