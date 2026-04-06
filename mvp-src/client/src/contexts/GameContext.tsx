import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type { NarrativeLine } from '@/types/narrative';
import { NarrativeManager } from '@/managers/NarrativeManager';
import { OPERATION_CONFIG, PROGRESS_COMPLETE_CONFIG } from '@/config/operations';
import type { OperationConfig } from '@/config/operations';
import { makeId, createSystemLine, createDangerLine, createSceneLine, applyOperationConfig } from '@/utils/narrativeUtils';

// ===== 类型定义 =====
export interface PlayerStats {
  name: string;
  gender: '男' | '女';
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  hunger: number;
  maxHunger: number;
  money: number;
  moneyFrozen: boolean;
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
  player: PlayerStats;
  currentLocation: string;
  locations: Record<string, LocationNode>;
  narrative: NarrativeLine[];
  gtTime: number; // GT 时间（分钟为单位，从0开始）
  gtRunning: boolean;
  activeProgress: { label: string; duration: number; elapsed: number; onComplete: string } | null;
  inventory: { id: string; name: string; quantity: number }[];
  foodSupply: number; // 厨房食物剩余次数
}

// ===== 初始数据 =====
const INTRO_LINES = [
  '欢迎来到边境站。',
  '各位已通过入境审查，获得临时居留许可。每人将领取安置资金两千元整。',
  '现在进行户口登记。请依次进入生物特征采集舱。系统需录入各位的外貌特征与行为倾向数据。',
  '该界面将持续显示直至完成确认。录入的性格倾向数据将用于社会保障评级，外貌特征将关联至市内监控系统。',
  '登记完成后，请沿指示标识前往轨道交通站台。列车将统一运送至世界公寓，该处为各位的初始安置点。公寓配备基础生活设施，具体单元号于抵达后分配。',
  '两千元安置资金请于激活后合理规划使用。城内基础消费标准较高，建议尽快办理就业登记。',
  '登记程序现在开始。',
];

const LOCATIONS: Record<string, LocationNode> = {
  'apartment_main': {
    id: 'apartment_main',
    name: '世界公寓 - 客厅',
    description: '一间狭小但整洁的公寓客厅。灰白色的墙壁上挂着一幅褪色的城市地图。一张深灰色布艺沙发靠在窗边，窗外是密密麻麻的高楼轮廓。茶几上放着一份入住须知。',
    type: 'indoor',
    children: ['apartment_kitchen'],
    items: [
      { id: 'sofa', name: '沙发', action: 'interact_sofa' },
    ],
    actions: [
      { label: '去厨房', command: 'goto apartment_kitchen' },
      { label: '下楼', command: 'goto convenience_store' },
    ],
  },
  'apartment_kitchen': {
    id: 'apartment_kitchen',
    name: '世界公寓 - 厨房',
    description: '一间紧凑的厨房，配备了基本的灶台和冰箱。冰箱里存放着一周份量的基础食材——几袋速食米饭、罐头蔬菜和冷冻肉类。',
    type: 'indoor',
    parent: 'apartment_main',
    items: [],
    actions: [
      { label: '吃东西', command: 'eat' },
      { label: '去客厅', command: 'goto apartment_main' },
    ],
    onActionComplete: {
      eat: {
        text: '你放下碗筷，胃里传来满足的暖意。',
        links: [
          { label: '吃东西', command: 'eat' },
          { label: '去客厅', command: 'goto apartment_main' },
        ]
      }
    }
  },
  'convenience_store': {
    id: 'convenience_store',
    name: '楼下便利店',
    description: '公寓楼下的一间 24 小时便利店。白色的日光灯照亮了整齐排列的货架。收银台后面坐着一个面无表情的中年店员，正盯着一台小电视。',
    type: 'street',
    parent: 'apartment_main',
    items: [],
    actions: [
      { label: '买矿泉水 (¥2)', command: 'buy water' },
      { label: '上楼回公寓', command: 'goto apartment_main' },
    ],
    onActionComplete: {
      buy: {
        text: '收银员面无表情地接过钱，从柜台下拿出一瓶矿泉水放在你面前。',
        links: [
          { label: '买矿泉水', command: 'buy water' },
          { label: '上楼回公寓', command: 'goto apartment_main' },
        ]
      }
    }
  },
};

const initialState: GameState = {
  phase: 'intro',
  introIndex: 0,
  player: {
    name: '新移民',
    gender: '男',
    health: 120,
    maxHealth: 120,
    stamina: 120,
    maxStamina: 120,
    hunger: 0, // 0 = 不饿，100 = 饿死
    maxHunger: 100,
    money: 2000,
    moneyFrozen: false,
    skills: { strength: 1, intelligence: 1, social: 1, management: 1 },
  },
  currentLocation: 'apartment_main',
  locations: LOCATIONS,
  narrative: [],
  gtTime: 0,
  gtRunning: false,
  activeProgress: null,
  inventory: [],
  foodSupply: 21, // 一周三餐 = 21 次
};

