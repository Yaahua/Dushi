# 城市地图设定框架

## 系统概述

城市地图定义了游戏世界的物理空间，采用三层结构：
- **区域 (Area)**: 城市的大区块划分
- **地点 (Spot)**: 区域内的具体场所
- **坐标 (Coordinate)**: 精确位置（可选）

## 地图层级

```
城市
├── 区域 Area
│   ├── 地点 Spot
│   │   ├── 坐标 [x, y]
│   │   └── 连接 Connections
```

## 地点属性

| 属性 | 说明 | 示例 |
| :--- | :--- | :--- |
| `safety_level` | 安全等级 | safe/normal/dangerous/hostile |
| `crowd_density` | 人流密度 | sparse/normal/crowded |
| `tags` | 功能标签 | shop/restaurant/residence/office |
| `indoor` | 是否室内 | true/false |

## 连接关系

地点之间通过连接定义移动路径，包含：
- `target`: 目标地点ID
- `time_cost`: 移动时间消耗（GT分钟）
- `stamina_cost`: 体能消耗
- `condition`: 进入条件

## 准入系统

区域和地点可设置准入条件：
- 身份要求（公民/难民/许可）
- 关系要求（与NPC的关系值）
- 时间限制（特定时段开放）
- 特殊许可（证书/证件）

## 文件组织

```
map/
├── README.md          # 本文件
├── _schema.yaml       # 地图数据格式定义
├── world_apartment.yaml  # 世界公寓区域
└── main_district.yaml    # 主城区
```

## 与NPC系统的关联

NPC 的位置信息引用地图中的 `area_id` 和 `spot_id`。
