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
    const trimmed = cmd.trim();
    const lower = trimmed.toLowerCase();

    // 进度条进行中，不接受命令
    if (state.activeProgress) return;

    // ── 移动 ──
    if (lower.startsWith('goto ') || lower.startsWith('去 ')) {
      const target = lower.startsWith('goto ') ? lower.slice(5).trim() : lower.slice(2).trim();
      send({ action: 'goto', target });
      return;
    }

    // ── 吃东西（带进度条）──
    if (lower === 'eat' || lower === '吃东西' || lower === '吃饭') {
      dispatch({
        type: 'START_PROGRESS',
        label: '正在吃东西',
        duration: 3000,
        elapsed: 0,
        onComplete: 'eat_done',
      });
      return;
    }

    // ── 购买（通用）──
    if (lower === 'buy water' || lower === '买矿泉水') {
      send({ action: 'buy', item: 'water' });
      return;
    }
    if (lower.startsWith('buy ')) {
      const item = lower.slice(4).trim();
      send({ action: 'buy', item });
      return;
    }
    if (lower.startsWith('购买 ')) {
      const item = lower.slice(3).trim();
      send({ action: 'buy', item });
      return;
    }

    // ── 与 NPC 对话 ──
    if (lower.startsWith('talk ') || lower.startsWith('对话 ') || lower.startsWith('找 ')) {
      let rest = lower.startsWith('talk ') ? trimmed.slice(5).trim()
        : lower.startsWith('对话 ') ? trimmed.slice(3).trim()
        : trimmed.slice(2).trim();
      // 支持 "talk 老陈 about 工作" 格式
      const aboutIdx = rest.indexOf(' ');
      let target = rest;
      let topic = 'greeting';
      if (aboutIdx > -1) {
        target = rest.slice(0, aboutIdx);
        topic = rest.slice(aboutIdx + 1).trim() || 'greeting';
      }
      send({ action: 'talk', target, topic });
      return;
    }

    // ── 休息 ──
    if (lower === 'rest' || lower === '休息' || lower === '睡觉') {
      send({ action: 'rest', hours: 8 });
      return;
    }
    if (lower.startsWith('rest ') || lower.startsWith('休息 ')) {
      const hoursStr = lower.startsWith('rest ') ? lower.slice(5).trim() : lower.slice(3).trim();
      const hours = parseInt(hoursStr, 10) || 8;
      send({ action: 'rest', hours });
      return;
    }

    // ── 交房租 ──
    if (lower === 'pay rent' || lower === '交房租' || lower === '付房租' || lower === 'pay_rent') {
      send({ action: 'pay_rent', amount: 350 });
      return;
    }
    if (lower.startsWith('pay rent ') || lower.startsWith('交房租 ')) {
      const amtStr = lower.startsWith('pay rent ') ? lower.slice(9).trim() : lower.slice(4).trim();
      const amount = parseFloat(amtStr) || 350;
      send({ action: 'pay_rent', amount });
      return;
    }

    // ── 玩家状态 ──
    if (lower === 'status' || lower === '状态' || lower === '查看状态') {
      send({ action: 'status' });
      return;
    }

    // ── 游戏时间 ──
    if (lower === 'time' || lower === '时间' || lower === '几点') {
      send({ action: 'time' });
      return;
    }

    // ── 地图 ──
    if (lower === 'map' || lower === '地图' || lower === '去哪') {
      send({ action: 'map' });
      return;
    }

    // ── 帮助 ──
    if (lower === 'help' || lower === '帮助' || lower === '?') {
      send({ action: 'help' });
      return;
    }

    // ── 互动（旧版兼容）──
    if (lower === '坐沙发' || lower === '坐在沙发上' || lower === 'sit sofa') {
      send({ action: 'interact', target: 'sofa', interact_action: 'sit' });
      return;
    }
    if (lower === '躺沙发' || lower === '躺在沙发上' || lower === 'lie sofa') {
      send({ action: 'interact', target: 'sofa', interact_action: 'lie' });
      return;
    }

    // ── 查看 ──
    if (lower === '看' || lower === '环顾' || lower === 'look' || lower === '查看') {
      send({ action: 'look' });
      return;
    }

    // ── 背包 ──
    if (lower === '背包' || lower === '物品' || lower === 'inventory' || lower === 'inv') {
      send({ action: 'inventory' });
      return;
    }

    // ── 喝水 ──
    if (lower === '喝水' || lower === '喝矿泉水' || lower === 'drink water') {
      send({ action: 'drink_water' });
      return;
    }

    // ── 未知指令：发给后端处理 ──
    // 尝试直接解析为 action（支持原始 JSON 格式）
    if (trimmed.startsWith('{')) {
      try {
        const payload = JSON.parse(trimmed);
        send(payload);
        return;
      } catch {}
    }

    // 发给后端，让后端返回"未知指令"提示
    send({ action: lower });
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