// ===== Action 类型 =====
type GameAction =
  | { type: 'ADVANCE_INTRO' }
  | { type: 'SET_GENDER'; gender: '男' | '女' }
  | { type: 'SET_SKILLS'; skills: PlayerStats['skills'] }
  | { type: 'FINISH_CHARACTER_CREATION'; name: string }
  | { type: 'FINISH_TRANSIT' }
  | { type: 'ADD_NARRATIVE'; line: NarrativeLine }
  | { type: 'GOTO_LOCATION'; locationId: string }
  | { type: 'EAT_FOOD' }
  | { type: 'BUY_ITEM'; itemId: string }
  | { type: 'INTERACT'; targetId: string; action: string }
  | { type: 'DRINK_WATER' }
  | { type: 'GT_TICK' }
  | { type: 'START_PROGRESS'; label: string; duration: number; onComplete: string }
  | { type: 'PROGRESS_TICK' }
  | { type: 'COMPLETE_PROGRESS' }
  | { type: 'UNFREEZE_MONEY' };

// ===== 开发模式日志辅助 =====
function logDebug(label: string, logs: string[]): void {
  if (process.env.NODE_ENV === 'development') {
    console.group(`[${label}]`);
    logs.forEach(log => console.log(log));
    console.groupEnd();
  }
}

