# 紫微斗数排盘 Skill

> 报个生辰，直接出盘。本地引擎，离线可用，不需要 API Key。

把开源项目 [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu) 的排盘引擎抽出来，封装成一个可以装进 AI 助手的 **Skill**：对话里说一句出生信息，就能得到结构化的十二宫命盘，并按倪海厦体系解读。

原项目是一个 Next.js 网站，排盘虽然全在浏览器端完成，但要开网页、点表单。这个仓库把它变成一条命令。

---

## 特性

- **完整排盘**：十二宫、主星亮度（庙旺得利平不陷）、辅星吉星煞星、生年四化、宫干自化、大限序列
- **真太阳时校正**：按出生地经度修正，东西部可能差出一个时辰
- **晚子时换日**：23:00–23:59 按次日排盘
- **闰月四口径**：月中分界（默认）/ 归下月 / 归前月 / 归本月，可切换
- **农历直接输入**：不用自己换算公历
- **时辰不详也能排**：按子时起盘并明确标注
- **格局判定**：1100+ 条古籍规则，输出紫府同宫、杀破狼、武贪格等
- **合盘**：双宫联参、夫妻宫互参、四化飞化互参、大限同步，按五步法出结论
- **零网络**：所有计算在本地完成，不调用任何接口

## 快速开始

```bash
git clone https://github.com/LastTrainKing/ziwei-doushu-skill.git ~/.workbuddy-ai/skills/ziwei-doushu
cd ~/.workbuddy-ai/skills/ziwei-doushu
npm install
```

装好后在对话里直接说：

> 帮我看看 1990 年 6 月 15 日早上 8 点半，北京，男

## 命令行用法

### 单人排盘

```bash
npx tsx scripts/chart.ts --date 1990-06-15 --time 08:30 --city 北京 --gender male
```

| 参数 | 说明 |
|---|---|
| `--date YYYY-MM-DD` | 出生日期，默认公历（必填） |
| `--gender male\|female` | 性别（必填） |
| `--time HH:MM` | 钟表时间，按出生地经度做真太阳时校正 |
| `--branch 子\|1` | 直接指定时辰，0=子 … 11=亥 |
| `--lunar` | 把 `--date` 当农历 |
| `--leap-month` | 配合 `--lunar`，表示闰月 |
| `--city 北京` | 出生城市，支持省/市/区县模糊匹配 |
| `--longitude 116.41` | 直接给经度，优先于 `--city` |
| `--name 张三` | 姓名（可选） |
| `--leap split` | 闰月口径：`split` / `next-month` / `prev-month` / `origin-month` |
| `--json` | 末尾附加完整命盘 JSON |

常用组合：

```bash
# 农历 + 只知时辰
npx tsx scripts/chart.ts --date 1988-03-12 --lunar --branch 午 --city 杭州 --gender female

# 时辰不详
npx tsx scripts/chart.ts --date 1975-11-08 --city 广州 --gender male

# 需要反复追问细节时带 JSON
npx tsx scripts/chart.ts --date 1990-06-15 --time 08:30 --city 北京 --gender male --json
```

### 合盘

```bash
# 紧凑写法：日期 时间/时辰 城市 性别
npx tsx scripts/heming.ts --a "1990-06-15 08:30 北京 male" --b "1992-09-03 14:20 上海 female"

# 分字段写法（农历、只知时辰时用）
npx tsx scripts/heming.ts --a-date 1990-06-15 --a-time 08:30 --a-city 北京 --a-gender male \
                          --b-date 1992-03-03 --b-lunar --b-branch 未 --b-city 上海 --b-gender female
```

输出九节：双方速览、夫妻宫互参（天作之合判定）、夫妻宫星性知识库、四化飞化互参、婚姻星、桃花与煞星、大限同步、命格兼容性速判、判定要素清单。

## 输出示例

