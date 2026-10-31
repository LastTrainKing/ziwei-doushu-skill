# 专家包：紫微命理师

把仓库里的排盘技能包装成一个带人设的 WorkBuddy 专家（Agent 型），产出可直接安装的专家包。

专家「明微」按倪海厦体系解盘，会先排盘、再按「命宫 → 三方四正 → 具体问题」的顺序解读，并遵守一套边界（不编造星曜、不预测生死、古籍凶语要转译）。

## 一键构建

```bash
node expert/build.mjs
```

产物在 `expert/dist/ziwei-master/`，结构如下：

```
ziwei-master/
├── .codebuddy-plugin/plugin.json   专家元数据（skills 指向 ./skills/ziwei-chart）
├── agents/ziwei-master.md          人设 + 工作流 + 输出规范
├── avatars/expert.png              头像
├── skills/ziwei-chart/             排盘技能（构建时从仓库根目录复制）
└── README.md
```

构建过程做了三件事：复制模板、把仓库根目录的技能塞进 `skills/ziwei-chart`（并把技能名从 `ziwei-doushu` 改成 `ziwei-chart`，避免与用户级技能撞名）、安装依赖。

只想拼装文件不装依赖：

```bash
node expert/build.mjs --no-install
```

## 安装

1. 把 `expert/dist/ziwei-master` 整个目录复制到 WorkBuddy 的专家目录：

   ```
   <配置目录>/plugins/marketplaces/my-experts/plugins/ziwei-master
   ```

   Windows 默认配置目录是 `C:\Users\<你>\.workbuddy-ai`，其他平台是 `~/.workbuddy`。

2. 用 expert-manager 技能里的注册脚本登记：

   ```bash
   python scripts/register_expert.py <上面的 ziwei-master 路径>
   ```

3. 打开 **专家中心 → 我的专家**，就能看到「紫微命理师」。

## 目录说明

```
expert/
├── build.mjs          构建脚本
├── package/           专家模板（不含 skills，构建时补齐）
│   ├── .codebuddy-plugin/plugin.json
│   ├── agents/ziwei-master.md
│   ├── avatars/expert.png
│   └── README.md
└── dist/              构建产物（已 git 忽略）
```

## 定制

| 想改什么 | 改哪里 | 注意 |
|---|---|---|
| 人设、语气、工作流 | `package/agents/ziwei-master.md` | 改完要重新构建 + 重新注册 |
| 名称、描述、标签 | `package/.codebuddy-plugin/plugin.json` | `tags` 和 `quickPrompts` 固定 3 个；`displayDescription` 中文 40–50 字；`defaultInitPrompt` 必须与第一条 `quickPrompt` 一致 |
| 头像 | `package/avatars/expert.png` | PNG/JPG，512×512，≤500KB |
| 排盘逻辑 | 仓库根目录的 `scripts/` | 构建时自动带进专家包 |

改完重新执行 `node expert/build.mjs`，再跑一次注册脚本才会生效。
