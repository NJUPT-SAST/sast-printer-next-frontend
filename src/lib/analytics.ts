type EventData = Record<string, string | number | boolean>;

const bucket = {
  pageCount: (n: number) => n === 1 ? '1' : n <= 5 ? '2-5' : n <= 20 ? '6-20' : n <= 100 ? '21-100' : '101+',
  fileCount: (n: number) => n === 1 ? '1' : n <= 3 ? '2-3' : n <= 10 ? '4-10' : n <= 20 ? '11-20' : '21+',
  scale: (n: number) => n < 100 ? '<100' : n === 100 ? '100' : '>100',
};

export const track = {
  // Printer
  printerListViewed: (count: number) =>
    window.umami?.track('printer:list_viewed', { printer_count: count }),

  printerViewed: (printerId: string, duplexMode: string, hasActiveWarning: boolean) =>
    window.umami?.track('printer:viewed', { printer_id: printerId, duplex_mode: duplexMode, has_active_warning: hasActiveWarning }),

  printerActiveWarningShown: (printerId: string, warningType: 'printing' | 'manual_duplex') =>
    window.umami?.track('printer:active_warning_shown', { printer_id: printerId, warning_type: warningType }),

  printerActiveWarningIgnored: (printerId: string, warningType: string) =>
    window.umami?.track('printer:active_warning_ignored', { printer_id: printerId, warning_type: warningType }),

  printerActiveWarningBack: (printerId: string, warningType: string) =>
    window.umami?.track('printer:active_warning_back', { printer_id: printerId, warning_type: warningType }),

  // Preview
  previewCompleted: (opts: {
    source: 'file' | 'feishu';
    batch: boolean;
    duplex: 'off' | 'auto' | 'manual';
    nup: number;
    success: boolean;
    durationMs?: number;
    pageCount?: number;
    errorType?: string;
  }) =>
    window.umami?.track('preview:completed', {
      source: opts.source,
      batch: opts.batch,
      duplex: opts.duplex,
      nup: opts.nup,
      success: opts.success,
      ...(opts.success && opts.durationMs !== undefined && { duration_ms: opts.durationMs }),
      ...(opts.success && opts.pageCount && { page_count_bucket: bucket.pageCount(opts.pageCount) }),
      ...(!opts.success && opts.errorType && { error_type: opts.errorType }),
    }),

  // Print
  printSubmitted: (opts: {
    source: 'file' | 'feishu';
    batch: boolean;
    batchType: 'none' | 'image' | 'doc';
    fileType: string;
    copies: number;
    duplex: 'off' | 'auto' | 'manual';
    nup: number;
    pageRange: 'all' | 'odd' | 'even' | 'custom';
    scale: number;
    success: boolean;
    manualDuplex?: boolean;
    errorType?: string;
  }) =>
    window.umami?.track('print:submitted', {
      source: opts.source,
      batch: opts.batch,
      batch_type: opts.batchType,
      file_type: opts.fileType,
      copies: opts.copies,
      duplex: opts.duplex,
      nup: opts.nup,
      page_range: opts.pageRange,
      scale_bucket: bucket.scale(opts.scale),
      success: opts.success,
      ...(opts.success && opts.manualDuplex !== undefined && { manual_duplex: opts.manualDuplex }),
      ...(!opts.success && opts.errorType && { error_type: opts.errorType }),
    }),

  // Manual duplex
  manualDuplexWaitShown: (printerId: string, extendWindowSeconds?: number) =>
    window.umami?.track('manual_duplex:wait_shown', { printer_id: printerId, ...(extendWindowSeconds && { extend_window_seconds: extendWindowSeconds }) }),

  manualDuplexExtendAvailable: (printerId: string) =>
    window.umami?.track('manual_duplex:extend_available', { printer_id: printerId }),

  manualDuplexExtend: (printerId: string, success: boolean, errorType?: string) =>
    window.umami?.track('manual_duplex:extend', { printer_id: printerId, success, ...(!success && errorType && { error_type: errorType }) }),

  manualDuplexContinue: (printerId: string) =>
    window.umami?.track('manual_duplex:continue', { printer_id: printerId }),

  manualDuplexCancel: (printerId: string) =>
    window.umami?.track('manual_duplex:cancel', { printer_id: printerId }),

  manualDuplexExpiredClient: (printerId: string) =>
    window.umami?.track('manual_duplex:expired_client', { printer_id: printerId }),

  // Batch
  batchEnabled: (batchType: 'image' | 'doc') =>
    window.umami?.track('batch:enabled', { batch_type: batchType }),

  batchFileAdded: (batchType: string, count: number) =>
    window.umami?.track('batch:file_added', { batch_type: batchType, count_bucket: bucket.fileCount(count) }),

  batchCompleted: (batchType: string, fileCount: number, successCount: number, failedCount: number) =>
    window.umami?.track('batch:completed', { batch_type: batchType, file_count_bucket: bucket.fileCount(fileCount), success_count: successCount, failed_count: failedCount }),

  // Feishu
  feishuPickerOpened: () =>
    window.umami?.track('feishu_picker:opened'),

  feishuPickerCompleted: (success: boolean, errorType?: string) =>
    window.umami?.track('feishu_picker:completed', { success, ...(!success && errorType && { error_type: errorType }) }),

  // Scan
  scanDeviceDiscovered: (count: number) =>
    window.umami?.track('scan:device_discovered', { count }),

  scanStarted: () =>
    window.umami?.track('scan:started'),

  scanFileDownloaded: () =>
    window.umami?.track('scan:file_downloaded'),

  scanFileDeleted: () =>
    window.umami?.track('scan:file_deleted'),

  // Auth
  authLoginSuccess: () =>
    window.umami?.track('auth:login_success'),

  authLoginFailed: (reason?: string) =>
    window.umami?.track('auth:login_failed', reason ? { reason } : undefined),

  // UI
  uiLanguageChanged: (lang: string) =>
    window.umami?.track('ui:language_changed', { language: lang }),
};

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: EventData) => void;
    };
  }
}
