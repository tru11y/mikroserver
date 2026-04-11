'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface SshTerminalProps {
  routerId: string;
  /** JWT access token — fetched by parent from cookie/store */
  accessToken: string;
  /** WebSocket base URL, e.g. ws://139.84.241.27:3003 */
  wsUrl?: string;
}

export function SshTerminal({ routerId, accessToken, wsUrl }: SshTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  const getWsBaseUrl = useCallback(() => {
    if (wsUrl) return wsUrl;
    if (typeof window === 'undefined') return 'ws://localhost:3003';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const port = window.location.port;
    // Port standard (80/443) → NGINX est en frontal, il proxie /ws/ssh
    if (!port || port === '80' || port === '443') {
      return `${proto}//${window.location.hostname}`;
    }
    // Port non-standard → accès direct (ex: :3001), SSH gateway sur :3003
    return `${proto}//${window.location.hostname}:3003`;
  }, [wsUrl]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
      fontSize: 13,
      theme: {
        background: '#09090b',
        foreground: '#e4e4e7',
        cursor: '#a1a1aa',
        selectionBackground: '#3f3f46',
        black: '#18181b',
        brightBlack: '#3f3f46',
        red: '#f87171',
        brightRed: '#fca5a5',
        green: '#4ade80',
        brightGreen: '#86efac',
        yellow: '#facc15',
        brightYellow: '#fde047',
        blue: '#60a5fa',
        brightBlue: '#93c5fd',
        magenta: '#c084fc',
        brightMagenta: '#d8b4fe',
        cyan: '#22d3ee',
        brightCyan: '#67e8f9',
        white: '#e4e4e7',
        brightWhite: '#f4f4f5',
      },
    });

    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(webLinks);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    const base = getWsBaseUrl();
    const url = `${base}/ws/ssh?token=${encodeURIComponent(accessToken)}&routerId=${encodeURIComponent(routerId)}`;
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      // Send initial terminal size
      fit.fit();
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (evt) => {
      const data = evt.data instanceof ArrayBuffer
        ? new Uint8Array(evt.data)
        : evt.data;
      term.write(data as Uint8Array | string);
    };

    ws.onclose = () => {
      term.write('\r\n\x1b[33mDéconnecté.\x1b[0m\r\n');
    };

    ws.onerror = () => {
      term.write('\r\n\x1b[31mErreur de connexion WebSocket.\x1b[0m\r\n');
    };

    // Terminal input → WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    // Handle terminal resize
    const observer = new ResizeObserver(() => {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      ws.close();
      term.dispose();
      termRef.current = null;
      wsRef.current = null;
      fitRef.current = null;
    };
  }, [routerId, accessToken, getWsBaseUrl]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full rounded-lg overflow-hidden"
      style={{ minHeight: '400px' }}
    />
  );
}
