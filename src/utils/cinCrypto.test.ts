import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseV2rayUri,
  compileToCin,
  inspectCinHeader,
  decryptCinPackage,
  calculateNodeQualityScore,
  evaluateRoutingTarget,
  type RoutingRule,
} from './cinCrypto';

test('parseV2rayUri parses VLESS + Reality URI accurately', () => {
  const sampleUri =
    'vless://7c9e6679-7425-40de-944b-e07fc1f90ae7@de-fra-01.coreinet.net:443?security=reality&type=tcp&sni=www.cloudflare.com&fp=chrome&alpn=h2#Frankfurt%20Reality%20Core';
  const node = parseV2rayUri(sampleUri);

  assert.equal(node.protocol, 'VLESS');
  assert.equal(node.transport, 'TCP-Reality');
  assert.equal(node.tls, 'Reality');
  assert.equal(node.address, 'de-fra-01.coreinet.net');
  assert.equal(node.port, 443);
  assert.equal(node.sni, 'www.cloudflare.com');
  assert.equal(node.name, 'Frankfurt Reality Core');
});

test('compileToCin and decryptCinPackage round-trip with integrity protection', () => {
  const sampleUri =
    'hy2://auth-token-99@nl-ams-quic.coreinet.io:8443?sni=cdn.coreinet.io&alpn=h3#Amsterdam%20Hysteria2%20Turbo';
  const compiled = compileToCin({
    rawUri: sampleUri,
    passphrase: 'coreinet-master-key',
    issuer: 'CoreInet Security Team',
    antiTamperLock: true,
  });

  assert.ok(compiled.armoredFileText.includes('-----BEGIN COREINET ENCRYPTED CONFIG (.CIN)-----'));
  assert.ok(compiled.compactCinUri.startsWith('cin://'));

  const header = inspectCinHeader(compiled.armoredFileText);
  assert.equal(header.magic, 'CIN-v2.4');
  assert.equal(header.issuer, 'CoreInet Security Team');

  const decrypted = decryptCinPackage(compiled.armoredFileText, 'coreinet-master-key');
  assert.equal(decrypted.rawUri, sampleUri);
  assert.equal(decrypted.node.protocol, 'Hysteria2');
  assert.equal(decrypted.node.isCinEncrypted, true);

  assert.throws(() => {
    decryptCinPackage(compiled.armoredFileText, 'wrong-passphrase');
  }, /Passphrase verification failed/);
});

test('calculateNodeQualityScore ranks low-latency high-uptime nodes higher', () => {
  const premiumScore = calculateNodeQualityScore({
    latencyMs: 24,
    jitterMs: 1.4,
    packetLossPct: 0,
    uptimePct: 99.99,
    loadPct: 18,
  });
  const congestedScore = calculateNodeQualityScore({
    latencyMs: 165,
    jitterMs: 19.5,
    packetLossPct: 2.1,
    uptimePct: 96.2,
    loadPct: 88,
  });

  assert.ok(premiumScore > 90);
  assert.ok(congestedScore < 55);
  assert.ok(premiumScore > congestedScore);
});

test('evaluateRoutingTarget matches domain suffix, IP CIDR, and keyword rules', () => {
  const rules: RoutingRule[] = [
    {
      id: 'r1',
      name: 'Block QUIC & Telemetry Ads',
      matchType: 'domain-keyword',
      pattern: 'doubleclick',
      action: 'BLOCK',
      enabled: true,
      hits: 142,
    },
    {
      id: 'r2',
      name: 'Direct Domestic (.ir)',
      matchType: 'domain-suffix',
      pattern: '.ir',
      action: 'DIRECT',
      enabled: true,
      hits: 980,
    },
    {
      id: 'r3',
      name: 'Local LAN Subnets',
      matchType: 'ip-cidr',
      pattern: '192.168.1.0/24',
      action: 'DIRECT',
      enabled: true,
      hits: 64,
    },
  ];

  assert.equal(evaluateRoutingTarget('shaparak.ir', rules).action, 'DIRECT');
  assert.equal(evaluateRoutingTarget('ads.doubleclick.net', rules).action, 'BLOCK');
  assert.equal(evaluateRoutingTarget('192.168.1.45', rules).action, 'DIRECT');
  assert.equal(evaluateRoutingTarget('github.com', rules).action, 'PROXY');
});
