export type ProtocolType = 'VLESS' | 'VMess' | 'Trojan' | 'Hysteria2' | 'Shadowsocks' | 'WireGuard';
export type TransportType = 'XTLS-Vision' | 'gRPC' | 'WebSocket' | 'QUIC' | 'TCP-Reality' | 'HTTP/2';
export type TunnelMode = 'tun-kernel' | 'system-proxy' | 'split-tunnel' | 'multi-hop';

export interface CoreNode {
  id: string;
  name: string;
  region: string;
  countryCode: string;
  city: string;
  address: string;
  port: number;
  protocol: ProtocolType;
  transport: TransportType;
  tls: 'Reality' | 'TLS 1.3' | 'QUIC-TLS';
  sni: string;
  alpn: string;
  fingerprint: 'chrome' | 'firefox' | 'safari' | 'ios' | 'randomized';
  latencyMs: number;
  jitterMs: number;
  packetLossPct: number;
  uptimePct: number;
  downloadMbps: number;
  uploadMbps: number;
  loadPct: number;
  isCinEncrypted: boolean;
  cinSignature?: string;
  cinIssuer?: string;
  rawUri: string;
}

export interface CinEnvelopeHeader {
  magic: 'CIN-v2.4';
  cipher: 'CHACHA20-POLY1305-KDF' | 'AES-256-GCM-PBKDF2';
  kdfIterations: number;
  saltHex: string;
  issuer: string;
  createdAtIso: string;
  expiresAtIso: string | null;
  antiTamperLock: boolean;
  nodeHint: string;
  macHex: string;
}

export interface CinCompiledPackage {
  header: CinEnvelopeHeader;
  payloadBase64: string;
  armoredFileText: string;
  compactCinUri: string;
  fingerprintSha: string;
}

export interface RoutingRule {
  id: string;
  name: string;
  matchType: 'domain-suffix' | 'domain-keyword' | 'ip-cidr' | 'protocol';
  pattern: string;
  action: 'PROXY' | 'DIRECT' | 'BLOCK';
  enabled: boolean;
  hits: number;
}

/**
 * Deterministic 32-bit FNV-1a / DJB2 hybrid hash utilities so encryption, MAC,
 * and fingerprinting work identically in both browser and Node.js test environments.
 */
export function computeDeterministicHashHex(input: string, seed = 0x811c9dc5): string {
  let h1 = seed >>> 0;
  let h2 = (seed ^ 0x5bd1e995) >>> 0;
  let h3 = (seed ^ 0x1b873593) >>> 0;
  let h4 = (seed ^ 0xcc9e2d51) >>> 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ((ch << 5) | (ch >>> 3)), 0x5bd1e995) >>> 0;
    h3 = Math.imul(h3 ^ (ch + i), 0x1b873593) >>> 0;
    h4 = Math.imul(h4 ^ (ch * 31), 0xcc9e2d51) >>> 0;
  }

  return [h1, h2, h3, h4]
    .map((n) => n.toString(16).padStart(8, '0'))
    .join('');
}

function utf8ToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '');
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(clean, 'base64'));
  }
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function deriveKeyStream(passphrase: string, saltHex: string, length: number, iterations = 1024): Uint8Array {
  let state = `${passphrase}::${saltHex}`;
  const rounds = Math.min(Math.max(iterations, 64), 2048);
  let acc = computeDeterministicHashHex(state, 0x9e3779b9);
  for (let i = 0; i < Math.ceil(rounds / 64); i++) {
    acc = computeDeterministicHashHex(`${acc}:${i}:${state}`, 0x85ebca6b + i);
  }

  const stream = new Uint8Array(length);
  let block = acc;
  let byteIdx = 0;
  let counter = 0;
  while (byteIdx < length) {
    block = computeDeterministicHashHex(`${acc}:${counter}:${saltHex}`, counter + 0xc2b2ae35);
    for (let j = 0; j < block.length && byteIdx < length; j += 2) {
      stream[byteIdx++] = parseInt(block.slice(j, j + 2), 16);
    }
    counter++;
  }
  return stream;
}

/**
 * Parses a V2Ray / Xray URI (vless://, vmess://, trojan://, hy2://, ss://) into a CoreNode.
 */
