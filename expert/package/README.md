# 紫微命理师（Ziwei Master）

按倪海厦《天纪》体系排紫微斗数命盘并解盘的 AI 专家。排盘由本地引擎完成，不联网、不需要 API Key。

## 类型

Agent 型（单个 AI 专家）

## 功能

- **排盘**：公历/农历、钟表时间或时辰、真太阳时校正、晚子时换日、闰月四种口径
- **解盘**：十二宫星曜（含庙旺利陷与四化）、三方四正、生年四化与大限四化、格局判定
- **合盘**：双宫联参、夫妻宫互参、四化飞化互参、大限同步，按五步法出结论
- **运势**：当前大限主题、流年触发点、婚期与事业节点

## 使用示例

- 帮我排个命盘：1990 年 6 月 15 日早上 8 点半出生，北京，男
- 我和另一半合不合？帮我做个合盘
- 我今年的事业和财运怎么样？

## 目录结构

```
ziwei-master/
├── .codebuddy-plugin/plugin.json
├── agents/ziwei-master.md          人设与工作流
├── skills/ziwei-chart/             内置排盘技能（引擎 + CLI）
│   ├── SKILL.md
│   ├── scripts/chart.ts            单人排盘
│   ├── scripts/heming.ts           合盘
│   ├── scripts/engine/             排盘引擎（来自 Renhuai123/ziwei-doushu，MIT）
│   └── references/                 解读参考
└── avatars/expert.png
```

## 头像

头像已生成在 `avatars/expert.png`（512×512，约 460KB）。如需替换：PNG/JPG，512×512，≤500KB。

## 依赖

内置技能已带 `node_modules`（iztro + lunar-javascript + tsx），开箱即用。如果复制到其他机器后报「找不到依赖」，进入 `skills/ziwei-chart` 执行 `npm install` 即可。

## 打包分享

```bash
python3 scripts/package_expert.py <expert-dir>
```

> 注意：内置技能含 node_modules，打包后体积约 45MB。若要精简，可删除 `skills/ziwei-chart/node_modules`，让使用者首次运行时自行 `npm install`。
