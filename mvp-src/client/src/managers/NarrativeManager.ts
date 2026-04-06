// ============ managers/NarrativeManager.ts ============

import type { NarrativeLine, NarrativeUpdate } from '@/types/narrative';

export class NarrativeManager {
  private narrative: NarrativeLine[];
  private logs: string[];

  constructor(narrative: NarrativeLine[]) {
    this.narrative = [...narrative];
    this.logs = [];
  }

  /** 执行更新指令 */
  apply(update: NarrativeUpdate): void {
    switch (update.type) {
      case 'add':
        this.narrative.push(update.line);
        this.log(`添加叙事行: ${update.line.type}${update.line.actionType ? `(${update.line.actionType})` : ''}`);
        break;

      case 'expireActionType': {
        const expiredCount = this.expireByActionType(update.actionType);
        this.log(`过期 ${update.actionType} 类型卡片: ${expiredCount} 个`);
        break;
      }

      case 'expireLocation':
        this.expireByLocation(update.locationId);
        this.log(`过期场景 ${update.locationId} 的链接`);
        break;

      case 'expireAllActions': {
        const allCount = this.expireAllActions();
        this.log(`过期所有操作卡片: ${allCount} 个`);
        break;
      }

      case 'expireSceneLinks': {
        const sceneCount = this.expireSceneLinks();
        this.log(`过期场景导航链接: ${sceneCount} 个`);
        break;
      }
    }
  }

  /** 批量执行 */
  applyAll(updates: NarrativeUpdate[]): void {
    for (const update of updates) {
      this.apply(update);
    }
  }

  /** 获取结果 */
  getResult(): { narrative: NarrativeLine[]; logs: string[] } {
    return {
      narrative: this.narrative,
      logs: this.logs,
    };
  }

  // ============ 私有方法 ============

  /** 过期指定 actionType 的操作后卡片 */
  private expireByActionType(actionType: string): number {
    let count = 0;
    this.narrative = this.narrative.map(line => {
      if (line.actionType === actionType && !line.expired) {
        count++;
        return { ...line, expired: true };
      }
      return line;
    });
    return count;
  }

  /** 过期指定场景的所有行 */
  private expireByLocation(locationId: string): void {
    this.narrative = this.narrative.map(line => {
      if (line.locationId === locationId && !line.expired) {
        return { ...line, expired: true };
      }
      return line;
    });
  }

  /** 过期所有带 actionType 标记的操作卡片 */
  private expireAllActions(): number {
    let count = 0;
    this.narrative = this.narrative.map(line => {
      if (line.actionType && !line.expired) {
        count++;
        return { ...line, expired: true };
      }
      return line;
    });
    return count;
  }

  /**
   * 过期原始场景的导航链接。
   * 只过期没有 actionType 标记的、带 links 的行。
   * 操作后卡片（有 actionType）不受影响，由 expireByActionType 管理。
   */
  private expireSceneLinks(): number {
    let count = 0;
    this.narrative = this.narrative.map(line => {
      if (line.links && line.links.length > 0 && !line.actionType && !line.expired) {
        count++;
        return { ...line, expired: true };
      }
      return line;
    });
    return count;
  }

  private log(message: string): void {
    this.logs.push(`[${new Date().toISOString()}] ${message}`);
  }
}
