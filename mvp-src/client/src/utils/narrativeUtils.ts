// ============ utils/narrativeUtils.ts ============

import { NarrativeManager } from '@/managers/NarrativeManager';
import type { NarrativeLine } from '@/types/narrative';
import type { OperationConfig } from '@/config/operations';
import type { LocationNode, ActionResultConfig } from '@/contexts/GameContext';

let idCounter = 0;

/** 生成叙事行 ID */
export function makeId(): string {
  return `n_${++idCounter}`;
}

/** 创建系统消息行 */
export function createSystemLine(text: string): NarrativeLine {
  return {
    id: makeId(),
    type: 'system',
    text,
  };
}

/** 创建危险消息行 */
export function createDangerLine(text: string): NarrativeLine {
  return {
    id: makeId(),
    type: 'danger',
    text,
  };
}

/** 创建场景描述行 */
export function createSceneLine(loc: LocationNode): NarrativeLine {
  return {
    id: makeId(),
    type: 'scene',
    text: loc.description,
    links: loc.actions?.map(a => ({ label: a.label, command: a.command })),
    locationId: loc.id,
  };
}

/**
 * 创建操作后交互卡片
 * 优先使用场景配置的 onActionComplete，否则返回 null
 */
export function createActionCard(
  loc: LocationNode,
  actionType: 'buy' | 'eat' | 'interact',
  actionKey?: string
): NarrativeLine | null {
  let config: ActionResultConfig | undefined;

  if (actionType === 'interact' && actionKey) {
    config = loc.onActionComplete?.interact?.[actionKey];
  } else if (actionType === 'buy') {
    config = loc.onActionComplete?.buy;
  } else if (actionType === 'eat') {
    config = loc.onActionComplete?.eat;
  }

  if (!config) return null;

  return {
    id: makeId(),
    type: 'scene',
    text: config.text,
    links: config.links,
    actionType,       // 标记类型，用于后续过期
    locationId: loc.id,
  };
}

/**
 * 统一执行操作配置
 * 将配置表中的声明式规则转化为 NarrativeManager 的指令序列，
 * 避免每个 reducer case 重复编写模板代码。
 */
export function applyOperationConfig(
  manager: NarrativeManager,
  config: OperationConfig,
  context: {
    location: LocationNode;
    actionType?: 'buy' | 'eat' | 'interact';
    actionKey?: string;
  }
): void {
  // 1. 过期指定类型的操作卡片
  for (const at of config.expireActionTypes) {
    manager.apply({ type: 'expireActionType', actionType: at });
  }

  // 2. 过期所有操作卡片（场景切换时）
  if (config.expireAllActions) {
    manager.apply({ type: 'expireAllActions' });
  }

  // 3. 过期原始场景导航链接
  if (config.expireCurrentScene) {
    manager.apply({ type: 'expireSceneLinks' });
  }

  // 4. 添加系统消息
  if (config.systemMessage) {
    const text = typeof config.systemMessage === 'function'
      ? config.systemMessage(context)
      : config.systemMessage;
    manager.apply({ type: 'add', line: createSystemLine(text) });
  }

  // 5. 添加操作后交互卡片
  if (config.showActionCard && context.actionType) {
    const card = createActionCard(context.location, context.actionType, context.actionKey);
    if (card) {
      manager.apply({ type: 'add', line: card });
    }
  }
}
