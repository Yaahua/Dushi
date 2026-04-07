# 事件流设定框架

## 系统概述

事件系统是游戏叙事的核心驱动，采用三层事件池：
- **环境基础事件**: 所有玩家都可能遇到的通用事件
- **职业专属事件**: 与玩家职业/身份相关的事件
- **跨时间连锁事件**: 多阶段、长周期的事件链

## 事件分类

### 按触发方式

| 类型 | 说明 |
| :--- | :--- |
| `random` | 随机触发，有基础概率 |
| `conditional` | 满足特定条件后触发 |
| `scheduled` | 定时触发（特定日期/时间） |
| `chain` | 由其他事件触发 |

### 按内容类型

| 类型 | 说明 | 示例 |
| :--- | :--- | :--- |
| `environmental` | 环境事件 | 天气变化、城市新闻 |
| `career` | 职业事件 | 工作任务、职场冲突 |
| `social` | 社交事件 | NPC互动、玩家相遇 |
| `crisis` | 危机事件 | 意外、冲突、危险 |
| `opportunity` | 机遇事件 | 发现、交易、信息 |

## 事件结构

```
event:
  id: 唯一标识
  name: 显示名称
  category: 分类
  
  # 触发条件
  trigger:
    type: 触发类型
    conditions: 条件列表
    probability: 基础概率
    cooldown: 冷却时间
    
  # 执行效果
  effects:
    - type: 效果类型
      target: 作用目标
      value: 数值变化
      
  # 叙事内容
  narrative:
    title: 事件标题
    description: 事件描述
    choices: 玩家选项列表
    
  # 后续事件
  next_events:
    - event_id: 后续事件ID
      delay: 延迟时间
      condition: 触发条件
```

## 事件链

事件链允许多个事件按顺序或分支结构触发：
- **线性链**: A → B → C
- **分支链**: A → (B 或 C)
- **条件链**: 根据玩家选择触发不同后续

定义在 `_chains.yaml` 中。

## 文件组织

```
events/
├── README.md              # 本文件
├── _template.yaml         # 事件配置模板
├── _chains.yaml           # 事件链定义
├── environmental/         # 环境基础事件
├── career/                # 职业专属事件
└── chain/                 # 连锁事件
```

## 与NPC系统的关联

NPC 可以作为事件的：
- 触发者（触发事件）
- 参与者（事件中的角色）
- 信息源（提供事件线索）
