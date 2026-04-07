# 《都市余烬》设定框架

本文件夹包含游戏世界的所有设定数据，采用**数据驱动 (Data-Driven)** 架构，与代码分离。

## 文件夹结构

```
设定/
├── README.md                 # 本文件：框架说明与索引
├── npc/                      # NPC 系统设定
│   ├── README.md            # NPC 系统架构说明
│   ├── _template.yaml       # NPC 模板文件
│   ├── _common_dialogues.yaml # 通用对话库
│   └── 世界公寓/            # 按区域划分的NPC配置
│   └── 主城区/
│   └── 动态生成/            # 动态NPC生成规则
├── map/                      # 城市地图设定
│   ├── README.md            # 地图系统架构说明
│   ├── _schema.yaml         # 地图数据格式定义
│   ├── world_apartment.yaml # 世界公寓区域
│   └── main_district.yaml   # 主城区
└── events/                   # 事件流设定
    ├── README.md            # 事件系统架构说明
    ├── _template.yaml       # 事件模板文件
    ├── _chains.yaml         # 事件链定义
    ├── environmental/       # 环境基础事件
    ├── career/              # 职业专属事件
    └── chain/               # 连锁事件
```

## 使用说明

1. **制作人**负责在此文件夹中填充所有世界观内容
2. **工程端**负责读取这些配置并驱动游戏逻辑
3. 所有文件使用 YAML 格式，便于人工编辑和程序解析
4. 文件名和路径结构即为游戏内逻辑结构，修改需谨慎

## 当前状态

- [x] NPC 系统：框架已建立
- [x] 城市地图：框架已建立
- [x] 事件流：框架已建立
