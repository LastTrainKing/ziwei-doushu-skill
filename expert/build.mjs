#!/usr/bin/env node
/**
 * 一键构建专家包
 *
 * 把仓库根目录的排盘技能打包进专家模板，产出可直接安装的专家包：
 *   expert/dist/ziwei-master/
 *
 * 用法：
 *   node expert/build.mjs              # 构建 + 安装依赖
 *   node expert/build.mjs --no-install # 只拼装文件，跳过 npm install
 */
import {
  cpSync,
  rmSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  readdirSync,
} from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const templateDir = path.join(here, 'package');
const outDir = path.join(here, 'dist', 'ziwei-master');
const skipInstall = process.argv.includes('--no-install');

const SKILL_FILES = ['SKILL.md', 'package.json', 'package-lock.json', 'scripts', 'references'];

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function dirSize(dir) {
  let total = 0;
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const full = path.join(current, name);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else total += stat.size;
    }
  };
  walk(dir);
  return total;
}

console.log('紫微斗数专家包 · 构建\n');

if (!existsSync(templateDir)) fail(`找不到模板目录：${templateDir}`);
if (!existsSync(path.join(repoRoot, 'SKILL.md'))) {
  fail('请在仓库根目录运行，或确认 SKILL.md 存在');
}

// 1. 清空输出目录
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
console.log('· 清理输出目录');

// 2. 复制专家模板（plugin.json / agents / avatars）
cpSync(templateDir, outDir, { recursive: true });
console.log('· 复制专家模板');

// 3. 把技能塞进 skills/ziwei-chart
const skillOut = path.join(outDir, 'skills', 'ziwei-chart');
mkdirSync(skillOut, { recursive: true });
for (const item of SKILL_FILES) {
  const src = path.join(repoRoot, item);
  if (!existsSync(src)) {
    if (item === 'package-lock.json') continue;
    fail(`缺少技能文件：${item}`);
  }
  cpSync(src, path.join(skillOut, item), { recursive: true });
}
console.log('· 复制排盘技能 → skills/ziwei-chart');

// 4. 技能名改成 ziwei-chart，避免与用户级 ziwei-doushu 撞名
const skillMdPath = path.join(skillOut, 'SKILL.md');
const skillMd = readFileSync(skillMdPath, 'utf8');
if (!/^name: ziwei-doushu$/m.test(skillMd)) {
  fail('SKILL.md 里找不到 `name: ziwei-doushu`，无法改名');
}
writeFileSync(skillMdPath, skillMd.replace(/^name: ziwei-doushu$/m, 'name: ziwei-chart'), 'utf8');
console.log('· 技能名改为 ziwei-chart');

// 5. 安装依赖
if (skipInstall) {
  console.log('· 跳过 npm install（--no-install）');
} else {
  console.log('· 安装依赖（iztro / lunar-javascript / tsx）...');
  try {
    execSync('npm install --no-audit --no-fund', { cwd: skillOut, stdio: 'inherit', shell: true });
  } catch {
    fail('依赖安装失败，请检查网络后重试，或先用 --no-install 只拼装文件');
  }
}

// 6. 冒烟测试
const chartEntry = path.join(skillOut, 'scripts', 'chart.ts');
if (!existsSync(chartEntry)) fail('构建结果缺少 scripts/chart.ts');

const kb = Math.round(dirSize(outDir) / 1024);
console.log(`\n✓ 构建完成：${outDir}`);
console.log(`  体积：${kb} KB`);
console.log('\n安装到 WorkBuddy：');
console.log('  1. 把 expert/dist/ziwei-master 整个目录复制到');
console.log('     <WorkBuddy 配置目录>/plugins/marketplaces/my-experts/plugins/');
console.log('  2. 运行注册脚本（expert-manager 技能内）：');
console.log('     python scripts/register_expert.py <上面的 ziwei-master 路径>');
console.log('  3. 打开 专家中心 → 我的专家，即可看到「紫微命理师」\n');
