import React, { useState } from 'react';
import {
  Route,
  Plus,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  ArrowUpRight,
} from 'lucide-react';
import {
  type RoutingRule,
  type TunnelMode,
  evaluateRoutingTarget,
} from '../utils/cinCrypto';

interface RoutingEngineViewProps {
  rules: RoutingRule[];
  onToggleRule: (id: string) => void;
  onAddRule: (rule: Omit<RoutingRule, 'id' | 'hits'>) => void;
  onDeleteRule: (id: string) => void;
  tunnelMode: TunnelMode;
  onChangeTunnelMode: (mode: TunnelMode) => void;
  theme: 'navy' | 'light';
}

export const RoutingEngineView: React.FC<RoutingEngineViewProps> = ({
  rules,
  onToggleRule,
  onAddRule,
  onDeleteRule,
  tunnelMode,
  onChangeTunnelMode,
  theme,
}) => {
  const isNavy = theme === 'navy';

  // TUN Kernel Parameters
  const [tunStack, setTunStack] = useState<'gVisor' | 'System' | 'Mixed'>('Mixed');
  const [tunMtu, setTunMtu] = useState<number>(1500);
  const [dnsStrategy, setDnsStrategy] = useState<'FakeIP + DoH' | 'Remote DoH' | 'System DNS'>(
    'FakeIP + DoH'
  );
  const [strictRoute, setStrictRoute] = useState<boolean>(true);

  // Interactive Route Simulator
  const [probeHost, setProbeHost] = useState<string>('shaparak.ir');

  // New Rule Form
  const [newRuleName, setNewRuleName] = useState('');
  const [newMatchType, setNewMatchType] =
    useState<RoutingRule['matchType']>('domain-suffix');
  const [newPattern, setNewPattern] = useState('');
  const [newAction, setNewAction] = useState<RoutingRule['action']>('DIRECT');

  const evaluation = evaluateRoutingTarget(probeHost, rules);

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || !newPattern.trim()) return;
    onAddRule({
      name: newRuleName.trim(),
      matchType: newMatchType,
      pattern: newPattern.trim(),
      action: newAction,
      enabled: true,
    });
    setNewRuleName('');
    setNewPattern('');
  };

  const surfaceClass = isNavy
    ? 'bg-[#0D1729] border border-[#1E2D4A] text-slate-100'
    : 'bg-white border border-slate-200 text-slate-900';

  const inputClass = isNavy
    ? 'bg-[#080F1E] border border-[#1E2D4A] text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none'
    : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-sky-600 focus:outline-none';

  const dividerClass = isNavy ? 'border-[#1E2D4A]' : 'border-slate-200';

  return (
    <div className="space-y-6">
      {/* Top Panel: TUN Kernel Architecture & Interactive Route Probe */}
      <div className={`p-6 rounded-xl ${surfaceClass}`}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 cols: TUN Stack & Mode Configuration */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                TUN Virtual Adapter & Tunneling Engine
              </h2>
              <p className="text-sm opacity-70 mt-1">
                Configure packet capture layer, MTU framing, and DNS resolution strategy for Xray-core & Sing-box pipelines.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="tunnel-mode-select"
                  className="block text-xs font-semibold mb-1.5"
                >
                  Active Tunneling Topology
                </label>
                <select
                  id="tunnel-mode-select"
                  value={tunnelMode}
                  onChange={(e) => onChangeTunnelMode(e.target.value as TunnelMode)}
                  className={`w-full rounded-lg px-3 py-2 text-xs font-medium ${inputClass}`}
                >
                  <option value="tun-kernel">TUN Kernel Adapter (L3 Full Capture)</option>
                  <option value="split-tunnel">Smart Split-Tunnel (Domestic Direct)</option>
                  <option value="system-proxy">HTTP / SOCKS5 System Proxy</option>
                  <option value="multi-hop">Multi-Hop Cascade (Entry → Exit)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="tun-stack-select"
                  className="block text-xs font-semibold mb-1.5"
                >
                  Userspace / Kernel TCP Stack
                </label>
                <select
                  id="tun-stack-select"
                  value={tunStack}
                  onChange={(e) =>
                    setTunStack(e.target.value as 'gVisor' | 'System' | 'Mixed')
                  }
                  className={`w-full rounded-lg px-3 py-2 text-xs font-mono ${inputClass}`}
                >
                  <option value="Mixed">Mixed (System TCP + gVisor UDP)</option>
                  <option value="gVisor">gVisor Userspace Stack</option>
                  <option value="System">Native OS Kernel Stack</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="tun-mtu-input"
                  className="block text-xs font-semibold mb-1.5"
                >
                  Interface MTU Size (Bytes)
                </label>
                <input
                  id="tun-mtu-input"
                  type="number"
                  min={1280}
                  max={9000}
                  step={20}
                  value={tunMtu}
                  onChange={(e) => setTunMtu(Number(e.target.value) || 1500)}
                  className={`w-full rounded-lg px-3 py-2 text-xs font-mono tabular-nums ${inputClass}`}
                />
              </div>

              <div>
                <label
                  htmlFor="dns-strategy-select"
                  className="block text-xs font-semibold mb-1.5"
                >
                  Anti-Poisoning DNS Engine
                </label>
                <select
                  id="dns-strategy-select"
                  value={dnsStrategy}
                  onChange={(e) =>
                    setDnsStrategy(
                      e.target.value as 'FakeIP + DoH' | 'Remote DoH' | 'System DNS'
                    )
                  }
                  className={`w-full rounded-lg px-3 py-2 text-xs font-mono ${inputClass}`}
                >
                  <option value="FakeIP + DoH">FakeIP (198.18.0.0/15) + DoH</option>
                  <option value="Remote DoH">Encrypted Remote DoH (1.1.1.1)</option>
                  <option value="System DNS">Direct Local Resolver</option>
                </select>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between">
              <label className="flex items-center gap-2.5 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={strictRoute}
                  onChange={(e) => setStrictRoute(e.target.checked)}
                  className="rounded accent-sky-500 w-4 h-4"
                />
                <span>
                  Enforce Strict Route & WebRTC IPv6 Leak Prevention
                </span>
              </label>

              <span className="text-xs font-mono opacity-65">
                Interface: utun99 · {tunStack} · MTU {tunMtu}
              </span>
            </div>
          </div>

          {/* Right 5 cols: Live Route Decision Simulator */}
          <div className={`lg:col-span-5 lg:border-l lg:pl-8 ${dividerClass} space-y-4`}>
            <div>
              <h3 className="text-sm font-semibold">
                Interactive Split-Tunnel Route Simulator
              </h3>
              <p className="text-xs opacity-65 mt-0.5">
                Test any domain or IP address against your active routing table in real time.
              </p>
            </div>

            <div>
              <label
                htmlFor="route-simulator-input"
                className="block text-xs font-semibold mb-1.5"
              >
                Target Hostname or IPv4 Address
              </label>
              <input
                id="route-simulator-input"
                type="text"
                value={probeHost}
                onChange={(e) => setProbeHost(e.target.value)}
                placeholder="e.g. shaparak.ir, github.com, 192.168.1.10"
                className={`w-full rounded-lg px-3.5 py-2 text-xs font-mono ${inputClass}`}
              />
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {['shaparak.ir', 'github.com', 'ads.doubleclick.net', '192.168.1.25'].map(
                  (sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => setProbeHost(sample)}
                      className="text-xs font-mono underline opacity-70 hover:opacity-100"
                    >
                      {sample}
                    </button>
                  )
                )}
              </div>
            </div>

            <div
              className={`p-4 rounded-lg border ${dividerClass} space-y-1.5 text-xs`}
              aria-live="polite"
            >
              <div className="flex items-center justify-between">
                <span className="opacity-65">Routing Verdict:</span>
                <span
                  className={`font-mono font-bold ${
                    evaluation.action === 'PROXY'
                      ? 'text-sky-400'
                      : evaluation.action === 'DIRECT'
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  {evaluation.action === 'PROXY'
                    ? 'TUNNEL VIA COREINET NODE'
                    : evaluation.action === 'DIRECT'
                    ? 'BYPASS TUNNEL (DIRECT ISP)'
                    : 'SINKHOLE / BLOCKED'}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px] opacity-75">
                <span>Matched Rule:</span>
                <span>
                  {evaluation.matchedRule
                    ? `${evaluation.matchedRule.name} (${evaluation.matchedRule.pattern})`
                    : 'Default Outbound Fallback (PROXY)'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Panel: Split-Tunneling Rule Table & Rule Creator */}
      <div className={`p-6 rounded-xl ${surfaceClass}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-inherit">
          <div>
            <h3 className="text-base font-semibold">
              Active Split-Tunneling & Routing Rules ({rules.length})
            </h3>
            <p className="text-xs opacity-65 mt-0.5">
              Rules are evaluated top-to-bottom. Unmatched traffic defaults to encrypted CoreInet tunnel.
            </p>
          </div>
        </div>

        {/* Add New Rule Form */}
        <form
          onSubmit={handleCreateRule}
          className={`grid grid-cols-1 sm:grid-cols-12 gap-3 py-4 border-b ${dividerClass} items-end`}
        >
          <div className="sm:col-span-4">
            <label htmlFor="new-rule-name" className="block text-xs font-medium mb-1">
              Rule Description
            </label>
            <input
              id="new-rule-name"
              type="text"
              value={newRuleName}
              onChange={(e) => setNewRuleName(e.target.value)}
              placeholder="e.g. Banking Direct Bypass"
              className={`w-full rounded-lg px-3 py-1.5 text-xs ${inputClass}`}
            />
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="new-rule-type" className="block text-xs font-medium mb-1">
              Match Condition
            </label>
            <select
              id="new-rule-type"
              value={newMatchType}
              onChange={(e) =>
                setNewMatchType(e.target.value as RoutingRule['matchType'])
              }
              className={`w-full rounded-lg px-3 py-1.5 text-xs font-mono ${inputClass}`}
            >
              <option value="domain-suffix">domain-suffix</option>
              <option value="domain-keyword">domain-keyword</option>
              <option value="ip-cidr">ip-cidr</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="new-rule-pattern" className="block text-xs font-medium mb-1">
              Pattern (Domain or CIDR)
            </label>
            <input
              id="new-rule-pattern"
              type="text"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder="e.g. .bank.ir or 10.0.0.0/8"
              className={`w-full rounded-lg px-3 py-1.5 text-xs font-mono ${inputClass}`}
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <select
              aria-label="New rule outbound action"
              value={newAction}
              onChange={(e) => setNewAction(e.target.value as RoutingRule['action'])}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-mono ${inputClass}`}
            >
              <option value="DIRECT">DIRECT</option>
              <option value="PROXY">PROXY</option>
              <option value="BLOCK">BLOCK</option>
            </select>

            <button
              type="submit"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-core flex items-center gap-1 whitespace-nowrap shrink-0 ${
                isNavy
                  ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </form>

        {/* Rules Table */}
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b ${dividerClass} opacity-65 font-medium`}>
                <th className="py-3 pr-4">Rule Name</th>
                <th className="py-3 px-4">Match Type · Pattern</th>
                <th className="py-3 px-4">Outbound Action</th>
                <th className="py-3 px-4 text-right">Matched Packets</th>
                <th className="py-3 pl-4 text-right">Controls</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${dividerClass}`}>
              {rules.map((rule) => (
                <tr key={rule.id} className={rule.enabled ? '' : 'opacity-45'}>
                  <td className="py-3 pr-4 font-semibold">{rule.name}</td>
                  <td className="py-3 px-4 font-mono">
                    {rule.matchType} · {rule.pattern}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold">
                    <span
                      className={
                        rule.action === 'PROXY'
                          ? 'text-sky-400'
                          : rule.action === 'DIRECT'
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }
                    >
                      {rule.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    {rule.hits.toLocaleString()}
                  </td>
                  <td className="py-3 pl-4 text-right">
                    <div className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onToggleRule(rule.id)}
                        className="text-xs underline font-medium"
                      >
                        {rule.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete rule ${rule.name}`}
                        onClick={() => onDeleteRule(rule.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