// ===== Reducer =====
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'ADVANCE_INTRO': {
      const next = state.introIndex + 1;
      if (next >= INTRO_LINES.length) {
        return { ...state, phase: 'character_creation' };
      }
      return { ...state, introIndex: next };
    }

    case 'SET_GENDER':
      return { ...state, player: { ...state.player, gender: action.gender } };

    case 'SET_SKILLS':
      return { ...state, player: { ...state.player, skills: action.skills } };

    case 'FINISH_CHARACTER_CREATION':
      return {
        ...state,
        phase: 'transit',
        player: { ...state.player, name: action.name },
      };

    case 'FINISH_TRANSIT': {
      const loc = state.locations[state.currentLocation];
      return {
        ...state,
        phase: 'gameplay',
        gtRunning: true,
        narrative: [
          createSystemLine('你已抵达世界公寓。系统分配了一间位于 7 楼的单元。'),
          createSceneLine(loc),
        ],
      };
    }

    case 'ADD_NARRATIVE':
      return {
        ...state,
        narrative: [...state.narrative, action.line],
      };

    case 'GOTO_LOCATION': {
      const loc = state.locations[action.locationId];
      if (!loc) return state;

      // 室内移动消耗 1 体能，室外移动消耗 3 体能
      const isIndoor = loc.type === 'indoor' && state.locations[state.currentLocation]?.type === 'indoor';
      const cost = isIndoor ? 1 : 3;
      const newStamina = Math.max(0, state.player.stamina - cost);

      const manager = new NarrativeManager(state.narrative);
      applyOperationConfig(manager, OPERATION_CONFIG.GOTO_LOCATION, { location: loc });
      // 场景切换额外添加新场景描述
      manager.apply({ type: 'add', line: createSceneLine(loc) });
      const { narrative, logs } = manager.getResult();

      logDebug(`GOTO_LOCATION: ${action.locationId}`, logs);

      return {
        ...state,
        currentLocation: action.locationId,
        player: { ...state.player, stamina: newStamina },
        narrative,
      };
    }

    case 'EAT_FOOD': {
      if (state.foodSupply <= 0) {
        return {
          ...state,
          narrative: [...state.narrative, createDangerLine('冰箱里已经没有食物了。')],
        };
      }
      return {
        ...state,
        activeProgress: { label: '正在吃东西', duration: 3000, elapsed: 0, onComplete: 'eat_done' },
      };
    }

    case 'BUY_ITEM': {
      if (action.itemId === 'water') {
        if (state.player.money < 2) {
          return {
            ...state,
            narrative: [...state.narrative, createDangerLine('你的余额不足。')],
          };
        }

        const existing = state.inventory.find(i => i.id === 'water');
        const newInv = existing
          ? state.inventory.map(i => i.id === 'water' ? { ...i, quantity: i.quantity + 1 } : i)
          : [...state.inventory, { id: 'water', name: '矿泉水', quantity: 1 }];

        const manager = new NarrativeManager(state.narrative);
        const loc = state.locations[state.currentLocation];
        applyOperationConfig(manager, OPERATION_CONFIG.BUY_ITEM, {
          location: loc,
          actionType: 'buy',
        });
        const { narrative, logs } = manager.getResult();

        logDebug('BUY_ITEM', logs);

        return {
          ...state,
          player: { ...state.player, money: state.player.money - 2 },
          inventory: newInv,
          narrative,
        };
      }
      return state;
    }

    case 'INTERACT': {
      if (action.targetId === 'sofa') {
        if (action.action === 'sit') {
          return {
            ...state,
            narrative: [...state.narrative, {
              id: makeId(), type: 'scene' as const,
              text: '你坐在沙发上。弹簧有些塔陷，但比站着舒服多了。窗外传来远处的汽车喇叭声和隐约的人声喧嚣。',
            }],
          };
        }
        if (action.action === 'lie') {
          return {
            ...state,
            narrative: [...state.narrative, {
              id: makeId(), type: 'scene' as const,
              text: '你躺在沙发上。天花板上有一道细长的裂缝，从灯座延伸到墙角。你盯着它看了一会儿，思绪逐渐放空。',
            }],
          };
        }
      }
      return state;
    }

    case 'DRINK_WATER': {
      const water = state.inventory.find(i => i.id === 'water');
      if (!water || water.quantity <= 0) {
        return {
          ...state,
          narrative: [...state.narrative, createSystemLine('你没有矿泉水。')],
        };
      }
      const newInv = state.inventory.map(i =>
        i.id === 'water' ? { ...i, quantity: i.quantity - 1 } : i
      ).filter(i => i.quantity > 0);
      const newStamina = Math.min(state.player.maxStamina, state.player.stamina + 1);
      return {
        ...state,
        inventory: newInv,
        player: { ...state.player, stamina: newStamina },
        narrative: [...state.narrative, createSystemLine('你喝了一瓶矿泉水。')],
      };
    }

    case 'GT_TICK': {
      // 每个 GT_TICK = 1 GT 分钟
      const newGtTime = state.gtTime + 1;

      // 饥饿速率：3 个游戏日从 0 到 maxHunger
      // 3天 = 3 * 24 * 60 = 4320 GT分钟
      const hungerRate = state.player.maxHunger / (3 * 24 * 60);
      const newHunger = Math.min(state.player.maxHunger, state.player.hunger + hungerRate);

      // 生命值扣除：饥饿值满后，1.5 个游戏日从 maxHealth 到 0
      // 1.5天 = 1.5 * 24 * 60 = 2160 GT分钟
      let newHealth = state.player.health;
      const isStarving = newHunger >= state.player.maxHunger;
      if (isStarving) {
        const healthDrainRate = state.player.maxHealth / (1.5 * 24 * 60);
        newHealth = Math.max(0, newHealth - healthDrainRate);
      }

      // 生命值归零 → 昏迷
      const narrative = [...state.narrative];
      if (newHealth <= 0 && state.player.health > 0) {
        narrative.push(createDangerLine('你的视线逐渐模糊，身体再也支撑不住了……你昏倒在地。（昏迷）'));
        // TODO: 后续实现昏迷后送医院、扣费逻辑
      }

      return {
        ...state,
        gtTime: newGtTime,
        narrative,
        player: {
          ...state.player,
          hunger: newHunger,
          health: newHealth,
        },
      };
    }

    case 'START_PROGRESS':
      return {
        ...state,
        activeProgress: { label: action.label, duration: action.duration, elapsed: 0, onComplete: action.onComplete },
      };

    case 'PROGRESS_TICK': {
      if (!state.activeProgress) return state;
      const newElapsed = state.activeProgress.elapsed + 100;
      if (newElapsed >= state.activeProgress.duration) {
        return { ...state, activeProgress: { ...state.activeProgress, elapsed: state.activeProgress.duration } };
      }
      return { ...state, activeProgress: { ...state.activeProgress, elapsed: newElapsed } };
    }

    case 'COMPLETE_PROGRESS': {
      if (!state.activeProgress) return state;
      const onComplete = state.activeProgress.onComplete;
      let newState: GameState = { ...state, activeProgress: null };

      if (onComplete === 'eat_done') {
        const hungerReduction = 10;
        const newHunger = Math.max(0, newState.player.hunger - hungerReduction);
        // 饥饿阈值联动：<=50% 才能恢复体能，>50% 不恢复
        const hungerPercent = newHunger / newState.player.maxHunger;
        const canRecoverStamina = hungerPercent <= 0.5;
        const staminaRecovery = canRecoverStamina ? 2 : 0;
        const newStamina = Math.min(newState.player.maxStamina, newState.player.stamina + staminaRecovery);

        // 合并基础配置和进度完成配置
        const config = { ...OPERATION_CONFIG.COMPLETE_PROGRESS, ...PROGRESS_COMPLETE_CONFIG.eat_done } as OperationConfig;
        const manager = new NarrativeManager(newState.narrative);
        const loc = newState.locations[newState.currentLocation];
        applyOperationConfig(manager, config, {
          location: loc,
          actionType: 'eat',
        });
        const { narrative, logs } = manager.getResult();

        logDebug('COMPLETE_PROGRESS: eat_done', logs);

        newState = {
          ...newState,
          foodSupply: newState.foodSupply - 1,
          player: { ...newState.player, hunger: newHunger, stamina: newStamina },
          narrative,
        };
      }
      return newState;
    }

    case 'UNFREEZE_MONEY':
      return { ...state, player: { ...state.player, moneyFrozen: false } };

    default:
      return state;
  }
}

