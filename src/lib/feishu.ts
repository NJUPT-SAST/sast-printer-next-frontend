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

declare global {
  interface Window {
    tt?: {
      docsPicker?: (options: DocPickerOptions) => void;
    };
  }
}

export function isInFeishu(): boolean {
  return typeof window !== 'undefined' && !!window.tt?.docsPicker;
}

export function openDocPicker(options: {
  pickerTitle?: string;
  pickerConfirm?: string;
  success: (files: DocPickerFile[]) => void;
  fail?: (err: string) => void;
  complete?: () => void;
}): void {
  const tt = window.tt;
  if (!tt?.docsPicker) {
    options.fail?.('docsPicker not available');
    options.complete?.();
    return;
  }

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
}
