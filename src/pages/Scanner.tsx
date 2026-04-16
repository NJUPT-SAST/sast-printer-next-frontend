import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useUi } from '@/components/ui-context';
import { fetchContext, submitScan, type Scanner } from '@/lib/scannerApi';
import { Download, Loader2, Scan } from 'lucide-react';

export default function ScannerPage() {
  const { t } = useTranslation();
  const { toast } = useUi();

  const [, setScannerMapping] = useState<Record<string, string> | null>(null);
  const [devices, setDevices] = useState<Scanner[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);
  const [errorContext, setErrorContext] = useState(false);

  const [selectedScannerId, setSelectedScannerId] = useState<string>('');
  const [resolution, setResolution] = useState<string>('300');
  const [colorMode, setColorMode] = useState<string>('Color');
  const [pipeline, setPipeline] = useState<string>('Scan as PNG');

  const [scanning, setScanning] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoadingContext(true);
        
        let mapping: Record<string, string> | null = null;
        try {
          const res = await fetch('/scannerMapping.json');
          if (res.ok) {
            mapping = await res.json();
            setScannerMapping(mapping);
          }
        } catch (e) {
          console.warn('Could not load scannerMapping.json', e);
        }

        const data = await fetchContext();
        if (data && Array.isArray(data)) {
          let finalDevices = data;
          
          if (mapping) {
            finalDevices = data.filter((device) => {
              return !!(mapping![device.name] || mapping![device.id]);
            }).map((device) => {
              const mappedName = mapping![device.name] || mapping![device.id];
              return {
                ...device,
                name: mappedName,
                model: undefined, // Clear model so we just display the mapped name
              };
            });
          }
          
          setDevices(finalDevices);
          if (finalDevices.length === 1) {
            setSelectedScannerId(finalDevices[0].id);
          }
        }
      } catch (err) {
        console.error(err);
        setErrorContext(true);
        toast({ message: t('scanner.error') || 'Error loading scanners', type: 'error' });
      } finally {
        setLoadingContext(false);
      }
    }
    load();
  }, [t, toast]);

  const selectedScanner = devices.find((s) => s.id === selectedScannerId);

  const features = (selectedScanner?.features as Record<string, any>) || {};
  
  const resolutions = features['--resolution']?.constraint || [75, 150, 300, 600];
  const colorModes = features['--mode']?.constraint || ['Color', 'Gray', 'Lineart'];

  const handleScan = async () => {
    if (!selectedScannerId) return;
    try {
      setScanning(true);
      const requestPayload = {
        params: {
          deviceId: selectedScannerId,
          resolution: resolution,
          mode: colorMode,
        },
        pipeline: pipeline,
      };
      
      const res = await submitScan(requestPayload);
      const resData = res as Record<string, unknown>;
      if (resData && typeof resData.image === 'string') {
        setImageUrl(resData.image);
        toast({ message: t('scanner.success') || 'Scan completed successfully', type: 'success' });
      }
    } catch (err) {
      console.error(err);
      toast({ message: t('scanner.scanFailed') || 'Scan failed', type: 'error' });
    } finally {
      setScanning(false);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `scan-${new Date().getTime()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 w-full flex-1 min-h-[calc(100vh-4rem)]">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">{t('scanner.title')}</h1>
      
      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[600px]">
        {/* Sidebar Settings */}
        <div className="w-full lg:w-80 flex flex-col gap-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          
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
                <label className="text-sm font-medium text-gray-700">{t('scanner.device')}</label>
                <select
                  className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  value={selectedScannerId}
                  onChange={(e) => setSelectedScannerId(e.target.value)}
                  disabled={scanning}
                >
                  <option value="" disabled>
                    {t('scanner.selectDevice') || 'Select a scanner'}
                  </option>
                  {devices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.model ? `(${s.model})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resolution Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">{t('scanner.resolution')}</label>
                <select
                  className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  disabled={scanning}
                >
                  {resolutions.map((res: number | string) => (
                    <option key={res} value={res.toString()}>
                      {res} dpi
                    </option>
                  ))}
                </select>
              </div>

              {/* Color Mode Selection */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">{t('scanner.colorMode')}</label>
                <select
                  className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  value={colorMode}
                  onChange={(e) => setColorMode(e.target.value)}
                  disabled={scanning}
                >
                  {colorModes.map((mode: string) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Button */}
              
              {/* Pipeline Selection */}
              <div className="flex flex-col gap-2 mb-4">
                <label className="text-sm font-medium text-gray-700">{t('scanner.format') || 'Format / Pipeline'}</label>
                <select
                  className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  value={pipeline}
                  onChange={(e) => setPipeline(e.target.value)}
                  disabled={scanning}
                >
                  {((selectedScanner as any)?.pipelines || ['Scan as PNG', 'Scan as PDF']).map((p: string) => (
                    <option key={p} value={p}>
                      {p.replace('Scan as ', '')}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleScan}
                disabled={scanning || !selectedScannerId}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors"
              >
                {scanning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('scanner.scanning')}
                  </>
                ) : (
                  <>
                    <Scan className="w-5 h-5" />
                    {t('scanner.scanBtn')}
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Preview Area */}
        <div className="flex-1 flex flex-col bg-gray-50 rounded-xl border border-gray-200 overflow-hidden relative min-h-[400px]">
          <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
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
          
          <div className="flex-1 p-6 flex items-center justify-center overflow-auto">
            {scanning ? (
              <div className="flex flex-col items-center gap-3 text-gray-400">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="animate-pulse">{t('scanner.scanning')}</p>
              </div>
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt="Scan preview"
                className="max-w-full max-h-full object-contain shadow-md border border-gray-200"
              />
            ) : (
              <div className="text-gray-400 flex flex-col items-center gap-2">
                <Scan className="w-12 h-12 opacity-20" />
                <p>{t('scanner.noPreview')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
