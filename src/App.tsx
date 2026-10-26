/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Power,
  ShieldCheck,
  Activity,
  Sliders,
  Lock,
  ArrowRight,
  RefreshCw,
  Sun,
  Moon,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';
import {
  type CoreNode,
  type TunnelMode,
  type RoutingRule,
  calculateNodeQualityScore,
} from './utils/cinCrypto';
import { INITIAL_NODES, INITIAL_ROUTING_RULES } from './data/seedNodes';
import { ThroughputGraph, type TelemetryPoint } from './components/ThroughputGraph';
import { CinStudioView } from './components/CinStudioView';
import { ServerMatrixView } from './components/ServerMatrixView';
import { RoutingEngineView } from './components/RoutingEngineView';

type ActiveSection = 'dashboard' | 'matrix' | 'cin-studio' | 'routing';

export default function App() {
  // Theme: 'navy' (تم سرمه‌ای) | 'light' (تم لایت / سفید)
  const [theme, setTheme] = useState<'navy' | 'light'>('navy');
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');

  // Nodes & Selection State
  const [nodes, setNodes] = useState<CoreNode[]>(INITIAL_NODES);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(INITIAL_NODES[0].id);
  const [compareNodeId, setCompareNodeId] = useState<string>(INITIAL_NODES[1].id);
  const [entryRelayNodeId, setEntryRelayNodeId] = useState<string>(INITIAL_NODES[4].id);

  // Connection & Tunneling State
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [tunnelMode, setTunnelMode] = useState<TunnelMode>('tun-kernel');
  const [uptimeSeconds, setUptimeSeconds] = useState<number>(5182);
  const [sessionDownGB, setSessionDownGB] = useState<number>(14.82);
  const [sessionUpGB, setSessionUpGB] = useState<number>(3.41);
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);
  const [copiedUri, setCopiedUri] = useState<boolean>(false);

  // Routing Rules
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>(INITIAL_ROUTING_RULES);

  // Rolling 24-point throughput history
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>(() => {
    const initial: TelemetryPoint[] = [];
    for (let i = 0; i < 24; i++) {
      initial.push({
        timestamp: `${i}s`,
        downMbps: 185 + Math.round(Math.sin(i * 0.45) * 65 + (i % 3) * 18),
        upMbps: 62 + Math.round(Math.cos(i * 0.35) * 24 + (i % 2) * 9),
        pingMs: 28 + (i % 3),
      });
    }
    return initial;
  });

  const activeNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || nodes[0],
    [nodes, selectedNodeId]
  );

  const entryRelayNode = useMemo(
    () => nodes.find((n) => n.id === entryRelayNodeId) || nodes[4] || nodes[0],
    [nodes, entryRelayNodeId]
  );

  const activeQualityScore = useMemo(
    () => calculateNodeQualityScore(activeNode),
    [activeNode]
  );

  // Live telemetry & uptime loop while connected
  useEffect(() => {
    if (!isConnected) return;

    const timer = setInterval(() => {
      setUptimeSeconds((prev) => prev + 1);
      setSessionDownGB((prev) => +(prev + 0.014).toFixed(3));
      setSessionUpGB((prev) => +(prev + 0.004).toFixed(3));

      setTelemetryHistory((prev) => {
        const baseDown = Math.min(820, Math.round(activeNode.downloadMbps * 0.28));
        const baseUp = Math.min(340, Math.round(activeNode.uploadMbps * 0.16));
        const wave = Math.sin(Date.now() / 1800) * 48;
        const nextDown = Math.max(24, Math.round(baseDown + wave));
        const nextUp = Math.max(12, Math.round(baseUp + wave * 0.35));
        const nextPing = Math.max(
          12,
          activeNode.latencyMs +
            (tunnelMode === 'multi-hop' ? entryRelayNode.latencyMs : 0) +
            Math.round(Math.sin(Date.now() / 1200) * activeNode.jitterMs)
        );

        return [
          ...prev.slice(1),
          {
            timestamp: new Date().toLocaleTimeString(),
            downMbps: nextDown,
            upMbps: nextUp,
            pingMs: nextPing,
          },
        ];
      });
    }, 1500);

    return () => clearInterval(timer);
  }, [isConnected, activeNode, tunnelMode, entryRelayNode]);

  const formatUptime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
  };

  const handleToggleConnection = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setIsConnected((prev) => {
        const next = !prev;
        if (!next) {
          setUptimeSeconds(0);
        } else {
          setUptimeSeconds(1);
        }
        return next;
      });
      setIsTransitioning(false);
    }, 160);
  };

  const handleRunBenchmark = () => {
    setIsBenchmarking(true);
    setTimeout(() => {
      setNodes((prev) =>
        prev.map((node, i) => {
          const delta = (i % 2 === 0 ? -1 : 1) * ((i % 3) + 1);
          const nextLatency = Math.max(15, node.latencyMs + delta);
          const nextJitter = +(Math.max(0.6, node.jitterMs + delta * 0.15)).toFixed(1);
          return {
            ...node,
            latencyMs: nextLatency,
            jitterMs: nextJitter,
          };
        })
      );
      setIsBenchmarking(false);
    }, 320);
  };

  const handleImportDecryptedNode = (newNode: CoreNode, connectImmediately: boolean) => {
    setNodes((prev) => {
      const exists = prev.some((n) => n.id === newNode.id);
      if (exists) {
        return prev.map((n) => (n.id === newNode.id ? newNode : n));
      }
      return [newNode, ...prev];
    });
    setSelectedNodeId(newNode.id);
    if (connectImmediately) {
      setIsConnected(true);
      setActiveSection('dashboard');
    }
  };

  const handleCopyActiveUri = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(activeNode.rawUri).catch(() => {});
    }
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 1800);
  };

  const isNavy = theme === 'navy';

  const rootBgClass = isNavy
    ? 'bg-[#070D19] text-slate-100'
    : 'bg-[#F8FAFC] text-slate-900';

  const surfaceClass = isNavy
    ? 'bg-[#0D1729] border border-[#1E2D4A] text-slate-100'
    : 'bg-white border border-slate-200 text-slate-900';

  const dividerClass = isNavy ? 'border-[#1E2D4A]' : 'border-slate-200';

  const effectiveLatency =
    tunnelMode === 'multi-hop'
      ? activeNode.latencyMs + entryRelayNode.latencyMs
      : activeNode.latencyMs;

  return (
    <div className={`min-h-screen flex flex-col transition-core ${rootBgClass}`}>
      {/* Strict 3-Zone Top Bar Contract */}
      <header
        className={`flex items-center justify-between gap-8 px-6 lg:px-10 py-4 border-b ${
          isNavy ? 'bg-[#0A1222] border-[#1E2D4A]' : 'bg-white border-slate-200'
        }`}
      >
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('dashboard');
          }}
          className="text-xl font-bold tracking-tight font-display whitespace-nowrap shrink-0"
        >
          CoreInet
        </a>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="flex items-center gap-6 text-sm font-medium overflow-x-auto"
        >
          {[
            { id: 'dashboard', label: 'Command Center' },
            { id: 'matrix', label: 'Server Matrix' },
            { id: 'cin-studio', label: '.cin Studio' },
            { id: 'routing', label: 'Routing & TUN' },
          ].map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveSection(item.id as ActiveSection);
                }}
                className={`py-1 transition-core whitespace-nowrap shrink-0 border-b-2 ${
                  isActive
                    ? isNavy
                      ? 'border-sky-400 text-white font-semibold'
                      : 'border-slate-900 text-slate-950 font-semibold'
                    : 'border-transparent opacity-65 hover:opacity-100'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setActiveSection('cin-studio')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-core whitespace-nowrap shrink-0 ${
              isNavy
                ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            Compile / Import .cin
          </button>
        </div>
      </header>

      {/* Secondary Workspace Command Toolbar (Theme Toggle, Tunnel Mode, Core Status) */}
      <div
        className={`px-6 lg:px-10 py-3 border-b ${
          isNavy ? 'bg-[#091020] border-[#1E2D4A]' : 'bg-slate-100/80 border-slate-200'
        }`}
      >
        <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Left: Core Engine & Connection Summary */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-mono font-semibold">
              Xray-core 1.8.24 · Sing-box TUN
            </span>
            <span aria-hidden="true" className="opacity-35">·</span>
            <span className="font-mono tabular-nums">
              State:{' '}
              <strong
                className={
                  isConnected
                    ? isNavy
                      ? 'text-emerald-400'
                      : 'text-emerald-700'
                    : 'text-amber-500'
                }
              >
                {isConnected ? 'TUNNEL ESTABLISHED' : 'STANDBY (DISCONNECTED)'}
              </strong>
            </span>
            <span aria-hidden="true" className="opacity-35">·</span>
            <span className="font-mono tabular-nums opacity-80">
              Active Endpoint: {activeNode.city} ({activeNode.protocol} /{' '}
              {activeNode.transport})
            </span>
          </div>

          {/* Right: Tunneling Mode Segmented Control + Navy/Light Theme Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Tunneling Mode Selector */}
            <div
              className={`inline-flex p-0.5 rounded-lg border ${
                isNavy ? 'bg-[#060B16] border-[#1E2D4A]' : 'bg-white border-slate-200'
              }`}
              role="group"
              aria-label="Tunneling Mode"
            >
              {(
                [
                  { id: 'tun-kernel', label: 'TUN Kernel' },
                  { id: 'split-tunnel', label: 'Split Tunnel' },
                  { id: 'system-proxy', label: 'System Proxy' },
                  { id: 'multi-hop', label: 'Multi-Hop' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTunnelMode(m.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-core whitespace-nowrap shrink-0 ${
                    tunnelMode === m.id
                      ? isNavy
                        ? 'bg-[#172642] text-sky-300 font-semibold'
                        : 'bg-slate-900 text-white font-semibold'
                      : 'opacity-65 hover:opacity-100'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Dual Theme Switcher: Deep Navy (سرمه‌ای) vs Crisp Light (سفید) */}
            <div
              className={`inline-flex p-0.5 rounded-lg border ${
                isNavy ? 'bg-[#060B16] border-[#1E2D4A]' : 'bg-white border-slate-200'
              }`}
              role="group"
              aria-label="Workspace Color Theme"
            >
              <button
                type="button"
                onClick={() => setTheme('navy')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-core flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  isNavy
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Deep Navy · سرمه‌ای</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-core flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  !isNavy
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Crisp Light · لایت</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-6 lg:px-10 py-8">
        {activeSection === 'dashboard' && (
          <div className="space-y-6">
            {/* Primary 2-Column Hero Command Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left 5 Columns: Master Connection Controller & Active .cin Profile */}
              <section
                aria-label="Primary Tunnel Connection Controller"
                className={`lg:col-span-5 p-6 rounded-xl flex flex-col justify-between ${surfaceClass}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-4 pb-4 border-b border-inherit">
                    <div>
                      <div className="text-xs opacity-65 font-medium">
                        CoreInet Encrypted Tunnel Controller
                      </div>
                      <h1 className="text-xl font-bold tracking-tight mt-0.5 text-balance">
                        {activeNode.name}
                      </h1>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleConnection}
                      disabled={isTransitioning}
                      aria-pressed={isConnected}
                      className={`px-5 py-2.5 rounded-lg text-xs font-semibold transition-core flex items-center gap-2 whitespace-nowrap shrink-0 ${
                        isConnected
                          ? isNavy
                            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                            : 'bg-emerald-700 text-white hover:bg-emerald-800'
                          : isNavy
                          ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      <Power className="w-4 h-4" />
                      <span>
                        {isTransitioning
                          ? 'Switching...'
                          : isConnected
                          ? 'Disconnect Tunnel'
                          : 'Connect Tunnel'}
                      </span>
                    </button>
                  </div>

                  {/* Unboxed Metadata Line */}
                  <div className="py-3 text-xs font-mono opacity-80 flex flex-wrap items-center gap-2">
                    <span>{activeNode.protocol}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeNode.transport}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeNode.tls}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {activeNode.isCinEncrypted
                        ? `.cin Verified (${activeNode.cinSignature?.slice(0, 13)})`
                        : 'Standard Profile'}
                    </span>
                  </div>

                  {/* Tunnel Path Topology Breakdown */}
                  <div className={`py-4 border-y ${dividerClass} space-y-3`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="opacity-65">Active Tunnel Topology</span>
                      <span className="font-mono font-medium">
                        {tunnelMode === 'tun-kernel'
                          ? 'utun99 Kernel Capture'
                          : tunnelMode === 'split-tunnel'
                          ? 'Domestic Direct + International Proxy'
                          : tunnelMode === 'multi-hop'
                          ? `Cascade: ${entryRelayNode.city} → ${activeNode.city}`
                          : 'SOCKS5 127.0.0.1:10808'}
                      </span>
                    </div>

                    {tunnelMode === 'multi-hop' && (
                      <div className="flex items-center justify-between gap-3 text-xs pt-1">
                        <label htmlFor="entry-relay-select" className="opacity-70">
                          Entry Bridge Node:
                        </label>
                        <select
                          id="entry-relay-select"
                          value={entryRelayNodeId}
                          onChange={(e) => setEntryRelayNodeId(e.target.value)}
                          className={`rounded px-2.5 py-1 text-xs font-mono border ${
                            isNavy
                              ? 'bg-[#080F1E] border-[#1E2D4A] text-slate-100'
                              : 'bg-slate-50 border-slate-300 text-slate-900'
                          }`}
                        >
                          {nodes
                            .filter((n) => n.id !== activeNode.id)
                            .map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.city} ({n.protocol} · {n.latencyMs}ms)
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 pt-1 text-xs font-mono tabular-nums">
                      <div>
                        <div className="opacity-60">Local Ingress</div>
                        <div className="font-semibold mt-0.5">127.0.0.1:10809</div>
                      </div>
                      <div>
                        <div className="opacity-60">SNI Camouflage</div>
                        <div className="font-semibold mt-0.5 truncate">
                          {activeNode.sni}
                        </div>
                      </div>
                      <div>
                        <div className="opacity-60">uTLS Fingerprint</div>
                        <div className="font-semibold mt-0.5">
                          {activeNode.fingerprint}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Row inside Controller */}
                <div className="pt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <button
                    type="button"
                    onClick={handleCopyActiveUri}
                    className="inline-flex items-center gap-1.5 opacity-75 hover:opacity-100 underline whitespace-nowrap"
                  >
                    {copiedUri ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {copiedUri ? 'Copied Node URI' : 'Copy Raw Node URI'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection('cin-studio')}
                    className={`inline-flex items-center gap-1.5 font-semibold whitespace-nowrap ${
                      isNavy ? 'text-sky-400 hover:text-sky-300' : 'text-sky-700 hover:text-sky-900'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Export as Encrypted .cin</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </section>

              {/* Right 7 Columns: Real-Time Throughput Waveform & Packet Telemetry */}
              <section
                aria-label="Live Network Throughput Waveform"
                className={`lg:col-span-7 p-6 rounded-xl flex flex-col justify-between ${surfaceClass}`}
              >
                <ThroughputGraph
                  history={telemetryHistory}
                  isConnected={isConnected}
                  theme={theme}
                  activeProtocol={activeNode.protocol}
                  activeTransport={activeNode.transport}
                />

                <div
                  className={`grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 mt-4 border-t ${dividerClass} font-mono tabular-nums text-xs`}
                >
                  <div>
                    <div className="opacity-60">Session Uptime</div>
                    <div className="text-sm font-semibold mt-0.5">
                      {isConnected ? formatUptime(uptimeSeconds) : '00:00:00'}
                    </div>
                  </div>
                  <div>
                    <div className="opacity-60">Connection Quality</div>
                    <div className="text-sm font-semibold mt-0.5">
                      {activeQualityScore}/100 · {activeNode.uptimePct}% SLA
                    </div>
                  </div>
                  <div>
                    <div className="opacity-60">Effective RTT / Jitter</div>
                    <div className="text-sm font-semibold mt-0.5">
                      {isConnected
                        ? `${effectiveLatency} ms / ${activeNode.jitterMs} ms`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="opacity-60">Session Traffic</div>
                    <div className="text-sm font-semibold mt-0.5 whitespace-nowrap">
                      {sessionDownGB.toFixed(2)}↓ / {sessionUpGB.toFixed(2)}↑ GB
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Full-Width Server Selection & Differential Table */}
            <section
              aria-label="Quick Server Switcher and Differential Table"
              className={`p-6 rounded-xl ${surfaceClass}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-inherit">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Global CoreInet Nodes & Protocol Differential
                  </h2>
                  <p className="text-xs opacity-65 mt-0.5">
                    Select any server to switch the tunnel instantaneously without dropping active local sockets.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={handleRunBenchmark}
                    disabled={isBenchmarking}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-core flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      isNavy
                        ? 'border-[#1E2D4A] hover:border-sky-400 text-slate-200'
                        : 'border-slate-300 hover:border-slate-600 text-slate-800'
                    }`}
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isBenchmarking ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {isBenchmarking ? 'Testing Latency...' : 'Ping All Servers'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection('matrix')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-core flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      isNavy
                        ? 'bg-[#172642] text-sky-300 hover:bg-[#1E3154]'
                        : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    <span>Compare Side-by-Side</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={`border-b ${dividerClass} opacity-65 font-medium whitespace-nowrap`}>
                      <th className="py-3 pr-3">Server Endpoint</th>
                      <th className="py-3 px-2.5">Protocol · Transport · Security</th>
                      <th className="py-3 px-2.5">Container</th>
                      <th className="py-3 px-2.5 text-right">Ping / Jitter</th>
                      <th className="py-3 px-2.5 text-right">Uptime</th>
                      <th className="py-3 px-2.5 text-right">Capacity</th>
                      <th className="py-3 pl-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${dividerClass}`}>
                    {nodes.map((node) => {
                      const isCurrent = node.id === selectedNodeId;
                      return (
                        <tr
                          key={node.id}
                          className={`transition-core ${
                            isCurrent
                              ? isNavy
                                ? 'bg-sky-500/10'
                                : 'bg-sky-50/80'
                              : isNavy
                              ? 'hover:bg-white/[0.02]'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3 pr-3 whitespace-nowrap">
                            <div className="font-semibold">{node.name}</div>
                            <div className="font-mono text-[11px] opacity-65 mt-0.5">
                              {node.countryCode} · {node.city} · {node.address}:{node.port}
                            </div>
                          </td>
                          <td className="py-3 px-2.5 font-mono whitespace-nowrap">
                            {node.protocol} · {node.transport} · {node.tls}
                          </td>
                          <td className="py-3 px-2.5 font-mono whitespace-nowrap">
                            {node.isCinEncrypted ? (
                              <span className={isNavy ? 'text-sky-300' : 'text-sky-700 font-medium'}>
                                .cin Verified
                              </span>
                            ) : (
                              <span className="opacity-65">V2Ray URI</span>
                            )}
                          </td>
                          <td className="py-3 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                            <span
                              className={
                                node.latencyMs < 45
                                  ? isNavy
                                    ? 'text-emerald-400 font-semibold'
                                    : 'text-emerald-700 font-semibold'
                                  : node.latencyMs < 95
                                  ? isNavy
                                    ? 'text-sky-400 font-semibold'
                                    : 'text-sky-700 font-semibold'
                                  : isNavy
                                  ? 'text-amber-400 font-semibold'
                                  : 'text-amber-700 font-semibold'
                              }
                            >
                              {node.latencyMs} ms
                            </span>
                            <span className="opacity-60"> / {node.jitterMs} ms</span>
                          </td>
                          <td className="py-3 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                            {node.uptimePct.toFixed(2)}%
                          </td>
                          <td className="py-3 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                            {node.downloadMbps} Mbps · {node.loadPct}%
                          </td>
                          <td className="py-3 pl-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedNodeId(node.id);
                                setIsConnected(true);
                              }}
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-core inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                                isCurrent
                                  ? isNavy
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-emerald-700 text-white'
                                  : isNavy
                                  ? 'bg-[#080F1E] border border-[#1E2D4A] hover:border-sky-400 text-slate-200'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                              }`}
                            >
                              {isCurrent ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Connected</span>
                                </>
                              ) : (
                                <span>Switch Here</span>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeSection === 'matrix' && (
          <ServerMatrixView
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            compareNodeId={compareNodeId}
            onSelectPrimaryNode={(id) => {
              setSelectedNodeId(id);
              setIsConnected(true);
            }}
            onSelectCompareNode={(id) => setCompareNodeId(id)}
            onRunBenchmark={handleRunBenchmark}
            isBenchmarking={isBenchmarking}
            theme={theme}
          />
        )}

        {activeSection === 'cin-studio' && (
          <CinStudioView
            theme={theme}
            onImportDecryptedNode={handleImportDecryptedNode}
          />
        )}

        {activeSection === 'routing' && (
          <RoutingEngineView
            rules={routingRules}
            onToggleRule={(id) =>
              setRoutingRules((prev) =>
                prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
              )
            }
            onAddRule={(newRule) =>
              setRoutingRules((prev) => [
                {
                  ...newRule,
                  id: `rule-${Date.now()}`,
                  hits: 1,
                },
                ...prev,
              ])
            }
            onDeleteRule={(id) =>
              setRoutingRules((prev) => prev.filter((r) => r.id !== id))
            }
            tunnelMode={tunnelMode}
            onChangeTunnelMode={(m) => setTunnelMode(m)}
            theme={theme}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer
        className={`mt-12 px-6 lg:px-10 py-5 border-t text-xs opacity-65 ${
          isNavy ? 'border-[#1E2D4A]' : 'border-slate-200'
        }`}
      >
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            CoreInet Client · Encrypted Tunneling & Cryptographic .cin Container Engine
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveSection('cin-studio')}
              className="hover:underline"
            >
              .cin Format Specification
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveSection('routing')}
              className="hover:underline"
            >
              TUN & Split-Routing Rules
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
