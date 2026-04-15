// ============ types/narrative.ts ============

/** 叙事行类型 */
export type LineType = 'scene' | 'system' | 'player' | 'danger' | 'warning' | 'dialogue' | 'success';

/** 交互链接 */
export interface ActionLink {
  label: string;
  command: string;
}

/** 叙事行 */
export interface NarrativeLine {
  id: string;
  type: LineType;
  text: string;
  links?: ActionLink[];
  expired?: boolean;
  timestamp?: number;
  actionType?: string;   // 'buy' | 'eat' | 'interact' | 'scene' — 标记操作后卡片类型，用于过期管理
  locationId?: string;   // 关联的场景 ID
}

/** 叙事更新指令 */
export type NarrativeUpdate =
  | { type: 'add'; line: NarrativeLine }
  | { type: 'expireActionType'; actionType: string }
  | { type: 'expireLocation'; locationId: string }
  | { type: 'expireAllActions' }
  | { type: 'expireSceneLinks' };
