# 第三方声明

本仓库的 `scripts/engine/` 目录不是原创代码，而是从下列开源项目抽取而来。按 MIT 协议要求，保留原始版权声明。

---

## 1. ziwei-doushu（排盘引擎）

- 仓库：https://github.com/Renhuai123/ziwei-doushu
- 许可证：MIT License
- 版权：Copyright (c) 2026 紫微研究

本仓库使用范围：`scripts/engine/` 下全部文件（18 个），仅做了两处适配性删改：

1. 未包含依赖 React 的 `history.ts`、`share.ts`，以及含名人命盘的 `famous.ts`
2. 删除 `patterns.ts` 顶部的 `import 'server-only'`（该包在纯 Node 环境下会主动抛错）

引擎算法本身未作任何修改。

### 原始许可证全文

```
MIT License

Copyright (c) 2026 紫微研究

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

> 上游仓库另有 `DATASET-LICENSE`，适用于其 GitHub Releases 中发布的数据集。本仓库未使用任何数据集文件。

---

## 2. 运行时依赖

以下依赖通过 `npm install` 安装，不随本仓库分发，均为 MIT 协议：

| 包 | 许可证 | 用途 |
|---|---|---|
| [iztro](https://github.com/SylarLong/iztro) | MIT | 紫微斗数排盘基础库 |
| [lunar-javascript](https://github.com/6tail/lunar-javascript) | MIT | 农历 / 节气 / 干支换算 |
| [tsx](https://github.com/privatenumber/tsx) | MIT | 直接运行 TypeScript |

---

## 3. 内容说明

`references/` 下的解读参考（十二宫主管、主星特质、四化含义、格局条件、合盘五步法）整理自《紫微斗数全书》《紫微斗数全集》《骨髓赋》等公版古籍，以及上游引擎中已开源的 `heming-knowledge.ts`、`patterns.ts` 注释。引用的倪海厦讲稿语句均来自上游仓库已公开的文本片段。

命理内容仅供文化研究与个人参考。
