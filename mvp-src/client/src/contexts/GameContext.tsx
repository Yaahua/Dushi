import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef, useState } from 'react';
import type { NarrativeLine } from '@/types/narrative';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { WSMessage } from '@/hooks/useWebSocket';

// ===== 类型定义 =====
export interface PlayerStats {
  name: string;
  gender: '男' | '女';
  health: number;
  max_health: number;
  stamina: number;
  max_stamina: number;
  hunger: number;
  max_hunger: number;
  money: number;
  money_frozen: boolean;
  skills: {
    strength: number;
    intelligence: number;
    social: number;
    management: number;
  };
}

export interface ActionResultConfig {
  text: string;
  links: { label: string; command: string }[];
}

export interface LocationNode {
  id: string;
  name: string;
  description: string;
  type: 'indoor' | 'street';
  children?: string[];
  parent?: string;
  items?: { id: string; name: string; action: string }[];
  actions?: { label: string; command: string }[];
  onActionComplete?: {
    buy?: ActionResultConfig;
    eat?: ActionResultConfig;
    interact?: Record<string, ActionResultConfig>;
  };
}

export type GamePhase = 'intro' | 'character_creation' | 'transit' | 'gameplay';

export interface GameState {
  phase: GamePhase;
  introIndex: number;
  introLines: string[];
  player: PlayerStats;
  currentLocation: string;
  location: LocationNode | null;
  narrative: NarrativeLine[];
  gtTime: number;
  gtRunning: boolean;
  activeProgress: { label: string; duration: number; elapsed: number; onComplete: string } | null;
  inventory: { id: string; name: string; quantity: number }[];
  foodSupply: number;
  connected: boolean;
}

// ===== 初始状态 =====
const initialState: GameState = {
  phase: 'intro',
  introIndex: 0,
  introLines: [],
  player: {
    name: '新移民',
    gender: '男',
    health: 120,
    max_health: 120,
    stamina: 120,
    max_stamina: 120,
    hunger: 0,
    max_hunger: 100,
    money: 2000,
    money_frozen: false,
    skills: { strength: 1, intelligence: 1, social: 1, management: 1 },
  },
  currentLocation: 'apartment_main',
  location: null,
  narrative: [],
  gtTime: 0,
  gtRunning: false,
  activeProgress: null,
  inventory: [],
  foodSupply: 21,
  connected: false,
};

// ===== Action 类型 =====
type GameAction =
  | { type: 'SET_CONNECTED'; connected: boolean }
  | { type: 'STATE_UPDATE'; data: any }
  | { type: 'NARRATIVE_EVENT'; data: any }
  | { type: 'ADD_NARRATIVE'; line: NarrativeLine }
  | { type: 'START_PROGRESS'; label: string; duration: number; elapsed: number; onComplete: string }
  | { type: 'PROGRESS_TICK' }
  | { type: 'COMPLETE_PROGRESS' };

// ===== 辅助函数 =====
let _idCounter = 0;
function makeId(): string {
  return `line_${Date.now()}_${++_idCounter}`;
}

// ===== Reducer =====
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_CONNECTED':
      return { ...state, connected: action.connected };

    case 'STATE_UPDATE': {
      const d = action.data;
      return {
        ...state,
        phase: d.phase ?? state.phase,
        introIndex: d.intro_index ?? state.introIndex,
        introLines: d.intro_lines ?? state.introLines,
        player: d.player ? {
          name: d.player.name,
          gender: d.player.gender,
          health: d.player.health,
          max_health: d.player.max_health,
          stamina: d.player.stamina,
          max_stamina: d.player.max_stamina,
          hunger: d.player.hunger,
          max_hunger: d.player.max_hunger,
          money: d.player.money,
          money_frozen: d.player.money_frozen,
          skills: d.player.skills,
        } : state.player,
        gtTime: d.gt_time ?? state.gtTime,
        gtRunning: d.gt_running ?? state.gtRunning,
        currentLocation: d.current_location ?? state.currentLocation,
        location: d.location ?? state.location,
        foodSupply: d.food_supply ?? state.foodSupply,
        inventory: d.inventory ?? state.inventory,
      };
    }

    case 'NARRATIVE_EVENT': {
      const evt = action.data;
      const line: NarrativeLine = {
        id: makeId(),
        type: evt.type || 'system',
        text: evt.text || '',
        links: evt.actions?.map((a: any) => ({ label: a.label, command: a.command })),
        locationId: evt.location_name,
      };
      // 标记旧的同类型 action links 为失效
      const newNarrative = state.narrative.map(n => {
        if (n.links && !n.expired) {
          return { ...n, expired: true };
        }
        return n;
      });
      return { ...state, narrative: [...newNarrative, line] };
    }

    case 'ADD_NARRATIVE':
      return { ...state, narrative: [...state.narrative, action.line] };

    case 'START_PROGRESS':
      return {
        ...state,
        activeProgress: {
          label: action.label,
          duration: action.duration,
          elapsed: action.elapsed,
          onComplete: action.onComplete,
        },
      };

    case 'PROGRESS_TICK': {
      if (!state.activeProgress) return state;
      const newElapsed = state.activeProgress.elapsed + 100;
      if (newElapsed >= state.activeProgress.duration) {
        return { ...state, activeProgress: { ...state.activeProgress, elapsed: state.activeProgress.duration } };
      }
      return { ...state, activeProgress: { ...state.activeProgress, elapsed: newElapsed } };
    }

    case 'COMPLETE_PROGRESS':
      return { ...state, activeProgress: null };

    default:
      return state;
  }
}

