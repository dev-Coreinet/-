import React, { useState } from 'react';
import {
  Activity,
  Search,
  RefreshCw,
  ArrowUpDown,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import {
  type CoreNode,
  type ProtocolType,
  calculateNodeQualityScore,
} from '../utils/cinCrypto';

interface ServerMatrixViewProps {
  nodes: CoreNode[];
  selectedNodeId: string;
  compareNodeId: string;
  onSelectPrimaryNode: (id: string) => void;
  onSelectCompareNode: (id: string) => void;
  onRunBenchmark: () => void;
  isBenchmarking: boolean;
  theme: 'navy' | 'light';
}

export const ServerMatrixView: React.FC<ServerMatrixViewProps> = ({
  nodes,
  selectedNodeId,
  compareNodeId,
  onSelectPrimaryNode,
  onSelectCompareNode,
  onRunBenchmark,
  isBenchmarking,
  theme,
}) => {
  const isNavy = theme === 'navy';
  const [searchQuery, setSearchQuery] = useState('');
  const [protocolFilter, setProtocolFilter] = useState<'ALL' | ProtocolType | 'CIN'>('ALL');
  const [sortBy, setSortBy] = useState<'latency' | 'quality' | 'throughput' | 'uptime'>('quality');

  const primaryNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];
  const secondaryNode =
    nodes.find((n) => n.id === compareNodeId) ||
    nodes.find((n) => n.id !== primaryNode?.id) ||
    nodes[0];

  const filteredNodes = nodes
    .filter((node) => {
      if (protocolFilter === 'CIN' && !node.isCinEncrypted) return false;
      if (
        protocolFilter !== 'ALL' &&
        protocolFilter !== 'CIN' &&
        node.protocol !== protocolFilter
      ) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        node.name.toLowerCase().includes(q) ||
        node.city.toLowerCase().includes(q) ||
        node.address.toLowerCase().includes(q) ||
        node.protocol.toLowerCase().includes(q) ||
        node.sni.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'latency') return a.latencyMs - b.latencyMs;
      if (sortBy === 'throughput') return b.downloadMbps - a.downloadMbps;
      if (sortBy === 'uptime') return b.uptimePct - a.uptimePct;
      return calculateNodeQualityScore(b) - calculateNodeQualityScore(a);
    });

  const surfaceClass = isNavy
    ? 'bg-[#0D1729] border border-[#1E2D4A] text-slate-100'
    : 'bg-white border border-slate-200 text-slate-900';

  const inputClass = isNavy
    ? 'bg-[#080F1E] border border-[#1E2D4A] text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none'
    : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-sky-600 focus:outline-none';

  const dividerClass = isNavy ? 'border-[#1E2D4A]' : 'border-slate-200';

  const getProtocolCharacteristics = (node: CoreNode) => {
    if (node.protocol === 'Hysteria2') {
      return {
        handshake: '0-RTT QUIC Brutal Congestion Control',
        dpiProfile: 'UDP Obfuscated QUIC Stream (High Loss Recovery)',
        mtuOverhead: '28 Bytes / Frame',
        bestFor: 'High-throughput 4K streaming & congested links',
      };
    }
    if (node.protocol === 'VLESS' && node.tls === 'Reality') {
      return {
        handshake: 'TLS 1.3 X25519 Reality (Zero Certificate Footprint)',
        dpiProfile: 'Borrowed SNI Fingerprint (' + node.fingerprint + ')',
        mtuOverhead: '19 Bytes / Frame',
        bestFor: 'Strict DPI bypass & ultra-stable long sessions',
      };
    }
    if (node.protocol === 'Trojan') {
      return {
        handshake: 'TLS 1.3 + HTTP/2 gRPC Multiplexed Gun Stream',
        dpiProfile: 'Standard CDN-compatible TLS ALPN h2',
        mtuOverhead: '34 Bytes / Frame',
        bestFor: 'Persistent multi-stream developer & SSH workloads',
      };
    }
    if (node.protocol === 'WireGuard') {
      return {
        handshake: 'Noise_IKpsk2 ChaCha20-Poly1305 Kernel Tunnel',
        dpiProfile: 'Low-overhead UDP Encapsulation',
        mtuOverhead: '32 Bytes / Frame',
        bestFor: 'Lowest CPU utilization & raw gigabit routing',
      };
    }
    return {
      handshake: 'TLS 1.3 WebSocket Framed Stream',
      dpiProfile: 'HTTP/1.1 Upgrade Compatible Relay',
      mtuOverhead: '38 Bytes / Frame',
      bestFor: 'Universal firewall traversal & fallback relay',
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Section: Server Differential Comparison Matrix */}
      {primaryNode && secondaryNode && (
        <div className={`p-6 rounded-xl ${surfaceClass}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-inherit">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Server Connection Differential & Tunnel Architecture Comparison
              </h2>
              <p className="text-sm opacity-70 mt-1">
                Compare latency, jitter, uptime, and cryptographic transport characteristics across active CoreInet endpoints.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <label htmlFor="compare-node-select" className="text-xs opacity-70 whitespace-nowrap">
                Compare Primary against:
              </label>
              <select
                id="compare-node-select"
                value={secondaryNode.id}
                onChange={(e) => onSelectCompareNode(e.target.value)}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${inputClass}`}
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.protocol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6">
            {[
              { role: 'Active Primary Endpoint', node: primaryNode, isPrimary: true },
              { role: 'Comparison Benchmark Endpoint', node: secondaryNode, isPrimary: false },
            ].map(({ role, node, isPrimary }) => {
              const score = calculateNodeQualityScore(node);
              const spec = getProtocolCharacteristics(node);
              const latencyDelta = node.latencyMs - (isPrimary ? secondaryNode.latencyMs : primaryNode.latencyMs);

              return (
                <div
                  key={`${role}-${node.id}`}
                  className={isPrimary ? '' : `lg:border-l lg:pl-8 ${dividerClass}`}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="text-xs opacity-65 font-medium">{role}</div>
                      <h3 className="text-base font-semibold mt-0.5">{node.name}</h3>
                      <div className="text-xs opacity-70 mt-1 font-mono">
                        {node.countryCode} · {node.city} · {node.address}:{node.port}
                      </div>
                    </div>

                    <div className="text-right font-mono tabular-nums">
                      <div className="text-xs opacity-65">Quality Index</div>
                      <div
                        className={`text-lg font-bold ${
                          score >= 88
                            ? 'text-emerald-400'
                            : score >= 70
                            ? 'text-sky-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {score}/100
                      </div>
                    </div>
                  </div>

                  {/* 4 Key Telemetry Figures */}
                  <div
                    className={`grid grid-cols-4 gap-3 py-3 border-y ${dividerClass} font-mono tabular-nums text-xs`}
                  >
                    <div>
                      <div className="opacity-60">RTT Ping</div>
                      <div className="font-semibold text-sm mt-0.5">
                        {node.latencyMs} ms
                        {latencyDelta !== 0 && (
                          <span
                            className={`ml-1 text-[11px] ${
                              latencyDelta < 0 ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            ({latencyDelta > 0 ? `+${latencyDelta}` : latencyDelta}ms)
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="opacity-60">Jitter</div>
                      <div className="font-semibold text-sm mt-0.5">{node.jitterMs} ms</div>
                    </div>
                    <div>
                      <div className="opacity-60">Uptime SLA</div>
                      <div className="font-semibold text-sm mt-0.5">{node.uptimePct}%</div>
                    </div>
                    <div>
                      <div className="opacity-60">Peak Down</div>
                      <div className="font-semibold text-sm mt-0.5">{node.downloadMbps} Mbps</div>
                    </div>
                  </div>

                  {/* Transport & Tunneling Breakdown */}
                  <dl className={`divide-y ${dividerClass} text-xs mt-2`}>
                    <div className="py-2 flex justify-between gap-4">
                      <dt className="opacity-65">Protocol & Transport</dt>
                      <dd className="font-mono font-medium">
                        {node.protocol} · {node.transport} · {node.tls}
                      </dd>
                    </div>
                    <div className="py-2 flex justify-between gap-4">
                      <dt className="opacity-65">Handshake Mechanism</dt>
                      <dd className="text-right">{spec.handshake}</dd>
                    </div>
                    <div className="py-2 flex justify-between gap-4">
                      <dt className="opacity-65">TLS SNI / ALPN</dt>
                      <dd className="font-mono">
                        {node.sni} · {node.alpn}
                      </dd>
                    </div>
                    <div className="py-2 flex justify-between gap-4">
                      <dt className="opacity-65">Optimal Workload</dt>
                      <dd className="text-right">{spec.bestFor}</dd>
                    </div>
                    <div className="py-2 flex justify-between gap-4">
                      <dt className="opacity-65">Container Integrity</dt>
                      <dd className="font-mono">
                        {node.isCinEncrypted
                          ? `.cin Encrypted (${node.cinSignature || 'Verified'})`
                          : 'Standard V2Ray URI'}
                      </dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full High-Density Node Matrix Table */}
      <div className={`p-6 rounded-xl ${surfaceClass}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-inherit">
          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented Filter Controls */}
            {(['ALL', 'CIN', 'VLESS', 'Hysteria2', 'Trojan', 'VMess', 'WireGuard'] as const).map(
              (f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setProtocolFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-core whitespace-nowrap shrink-0 ${
                    protocolFilter === f
                      ? isNavy
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'bg-slate-900 text-white font-semibold'
                      : isNavy
                      ? 'bg-[#080F1E] text-slate-300 hover:text-white border border-[#1E2D4A]'
                      : 'bg-slate-100 text-slate-700 hover:text-slate-950'
                  }`}
                >
                  {f === 'ALL'
                    ? `All Nodes (${nodes.length})`
                    : f === 'CIN'
                    ? '.cin Encrypted Only'
                    : f}
                </button>
              )
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
              <input
                type="search"
                aria-label="Filter servers by city, host, or protocol"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search city, SNI, protocol..."
                className={`pl-8 pr-3 py-1.5 rounded-lg text-xs w-52 ${inputClass}`}
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setSortBy((prev) =>
                  prev === 'quality'
                    ? 'latency'
                    : prev === 'latency'
                    ? 'throughput'
                    : prev === 'throughput'
                    ? 'uptime'
                    : 'quality'
                )
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-core flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                isNavy
                  ? 'border-[#1E2D4A] hover:border-sky-400 text-slate-200'
                  : 'border-slate-300 hover:border-slate-500 text-slate-800'
              }`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}</span>
            </button>

            <button
              type="button"
              onClick={onRunBenchmark}
              disabled={isBenchmarking}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-core flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                isNavy
                  ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBenchmarking ? 'animate-spin' : ''}`} />
              <span>
                {isBenchmarking ? 'Probing Nodes...' : 'Run Latency & Jitter Probe'}
              </span>
            </button>
          </div>
        </div>

        {/* High-Density Data Grid */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b ${dividerClass} opacity-65 font-medium whitespace-nowrap`}>
                <th className="py-3 pr-4">Endpoint & Location</th>
                <th className="py-3 px-4">Protocol · Transport · TLS</th>
                <th className="py-3 px-4">SNI & Fingerprint</th>
                <th className="py-3 px-4 text-right">RTT / Jitter</th>
                <th className="py-3 px-4 text-right">Uptime SLA</th>
                <th className="py-3 px-4 text-right">Throughput</th>
                <th className="py-3 px-4 text-right">Quality</th>
                <th className="py-3 pl-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${dividerClass}`}>
              {filteredNodes.map((node) => {
                const isSelected = node.id === selectedNodeId;
                const score = calculateNodeQualityScore(node);
                return (
                  <tr
                    key={node.id}
                    className={`transition-core ${
                      isSelected
                        ? isNavy
                          ? 'bg-sky-500/10'
                          : 'bg-sky-50/80'
                        : isNavy
                        ? 'hover:bg-white/[0.02]'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <div className="font-semibold flex items-center gap-2">
                        <span>{node.name}</span>
                        {node.isCinEncrypted && (
                          <span className="font-mono text-[11px] opacity-75">
                            · .cin
                          </span>
                        )}
                      </div>
                      <div className="opacity-65 font-mono text-[11px] mt-0.5">
                        {node.countryCode} · {node.city} · {node.address}:{node.port}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono whitespace-nowrap">
                      {node.protocol} · {node.transport} · {node.tls}
                    </td>

                    <td className="py-3 px-4 font-mono opacity-80 whitespace-nowrap">
                      {node.sni} · {node.fingerprint}
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
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

                    <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {node.uptimePct.toFixed(2)}%
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {node.downloadMbps} / {node.uploadMbps} Mbps
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold whitespace-nowrap">
                      {score}/100
                    </td>

                    <td className="py-3 pl-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectCompareNode(node.id)}
                          className="text-xs opacity-65 hover:opacity-100 underline whitespace-nowrap"
                        >
                          Compare
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectPrimaryNode(node.id)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-core flex items-center gap-1 whitespace-nowrap shrink-0 ${
                            isSelected
                              ? isNavy
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-emerald-700 text-white'
                              : isNavy
                              ? 'bg-[#080F1E] border border-[#1E2D4A] hover:border-sky-400 text-slate-200'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Active</span>
                            </>
                          ) : (
                            <span>Select Node</span>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
