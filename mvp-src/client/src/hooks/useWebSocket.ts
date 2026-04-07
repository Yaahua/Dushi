/**
 * WebSocket 客户端 Hook
 * 管理与后端的 WebSocket 连接，发送指令、接收状态更新和叙事事件。
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export interface WSMessage {
  type: string;
  data: any;
}

interface UseWebSocketOptions {
  playerId: string;
  url?: string;
  onMessage?: (msg: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket({ playerId, url, onMessage, onConnect, onDisconnect }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  // 保持回调引用最新
  onMessageRef.current = onMessage;
  onConnectRef.current = onConnect;
  onDisconnectRef.current = onDisconnect;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // 自动检测 WebSocket URL
    const wsUrl = url || (() => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // 开发模式下连接后端 8000 端口
      const host = window.location.hostname;
      const port = '8000';
      return `${protocol}//${host}:${port}/ws/${playerId}`;
    })();

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] 已连接');
      setConnected(true);
      onConnectRef.current?.();
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        onMessageRef.current?.(msg);
      } catch (e) {
        console.error('[WS] 解析消息失败:', e);
      }
    };

    ws.onclose = () => {
      console.log('[WS] 连接断开');
      setConnected(false);
      onDisconnectRef.current?.();
      // 自动重连
      reconnectTimer.current = setTimeout(() => {
        console.log('[WS] 尝试重连...');
        connect();
      }, 3000);
    };

    ws.onerror = (err) => {
      console.error('[WS] 错误:', err);
    };
  }, [playerId, url]);

  const send = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      console.warn('[WS] 未连接，无法发送:', payload);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { connected, send, disconnect };
}
