import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useUi } from '@/components/ui-context';
import { fetchContext, submitScan, downloadScanFile, getScanFiles, deleteScanFile, type Scanner, type PaperSize, type ScanFile } from '@/lib/scannerApi';
import { downloadFile } from '@/lib/utils';
import { isInFeishu, enableLeaveConfirm, disableLeaveConfirm } from '@/lib/feishu';
import { Download, Loader2, Scan, RefreshCw, ChevronDown, ChevronUp, FolderOpen, X } from 'lucide-react';
import { DocumentPreview, renderPdfToImages } from '@/components/DocumentPreview';
import Select from '@/components/Select';

export default function ScannerPage() {
  const { t, locale } = useTranslation();
  const { toast, confirm } = useUi();

  const [devices, setDevices] = useState<Scanner[]>([]);
  const [paperSizes, setPaperSizes] = useState<PaperSize[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);
  const [errorContext, setErrorContext] = useState(false);

  const [selectedScannerId, setSelectedScannerId] = useState<string>('');
  const [resolution, setResolution] = useState<string>('300');
  const [colorMode, setColorMode] = useState<string>('Color');
  const [pipeline, setPipeline] = useState<string>(() => localStorage.getItem('scanner_last_pipeline') || 'Scan as PNG');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<Record<string, string | number>>({});
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  const [files, setFiles] = useState<ScanFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [errorFiles, setErrorFiles] = useState(false);

  const [isFileListModalOpen, setIsFileListModalOpen] = useState(false);

  const fetchFiles = async () => {
    try {
      setLoadingFiles(true);
      setErrorFiles(false);
      const data = await getScanFiles();
      setFiles(data);
    } catch (err) {
      console.error(err);
      setErrorFiles(true);
      toast({ message: t('scanner.errorFiles') || 'Failed to load files', type: 'error' });
    } finally {
      setLoadingFiles(false);
    }
  };

  const loadDevices = async () => {
    try {
      setLoadingContext(true);
      setErrorContext(false);

      let mapping: Record<string, string> | null = null;
      try {
        const res = await fetch('/scannerMapping.json');
        if (res.ok) {
          mapping = await res.json();
        }
      } catch (e) {
        console.warn('Could not load scannerMapping.json', e);
      }

      const contextData = await fetchContext();
      let devs = contextData.devices;
      setPaperSizes(contextData.paperSizes);

      if (mapping) {
        devs = devs.filter((d: Scanner) => mapping![d.id] || mapping![d.name]);
        devs = devs.map((d: Scanner) => ({
          ...d,
          name: mapping![d.id] || mapping![d.name] || d.name
        }));
      }

      setDevices(devs);

      if (devs.length === 1) {
        setSelectedScannerId(devs[0].id);
      } else if (devs.length > 0 && !devs.find(d => d.id === selectedScannerId)) {
        setSelectedScannerId(devs[0].id);
      }
    } catch (err) {
      console.error(err);
      setErrorContext(true);
      toast({ message: t('scanner.error') || 'Failed to load scanners', type: 'error' });
    } finally {
      setLoadingContext(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadDevices();
      await fetchFiles();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaultAdvancedSettings = useMemo<Record<string, string | number>>(() => {
    const a4Size = paperSizes.find(p => p.name.toLowerCase().includes('a4'));
    if (a4Size) {
      return {
        width: a4Size.dimensions.x,
        height: a4Size.dimensions.y,
        pageWidth: a4Size.dimensions.x,
        pageHeight: a4Size.dimensions.y
      };
    }
    return {};
  }, [paperSizes]);

  const [prevContext, setPrevContext] = useState('');
  const currentContext = `${selectedScannerId}|${paperSizes.map(p => p.name).join(',')}`;

  if (prevContext !== currentContext) {
    setPrevContext(currentContext);
    setAdvancedSettings(defaultAdvancedSettings);
    setSelectedFilters([]);
    setShowAdvanced(false);
  }

  if (selectedScannerId && devices.length > 0) {
    const scanner = devices.find(s => s.id === selectedScannerId);
    const availablePipelines = scanner?.pipelines ?? ['Scan as PNG', 'Scan as PDF'];
    if (!availablePipelines.includes(pipeline)) {
      setPipeline(availablePipelines[0]);
    }
  }

  const [scanning, setScanning] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadLoaded, setDownloadLoaded] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };





  const selectedScanner = devices.find((s) => s.id === selectedScannerId);

  const features = (selectedScanner?.features ?? {}) as Scanner['features'];
  const settings = (selectedScanner?.settings ?? {}) as Scanner['settings'];
  const availableFilters: string[] = settings.filters?.options || [];
  
  const resolutions = features['--resolution']?.constraint || [75, 150, 300, 600];
  const colorModes = features['--mode']?.constraint || ['Color', 'Gray', 'Lineart'];

  const handleScan = async () => {
    if (!selectedScannerId) return;
    try {
      setScanning(true);
      if (isInFeishu()) enableLeaveConfirm();
      const requestPayload = {
        params: {
          deviceId: selectedScannerId,
          resolution: resolution,
          mode: colorMode,
          ...advancedSettings,
        },
        filters: selectedFilters,
        pipeline: pipeline,
      };
      
      const res = await submitScan(requestPayload);
      if (res && res.file && res.file.name) {
        setPreviewFilename(res.file.name);
        setDownloadingFile(true);
        setDownloadLoaded(0);
        setDownloadTotal(res.file.size || 0);
        setDownloadProgress(0);

        const fileBlob = await downloadScanFile(res.file.name, (e) => {
          setDownloadLoaded(e.loaded);
          const total = e.total || res.file.size || 0;
          if (total > 0) {
            setDownloadProgress(Math.round((e.loaded / total) * 100));
            setDownloadTotal(total);
          }
        });
        
        setDownloadingFile(false);
        const objectUrl = URL.createObjectURL(fileBlob);
        setImageUrl(objectUrl);
        
        if (res.file.name.toLowerCase().endsWith('.pdf')) {
          try {
            const { images } = await renderPdfToImages(fileBlob);
            setPreviewImages(images);
          } catch (e) {
            console.error('Failed to render PDF to images', e);
            setPreviewImages([]);
          }
        } else {
          setPreviewImages([objectUrl]);
        }
        toast({ message: t('scanner.success') || 'Scan completed successfully', type: 'success' });
        fetchFiles();
      }
    } catch (err) {
      console.error(err);
      toast({ message: t('scanner.scanFailed') || 'Scan failed', type: 'error' });
      setDownloadingFile(false);
    } finally {
      setScanning(false);
      if (isInFeishu()) disableLeaveConfirm();
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    downloadFile(imageUrl, previewFilename || `scan-${Date.now()}.jpg`);
  };

  const handleDownloadFile = async (filename: string) => {
    try {
      const blob = await downloadScanFile(filename);
      const url = URL.createObjectURL(blob);
      downloadFile(url, filename);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast({ message: t('scanner.downloadFailed') || 'Download failed', type: 'error' });
    }
  };

  const handleDeleteFile = async (filename: string) => {
    confirm({
      message: t('scanner.confirmDelete') || 'Are you sure you want to delete this file?',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteScanFile(filename);
          toast({ message: t('scanner.deleteSuccess') || 'File deleted', type: 'success' });
          fetchFiles();
        } catch (err) {
          console.error(err);
          toast({ message: t('scanner.deleteFailed') || 'Delete failed', type: 'error' });
        }
      }
    });
  };

  return (
    <div className={`max-w-6xl mx-auto p-4 sm:p-6 pb-24 lg:pb-6 w-full flex-1 flex flex-col relative ${imageUrl ? 'h-[calc(100vh-4rem)]' : ''}`}>
      <div className="flex justify-between items-center mb-6 shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">{t('scanner.title')}</h1>
        <button
          onClick={() => setIsFileListModalOpen(true)}
          className="inline-flex items-center text-sm font-medium text-gray-700 bg-white border border-gray-200 shadow-sm hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 px-4 py-2 rounded-lg transition-all"
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          {t('scanner.viewFiles')}
        </button>
      </div>
      
      <div className="bg-yellow-50 border-l-4 border-yellow-200 p-4 mb-6 rounded-r-lg w-full shrink-0">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-base text-yellow-800 font-bold">
              {t('scanner.publicWarning') || 'Files are publicly accessible to anyone on the same network. Please delete sensitive files immediately after downloading.'}
            </p>
          </div>
        </div>
      </div>

      <div className={`flex flex-col lg:flex-row gap-6 items-stretch flex-1 ${imageUrl ? 'min-h-0' : ''}`}>
        {/* Sidebar Settings */}
        <div className={`w-full lg:w-80 flex flex-col gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 ${imageUrl ? 'overflow-y-auto' : ''}`}>
          
          {loadingContext ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('scanner.loadingDevices')}</span>
            </div>
          ) : errorContext ? (
            <div className="text-red-500">{t('scanner.error')}</div>
          ) : devices.length === 0 ? (
            <div className="text-gray-500">{t('scanner.noDevices')}</div>
          ) : (
            <>
              {/* Device Selection */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">{t('scanner.device')} <span className="text-red-500">*</span></label>
                  <button 
                    onClick={loadDevices} 
                    disabled={loadingContext || scanning}
                    className="text-gray-500 hover:text-blue-600 disabled:opacity-50 transition-colors"
                    title="Refresh Devices"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingContext ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <Select
                  options={devices.map((s) => ({
                    value: s.id,
                    label: `${s.name}${s.model ? ` (${s.model})` : ''}`,
                  }))}
                  value={selectedScannerId}
                  onChange={setSelectedScannerId}
                  placeholder={t('scanner.selectDevice') || 'Select a scanner'}
                  disabled={scanning}
                  className="w-full p-2 rounded-lg"
                />
              </div>

              {/* Resolution Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">{t('scanner.resolution')}</label>
                <Select
                  options={resolutions.map((res: number | string) => ({
                    value: res.toString(),
                    label: `${res} dpi`,
                  }))}
                  value={resolution}
                  onChange={setResolution}
                  disabled={scanning}
                  className="w-full p-2 rounded-lg"
                />
              </div>

              {/* Color Mode Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">{t('scanner.colorMode')}</label>
                <Select
                  options={colorModes.map((mode: string) => ({
                    value: mode,
                    label: mode,
                  }))}
                  value={colorMode}
                  onChange={setColorMode}
                  disabled={scanning}
                  className="w-full p-2 rounded-lg"
                />
              </div>

              {/* Action Button */}
              
              {/* Advanced Settings */}
              {(features['--brightness'] || features['--contrast'] || features['--source'] || availableFilters.length > 0 || features['-l'] || features['-t'] || features['-x'] || features['-y'] || paperSizes.length > 0) && (
                <div className="border-t border-gray-200 pt-4 mt-2">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    {t('scanner.advanced') || 'Advanced Settings'}
                    {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  {showAdvanced && (
                    <div className="mt-4 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
                      {features['--source'] && (
                        <div className="flex flex-col gap-2">
                          <label className="text-sm text-gray-600">{t('scanner.source') || 'Source'}</label>
                          <Select
                            options={(features['--source'].options ?? []).map((opt: string) => ({
                              value: opt,
                              label: opt,
                            }))}
                            value={advancedSettings['source'] ?? features['--source'].default ?? ''}
                            onChange={(v) => setAdvancedSettings({ ...advancedSettings, source: v })}
                            disabled={scanning}
                            className="w-full p-2 rounded-lg text-sm"
                          />
                        </div>
                      )}
                      
                      {paperSizes.length > 0 && (features['-x'] || features['-y']) && (
                        <div className="flex flex-col gap-2">
                          <label className="text-sm text-gray-600">{t('scanner.paperSize') || 'Paper Size'}</label>
                          <Select
                            options={[
                              { value: '', label: t('scanner.customSize') || 'Custom / Select size...' },
                              ...paperSizes.map((ps) => ({
                                value: `${ps.dimensions.x},${ps.dimensions.y}`,
                                label: `${ps.name.replace(/\(.*\)/, '').trim()} (${ps.dimensions.x}x${ps.dimensions.y}mm)`,
                              })),
                            ]}
                            value={
                              advancedSettings.width && advancedSettings.height
                                ? `${advancedSettings.width},${advancedSettings.height}`
                                : ''
                            }
                            onChange={(v) => {
                              if (v === '') {
                                const newSettings = { ...advancedSettings };
                                delete newSettings.width;
                                delete newSettings.height;
                                delete newSettings.pageWidth;
                                delete newSettings.pageHeight;
                                setAdvancedSettings(newSettings);
                                return;
                              }
                              const [w, h] = v.split(',').map(Number);
                              setAdvancedSettings({
                                ...advancedSettings,
                                width: w,
                                height: h,
                                pageWidth: w,
                                pageHeight: h,
                              });
                            }}
                            disabled={scanning}
                            className="w-full p-2 rounded-lg text-sm"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        {features['-t'] && (
                          <div className="flex flex-col gap-2">
                            <label className="text-sm text-gray-600">{t('scanner.topMargin') || 'Top Margin (mm)'}</label>
                            <input 
                              type="number" 
                              className="p-1.5 border border-gray-300 rounded text-sm w-full"
                              min={features['-t'].limits?.[0] ?? 0} max={features['-t'].limits?.[1] ?? 297}
                              value={advancedSettings['top'] ?? features['-t'].default ?? 0}
                              onChange={(e) => setAdvancedSettings({...advancedSettings, top: parseFloat(e.target.value)})}
                              disabled={scanning}
                            />
                          </div>
                        )}
                        {features['-l'] && (
                          <div className="flex flex-col gap-2">
                            <label className="text-sm text-gray-600">{t('scanner.leftMargin') || 'Left Margin (mm)'}</label>
                            <input 
                              type="number" 
                              className="p-1.5 border border-gray-300 rounded text-sm w-full"
                              min={features['-l'].limits?.[0] ?? 0} max={features['-l'].limits?.[1] ?? 215}
                              value={advancedSettings['left'] ?? features['-l'].default ?? 0}
                              onChange={(e) => setAdvancedSettings({...advancedSettings, left: parseFloat(e.target.value)})}
                              disabled={scanning}
                            />
                          </div>
                        )}
                        {features['-x'] && (
                          <div className="flex flex-col gap-2">
                            <label className="text-sm text-gray-600">{t('scanner.width') || 'Width (mm)'}</label>
                            <input 
                              type="number" 
                              className="p-1.5 border border-gray-300 rounded text-sm w-full"
                              min={features['-x'].limits?.[0] ?? 0} max={features['-x'].limits?.[1] ?? 215}
                              value={advancedSettings['width'] ?? features['-x'].default ?? 215}
                              onChange={(e) => setAdvancedSettings({...advancedSettings, width: parseFloat(e.target.value)})}
                              disabled={scanning}
                            />
                          </div>
                        )}
                        {features['-y'] && (
                          <div className="flex flex-col gap-2">
                            <label className="text-sm text-gray-600">{t('scanner.height') || 'Height (mm)'}</label>
                            <input 
                              type="number" 
                              className="p-1.5 border border-gray-300 rounded text-sm w-full"
                              min={features['-y'].limits?.[0] ?? 0} max={features['-y'].limits?.[1] ?? 297}
                              value={advancedSettings['height'] ?? features['-y'].default ?? 297}
                              onChange={(e) => setAdvancedSettings({...advancedSettings, height: parseFloat(e.target.value)})}
                              disabled={scanning}
                            />
                          </div>
                        )}
                      </div>

                      {features['--brightness'] && (
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between">
                            <label className="text-sm text-gray-600">{t('scanner.brightness') || 'Brightness'}</label>
                            <span className="text-sm text-gray-500 font-mono bg-gray-100 px-1.5 rounded">{advancedSettings['brightness'] ?? features['--brightness'].default ?? 0}</span>
                          </div>
                          <input 
                            type="range" 
                            min={features['--brightness'].limits?.[0] ?? -100} 
                            max={features['--brightness'].limits?.[1] ?? 100}
                            step={features['--brightness'].interval ?? 1}
                            value={advancedSettings['brightness'] ?? features['--brightness'].default ?? 0}
                            onChange={(e) => setAdvancedSettings({...advancedSettings, brightness: parseInt(e.target.value)})}
                            disabled={scanning}
                            className="w-full accent-blue-600"
                          />
                        </div>
                      )}

                      {features['--contrast'] && (
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between">
                            <label className="text-sm text-gray-600">{t('scanner.contrast') || 'Contrast'}</label>
                            <span className="text-sm text-gray-500 font-mono bg-gray-100 px-1.5 rounded">{advancedSettings['contrast'] ?? features['--contrast'].default ?? 0}</span>
                          </div>
                          <input 
                            type="range" 
                            min={features['--contrast'].limits?.[0] ?? -100} 
                            max={features['--contrast'].limits?.[1] ?? 100}
                            step={features['--contrast'].interval ?? 1}
                            value={advancedSettings['contrast'] ?? features['--contrast'].default ?? 0}
                            onChange={(e) => setAdvancedSettings({...advancedSettings, contrast: parseInt(e.target.value)})}
                            disabled={scanning}
                            className="w-full accent-blue-600"
                          />
                        </div>
                      )}

                      {availableFilters.length > 0 && (
                        <div className="flex flex-col gap-3 mt-2 border-t border-gray-100 pt-4">
                          <label className="text-sm font-medium text-gray-700">{t('scanner.filters') || 'Filters'}</label>
                          <div className="flex flex-col gap-2.5">
                            {availableFilters.map((filter) => (
                              <label key={filter} className="flex items-center gap-3 cursor-pointer group">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                  checked={selectedFilters.includes(filter)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedFilters([...selectedFilters, filter]);
                                    } else {
                                      setSelectedFilters(selectedFilters.filter(f => f !== filter));
                                    }
                                  }}
                                  disabled={scanning}
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{filter.replace('filter.', '').replace(/-/g, ' ')}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action Area: Format + Scan Button — desktop only inside sidebar */}
              <div className="hidden lg:flex mt-auto pt-4 border-t border-gray-200 items-center gap-3">
                <Select
                  options={(selectedScanner?.pipelines ?? ['Scan as PNG', 'Scan as PDF']).map((p) => ({
                    value: p,
                    label: p.replace('Scan as ', ''),
                  }))}
                  value={pipeline}
                  onChange={(v) => {
                    setPipeline(v);
                    localStorage.setItem('scanner_last_pipeline', v);
                  }}
                  disabled={scanning}
                  className="p-3 w-[120px] sm:w-[140px] rounded-lg text-sm font-medium text-gray-700"
                />

                <button
                  onClick={handleScan}
                  disabled={scanning || !selectedScannerId}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors"
                >
                  {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scan className="w-5 h-5" />}
                  {t('scanner.scanBtn')}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Preview Area */}
        <div className={`flex-1 flex flex-col gap-6 ${imageUrl ? 'min-h-0' : ''}`}>
          <div className={`flex-1 flex flex-col bg-gray-50 rounded-xl border border-gray-200 overflow-hidden relative ${imageUrl ? 'min-h-0' : 'min-h-[400px]'}`}>
            <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center shrink-0">
              <h2 className="font-medium text-gray-800 flex items-center gap-2">
                <Scan className="w-4 h-4 text-gray-500" />
                {t('scanner.preview')}
              </h2>
              {imageUrl && (
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {t('scanner.download')}
                </button>
              )}
            </div>
            
            <div className="flex-1 p-6 overflow-hidden flex flex-col">
              {scanning && !downloadingFile ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-gray-400">
                  <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="animate-pulse">{t('scanner.scanning')}</p>
                </div>
              ) : downloadingFile ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-gray-600">
                  <Download className="w-12 h-12 text-blue-500 animate-bounce" />
                  <div className="w-full max-w-sm bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                      style={{ width: `${Math.min(100, Math.max(0, downloadProgress))}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between w-full max-w-sm text-sm font-medium">
                    <span>{t('scanner.downloading') || 'Downloading preview...'}</span>
                    <span>{downloadProgress}% ({formatBytes(downloadLoaded)} / {downloadTotal > 0 ? formatBytes(downloadTotal) : '?'})</span>
                  </div>
                </div>
              ) : imageUrl ? (
                <DocumentPreview
                  images={previewImages}
                  fallbackNode={<object data={imageUrl} type="application/pdf" className="w-full h-full rounded-lg shadow-md border border-gray-200"></object>}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                  <Scan className="w-12 h-12 opacity-20" />
                  <p>{t('scanner.noPreview')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Files List Modal */}
      {isFileListModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6" onClick={() => setIsFileListModalOpen(false)}>
          <div 
            className="bg-white rounded-xl shadow-xl border border-gray-100 p-6 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="font-medium text-gray-800">{t('scanner.scannedFiles') || 'Scanned Files'}</h2>
                <button 
                  onClick={fetchFiles} 
                  disabled={loadingFiles}
                  className="text-gray-500 hover:text-blue-600 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingFiles ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <button 
                onClick={() => setIsFileListModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2">
              {errorFiles ? (
                <div className="text-sm text-red-500">{t('scanner.errorFiles') || 'Failed to load files'}</div>
              ) : files.length === 0 && !loadingFiles ? (
                <div className="text-sm text-gray-500">{t('scanner.noFiles') || 'No files found'}</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {files.map((f) => (
                    <div key={f.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-medium text-gray-700 truncate" title={f.name}>{f.name}</span>
                        <span className="text-xs text-gray-500">{f.sizeString || formatBytes(f.size || 0)} • {new Date(f.lastModified).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button 
                          onClick={() => handleDownloadFile(f.name)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title={t('scanner.download') || 'Download'}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteFile(f.name)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title={t('scanner.delete') || 'Delete'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Mobile floating scan button */}
      {!loadingContext && !errorContext && devices.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 p-4 bg-white border-t border-gray-200 shadow-lg flex items-center gap-3">
          <Select
            options={(selectedScanner?.pipelines ?? ['Scan as PNG', 'Scan as PDF']).map((p) => ({
              value: p,
              label: p.replace('Scan as ', ''),
            }))}
            value={pipeline}
            onChange={(v) => {
              setPipeline(v);
              localStorage.setItem('scanner_last_pipeline', v);
            }}
            disabled={scanning}
            className="p-3 w-[120px] rounded-lg text-sm font-medium text-gray-700"
          />
          <button
            onClick={handleScan}
            disabled={scanning || !selectedScannerId}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-medium transition-colors"
          >
            {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Scan className="w-5 h-5" />}
            {t('scanner.scanBtn')}
          </button>
        </div>
      )}
    </div>
  );
}
