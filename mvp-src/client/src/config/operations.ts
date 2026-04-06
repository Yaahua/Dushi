// ============ config/operations.ts ============

/** 每个操作的叙事行为配置 */
export interface OperationConfig {
  /** 操作名称 */
  name: string;

  /** 过期哪些类型的交互卡片 */
  expireActionTypes: string[];

  /** 是否过期当前场景的导航链接（不含操作后卡片） */
  expireCurrentScene: boolean;

  /** 是否过期所有操作卡片（用于场景切换） */
  expireAllActions: boolean;

  /** 是否显示操作后的交互卡片 */
  showActionCard: boolean;

  /** 操作后卡片的 actionType 标记（用于后续过期管理） */
  actionCardType?: string;

  /** 系统提示文本模板 */
  systemMessage?: string | ((context: any) => string);
}

/** 操作配置表 - 唯一真相源 */
export const OPERATION_CONFIG: Record<string, OperationConfig> = {
  GOTO_LOCATION: {
    name: '移动',
    expireActionTypes: [],
    expireCurrentScene: true,
    expireAllActions: true,      // 移动时清理所有操作卡片
    showActionCard: false,
  },

  BUY_ITEM: {
    name: '购买',
    expireActionTypes: ['buy'],  // 过期之前的购买卡片
    expireCurrentScene: true,    // 先过期再重建（与现有源码一致）
    expireAllActions: false,
    showActionCard: true,        // 通过 onActionComplete 重建链接
    actionCardType: 'buy',
    systemMessage: '你购买了一瓶矿泉水。',
  },

  EAT_FOOD: {
    name: '吃饭',
    expireActionTypes: ['eat'],
    expireCurrentScene: true,
    expireAllActions: false,
    showActionCard: true,
    actionCardType: 'eat',
  },

  COMPLETE_PROGRESS: {
    name: '完成进度',
    expireActionTypes: [],
    expireCurrentScene: false,
    expireAllActions: false,
    showActionCard: false,
  },

  INTERACT: {
    name: '交互',
    expireActionTypes: [],
    expireCurrentScene: false,
    expireAllActions: false,
    showActionCard: false,
  },
};

/** 进度完成类型的特殊配置 */
export const PROGRESS_COMPLETE_CONFIG: Record<string, Partial<OperationConfig>> = {
  eat_done: {
    expireActionTypes: ['eat'],
    expireCurrentScene: true,
    showActionCard: true,
    actionCardType: 'eat',
    systemMessage: '你吃了一顿饭。',
  },
};
