import React from 'react';

export interface TelemetryPoint {
  timestamp: string;
  downMbps: number;
  upMbps: number;
  pingMs: number;
}

interface ThroughputGraphProps {
  history: TelemetryPoint[];
  isConnected: boolean;
  theme: 'navy' | 'light';
  activeProtocol: string;
  activeTransport: string;
}

export const ThroughputGraph: React.FC<ThroughputGraphProps> = ({
  history,
  isConnected,
  theme,
  activeProtocol,
  activeTransport,
}) => {
  const width = 680;
  const height = 168;
  const padX = 8;
  const padY = 14;

  const maxMbps = Math.max(
    100,
    ...history.map((h) => Math.max(h.downMbps, h.upMbps))
  );

  const buildPath = (key: 'downMbps' | 'upMbps') => {
    if (history.length === 0) return '';
    return history
      .map((pt, idx) => {
        const x =
          padX +
          (idx / Math.max(1, history.length - 1)) * (width - padX * 2);
        const normalized = Math.min(1, Math.max(0, pt[key] / maxMbps));
        const y = height - padY - normalized * (height - padY * 2);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const buildArea = (key: 'downMbps' | 'upMbps') => {
    const line = buildPath(key);
    if (!line || history.length === 0) return '';
    const firstX = padX;
    const lastX = width - padX;
    const baseline = height - padY;
    return `${line} L ${lastX} ${baseline} L ${firstX} ${baseline} Z`;
  };

  const latest = history[history.length - 1] || {
    downMbps: 0,
    upMbps: 0,
    pingMs: 0,
  };

  const isNavy = theme === 'navy';
  const gridStroke = isNavy ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.08)';
  const downStroke = isNavy ? '#38BDF8' : '#0284C7';
  const upStroke = isNavy ? '#818CF8' : '#4F46E5';

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-3">
        <div>
          <div className="text-xs font-medium tracking-tight opacity-75">
            Real-Time Tunnel Throughput · {activeProtocol} / {activeTransport}
          </div>
          <div className="text-xs opacity-60 mt-0.5">
            {isConnected
              ? 'Encrypted Xray-core multiplex stream active (60s rolling window)'
              : 'Tunnel on standby — connect to inspect live packet flow'}
          </div>
        </div>

        <div className="flex items-center gap-6 font-mono tabular-nums text-xs">
          <div>
            <span className="opacity-65 mr-1.5">Downlink:</span>
            <span className={isNavy ? 'text-sky-400 font-semibold' : 'text-sky-700 font-semibold'}>
              {isConnected ? `${latest.downMbps.toFixed(1)} Mbps` : '0.0 Mbps'}
            </span>
          </div>
          <span aria-hidden="true" className="opacity-30">·</span>
          <div>
            <span className="opacity-65 mr-1.5">Uplink:</span>
            <span className={isNavy ? 'text-indigo-400 font-semibold' : 'text-indigo-700 font-semibold'}>
              {isConnected ? `${latest.upMbps.toFixed(1)} Mbps` : '0.0 Mbps'}
            </span>
          </div>
          <span aria-hidden="true" className="opacity-30">·</span>
          <div>
            <span className="opacity-65 mr-1.5">RTT:</span>
            <span className="font-semibold">
              {isConnected ? `${latest.pingMs} ms` : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-40 block select-none"
          role="img"
          aria-label="Real-time downlink and uplink throughput waveform"
        >
          <defs>
            <linearGradient id="coreinetDownGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={downStroke} stopOpacity={isNavy ? '0.28' : '0.18'} />
              <stop offset="100%" stopColor={downStroke} stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="coreinetUpGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={upStroke} stopOpacity={isNavy ? '0.20' : '0.12'} />
              <stop offset="100%" stopColor={upStroke} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal reference hairlines */}
          {[0.2, 0.5, 0.8].map((ratio) => {
            const y = padY + ratio * (height - padY * 2);
            return (
              <line
                key={ratio}
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke={gridStroke}
                strokeDasharray="3 3"
                strokeWidth="1"
              />
            );
          })}

          {/* Area fills */}
          <path d={buildArea('downMbps')} fill="url(#coreinetDownGrad)" />
          <path d={buildArea('upMbps')} fill="url(#coreinetUpGrad)" />

          {/* Waveform strokes */}
          <path
            d={buildPath('upMbps')}
            fill="none"
            stroke={upStroke}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={buildPath('downMbps')}
            fill="none"
            stroke={downStroke}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};