// ===== Context =====
interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  executeCommand: (cmd: string) => void;
  sendAction: (payload: object) => void;
  introLines: string[];
}

const GameContext = createContext<GameContextType | null>(null);

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}

// ===== 生成唯一玩家 ID =====
function getPlayerId(): string {
  let id = localStorage.getItem('dushi_player_id');
  if (!id) {
    id = `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('dushi_player_id', id);
  }
  return id;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [playerId] = useState(getPlayerId);

  // WebSocket 消息处理
  const handleMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case 'connected':
        dispatch({ type: 'SET_CONNECTED', connected: true });
        // 连接成功后请求初始化
        send({ action: 'init' });
        break;
      case 'state_update':
        dispatch({ type: 'STATE_UPDATE', data: msg.data });
        break;
      case 'narrative_event':
        dispatch({ type: 'NARRATIVE_EVENT', data: msg.data });
        break;
      case 'error':
        dispatch({
          type: 'ADD_NARRATIVE',
          line: { id: makeId(), type: 'danger', text: msg.data?.text || '发生错误' },
        });
        break;
    }
  }, []);

  const { connected, send } = useWebSocket({
    playerId,
    onMessage: handleMessage,
    onConnect: () => dispatch({ type: 'SET_CONNECTED', connected: true }),
    onDisconnect: () => dispatch({ type: 'SET_CONNECTED', connected: false }),
  });

  // 进度条自动推进（仍在前端处理，因为是纯 UI 动画）
  useEffect(() => {
    if (state.activeProgress && state.activeProgress.elapsed < state.activeProgress.duration) {
      progressRef.current = setInterval(() => {
        dispatch({ type: 'PROGRESS_TICK' });
      }, 100);
      return () => { if (progressRef.current) clearInterval(progressRef.current); };
    }
    if (state.activeProgress && state.activeProgress.elapsed >= state.activeProgress.duration) {
      // 进度完成，通知后端
      const onComplete = state.activeProgress.onComplete;
      dispatch({ type: 'COMPLETE_PROGRESS' });
      if (onComplete === 'eat_done') {
        send({ action: 'eat' });
      }
    }
  }, [state.activeProgress?.elapsed, state.activeProgress?.duration, send]);

  // 指令执行：将文本命令转换为后端 action
  const executeCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();

    // 进度条进行中，不接受命令
    if (state.activeProgress) return;

    if (trimmed.startsWith('goto ') || trimmed.startsWith('去')) {
      const target = trimmed.startsWith('goto ') ? trimmed.slice(5).trim() : trimmed.slice(1).trim();
      // 尝试匹配 location id 或名称
      send({ action: 'goto', target });
      return;
    }

    if (trimmed === 'eat' || trimmed === '吃东西' || trimmed === '吃饭') {
      // 先在前端启动进度条动画，完成后再发送给后端
      dispatch({
        type: 'START_PROGRESS',
        label: '正在吃东西',
        duration: 3000,
        elapsed: 0,
        onComplete: 'eat_done',
      });
      return;
    }

    if (trimmed === 'buy water' || trimmed === '买矿泉水') {
      send({ action: 'buy', item: 'water' });
      return;
    }

    if (trimmed === '坐沙发' || trimmed === '坐在沙发上' || trimmed === 'sit sofa') {
      send({ action: 'interact', target: 'sofa', interact_action: 'sit' });
      return;
    }

    if (trimmed === '躺沙发' || trimmed === '躺在沙发上' || trimmed === 'lie sofa') {
      send({ action: 'interact', target: 'sofa', interact_action: 'lie' });
      return;
    }

    if (trimmed === '看' || trimmed === '环顾' || trimmed === 'look') {
      send({ action: 'look' });
      return;
    }

    if (trimmed === '背包' || trimmed === '物品' || trimmed === 'inventory') {
      send({ action: 'inventory' });
      return;
    }

    if (trimmed === '喝水' || trimmed === '喝矿泉水') {
      send({ action: 'drink_water' });
      return;
    }

    dispatch({
      type: 'ADD_NARRATIVE',
      line: { id: makeId(), type: 'system', text: `未知指令：${cmd}` },
    });
  }, [state.activeProgress, send]);

  // sendAction: 直接发送结构化指令（供组件使用）
  const sendAction = useCallback((payload: object) => {
    send(payload);
  }, [send]);

  return (
    <GameContext.Provider value={{
      state,
      dispatch,
      executeCommand,
      sendAction,
      introLines: state.introLines,
    }}>
      {children}
    </GameContext.Provider>
  );
}