// ===== Context =====
interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  executeCommand: (cmd: string) => void;
  introLines: string[];
}

const GameContext = createContext<GameContextType | null>(null);

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // GT 时间自动流动
  useEffect(() => {
    if (!state.gtRunning) return;
    const interval = setInterval(() => {
      dispatch({ type: 'GT_TICK' });
    }, 2000); // 每2秒 = 1 GT分钟
    return () => clearInterval(interval);
  }, [state.gtRunning]);

  // 进度条自动推进
  useEffect(() => {
    if (state.activeProgress && state.activeProgress.elapsed < state.activeProgress.duration) {
      progressRef.current = setInterval(() => {
        dispatch({ type: 'PROGRESS_TICK' });
      }, 100);
      return () => { if (progressRef.current) clearInterval(progressRef.current); };
    }
    if (state.activeProgress && state.activeProgress.elapsed >= state.activeProgress.duration) {
      dispatch({ type: 'COMPLETE_PROGRESS' });
    }
  }, [state.activeProgress?.elapsed, state.activeProgress?.duration]);

  const executeCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();

    // 进度条进行中，不接受命令
    if (state.activeProgress) return;

    if (trimmed.startsWith('goto ') || trimmed.startsWith('去')) {
      const target = trimmed.startsWith('goto ') ? trimmed.slice(5).trim() : trimmed.slice(1).trim();
      // 匹配 location
      const loc = Object.values(state.locations).find(
        l => l.id === target || l.name.includes(target)
      );
      if (loc) {
        dispatch({ type: 'GOTO_LOCATION', locationId: loc.id });
      } else {
        dispatch({ type: 'ADD_NARRATIVE', line: { id: makeId(), type: 'system', text: `你不知道"${target}"在哪里。` } });
      }
      return;
    }

    if (trimmed === 'eat' || trimmed === '吃东西' || trimmed === '吃饭') {
      if (state.currentLocation !== 'apartment_kitchen') {
        dispatch({ type: 'ADD_NARRATIVE', line: { id: makeId(), type: 'system', text: '你需要在厨房才能吃东西。' } });
        return;
      }
      dispatch({ type: 'EAT_FOOD' });
      return;
    }

    if (trimmed === 'buy water' || trimmed === '买矿泉水') {
      if (state.currentLocation !== 'convenience_store') {
        dispatch({ type: 'ADD_NARRATIVE', line: { id: makeId(), type: 'system', text: '你需要在便利店才能购物。' } });
        return;
      }
      dispatch({ type: 'BUY_ITEM', itemId: 'water' });
      return;
    }

    if (trimmed === '坐沙发' || trimmed === '坐在沙发上' || trimmed === 'sit sofa') {
      dispatch({ type: 'INTERACT', targetId: 'sofa', action: 'sit' });
      return;
    }

    if (trimmed === '躺沙发' || trimmed === '躺在沙发上' || trimmed === 'lie sofa') {
      dispatch({ type: 'INTERACT', targetId: 'sofa', action: 'lie' });
      return;
    }

    if (trimmed === '看' || trimmed === '环顾' || trimmed === 'look') {
      const loc = state.locations[state.currentLocation];
      if (loc) {
        dispatch({
          type: 'ADD_NARRATIVE',
          line: createSceneLine(loc),
        });
      }
      return;
    }

    if (trimmed === '背包' || trimmed === '物品' || trimmed === 'inventory') {
      const items = state.inventory.length > 0
        ? state.inventory.map(i => `${i.name} x${i.quantity}`).join('、')
        : '空空如也';
      dispatch({ type: 'ADD_NARRATIVE', line: createSystemLine(`【背包】${items}`) });
      return;
    }

    if (trimmed === '喝水' || trimmed === '喝矿泉水') {
      dispatch({ type: 'DRINK_WATER' });
      return;
    }

    dispatch({ type: 'ADD_NARRATIVE', line: createSystemLine(`未知指令：${cmd}`) });
  }, [state.activeProgress, state.currentLocation, state.locations, state.inventory]);

  return (
    <GameContext.Provider value={{ state, dispatch, executeCommand, introLines: INTRO_LINES }}>
      {children}
    </GameContext.Provider>
  );
}
