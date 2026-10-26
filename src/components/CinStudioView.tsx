import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Download,
  Upload,
  Copy,
  Check,
  ShieldCheck,
  FileCode2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import {
  compileToCin,
  inspectCinHeader,
  decryptCinPackage,
  type CoreNode,
  type CinEnvelopeHeader,
  type CinCompiledPackage,
} from '../utils/cinCrypto';
import { SAMPLE_CIN_PRESETS, DEFAULT_PRECOMPILED_CIN } from '../data/seedNodes';

interface CinStudioViewProps {
  theme: 'navy' | 'light';
  onImportDecryptedNode: (node: CoreNode, connectImmediately: boolean) => void;
}

export const CinStudioView: React.FC<CinStudioViewProps> = ({
  theme,
  onImportDecryptedNode,
}) => {
  const isNavy = theme === 'navy';

  // Studio Tab: 'compile' | 'import'
  const [studioMode, setStudioMode] = useState<'compile' | 'import'>('compile');

  // Compiler State
  const [rawUriInput, setRawUriInput] = useState<string>(SAMPLE_CIN_PRESETS[0].rawUri);
  const [compilePassphrase, setCompilePassphrase] = useState<string>(
    SAMPLE_CIN_PRESETS[0].passphrase
  );
  const [issuerName, setIssuerName] = useState<string>(SAMPLE_CIN_PRESETS[0].issuer);
  const [cipherSuite, setCipherSuite] = useState<
    'CHACHA20-POLY1305-KDF' | 'AES-256-GCM-PBKDF2'
  >('CHACHA20-POLY1305-KDF');
  const [antiTamperLock, setAntiTamperLock] = useState<boolean>(true);
  const [expiresInDays, setExpiresInDays] = useState<number>(90);
  const [compiledResult, setCompiledResult] = useState<CinCompiledPackage | null>(
    DEFAULT_PRECOMPILED_CIN
  );
  const [compileError, setCompileError] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'armor' | 'uri' | null>(null);

  // Importer State
  const [cinImportText, setCinImportText] = useState<string>(
    DEFAULT_PRECOMPILED_CIN.armoredFileText
  );
  const [importPassphrase, setImportPassphrase] = useState<string>('coreinet-2026');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessNode, setImportSuccessNode] = useState<CoreNode | null>(null);

  // Live header preview on import text
  let inspectedHeader: CinEnvelopeHeader | null = null;
  let headerInspectError: string | null = null;
  if (cinImportText.trim().length > 0) {
    try {
      inspectedHeader = inspectCinHeader(cinImportText);
    } catch (err) {
      headerInspectError = err instanceof Error ? err.message : 'Invalid .cin header';
    }
  }

  const handleCompile = (e: React.FormEvent) => {
    e.preventDefault();
    setCompileError(null);
    try {
      const pkg = compileToCin({
        rawUri: rawUriInput,
        passphrase: compilePassphrase,
        issuer: issuerName || 'CoreInet Authority',
        cipher: cipherSuite,
        antiTamperLock,
        expiresInDays,
      });
      setCompiledResult(pkg);
      // Also sync into import buffer so user can test round-trip immediately
      setCinImportText(pkg.armoredFileText);
      setImportPassphrase(compilePassphrase);
    } catch (err) {
      setCompileError(
        err instanceof Error ? err.message : 'Failed to compile .cin package.'
      );
    }
  };

  const handleDownloadCinFile = () => {
    if (!compiledResult) return;
    const blob = new Blob([compiledResult.armoredFileText], {
      type: 'application/x-coreinet-cin;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = compiledResult.fingerprintSha.slice(0, 8).toLowerCase();
    a.download = `coreinet-profile-${slug}.cin`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string, kind: 'armor' | 'uri') => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedType(kind);
    setTimeout(() => setCopiedType(null), 1800);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCinImportText(reader.result);
        setImportError(null);
        setImportSuccessNode(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDecryptAndImport = (connectNow: boolean) => {
    setImportError(null);
    setImportSuccessNode(null);
    try {
      const result = decryptCinPackage(cinImportText, importPassphrase);
      setImportSuccessNode(result.node);
      onImportDecryptedNode(result.node, connectNow);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Decryption failed. Check passphrase.'
      );
    }
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
      {/* Studio Header & Mode Switcher */}
      <div className={`p-6 rounded-xl ${surfaceClass}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-inherit">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              .cin Cryptographic Studio & Config Compiler
            </h2>
            <p className="text-sm opacity-70 mt-1 max-w-2xl">
              Compile standard V2Ray / Xray / Hysteria2 URIs into authenticated, tamper-locked{' '}
              <span className="font-mono">.cin</span> containers, or decrypt and import{' '}
              <span className="font-mono">.cin</span> files into your CoreInet routing table.
            </p>
          </div>

          {/* Functional Segmented Control */}
          <div
            className={`inline-flex p-1 rounded-lg shrink-0 ${
              isNavy ? 'bg-[#080F1E] border border-[#1E2D4A]' : 'bg-slate-100 border border-slate-200'
            }`}
            role="tablist"
            aria-label=".cin Studio Mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={studioMode === 'compile'}
              onClick={() => setStudioMode('compile')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-core flex items-center gap-2 whitespace-nowrap shrink-0 ${
                studioMode === 'compile'
                  ? isNavy
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-white font-semibold'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Compile to .cin</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={studioMode === 'import'}
              onClick={() => setStudioMode('import')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-core flex items-center gap-2 whitespace-nowrap shrink-0 ${
                studioMode === 'import'
                  ? isNavy
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-white font-semibold'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Import & Decrypt .cin</span>
            </button>
          </div>
        </div>

        {studioMode === 'compile' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 items-start">
            {/* Left Column: Raw V2Ray Config & Encryption Parameters */}
            <form onSubmit={handleCompile} className="lg:col-span-6 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="raw-v2ray-uri"
                    className="text-xs font-semibold tracking-tight"
                  >
                    Source V2Ray / Xray / Hysteria2 URI
                  </label>
                  <span className="text-xs opacity-60">
                    Supports vless:// · vmess:// · trojan:// · hy2:// · wg://
                  </span>
                </div>
                <textarea
                  id="raw-v2ray-uri"
                  rows={4}
                  value={rawUriInput}
                  onChange={(e) => setRawUriInput(e.target.value)}
                  placeholder="vless://uuid@host:443?security=reality&sni=..."
                  className={`w-full rounded-lg p-3 text-xs font-mono leading-relaxed ${inputClass}`}
                />
                {/* Preset Quick-Fill Buttons */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-xs opacity-60 mr-1">Load sample URI:</span>
                  {SAMPLE_CIN_PRESETS.map((preset, idx) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setRawUriInput(preset.rawUri);
                        setCompilePassphrase(preset.passphrase);
                        setIssuerName(preset.issuer);
                      }}
                      className={`px-2.5 py-1 text-xs rounded border transition-core whitespace-nowrap shrink-0 ${
                        isNavy
                          ? 'border-[#1E2D4A] hover:border-sky-400/60 text-slate-300'
                          : 'border-slate-200 hover:border-slate-400 text-slate-700'
                      }`}
                    >
                      Preset {idx + 1}: {preset.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="cin-compile-passphrase"
                    className="block text-xs font-semibold mb-1.5"
                  >
                    Encryption Passphrase (KDF Key)
                  </label>
                  <input
                    id="cin-compile-passphrase"
                    type="text"
                    value={compilePassphrase}
                    onChange={(e) => setCompilePassphrase(e.target.value)}
                    placeholder="Minimum 4 characters"
                    className={`w-full rounded-lg px-3 py-2 text-xs font-mono ${inputClass}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="cin-issuer"
                    className="block text-xs font-semibold mb-1.5"
                  >
                    Certificate Authority / Issuer Label
                  </label>
                  <input
                    id="cin-issuer"
                    type="text"
                    value={issuerName}
                    onChange={(e) => setIssuerName(e.target.value)}
                    placeholder="CoreInet Backbone Authority"
                    className={`w-full rounded-lg px-3 py-2 text-xs ${inputClass}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="cin-cipher-select"
                    className="block text-xs font-semibold mb-1.5"
                  >
                    AEAD Cipher Suite
                  </label>
                  <select
                    id="cin-cipher-select"
                    value={cipherSuite}
                    onChange={(e) =>
                      setCipherSuite(
                        e.target.value as
                          | 'CHACHA20-POLY1305-KDF'
                          | 'AES-256-GCM-PBKDF2'
                      )
                    }
                    className={`w-full rounded-lg px-3 py-2 text-xs font-mono ${inputClass}`}
                  >
                    <option value="CHACHA20-POLY1305-KDF">CHACHA20-POLY1305-KDF</option>
                    <option value="AES-256-GCM-PBKDF2">AES-256-GCM-PBKDF2</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="cin-ttl-days"
                    className="block text-xs font-semibold mb-1.5"
                  >
                    Key Validity Window (Days)
                  </label>
                  <input
                    id="cin-ttl-days"
                    type="number"
                    min={1}
                    max={365}
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(Number(e.target.value) || 30)}
                    className={`w-full rounded-lg px-3 py-2 text-xs font-mono tabular-nums ${inputClass}`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2.5 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={antiTamperLock}
                    onChange={(e) => setAntiTamperLock(e.target.checked)}
                    className="rounded accent-sky-500 w-4 h-4"
                  />
                  <span>
                    Enforce anti-tamper MAC signature & SNI obfuscation lock
                  </span>
                </label>

                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-lg text-xs font-semibold transition-core flex items-center gap-2 whitespace-nowrap shrink-0 ${
                    isNavy
                      ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  <FileCode2 className="w-4 h-4" />
                  <span>Compile to .cin</span>
                </button>
              </div>

              {compileError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{compileError}</span>
                </div>
              )}
            </form>

            {/* Right Column: Compiled .cin Output & Cryptographic Metadata */}
            <div className={`lg:col-span-6 lg:border-l lg:pl-8 ${dividerClass} space-y-4`}>
              {compiledResult && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold">
                        Compiled .cin Container Output
                      </div>
                      <div className="text-xs opacity-65 font-mono tabular-nums mt-0.5">
                        {compiledResult.header.magic} · {compiledResult.header.cipher} ·{' '}
                        {compiledResult.header.kdfIterations} rounds
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(compiledResult.armoredFileText, 'armor')
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-core flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                          isNavy
                            ? 'border-[#1E2D4A] hover:border-sky-400 text-slate-200'
                            : 'border-slate-300 hover:border-slate-500 text-slate-800'
                        }`}
                      >
                        {copiedType === 'armor' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {copiedType === 'armor' ? 'Copied .cin' : 'Copy .cin Block'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadCinFile}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-core flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                          isNavy
                            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                            : 'bg-emerald-700 text-white hover:bg-emerald-800'
                        }`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .cin File</span>
                      </button>
                    </div>
                  </div>

                  <pre
                    className={`w-full max-h-60 overflow-y-auto rounded-lg p-3.5 text-[11px] font-mono leading-relaxed overflow-x-auto select-all ${inputClass}`}
                  >
                    {compiledResult.armoredFileText}
                  </pre>

                  {/* Compact cin:// URI & Quick Round-Trip Button */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs opacity-75 font-mono truncate max-w-md">
                      SHA256:{compiledResult.fingerprintSha.slice(0, 24)} · Salt:{' '}
                      {compiledResult.header.saltHex}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(compiledResult.compactCinUri, 'uri')}
                        className="text-xs underline opacity-75 hover:opacity-100 whitespace-nowrap"
                      >
                        {copiedType === 'uri' ? 'Copied cin:// URI' : 'Copy cin:// URI'}
                      </button>
                      <span aria-hidden="true" className="opacity-30">·</span>
                      <button
                        type="button"
                        onClick={() => setStudioMode('import')}
                        className={`text-xs font-semibold flex items-center gap-1 whitespace-nowrap ${
                          isNavy ? 'text-sky-400 hover:text-sky-300' : 'text-sky-700 hover:text-sky-900'
                        }`}
                      >
                        <span>Test in Importer</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Import & Decrypt .cin Mode */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 items-start">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="cin-import-textarea"
                  className="text-xs font-semibold"
                >
                  Encrypted .cin File Content or cin:// URI
                </label>

                <label
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-core flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    isNavy
                      ? 'border-[#1E2D4A] hover:border-sky-400 text-slate-200'
                      : 'border-slate-300 hover:border-slate-500 text-slate-800'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Load .cin File from Disk</span>
                  <input
                    type="file"
                    accept=".cin,.txt"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>

              <textarea
                id="cin-import-textarea"
                rows={8}
                value={cinImportText}
                onChange={(e) => {
                  setCinImportText(e.target.value);
                  setImportError(null);
                  setImportSuccessNode(null);
                }}
                placeholder="Paste -----BEGIN COREINET ENCRYPTED CONFIG (.CIN)----- or cin://..."
                className={`w-full rounded-lg p-3.5 text-xs font-mono leading-relaxed ${inputClass}`}
              />

              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4 pt-1">
                <div className="flex-1">
                  <label
                    htmlFor="cin-import-passphrase"
                    className="block text-xs font-semibold mb-1.5"
                  >
                    Decryption Passphrase
                  </label>
                  <input
                    id="cin-import-passphrase"
                    type="text"
                    value={importPassphrase}
                    onChange={(e) => setImportPassphrase(e.target.value)}
                    placeholder="Enter .cin passphrase (e.g. coreinet-2026)"
                    className={`w-full rounded-lg px-3.5 py-2 text-xs font-mono ${inputClass}`}
                  />
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDecryptAndImport(false)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium border transition-core whitespace-nowrap shrink-0 ${
                      isNavy
                        ? 'border-[#1E2D4A] hover:border-sky-400 text-slate-100'
                        : 'border-slate-300 hover:border-slate-600 text-slate-900'
                    }`}
                  >
                    Decrypt & Add to Nodes
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDecryptAndImport(true)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-core flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      isNavy
                        ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify & Connect Now</span>
                  </button>
                </div>
              </div>

              {importError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccessNode && (
                <div
                  role="status"
                  className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs space-y-1"
                >
                  <div className="font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      Decrypted & Imported: {importSuccessNode.name}
                    </span>
                  </div>
                  <div className="font-mono opacity-80">
                    Endpoint: {importSuccessNode.address}:{importSuccessNode.port} ·{' '}
                    {importSuccessNode.protocol} / {importSuccessNode.transport} ·{' '}
                    {importSuccessNode.cinSignature}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Live Envelope Inspector */}
            <div className={`lg:col-span-5 lg:border-l lg:pl-8 ${dividerClass} space-y-4`}>
              <div>
                <h3 className="text-sm font-semibold">
                  Envelope Header Inspection (Zero-Knowledge Pre-Check)
                </h3>
                <p className="text-xs opacity-65 mt-0.5">
                  CoreInet validates the outer header and MAC salt before attempting key derivation.
                </p>
              </div>

              {inspectedHeader ? (
                <dl className={`divide-y ${dividerClass} text-xs font-mono tabular-nums`}>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="opacity-65">Format Magic</dt>
                    <dd className="font-semibold">{inspectedHeader.magic}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="opacity-65">AEAD Cipher</dt>
                    <dd>{inspectedHeader.cipher}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="opacity-65">Issuer Authority</dt>
                    <dd className="font-sans font-medium">{inspectedHeader.issuer}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="opacity-65">Transport Hint</dt>
                    <dd>{inspectedHeader.nodeHint}</dd>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="opacity-65">KDF Rounds & Salt</dt>
                    <dd>
                      {inspectedHeader.kdfIterations} · {inspectedHeader.saltHex}
                    </dd>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="opacity-65">Anti-Tamper Lock</dt>
                    <dd className="text-emerald-400">
                      {inspectedHeader.antiTamperLock ? 'Enforced (MAC Verified)' : 'Standard'}
                    </dd>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="opacity-65">HMAC Digest</dt>
                    <dd className="truncate max-w-[180px]">{inspectedHeader.macHex}</dd>
                  </div>
                </dl>
              ) : (
                <div className="p-4 rounded-lg border border-dashed border-amber-500/40 text-xs text-amber-400">
                  {headerInspectError || 'Paste a valid .cin container to inspect its cryptographic header.'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
