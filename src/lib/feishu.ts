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

export function openDocPicker(
  options?: { pickerTitle?: string; pickerConfirm?: string },
): Promise<DocPickerFile[]> {
  return new Promise((resolve, reject) => {
    const tt = window.tt;
    if (!tt?.docsPicker) {
      reject(new Error('docsPicker not available'));
      return;
    }

    tt.docsPicker({
      pickerTitle: options?.pickerTitle ?? '选择云文档',
      pickerConfirm: options?.pickerConfirm ?? '选择',
      success(res) {
        resolve(res.fileList ?? []);
      },
      fail(res) {
        reject(new Error(res.errMsg ?? 'docsPicker failed'));
      },
    });
  });
}
