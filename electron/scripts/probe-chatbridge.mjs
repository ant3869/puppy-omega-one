#!/usr/bin/env node
/**
 * Explicit, bounded ping-only inspection of an installed local Puppy GUI.
 * Connecting can itself create or mutate a server session: use only a disposable runtime.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const DEFAULT_ORIGIN = 'http://127.0.0.1:8765';
const CONSENT_FLAG = '--acknowledge-session-side-effects';

export function validatedWebSocketUrl(origin) {
  const match = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/.exec(origin);
  const port = match ? Number(match[1]) : NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Only an exact http://127.0.0.1:PORT origin is allowed');
  }
  return `ws://127.0.0.1:${port}/ws/chat`;
}

function report(attempted, result, opened = false, ignoredFrames = 0) {
  return {
    attempted,
    result,
    websocket_opened: opened,
    pong_observed: result === 'pong_observed',
    ignored_frame_count: ignoredFrames,
    session_identity: 'not_verified',
    project_identity: 'not_verified',
    approval_contract: 'not_verified',
    server_side_connection_effects: 'unknown',
    note: 'A pong confirms only a ping response, never project/session binding or dispatch safety.'
  };
}

export async function probeChatBridge({ origin = DEFAULT_ORIGIN, acknowledged = false, timeoutMs = 2500 } = {}) {
  const url = validatedWebSocketUrl(origin);
  if (!acknowledged) return report(false, 'explicit_acknowledgement_required');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10000) {
    throw new Error('Probe timeout must be between 100 and 10000 ms');
  }

  return await new Promise((done) => {
    let socket;
    let opened = false;
    let ignoredFrames = 0;
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (socket && socket.readyState !== WebSocket.CLOSED) socket.terminate();
      done(report(true, result, opened, ignoredFrames));
    };
    const timer = setTimeout(() => finish('timed_out'), timeoutMs);

    try {
      socket = new WebSocket(url, {
        handshakeTimeout: Math.min(1500, timeoutMs),
        perMessageDeflate: false,
        followRedirects: false,
        maxPayload: 8192
      });
      socket.on('open', () => {
        opened = true;
        socket.send('{"action":"ping"}', (error) => {
          if (error) finish('ping_send_failed');
        });
      });
      socket.on('message', (payload, binary) => {
        if (!binary) {
          try {
            const frame = JSON.parse(payload.toString('utf8'));
            if (frame && typeof frame === 'object' && !Array.isArray(frame) && frame.type === 'pong') {
              finish('pong_observed');
              return;
            }
          } catch {
            // Unrecognized frames are counted but never logged or persisted.
          }
        }
        ignoredFrames = Math.min(ignoredFrames + 1, 99);
      });
      socket.on('error', () => finish('connection_error'));
      socket.on('close', () => finish('closed_without_pong'));
    } catch {
      finish('connection_error');
    }
  });
}

export function parseArguments(args) {
  let origin = DEFAULT_ORIGIN;
  let acknowledged = false;
  let help = false;
  let seenOrigin = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help' && args.length === 1) {
      help = true;
    } else if (arg === CONSENT_FLAG && !acknowledged) {
      acknowledged = true;
    } else if (arg === '--origin' && !seenOrigin && args[index + 1] && !args[index + 1].startsWith('--')) {
      origin = args[++index];
      seenOrigin = true;
    } else {
      throw new Error('Unknown or duplicated argument');
    }
  }
  validatedWebSocketUrl(origin);
  return { origin, acknowledged, help };
}

export async function main(args = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArguments(args);
  } catch {
    process.stderr.write('Probe refused: invalid arguments or unsafe origin. Use --help.\n');
    return 2;
  }
  if (parsed.help) {
    process.stdout.write(
      'Usage: node scripts/probe-chatbridge.mjs --origin http://127.0.0.1:8765 ' +
      CONSENT_FLAG + '\n' +
      'Use only with a running disposable Puppy GUI project. A WebSocket connection may create or alter a session.\n' +
      'The probe sends only {"action":"ping"} and discards all other server frames.\n'
    );
    return 0;
  }
  const result = await probeChatBridge(parsed);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return result.pong_observed ? 0 : result.attempted ? 1 : 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
