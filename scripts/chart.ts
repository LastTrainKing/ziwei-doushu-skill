#!/usr/bin/env node
/**
 * 紫微斗数排盘 CLI
 *
 * 用法示例：
 *   npx tsx scripts/chart.ts --date 1990-06-15 --time 08:30 --city 北京 --gender male
 *   npx tsx scripts/chart.ts --date 1995-03-02 --branch 午 --gender female --json
 */
import { detectPatterns, getMingGongSummary } from './engine/patterns';
import type { Star, Palace } from './engine/types';
import {
  BRANCHES,
  STEMS,
  BirthError,
  resolveBirth,
  daXianMeta,
  lunarMonthName,
  lunarDayName,
  type BirthResult,
} from './birth';

function parseArgs(argv: string[]) {
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      flags.add(key);
    } else {
      values[key] = next;
      i++;
    }
  }
  return { values, flags };
}

function starLabel(star: Star) {
  const brightness = star.brightnessRaw ? `(${star.brightnessRaw})` : '';
  const hua = star.siHua ? `化${star.siHua}` : '';
  return `${star.name}${brightness}${hua}`;
}

function palaceRow(p: Palace) {
  const major = p.stars.filter(s => s.type === 'major').map(starLabel);
  const minor = p.stars.filter(s => s.type === 'minor').map(starLabel);
  const lucky = p.stars.filter(s => s.type === 'lucky').map(starLabel);
  const sha = p.stars.filter(s => s.type === 'sha').map(starLabel);

  const mark = [p.isMingGong ? '★' : '', p.isShenGong ? '◆' : ''].join('');
  const name = `${mark}${p.name}${p.isCurrentDaXian ? '（限）' : ''}`;
  const ganzhi = `${STEMS[p.stem]}${BRANCHES[p.branch]}`;
  const age = p.daXianAge ? `${p.daXianAge[0]}-${p.daXianAge[1]}` : '';
  const self = p.selfSihua?.length ? p.selfSihua.map(s => `${s.starName}化${s.siHua}`).join('、') : '';

  const main = major.length
    ? major.join('、')
    : p.isEmpty
      ? `空宫（借${p.borrowedFromName ?? '对宫'}：${(p.borrowedStars ?? []).join('、') || '—'}）`
      : '—';

  return `| ${name} | ${ganzhi} | ${age} | ${main} | ${minor.join('、') || '—'} | ${lucky.join('、') || '—'} | ${sha.join('、') || '—'} | ${self || '—'} |`;
}

function usage() {
  return `紫微斗数排盘

必填：
  --date YYYY-MM-DD     出生日期（默认公历）
  --gender male|female  性别

时间（二选一，都不给则按时辰不详处理）：
  --time HH:MM          出生钟表时间（会按出生地经度做真太阳时校正）
  --branch 子|1         直接指定时辰（0=子 … 11=亥）

可选：
  --lunar               把 --date 当作农历日期
  --leap-month          配合 --lunar，表示该月为闰月
  --city 北京           出生城市（用于取经度；支持省/市/区县模糊匹配）
  --longitude 116.41    直接给经度，优先于 --city
  --name 张三           姓名
  --leap split          闰月口径：split | next-month | prev-month | origin-month（默认 split）
  --json                末尾追加完整命盘 JSON
  --help                显示本帮助`;
}

