/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bus, Clock, RefreshCw, AlertCircle, CheckCircle2, Search, ShieldCheck, MapPin } from 'lucide-react';

interface BusService {
  ServiceNo: string;
  nextBuses: number[];
  minutes?: number[];
}

interface HealthData {
  keyConfigured: boolean;
  ltaAnswered: boolean;
  upstreamStatus: number | null;
  error?: string;
  message?: string;
}

const POPULAR_STOPS = [
  { code: '04121', name: 'SMU / Bras Basah Rd (Default)' },
  { code: '04179', name: 'SMU / Stamford Rd' },
  { code: '08057', name: 'Dhoby Ghaut Stn' },
  { code: '01012', name: 'Victoria St / Hotel Grand Pacific' },
  { code: '07011', name: 'Bugis Stn Exit A' },
];

export default function App() {
  const [busStopCode, setBusStopCode] = useState<string>('04121');
  const [inputCode, setInputCode] = useState<string>('04121');
  const [services, setServices] = useState<BusService[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number>(20);
  const [healthStatus, setHealthStatus] = useState<HealthData | null>(null);
  const [checkingHealth, setCheckingHealth] = useState<boolean>(false);
  const [showHealthModal, setShowHealthModal] = useState<boolean>(false);

  // Format accessed date for the mandatory footer licence attribution
  const [accessedDate] = useState<string>(() => {
    return new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchArrivals = useCallback(async (stopCode: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/bus?BusStopCode=${encodeURIComponent(stopCode)}`);

      if (!res.ok) {
        let errorMsg = `Server error (${res.status})`;
        try {
          const errData = await res.json();
          if (errData && errData.error) {
            errorMsg = errData.error;
          }
        } catch {
          // ignore json parse error
        }
        setError(errorMsg);
        setServices([]);
        return;
      }

      const data = await res.json();
      // Handle array or object shape
      const rawList: BusService[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.services)
        ? (data as any).services
        : [];

      // Sort services alphanumerically (e.g. 7, 14, 16, 175)
      const sorted = [...rawList].sort((a, b) => {
        return a.ServiceNo.localeCompare(b.ServiceNo, undefined, { numeric: true, sensitivity: 'base' });
      });

      setServices(sorted);
      setLastUpdated(new Date());
      setCountdown(20);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error fetching bus arrivals');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount or stop code change
  useEffect(() => {
    fetchArrivals(busStopCode);
  }, [busStopCode, fetchArrivals]);

  // Set up 20-second refresh timer and 1-second countdown
  useEffect(() => {
    setCountdown(20);

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 20));
    }, 1000);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      fetchArrivals(busStopCode);
    }, 20000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [busStopCode, fetchArrivals]);

  const handleManualRefresh = () => {
    setCountdown(20);
    fetchArrivals(busStopCode);
  };

  const handleStopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim();
    if (clean) {
      setBusStopCode(clean);
    }
  };

  const checkHealth = async () => {
    setCheckingHealth(true);
    setShowHealthModal(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthStatus(data);
    } catch (err) {
      setHealthStatus({
        keyConfigured: false,
        ltaAnswered: false,
        upstreamStatus: null,
        error: err instanceof Error ? err.message : 'Health check request failed',
      });
    } finally {
      setCheckingHealth(false);
    }
  };

  // Helper to format minute value according to rules
  // rounding down to whole minutes, showing "Arriving" under one minute
  const formatArrival = (minutes: number) => {
    if (minutes < 1) {
      return 'Arriving';
    }
    return `${minutes} min${minutes > 1 ? 's' : ''}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-black">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl shadow-inner">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Live Bus Arrival Panel</h1>
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700 font-mono">
                  Stop {busStopCode}
                </span>
              </div>
              <p className="text-xs text-slate-400">SMU Course Project • Auto-refreshes every 20s</p>
            </div>
          </div>

          {/* Refresh & Health Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={checkHealth}
              title="Check LTA DataMall Upstream Status"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Health Check</span>
            </button>

            <button
              onClick={handleManualRefresh}
              disabled={loading}
              title="Refresh now"
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Updating...' : `Refresh (${countdown}s)`}</span>
            </button>
          </div>
        </div>

        {/* 20-second countdown indicator bar */}
        <div className="w-full bg-slate-800 h-0.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-1000 ease-linear"
            style={{ width: `${(countdown / 20) * 100}%` }}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl w-full mx-auto px-4 py-6 sm:py-8 flex-1">
        {/* Bus Stop Selector & Search */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 mb-6 shadow-xl">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <form onSubmit={handleStopSubmit} className="flex items-center space-x-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="Enter 5-digit bus stop code (e.g. 04121)"
                  maxLength={6}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 outline-none font-mono"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition cursor-pointer"
              >
                Go
              </button>
            </form>

            {lastUpdated && (
              <div className="flex items-center space-x-1.5 text-xs text-slate-400 self-center">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Last updated {lastUpdated.toLocaleTimeString()}</span>
              </div>
            )}
          </div>

          {/* Quick Preset Buttons */}
          <div className="mt-3.5 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 mr-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-400" /> Stops:
            </span>
            {POPULAR_STOPS.map((stop) => (
              <button
                key={stop.code}
                onClick={() => {
                  setInputCode(stop.code);
                  setBusStopCode(stop.code);
                }}
                className={`px-2.5 py-1 rounded-lg border transition cursor-pointer font-mono ${
                  busStopCode === stop.code
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {stop.code} - {stop.name}
              </button>
            ))}
          </div>
        </section>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-950/50 border border-red-800/80 rounded-2xl p-4 sm:p-5 flex items-start space-x-3 text-red-200 shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-300 text-sm">Unable to load bus arrival data</h3>
              <p className="text-sm mt-1 text-red-300/90">{error}</p>
              {error.includes('LTA_ACCOUNT_KEY') && (
                <div className="mt-3 bg-red-900/30 border border-red-700/50 rounded-xl p-3 text-xs text-red-200">
                  <p className="font-medium text-red-200 mb-1">Configuration Needed:</p>
                  <p>
                    Ensure your <code>LTA_ACCOUNT_KEY</code> is configured in your deployment environment variables or Secrets panel.
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={handleManualRefresh}
              className="text-xs bg-red-900/40 hover:bg-red-900/70 border border-red-700/50 px-3 py-1.5 rounded-lg text-red-200 shrink-0 transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Services List Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-200 flex items-center space-x-2">
              <span>Arrival Times</span>
              <span className="text-xs font-normal text-slate-400">({services.length} services found)</span>
            </h2>
            <div className="text-xs text-slate-400">
              Auto-updating every 20s (matching LTA DataMall)
            </div>
          </div>

          {loading && services.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center shadow-lg">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-300">Fetching live arrivals for bus stop {busStopCode}...</p>
              <p className="text-xs text-slate-500 mt-1">Calling LTA DataMall Bus Arrival v3</p>
            </div>
          ) : services.length === 0 && !error ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center shadow-lg">
              <Bus className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-base text-slate-300 font-medium">No buses running</p>
              <p className="text-sm text-slate-400 mt-1">
                No bus services are currently operating at bus stop {busStopCode}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {services.map((service) => {
                const nextBuses = service.nextBuses || service.minutes || [];
                const hasBuses = nextBuses.length > 0;

                return (
                  <div
                    key={service.ServiceNo}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 sm:p-5 transition-all shadow-md flex items-center justify-between"
                  >
                    {/* Left: Service Number Badge */}
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-14 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-xl flex items-center justify-center shadow-inner font-extrabold text-white text-2xl tracking-tight border border-emerald-400/30">
                        {service.ServiceNo}
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Service {service.ServiceNo}
                        </div>
                        {!hasBuses && (
                          <div className="text-sm text-slate-400 mt-0.5">
                            No buses running.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Arrival times or plain sentence when no buses */}
                    <div className="flex items-center space-x-2 text-right">
                      {hasBuses ? (
                        <div className="flex items-center space-x-2">
                          {/* Next Bus */}
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-slate-400 uppercase font-medium">Next Bus</span>
                            <span
                              className={`px-3 py-1 rounded-lg text-sm font-bold border ${
                                nextBuses[0] < 1
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                                  : 'bg-slate-800 text-slate-100 border-slate-700'
                              }`}
                            >
                              {formatArrival(nextBuses[0])}
                            </span>
                          </div>

                          {/* 2nd Bus (if scheduled) */}
                          {nextBuses.length > 1 ? (
                            <div className="flex flex-col items-end pl-2 border-l border-slate-800">
                              <span className="text-[10px] text-slate-400 uppercase font-medium">2nd Bus</span>
                              <span
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                                  nextBuses[1] < 1
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-slate-950 text-slate-300 border-slate-800'
                                }`}
                              >
                                {formatArrival(nextBuses[1])}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end pl-2 border-l border-slate-800 text-[11px] text-slate-400">
                              <span>Subsequent</span>
                              <span className="text-slate-400 italic">No 2nd bus</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 italic">
                          No buses running
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Health Check Modal */}
        {showHealthModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-semibold text-white text-base">LTA Service Health</h3>
                </div>
                <button
                  onClick={() => setShowHealthModal(false)}
                  className="text-slate-400 hover:text-white text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm">
                {checkingHealth ? (
                  <div className="py-6 text-center text-slate-400 flex flex-col items-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mb-2" />
                    Checking /api/health upstream...
                  </div>
                ) : healthStatus ? (
                  <>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 text-xs">Account Key Configured:</span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          healthStatus.keyConfigured
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}
                      >
                        {healthStatus.keyConfigured ? 'Yes (Configured)' : 'No (Missing)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 text-xs">LTA DataMall Answered:</span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          healthStatus.ltaAnswered
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {healthStatus.ltaAnswered ? 'Yes' : 'No'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 text-xs">Upstream HTTP Status:</span>
                      <span className="text-xs font-mono font-bold text-slate-200">
                        {healthStatus.upstreamStatus ?? 'N/A'}
                      </span>
                    </div>

                    {healthStatus.error && (
                      <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300">
                        <span className="font-semibold">Message:</span> {healthStatus.error}
                      </div>
                    )}

                    {healthStatus.message && (
                      <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{healthStatus.message}</span>
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setShowHealthModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mandatory Footer with exact statutory licence attribution line and active link */}
      <footer className="border-t border-slate-800/80 bg-slate-950/90 text-slate-400 text-xs px-4 py-6 mt-8">
        <div className="max-w-5xl mx-auto">
          <p className="leading-relaxed">
            Contains information from LTA DataMall Bus Arrival accessed on {accessedDate} from the Land
            Transport Authority (LTA DataMall), which is made available under the terms of the
            Singapore Open Data Licence version 1.0{' '}
            <a
              href="https://data.gov.sg/open-data-licence"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
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