```
# 紫微斗数命盘

**性别**：男（阳男）
**公历**：1990 年 6 月 15 日 辰时
**时间换算**：钟表 08:30，东经 116.4° → 真太阳时约 08:16，经度修正 -14 分钟
**农历**：庚午年 五月廿三
**节气四柱**：庚午 壬午 辛亥 壬辰
**五行局**：土五局　**命主**：禄存　**身主**：火星
**出生地**：北京市 北京

## 生年四化
化忌 天同｜化权 武曲｜化禄 太阳｜化科 太阴

## 十二宫
| 宫位 | 宫干支 | 大限 | 主星 | 辅星 | 吉星 | 煞星 | 自化 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ★命宫 | 戊寅 | 5-14 | 七杀(庙) | 天厨 | — | 蜚廉 | — |
| 夫妻 | 戊子 | 105-114 | 廉贞(平)、天相(庙) | — | 解神(庙) | 天哭(平)、天虚(陷) | — |
...

## 格局判定
- ★★ **杀破狼**（命宫、官禄、财帛）：七杀、破军、贪狼三星会命，开创闯荡之命格……
```

## 作为 WorkBuddy Skill 使用

`SKILL.md` 里写了触发条件、需要收集哪些信息、命令用法和解读规范。装到技能目录后，助手会在识别到「紫微/排盘/命盘/合盘」这类请求时自动加载。

## 作为 Expert 使用

仓库里已经带了一个现成的专家包模板：`expert/`。一条命令构建：

```bash
node expert/build.mjs
```

产物 `expert/dist/ziwei-master/` 是完整的 Agent 型专家包——人设「明微」+ 内置 `ziwei-chart` 技能 + 头像。复制到专家目录再跑一次注册脚本即可：

```bash
# 1. 复制（Windows 配置目录是 C:\Users\<你>\.workbuddy-ai，其他平台是 ~/.workbuddy）
cp -r expert/dist/ziwei-master <配置目录>/plugins/marketplaces/my-experts/plugins/

# 2. 注册（脚本在 expert-manager 技能内）
python scripts/register_expert.py <上面的 ziwei-master 路径>
```

打开 **专家中心 → 我的专家**，就能看到「紫微命理师」。人设、标签、头像怎么改，见 [expert/README.md](./expert/README.md)。

## 目录结构

```
.
├── SKILL.md                     技能说明（触发条件 / 用法 / 解读规范）
├── package.json
├── scripts/
│   ├── chart.ts                 单人排盘 CLI
│   ├── heming.ts                合盘 CLI
│   ├── birth.ts                 公共逻辑（解析 → 命盘）
│   └── engine/                  排盘引擎（源自上游，MIT）
├── references/
│   ├── interpretation.md        十二宫 / 主星 / 四化 / 格局 / 大限流年
│   └── heming.md                合盘五步法 / 婚期 / 凶语转译
└── expert/
    ├── build.mjs                一键构建专家包
    ├── package/                 专家模板（人设、plugin.json、头像）
    └── README.md                构建与安装说明
```

## 口径说明

- **真太阳时**：`钟表时间 +（出生地经度 − 120）× 4 分钟`，与上游网页端保持一致；均时差在引擎内有完整实现，CLI 走的是网页端那套简化口径
- **晚子时**：23:00–23:59 归次日，00:00–00:59 归本日
- **闰月**：默认 `split`（月中分界），可切 `next-month` 等
- **不含**：上游的断语库和 AI 解读 prompt 未开源，本仓库只做排盘与结构化输出，解读由使用者（或接入的模型）完成

## 上游与许可

排盘引擎来自 [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu)，MIT License，Copyright (c) 2026 紫微研究。原许可证全文见 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)。

相对上游做的改动：

- 只抽取 `lib/ziwei/` 下的引擎代码，去掉依赖 React 的 `history.ts`、`share.ts` 与 `famous.ts`
- 删除 `patterns.ts` 顶部的 `import 'server-only'`（纯 Node 环境会抛错）
- 新增 `scripts/chart.ts`、`scripts/heming.ts`、`scripts/birth.ts` 三个 CLI 入口与公共模块
- 新增 `SKILL.md`、`references/` 下的解读参考

本仓库其余部分同样以 MIT 协议发布，Copyright (c) 2026 LastTrainKing。

## 免责声明

命理内容仅供参考，不构成医疗、法律、投资或婚姻决策依据。请理性看待。
