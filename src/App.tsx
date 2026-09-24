import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bus,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Search,
  Activity,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface ServiceArrival {
  ServiceNo: string;
  nextBuses: number[];
}

interface HealthStatus {
  keyConfigured?: boolean;
  ltaAnswered?: boolean;
  statusCode?: number;
  upstreamStatus?: number;
  error?: string;
  status?: string;
}

const PRESET_STOPS = [
  { code: '04121', name: 'Bras Basah Rd - NTUC Income Ctr (SMU)', tag: 'SMU Main' },
  { code: '08069', name: 'Stamford Rd - SMU / Opp Stamford Court', tag: 'SMU Stamford' },
  { code: '04179', name: 'Victoria St - SMU Sch of Economics', tag: 'SMU SOE' },
  { code: '01012', name: 'Victoria St - Hotel Grand Pacific', tag: 'Victoria St' },
  { code: '01019', name: 'Victoria St - Bugis Stn Exit A', tag: 'Bugis' },
  { code: '03011', name: 'Orchard Rd - Dhoby Ghaut Stn', tag: 'Dhoby Ghaut' },
];

export default function App() {
  const [busStopCode, setBusStopCode] = useState<string>('04121');
  const [searchInput, setSearchInput] = useState<string>('04121');
  const [services, setServices] = useState<ServiceArrival[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number>(20);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>('');

  // Fixed accessed date formatted as requested
  const accessedDate = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const fetchArrivals = useCallback(async (stopCode: string, isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/bus?BusStopCode=${encodeURIComponent(stopCode)}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || `Error: Received HTTP ${response.status}`);
        setServices([]);
      } else if (Array.isArray(data)) {
        setServices(data);
        setError(null);
      } else if (data && Array.isArray(data.services)) {
        setServices(data.services);
        setError(null);
      } else {
        setServices([]);
      }
      setLastUpdated(new Date());
      setCountdown(20);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to connect to the bus arrival service.');
      setServices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({
        keyConfigured: false,
        ltaAnswered: false,
        error: 'Unable to reach /api/health endpoint',
      });
    }
  }, []);

  // Initial fetch and health check
  useEffect(() => {
    fetchArrivals(busStopCode);
    checkHealth();
  }, [busStopCode, fetchArrivals, checkHealth]);

  // 20-second automatic refresh cycle
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchArrivals(busStopCode);
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [busStopCode, fetchArrivals]);

  const handleStopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = searchInput.trim();
    if (cleanCode) {
      setLoading(true);
      setBusStopCode(cleanCode);
    }
  };

  const currentPreset = PRESET_STOPS.find((s) => s.code === busStopCode);

  const filteredServices = services.filter((s) =>
    s.ServiceNo.toLowerCase().includes(filterQuery.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Notification / Key Warning Bar */}
      {health && health.keyConfigured === false && (
        <div className="bg-amber-950/90 border-b border-amber-600/50 text-amber-200 px-4 py-2.5 text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Setup Notice:</strong> {health.error || 'LTA_ACCOUNT_KEY is not set. Add it in Vercel and redeploy.'}
            </span>
          </div>
          <button
            onClick={() => setShowDiagnostics(true)}
            className="text-xs bg-amber-800 hover:bg-amber-700 px-2 py-1 rounded text-white ml-2 transition"
          >
            Diagnostics
          </button>
        </div>
      )}

      {/* Main Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  Singapore Bus Arrivals
                </h1>
                <span className="text-[10px] uppercase font-semibold tracking-wider bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                  SMU Project
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Live DataMall v3 Feed • Synchronized every 20 seconds
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Auto refresh countdown badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
              <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>
                Syncing in <strong className="text-emerald-400 font-mono">{countdown}s</strong>
              </span>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchArrivals(busStopCode, true)}
              disabled={refreshing}
              aria-label="Refresh arrivals now"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-medium rounded-lg shadow transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Health / Diagnostics Button */}
            <button
              onClick={() => {
                checkHealth();
                setShowDiagnostics(!showDiagnostics);
              }}
              title="System Health & API Diagnostics"
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            >
              <Activity className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Diagnostics Drawer (Collapsible) */}
      {showDiagnostics && (
        <div className="bg-slate-950 border-b border-slate-800 px-4 py-4 transition-all">
          <div className="max-w-5xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">System Diagnostics (api/health.js)</h2>
              </div>
              <button
                onClick={() => setShowDiagnostics(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Key Status</span>
                <span className="font-semibold flex items-center gap-1.5">
                  {health?.keyConfigured ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Configured</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span className="text-amber-400">Not Set</span>
                    </>
                  )}
                </span>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Upstream LTA Status</span>
                <span className="font-semibold font-mono text-slate-200">
                  {health?.statusCode ?? health?.upstreamStatus ? `HTTP ${health?.statusCode ?? health?.upstreamStatus}` : 'Checking...'}
                </span>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block mb-1">Cache Policy</span>
                <span className="text-slate-300 font-mono">s-maxage=20, stale-while-revalidate=40</span>
              </div>
            </div>
            {health?.error && (
              <div className="p-2.5 bg-red-950/40 border border-red-800/60 rounded text-red-300 text-xs">
                {health.error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 py-6 flex-1 w-full space-y-6">
        {/* Bus Stop Selector & Presets */}
        <section className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex-1">
              <label htmlFor="bus-stop-input" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Current Bus Stop
              </label>
              <form onSubmit={handleStopSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="bus-stop-input"
                    type="text"
                    maxLength={5}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Enter 5-digit Stop Code (e.g. 04121)"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 outline-none transition"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition cursor-pointer"
                >
                  Load Stop
                </button>
              </form>
            </div>

            {/* Active Stop Badge */}
            <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between sm:justify-start gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Selected Stop
                </div>
                <div className="text-base sm:text-lg font-bold font-mono text-emerald-400">
                  {busStopCode}
                </div>
              </div>
              <div className="h-8 w-px bg-slate-700 hidden sm:block" />
              <div className="text-xs text-slate-300 max-w-xs">
                {currentPreset ? currentPreset.name : 'Custom Bus Stop'}
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="mt-4 pt-3 border-t border-slate-700/60">
            <div className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
              <span>Nearby SMU & Downtown Stops:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_STOPS.map((stop) => {
                const isActive = busStopCode === stop.code;
                return (
                  <button
                    key={stop.code}
                    onClick={() => {
                      setBusStopCode(stop.code);
                      setSearchInput(stop.code);
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                        : 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }`}
                  >
                    <span className="font-mono">{stop.code}</span>
                    <span className="text-[10px] text-slate-400">({stop.tag})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Live Arrivals Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span>Live Bus Arrivals</span>
              <span className="text-xs font-normal text-slate-400">
                ({services.length} {services.length === 1 ? 'service' : 'services'} monitored)
              </span>
            </h2>
            {lastUpdated && (
              <span className="text-[11px] text-slate-400">
                Last checked at {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Quick Filter */}
          {services.length > 0 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter service no..."
                className="bg-slate-800/80 border border-slate-700 focus:border-emerald-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none transition w-36 sm:w-44"
              />
            </div>
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="bg-red-950/40 border border-red-800/60 rounded-2xl p-4 text-red-200 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-white">Arrival Feed Notice</p>
              <p className="text-red-300 text-xs sm:text-sm">{error}</p>
              {error.includes('LTA_ACCOUNT_KEY') && (
                <p className="text-xs text-slate-300 mt-2 bg-slate-900/60 p-2.5 rounded border border-slate-800">
                  To view live arrivals, configure your LTA DataMall Account Key in your deployment environment variables or Secrets.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Services List Panel */}
        <section className="space-y-3" aria-label="Bus Services List">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-slate-800/40 border border-slate-800 rounded-xl p-4 flex items-center justify-between animate-pulse"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-10 bg-slate-700 rounded-lg" />
                    <div className="space-y-2">
                      <div className="w-24 h-4 bg-slate-700 rounded" />
                      <div className="w-32 h-3 bg-slate-800 rounded" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-20 h-9 bg-slate-700 rounded-lg" />
                    <div className="w-20 h-9 bg-slate-700 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : services.length === 0 ? (
            /* Plain sentence when a stop has no services running */
            <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
              <Bus className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-slate-300 text-base font-medium">
                No buses currently running for this bus stop.
              </p>
              <p className="text-xs text-slate-500">
                Services may not be operating at this hour, or the bus stop code may be inactive.
              </p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-6 text-center text-slate-400 text-sm">
              No services match &ldquo;{filterQuery}&rdquo;.
            </div>
          ) : (
            filteredServices.map((service) => {
              const arrivals = service.nextBuses || [];
              const hasBusesRunning = arrivals.length > 0;

              return (
                <div
                  key={service.ServiceNo}
                  className="bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl p-4 transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  {/* Service Number Badge */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-12 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center font-bold text-lg text-emerald-400 font-mono tracking-tight shadow-inner">
                      {service.ServiceNo}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        Service {service.ServiceNo}
                      </div>
                      <div className="text-xs text-slate-400">
                        {hasBusesRunning
                          ? `${arrivals.length} upcoming ${arrivals.length === 1 ? 'arrival' : 'arrivals'} scheduled`
                          : 'Operational status'}
                      </div>
                    </div>
                  </div>

                  {/* Arrival Times or Plain Sentence */}
                  <div className="flex items-center justify-start sm:justify-end">
                    {hasBusesRunning ? (
                      <div className="flex items-center gap-3">
                        {/* Next Bus 1 */}
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-1">
                            Next Bus
                          </span>
                          {arrivals[0] < 1 ? (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                              Arriving
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-700/80 text-white border border-slate-600">
                              <strong className="text-sm font-mono mr-1">{arrivals[0]}</strong> min
                            </span>
                          )}
                        </div>

                        {/* Next Bus 2 (if available) */}
                        {arrivals.length > 1 ? (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-1">
                              2nd Bus
                            </span>
                            {arrivals[1] < 1 ? (
                              <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                Arriving
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/90 text-slate-300 border border-slate-700">
                                <strong className="text-sm font-mono mr-1 text-white">{arrivals[1]}</strong> min
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-1">
                              2nd Bus
                            </span>
                            <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-[11px] text-slate-500 bg-slate-900/60 border border-slate-800">
                              No 2nd bus
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Plain sentence when a service has no buses running */
                      <div className="text-xs sm:text-sm text-slate-400 bg-slate-900/70 border border-slate-800/80 px-3.5 py-2 rounded-lg">
                        No buses currently operating for this service.
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>

      {/* Footer with exact required license line and working link */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-950/80 text-slate-400 text-xs py-6 px-4">
        <div className="max-w-5xl mx-auto space-y-2 leading-relaxed">
          <p>
            Contains information from LTA DataMall Bus Arrival accessed on {accessedDate} from the Land
            Transport Authority (LTA DataMall), which is made available under the terms of the
            Singapore Open Data Licence version 1.0{' '}
            <a
              href="https://data.gov.sg/open-data-licence"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition"
            >
              https://data.gov.sg/open-data-licence
            </a>
            . This is an SMU course project and is not affiliated with or endorsed by the Land
            Transport Authority.
          </p>
        </div>
      </footer>
    </div>
  );
}
