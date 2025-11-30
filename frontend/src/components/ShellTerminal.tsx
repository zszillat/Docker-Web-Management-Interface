import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';

interface ShellTerminalProps {
  title: string;
  streamFactory: () => WebSocket;
  onClose: () => void;
}

function ShellTerminal({ title, streamFactory, onClose }: ShellTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontSize: 14,
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
      },
    });
    if (containerRef.current) {
      term.open(containerRef.current);
    }
    term.writeln('Connecting to container shell...');

    const socket = streamFactory();
    socketRef.current = socket;

    const dataDisposable = term.onData((data) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(data);
      }
    });

    socket.onopen = () => {
      term.writeln('Connected. Press Ctrl+D or type `exit` to close.');
      term.focus();
    };
    socket.onmessage = (event) => {
      term.write(event.data as string);
    };
    socket.onerror = () => {
      term.writeln('\r\n[Shell connection error]');
    };
    socket.onclose = () => {
      term.writeln('\r\n[Shell closed]');
    };

    return () => {
      dataDisposable.dispose();
      socket.close();
      term.dispose();
    };
  }, [streamFactory]);

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="log-header">
        <strong>{title}</strong>
        <div className="actions">
          <button className="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="terminal-wrapper">
        <div ref={containerRef} className="terminal-container" />
      </div>
    </div>
  );
}

export default ShellTerminal;