function render({ chart, birthInfo, meta }: BirthResult, withJson: boolean) {
  const { lunarInfo } = chart;
  const { unknownTime, hour, gender, place, clockNote, solarNote, lunarConverted, clockTime } = meta;

  const siHua = chart.palaces
    .flatMap(p => p.stars)
    .filter(s => s.siHua)
    .map(s => `化${s.siHua} ${s.name}`)
    .join('｜');

  const lines: string[] = [];
  lines.push('# 紫微斗数命盘', '');
  lines.push(
    `**${birthInfo.name ? `${birthInfo.name}　` : ''}性别**：${gender === 'male' ? '男' : '女'}${chart.yinYangGender ? `（${chart.yinYangGender}）` : ''}`,
  );
  lines.push(
    `**公历**：${birthInfo.year} 年 ${birthInfo.month} 月 ${birthInfo.day} 日${unknownTime ? '（时辰不详，按子时排）' : ` ${BRANCHES[hour]}时`}${clockNote}`,
  );
  if (lunarConverted) lines.push(`**农历输入**：${lunarConverted}`);
  if (!unknownTime && clockTime) {
    lines.push(
      `**时间换算**：钟表 ${clockTime}${typeof meta.longitude === 'number' ? `，东经 ${meta.longitude}°` : ''} → ${solarNote}`,
    );
  }
  lines.push(
    `**农历**：${STEMS[lunarInfo.yearStem]}${BRANCHES[lunarInfo.yearBranch]}年 ${lunarMonthName(lunarInfo.lunarMonth)}${lunarDayName(lunarInfo.lunarDay)}`,
  );
  if (lunarInfo.fourPillars) lines.push(`**节气四柱**：${lunarInfo.fourPillars.join(' ')}`);
  lines.push(
    `**五行局**：${chart.wuxingJuName}　**命主**：${chart.mingZhu ?? '—'}　**身主**：${chart.shenZhu ?? '—'}`,
  );
  if (place) lines.push(`**出生地**：${place.province} ${place.city}`);
  lines.push('');

  lines.push('## 生年四化', '', siHua || '无', '');

  lines.push('## 十二宫', '');
  lines.push('| 宫位 | 宫干支 | 大限 | 主星 | 辅星 | 吉星 | 煞星 | 自化 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  [...chart.palaces].sort((a, b) => a.branch - b.branch).forEach(p => lines.push(palaceRow(p)));
  lines.push('');

  const current = chart.daXians[chart.currentDaXianIndex];
  lines.push('## 当前运势', '');
  lines.push(`- 当前虚岁约 **${chart.currentAge}** 岁`);
  if (current) {
    const info = daXianMeta(chart, current);
    lines.push(
      `- 当前大限：**${current.startAge}-${current.endAge} 岁**，走 **${current.palaceName}宫**` +
        (info.stemName ? `（${info.stemName}干）` : '') +
        (info.siHua
          ? `，大限四化：禄${info.siHua.lu} 权${info.siHua.quan} 科${info.siHua.ke} 忌${info.siHua.ji}`
          : ''),
    );
  }
  const thisYear = new Date().getFullYear();
  lines.push(
    `- 今年流年：${thisYear} 年（${STEMS[(((thisYear - 4) % 10) + 10) % 10]}${BRANCHES[(((thisYear - 4) % 12) + 12) % 12]}年）`,
  );
  lines.push('');

  lines.push('## 大限序列', '');
  lines.push(
    chart.daXians
      .map(d => {
        const stem = daXianMeta(chart, d).stemName;
        return `${d.startAge}-${d.endAge} ${d.palaceName}${stem ? `(${stem})` : ''}`;
      })
      .join('　｜　'),
  );
  lines.push('');

  const summary = getMingGongSummary(chart);
  if (summary.stars.length) {
    lines.push('## 命宫提要', '');
    lines.push(`- 命宫主星：${summary.stars.join('、')}`);
    if (summary.nature) lines.push(`- 星性：${summary.nature}`);
    if (summary.keywords.length) lines.push(`- 关键词：${[...new Set(summary.keywords)].join('、')}`);
    lines.push('');
  }

  const patterns = detectPatterns(chart);
  if (patterns.length) {
    lines.push('## 格局判定', '');
    const icon: Record<string, string> = { excellent: '★★★', good: '★★', neutral: '★', caution: '⚠' };
    patterns.slice(0, 12).forEach(p => {
      const where = p.palaces.length ? `（${p.palaces.join('、')}）` : '';
      lines.push(`- ${icon[p.level] ?? '·'} **${p.name}**${where}：${p.description}`);
    });
    lines.push('');
  }

  console.log(lines.join('\n'));

  if (withJson) {
    console.log('\n<!-- CHART_JSON');
    console.log(JSON.stringify({ birthInfo, chart }, null, 2));
    console.log('CHART_JSON -->');
  }
}

function main() {
  const { values, flags } = parseArgs(process.argv.slice(2));

  if (flags.has('help') || !values.date) {
    console.log(usage());
    process.exit(values.date ? 0 : 1);
  }

  try {
    const result = resolveBirth({
      date: values.date,
      time: values.time,
      branch: values.branch,
      city: values.city,
      longitude: values.longitude,
      gender: values.gender,
      name: values.name,
      lunar: flags.has('lunar'),
      leapMonth: flags.has('leap-month'),
      leap: values.leap,
    });
    render(result, flags.has('json'));
  } catch (err) {
    console.error(err instanceof BirthError ? err.message : String(err));
    process.exit(1);
  }
}

main();
