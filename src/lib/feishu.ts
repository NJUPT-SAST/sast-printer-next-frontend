import api from '@/lib/api';

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
  return typeof window !== 'undefined' && !!window.tt?.docsPicker;
}

let configPromise: Promise<void> | null = null;

async function ensureJSAPIConfig(): Promise<void> {
  if (configPromise) return configPromise;

  configPromise = (async () => {
    const h5sdk = window.h5sdk;
    if (!h5sdk?.config) return;

    const pageURL = window.location.href.split('#')[0];
    const resp = await api.get<JSSDKConfigResponse>('/auth/config/jssdk-config', {
      params: { url: pageURL },
      timeout: 10000,
    });
    const data = resp.data;

    await new Promise<void>((resolve, reject) => {
      const onReady = () => resolve();
      const onError = (err: { errMsg?: string }) => {
        reject(new Error(err?.errMsg || 'JSSDK config failed'));
      };
      h5sdk.ready?.(onReady);
      h5sdk.error?.(onError);
      h5sdk.config({
        appId: data.appId,
        timestamp: Number(data.timestamp),
        nonceStr: data.nonceStr,
        signature: data.signature,
        jsApiList: ['docsPicker'],
        onSuccess: onReady,
        onFail: onError,
      });
    });
  })();

  try {
    await configPromise;
  } catch (err) {
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
    options.fail?.('docsPicker not available');
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
      pickerTitle: options.pickerTitle ?? '选择云文档',
      pickerConfirm: options.pickerConfirm ?? '选择',
      success(res) {
        options.success(res.fileList ?? []);
        options.complete?.();
      },
      fail(res) {
        options.fail?.(res.errMsg ?? 'docsPicker failed');
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
