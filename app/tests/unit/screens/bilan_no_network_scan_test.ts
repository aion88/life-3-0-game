/** Pas de réseau dans le bilan [plan 03 T12, R-03.29 (3)] : balayage des sources de `src/screens/bilan` et `src/bilan/share.ts`. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+Image\b|\bimport\s*\(|\bWebSocket\b|\bEventSource\b|\bRTCPeerConnection\b/;
function files(p: string): string[] {
  if (!statSync(p).isDirectory()) return [p];
  return readdirSync(p).flatMap((n) => files(join(p, n)));
}
describe('bilan sans réseau', () => {
  const targets = [...files('src/screens/bilan'), 'src/bilan/share.ts'].filter((f) => f.endsWith('.ts'));
  it('test_bilan_sources_have_no_network_primitive', () => {
    expect(targets.length).toBeGreaterThanOrEqual(3);
    expect(targets.filter((f) => FORBIDDEN.test(readFileSync(f, 'utf8')))).toEqual([]);
  });
  it('test_scan_pattern_bites', () => {
    for (const s of ['fetch(x)', 'new XMLHttpRequest()', 'navigator.sendBeacon(u)', 'new Image()', 'await import("x")', 'new WebSocket(u)', 'new EventSource(u)', 'new RTCPeerConnection()']) expect(FORBIDDEN.test(s)).toBe(true);
  });
});