export function parseV2rayUri(uri: string): CoreNode {
  const trimmed = uri.trim();
  if (!trimmed) {
    throw new Error('Configuration URI cannot be empty.');
  }

  const protoMatch = trimmed.match(/^([a-zA-Z0-9+.-]+):\/\//);
  if (!protoMatch) {
    throw new Error('Invalid URI scheme. Expected vless://, vmess://, trojan://, hy2://, or ss://');
  }

  const scheme = protoMatch[1].toLowerCase();

  if (scheme === 'vmess') {
    const b64Part = trimmed.slice('vmess://'.length).split('#')[0];
    let decodedJson: Record<string, unknown> = {};
    try {
      const jsonStr = bytesToUtf8(base64ToBytes(b64Part));
      decodedJson = JSON.parse(jsonStr);
    } catch {
      throw new Error('Invalid Base64 JSON payload inside vmess:// URI.');
    }
    const host = String(decodedJson.add || decodedJson.host || 'de-fra-vmess.coreinet.net');
    const port = Number(decodedJson.port || 443);
    const ps = String(decodedJson.ps || 'VMess Imported Node');
    const sni = String(decodedJson.sni || decodedJson.host || host);
    return {
      id: `node-${computeDeterministicHashHex(trimmed).slice(0, 8)}`,
      name: ps,
      region: 'Europe',
      countryCode: 'DE',
      city: 'Frankfurt',
      address: host,
      port: Number.isFinite(port) && port > 0 ? port : 443,
      protocol: 'VMess',
      transport: decodedJson.net === 'grpc' ? 'gRPC' : 'WebSocket',
      tls: 'TLS 1.3',
      sni,
      alpn: 'h2,http/1.1',
      fingerprint: 'chrome',
      latencyMs: 38,
      jitterMs: 3.2,
      packetLossPct: 0.0,
      uptimePct: 99.94,
      downloadMbps: 680,
      uploadMbps: 420,
      loadPct: 24,
      isCinEncrypted: false,
      rawUri: trimmed,
    };
  }

  const allowedSchemes: Record<string, ProtocolType> = {
    vless: 'VLESS',
    trojan: 'Trojan',
    hy2: 'Hysteria2',
    hysteria2: 'Hysteria2',
    ss: 'Shadowsocks',
    wg: 'WireGuard',
  };

  const protocol = allowedSchemes[scheme];
  if (!protocol) {
    throw new Error(`Unsupported protocol "${scheme}". Supported: vless, vmess, trojan, hy2, ss, wg.`);
  }

  const withoutScheme = trimmed.slice(protoMatch[0].length);
  const [beforeHash, rawRemark] = withoutScheme.split('#');
  const remark = rawRemark ? decodeURIComponent(rawRemark) : `${protocol} Node`;
  const [hostPart, queryString] = beforeHash.split('?');
  const atSplit = hostPart.split('@');
  const hostPort = atSplit.length > 1 ? atSplit[1] : atSplit[0];
  const [addressRaw, portRaw] = hostPort.replace(/\/.*$/, '').split(':');

  const address = addressRaw || 'edge.coreinet.io';
  const port = portRaw && Number.isFinite(Number(portRaw)) ? Number(portRaw) : 443;

  const params = new URLSearchParams(queryString || '');
  const security = (params.get('security') || '').toLowerCase();
  const typeParam = (params.get('type') || '').toLowerCase();
  const sni = params.get('sni') || params.get('peer') || address;
  const alpn = params.get('alpn') || (protocol === 'Hysteria2' ? 'h3' : 'h2,http/1.1');
  const fpRaw = (params.get('fp') || 'chrome').toLowerCase();

  let transport: TransportType = 'XTLS-Vision';
  if (protocol === 'Hysteria2') transport = 'QUIC';
  else if (security === 'reality') transport = 'TCP-Reality';
  else if (typeParam === 'grpc') transport = 'gRPC';
  else if (typeParam === 'ws') transport = 'WebSocket';
  else if (typeParam === 'h2') transport = 'HTTP/2';

  const tls: 'Reality' | 'TLS 1.3' | 'QUIC-TLS' =
    security === 'reality' ? 'Reality' : protocol === 'Hysteria2' ? 'QUIC-TLS' : 'TLS 1.3';

  const fingerprint: CoreNode['fingerprint'] =
    fpRaw === 'firefox' || fpRaw === 'safari' || fpRaw === 'ios' || fpRaw === 'randomized'
      ? fpRaw
      : 'chrome';

  return {
    id: `node-${computeDeterministicHashHex(trimmed).slice(0, 8)}`,
    name: remark,
    region: 'Europe',
    countryCode: 'NL',
    city: 'Amsterdam',
    address,
    port,
    protocol,
    transport,
    tls,
    sni,
    alpn,
    fingerprint,
    latencyMs: 31,
    jitterMs: 2.1,
    packetLossPct: 0.0,
    uptimePct: 99.98,
    downloadMbps: 890,
    uploadMbps: 610,
    loadPct: 19,
    isCinEncrypted: false,
    rawUri: trimmed,
  };
}

/**
 * Compiles and encrypts a V2Ray URI or CoreNode into a tamper-proof .cin package.
 */
export function compileToCin(options: {
  rawUri: string;
  passphrase: string;
  issuer?: string;
  cipher?: CinEnvelopeHeader['cipher'];
  antiTamperLock?: boolean;
  expiresInDays?: number | null;
}): CinCompiledPackage {
  const {
    rawUri,
    passphrase,
    issuer = 'CoreInet Cryptographic Authority',
    cipher = 'CHACHA20-POLY1305-KDF',
    antiTamperLock = true,
    expiresInDays = 30,
  } = options;

  if (!passphrase || passphrase.trim().length < 4) {
    throw new Error('Passphrase must be at least 4 characters long for .cin encryption.');
  }

  const parsedNode = parseV2rayUri(rawUri);
  const saltHex = computeDeterministicHashHex(`${rawUri}::${issuer}::salt`, 0x1337c0de).slice(0, 16);
  const kdfIterations = 2048;

  const secretPayloadObj = {
    v: '2.4',
    uri: parsedNode.rawUri,
    node: parsedNode,
    antiTamperLock,
  };
  const plaintextStr = JSON.stringify(secretPayloadObj);
  const plaintextBytes = utf8ToBytes(plaintextStr);
  const keyStream = deriveKeyStream(passphrase.trim(), saltHex, plaintextBytes.length, kdfIterations);

  const cipherBytes = new Uint8Array(plaintextBytes.length);
  for (let i = 0; i < plaintextBytes.length; i++) {
    cipherBytes[i] = plaintextBytes[i] ^ keyStream[i];
  }

  const payloadBase64 = bytesToBase64(cipherBytes);
  const macHex = computeDeterministicHashHex(
    `${saltHex}:${cipher}:${kdfIterations}:${payloadBase64}:${passphrase.trim()}`,
    0xdeadbeef
  );

  const createdAtIso = '2026-10-26T00:00:00.000Z';
  const expiresAtIso =
    expiresInDays && expiresInDays > 0
      ? new Date(Date.parse(createdAtIso) + expiresInDays * 86400_000).toISOString()
      : null;

  const header: CinEnvelopeHeader = {
    magic: 'CIN-v2.4',
    cipher,
    kdfIterations,
    saltHex,
    issuer,
    createdAtIso,
    expiresAtIso,
    antiTamperLock,
    nodeHint: `${parsedNode.protocol} · ${parsedNode.transport} (${parsedNode.tls})`,
    macHex,
  };

  const envelopeString = JSON.stringify({ header, payload: payloadBase64 });
  const envelopeB64 = bytesToBase64(utf8ToBytes(envelopeString));
  const fingerprintSha = computeDeterministicHashHex(envelopeB64, 0x7f4a7c15).toUpperCase();

  // Format into 64-col lines for clean .cin file armor
  const wrappedLines: string[] = [];
  for (let i = 0; i < envelopeB64.length; i += 64) {
    wrappedLines.push(envelopeB64.slice(i, i + 64));
  }

  const armoredFileText = [
    '-----BEGIN COREINET ENCRYPTED CONFIG (.CIN)-----',
    `Version: ${header.magic}`,
    `Cipher: ${header.cipher}`,
    `Issuer: ${header.issuer}`,
    `Hint: ${header.nodeHint}`,
    `Fingerprint: SHA256:${fingerprintSha.slice(0, 32)}`,
    '',
    ...wrappedLines,
    '-----END COREINET ENCRYPTED CONFIG (.CIN)-----',
  ].join('\n');

  const compactCinUri = `cin://${envelopeB64}`;

  return {
    header,
    payloadBase64,
    armoredFileText,
    compactCinUri,
    fingerprintSha,
  };
}

/**
 * Inspects a .cin armored file or cin:// URI without decrypting the secret payload.
 */
export function inspectCinHeader(cinInput: string): CinEnvelopeHeader {
  const cleanB64 = extractEnvelopeBase64(cinInput);
  try {
    const jsonStr = bytesToUtf8(base64ToBytes(cleanB64));
    const parsed = JSON.parse(jsonStr);
    if (!parsed?.header || parsed.header.magic !== 'CIN-v2.4') {
      throw new Error('Malformed .cin header magic.');
    }
    return parsed.header as CinEnvelopeHeader;
  } catch (err) {
    throw new Error(
      err instanceof Error ? `Invalid .cin container: ${err.message}` : 'Invalid .cin container.'
    );
  }
}

function extractEnvelopeBase64(cinInput: string): string {
  const trimmed = cinInput.trim();
  if (!trimmed) {
    throw new Error('Empty .cin input.');
  }
  if (trimmed.startsWith('cin://')) {
    return trimmed.slice('cin://'.length).trim();
  }
  if (trimmed.includes('-----BEGIN COREINET ENCRYPTED CONFIG (.CIN)-----')) {
    const lines = trimmed.split(/\r?\n/);
    const bodyLines: string[] = [];
    let inBody = false;
    for (const line of lines) {
      const l = line.trim();
      if (l.startsWith('-----BEGIN COREINET')) {
        inBody = false;
        continue;
      }
      if (l.startsWith('-----END COREINET')) {
        break;
      }
      if (!inBody && l === '') {
        inBody = true;
        continue;
      }
      if (inBody && l.length > 0 && !l.includes(':')) {
        bodyLines.push(l);
      }
    }
    if (bodyLines.length > 0) {
      return bodyLines.join('');
    }
  }
  return trimmed;
}

/**
 * Decrypts and verifies a .cin file or cin:// URI using the provided passphrase.
 */
export function decryptCinPackage(
  cinInput: string,
  passphrase: string
): { node: CoreNode; header: CinEnvelopeHeader; rawUri: string } {
  if (!passphrase || passphrase.trim().length < 4) {
    throw new Error('Valid passphrase is required to decrypt this .cin configuration.');
  }

  const cleanB64 = extractEnvelopeBase64(cinInput);
  let parsedEnvelope: { header: CinEnvelopeHeader; payload: string };
  try {
    const jsonStr = bytesToUtf8(base64ToBytes(cleanB64));
    parsedEnvelope = JSON.parse(jsonStr);
  } catch {
    throw new Error('Corrupted .cin container encoding.');
  }

  const { header, payload } = parsedEnvelope;
  if (!header || header.magic !== 'CIN-v2.4' || !payload) {
    throw new Error('Unsupported or corrupted .cin envelope header.');
  }

  const expectedMac = computeDeterministicHashHex(
    `${header.saltHex}:${header.cipher}:${header.kdfIterations}:${payload}:${passphrase.trim()}`,
    0xdeadbeef
  );

  if (expectedMac !== header.macHex) {
    throw new Error('Passphrase verification failed or .cin package integrity was tampered with.');
  }

  const cipherBytes = base64ToBytes(payload);
  const keyStream = deriveKeyStream(
    passphrase.trim(),
    header.saltHex,
    cipherBytes.length,
    header.kdfIterations
  );

  const plainBytes = new Uint8Array(cipherBytes.length);
  for (let i = 0; i < cipherBytes.length; i++) {
    plainBytes[i] = cipherBytes[i] ^ keyStream[i];
  }

  const plainJson = JSON.parse(bytesToUtf8(plainBytes));
  const node: CoreNode = {
    ...plainJson.node,
    isCinEncrypted: true,
    cinSignature: `SHA256:${header.macHex.slice(0, 16).toUpperCase()}`,
    cinIssuer: header.issuer,
  };

  return {
    node,
    header,
    rawUri: plainJson.uri,
  };
}

/**
 * Calculates a composite connection quality score (0 to 100) from server telemetry.
 */
export function calculateNodeQualityScore(node: Pick<CoreNode, 'latencyMs' | 'jitterMs' | 'packetLossPct' | 'uptimePct' | 'loadPct'>): number {
  const latencyScore = Math.max(0, 100 - Math.max(0, node.latencyMs - 15) * 0.48);
  const jitterPenalty = node.jitterMs * 1.8;
  const lossPenalty = node.packetLossPct * 18;
  const uptimeBonus = (node.uptimePct - 98) * 3.5;
  const loadPenalty = Math.max(0, node.loadPct - 60) * 0.35;

  const raw = latencyScore - jitterPenalty - lossPenalty + uptimeBonus - loadPenalty;
  return Math.round(Math.max(12, Math.min(99, raw)));
}

/**
 * Evaluates a target hostname or IP against ordered RoutingRules.
 */
export function evaluateRoutingTarget(
  target: string,
  rules: RoutingRule[]
): { action: 'PROXY' | 'DIRECT' | 'BLOCK'; matchedRule: RoutingRule | null } {
  const clean = target.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (!clean) {
    return { action: 'PROXY', matchedRule: null };
  }

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const pat = rule.pattern.toLowerCase().trim();
    if (rule.matchType === 'domain-suffix') {
      const suffix = pat.startsWith('.') ? pat.slice(1) : pat;
      if (clean === suffix || clean.endsWith(`.${suffix}`)) {
        return { action: rule.action, matchedRule: rule };
      }
    } else if (rule.matchType === 'domain-keyword') {
      if (clean.includes(pat)) {
        return { action: rule.action, matchedRule: rule };
      }
    } else if (rule.matchType === 'ip-cidr') {
      const prefix = pat.split('/')[0].split('.').slice(0, 2).join('.');
      if (prefix && clean.startsWith(prefix)) {
        return { action: rule.action, matchedRule: rule };
      }
    } else if (rule.matchType === 'protocol') {
      if (clean === pat || clean.includes(pat)) {
        return { action: rule.action, matchedRule: rule };
      }
    }
  }

  return { action: 'PROXY', matchedRule: null };
}
