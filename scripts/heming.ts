#!/usr/bin/env node
/**
 * 紫微斗数合盘 CLI
 *
 * 用法：
 *   npx tsx scripts/heming.ts --a "1990-06-15 08:30 北京 male" --b "1992-09-03 14:20 上海 female"
 *   npx tsx scripts/heming.ts --a-date 1990-06-15 --a-time 08:30 --a-city 北京 --a-gender male \
 *                             --b-date 1992-09-03 --b-branch 未 --b-city 上海 --b-gender female
 */
import type { Palace, ZiweiChart, Star } from './engine/types';
import { STAR_IN_FUQI_GU, MARRIAGE_STARS_BRIEF, HEMING_SCORE_CRITERIA } from './engine/heming-knowledge';
import {
  BRANCHES,
  STEMS,
  BirthError,
  resolveBirth,
  daXianMeta,
  sanFangSiZheng,
  type BirthSpec,
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

/** 解析 "1990-06-15 08:30 北京 male" 这种紧凑写法 */
function parseCompact(input: string): BirthSpec {
  const spec: BirthSpec = {};
  for (const part of input.trim().split(/\s+/)) {
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(part) && !spec.date) {
      spec.date = part;
    } else if (/^\d{1,2}:\d{2}$/.test(part) && !spec.time) {
      spec.time = part;
    } else if (/^(male|female|男|女|m|f)$/i.test(part)) {
      spec.gender = part;
    } else if (part.length === 1 && BRANCHES.includes(part) && !spec.branch && !spec.time) {
      spec.branch = part;
    } else if (!spec.city) {
      spec.city = part;
    }
  }
  return spec;
}

function buildSpec(values: Record<string, string>, flags: Set<string>, side: 'a' | 'b'): BirthSpec {
  const compact = values[side] ? parseCompact(values[side]) : {};
  const pick = (field: string) => values[`${side}-${field}`] ?? values[`${side}${field}`];
  return {
    date: pick('date') ?? compact.date,
    time: pick('time') ?? compact.time,
    branch: pick('branch') ?? compact.branch,
    city: pick('city') ?? compact.city,
    longitude: pick('longitude') ?? compact.longitude,
    gender: pick('gender') ?? compact.gender ?? 'male',
    name: pick('name') ?? compact.name,
    lunar: flags.has(`${side}-lunar`) || Boolean(compact.lunar),
    leapMonth: flags.has(`${side}-leap-month`) || Boolean(compact.leapMonth),
    leap: pick('leap') ?? compact.leap,
  };
}

function mainStars(p: Palace) {
  return p.stars.filter(s => s.type === 'major');
}

function majorNames(p: Palace) {
  const names = mainStars(p).map(s => s.name);
  return names.length ? names : (p.borrowedStars ?? []);
}

function starText(s: Star) {
  return `${s.name}${s.brightnessRaw ? `(${s.brightnessRaw})` : ''}${s.siHua ? `化${s.siHua}` : ''}`;
}

function findStarPalace(chart: ZiweiChart, starName: string) {
  return chart.palaces.find(p => p.stars.some(s => s.name === starName));
}

function palaceStarsText(p?: Palace) {
  if (!p) return '—';
  const majors = p.stars.filter(s => s.type === 'major').map(starText);
  return majors.length ? majors.join('、') : p.isEmpty ? `空宫（借${p.borrowedFromName ?? '对宫'}）` : '无主星';
}

function birthFourHua(chart: ZiweiChart) {
  return chart.palaces
    .flatMap(p => p.stars)
    .filter(s => s.siHua)
    .map(s => ({ hua: s.siHua as string, star: s.name }));
}

function shaCount(palaces: Palace[]) {
  return palaces.reduce((n, p) => n + p.stars.filter(s => s.type === 'sha').length, 0);
}

function luckyCount(palaces: Palace[]) {
  return palaces.reduce((n, p) => n + p.stars.filter(s => s.type === 'lucky').length, 0);
}

function shortBirth(res: BirthResult) {
  const { birthInfo, meta } = res;
  return `${birthInfo.year}-${String(birthInfo.month).padStart(2, '0')}-${String(birthInfo.day).padStart(2, '0')} ${BRANCHES[meta.hour]}时 · ${meta.gender === 'male' ? '男' : '女'}${meta.place ? ` · ${meta.place.city}` : ''}`;
}

function sideBlock(title: string, res: BirthResult) {
  const { chart } = res;
  const ming = chart.palaces.find(p => p.isMingGong);
  const shen = chart.palaces.find(p => p.isShenGong);
  const fuqi = chart.palaces.find(p => p.name === '夫妻');
  const fude = chart.palaces.find(p => p.name === '福德');
  const current = chart.daXians[chart.currentDaXianIndex];

  const lines = [`### ${title}`, '', `- 生辰：${shortBirth(res)}`];
  lines.push(`- 命宫：**${palaceStarsText(ming)}**（${ming ? `${STEMS[ming.stem]}${BRANCHES[ming.branch]}` : '—'}）`);
  lines.push(`- 身宫：${shen ? `${shen.name}宫 · ${palaceStarsText(shen)}` : '—'}`);
  lines.push(`- 夫妻宫：**${palaceStarsText(fuqi)}**（${fuqi ? `${STEMS[fuqi.stem]}${BRANCHES[fuqi.branch]}` : '—'}）`);
  lines.push(`- 福德宫：${palaceStarsText(fude)}`);
  if (current) {
    const info = daXianMeta(chart, current);
    lines.push(
      `- 当前大限：${current.startAge}-${current.endAge} 岁走 ${current.palaceName}宫${info.stemName ? `（${info.stemName}干）` : ''}`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

/** 命格兼容性速判表（出自引擎 HEMING_METHODOLOGY「感情相位类型」） */
const COMPAT_RULES: { a: string[]; b: string[]; stars: string; label: string }[] = [
  { a: ['紫微'], b: ['天府'], stars: '★★★★★', label: '帝星遇财库，相互成就，最稳定' },
  { a: ['天相'], b: ['*'], stars: '★★★★', label: '印星佐才，天相适应性强' },
  { a: ['天梁'], b: ['天同'], stars: '★★★★', label: '老成与温和互补，白头偕老型' },
  { a: ['太阳'], b: ['太阴'], stars: '★★★★', label: '日月并明，经典互补，阴阳调和' },
  { a: ['紫微', '破军'], b: ['廉贞', '天府'], stars: '★★★★', label: '格局相当，互相吸引' },
  { a: ['武曲'], b: ['天同'], stars: '★★★', label: '刚柔互济，能互补' },
  { a: ['七杀'], b: ['七杀'], stars: '★★', label: '两虎相争，火花大、矛盾多' },
  { a: ['破军'], b: ['破军'], stars: '★★', label: '双破，彼此破坏，婚姻不稳' },
  { a: ['廉贞'], b: ['七杀', '破军'], stars: '★', label: '三凶组合之二，生离死别风险最高' },
];

const STAR_ORDER = ['★★★★★', '★★★★', '★★★', '★★', '★'];

function matchCompat(aStars: string[], bStars: string[]): typeof COMPAT_RULES {
  const matched = COMPAT_RULES.filter(rule => {
    const forward =
      aStars.some(s => rule.a.includes(s)) &&
      (rule.b.includes('*') || bStars.some(s => rule.b.includes(s)));
    const reverse =
      bStars.some(s => rule.a.includes(s)) &&
      (rule.b.includes('*') || aStars.some(s => rule.b.includes(s)));
    return forward || reverse;
  });
  return matched.sort((x, y) => STAR_ORDER.indexOf(x.stars) - STAR_ORDER.indexOf(y.stars));
}

function main() {
  const { values, flags } = parseArgs(process.argv.slice(2));

  if (flags.has('help') || (!values.a && !values['a-date']) || (!values.b && !values['b-date'])) {
    console.log(`紫微斗数合盘

用法一（紧凑写法）：
  npx tsx scripts/heming.ts --a "1990-06-15 08:30 北京 male" --b "1992-09-03 14:20 上海 female"

用法二（分字段）：
  npx tsx scripts/heming.ts --a-date 1990-06-15 --a-time 08:30 --a-city 北京 --a-gender male \\
                            --b-date 1992-09-03 --b-branch 未 --b-city 上海 --b-gender female

每侧支持：date / time / branch / city / longitude / gender / name / leap
每侧开关：--a-lunar --a-leap-month（乙方同理）

紧凑写法里顺序不限，但要有：日期、时间或时辰、城市、性别。`);
    process.exit(1);
  }

  let A: BirthResult;
  let B: BirthResult;
  try {
    A = resolveBirth(buildSpec(values, flags, 'a'));
    B = resolveBirth(buildSpec(values, flags, 'b'));
  } catch (err) {
    console.error(err instanceof BirthError ? err.message : String(err));
    process.exit(1);
  }

  const ca = A.chart;
  const cb = B.chart;
  const mingA = ca.palaces.find(p => p.isMingGong);
  const mingB = cb.palaces.find(p => p.isMingGong);
  const fuqiA = ca.palaces.find(p => p.name === '夫妻');
  const fuqiB = cb.palaces.find(p => p.name === '夫妻');

  const out: string[] = [];
  out.push('# 合盘分析数据', '');
  out.push(sideBlock('甲方', A));
  out.push(sideBlock('乙方', B));

  // ── 夫妻宫互参 ──
  const mingStarsA = mingA ? majorNames(mingA) : [];
  const mingStarsB = mingB ? majorNames(mingB) : [];
  const fuqiStarsA = fuqiA ? majorNames(fuqiA) : [];
  const fuqiStarsB = fuqiB ? majorNames(fuqiB) : [];

  const aToB = fuqiStarsA.filter(s => mingStarsB.includes(s));
  const bToA = fuqiStarsB.filter(s => mingStarsA.includes(s));

  out.push('## 一、夫妻宫互参（天作之合判定）', '');
  out.push(`- 甲方命宫主星：${mingStarsA.join('、') || '无主星'}｜夫妻宫主星：${fuqiStarsA.join('、') || '无主星'}`);
  out.push(`- 乙方命宫主星：${mingStarsB.join('、') || '无主星'}｜夫妻宫主星：${fuqiStarsB.join('、') || '无主星'}`);
  out.push(`- 甲夫妻宫 → 乙命宫：${aToB.length ? `**对应（${aToB.join('、')}）**` : '不对应'}`);
  out.push(`- 乙夫妻宫 → 甲命宫：${bToA.length ? `**对应（${bToA.join('、')}）**` : '不对应'}`);

  const verdict =
    aToB.length && bToA.length
      ? '双向对应 —— 方法论中的「天作之合」结构'
      : aToB.length || bToA.length
        ? '单向对应 —— 方法论中的「次级良配」结构'
        : '无直接对应 —— 需从命格互补、四化飞化、福德宫另找依据';
  out.push(`- **结构判定**：${verdict}`);
  out.push('');

  // ── 夫妻宫星性 ──
  out.push('## 二、夫妻宫星性（引擎知识库）', '');
  for (const [label, fuqi] of [
    ['甲方', fuqiA],
    ['乙方', fuqiB],
  ] as const) {
    const stars = fuqi ? majorNames(fuqi) : [];
    out.push(`### ${label}夫妻宫 · ${stars.join('、') || '无主星'}`, '');
    if (!stars.length) {
      out.push('- 空宫，借对宫主星看，力量约打七折', '');
      continue;
    }
    for (const name of stars) {
      const info = STAR_IN_FUQI_GU[name];
      if (!info) continue;
      out.push(`**${name}**`);
      out.push(`- 概要：${info.summary}`);
      out.push(`- 配偶特质：${info.spouse_traits}`);
      out.push(`- 吉：${info.good}`);
      out.push(`- 忌：${info.bad}`);
      out.push(`- 婚期：${info.timing}`);
      if (info.ni_quote) out.push(`- 倪师原话：${info.ni_quote}`);
      out.push('');
    }
  }

  // ── 四化飞化互参 ──
  out.push('## 三、四化飞化互参', '');
  const huaA = birthFourHua(ca);
  const huaB = birthFourHua(cb);
  const yearStemA = STEMS[ca.lunarInfo.yearStem];
  const yearStemB = STEMS[cb.lunarInfo.yearStem];

  out.push(`甲方生年四化（${yearStemA}干）：${huaA.map(h => `化${h.hua} ${h.star}`).join('｜')}`);
  out.push('');
  out.push('落入乙方命盘：');
  for (const { hua, star } of huaA) {
    const p = findStarPalace(cb, star);
    out.push(`- 化${hua} **${star}** → 乙方【${p?.name ?? '不在盘中'}】宫`);
  }
  out.push('');
  out.push(`乙方生年四化（${yearStemB}干）：${huaB.map(h => `化${h.hua} ${h.star}`).join('｜')}`);
  out.push('');
  out.push('落入甲方命盘：');
  for (const { hua, star } of huaB) {
    const p = findStarPalace(ca, star);
    out.push(`- 化${hua} **${star}** → 甲方【${p?.name ?? '不在盘中'}】宫`);
  }
  out.push('');

  // ── 太阳太阴 ──
  out.push('## 四、婚姻星（太阳 / 太阴）', '');
  for (const [label, chart, res] of [
    ['甲方', ca, A],
    ['乙方', cb, B],
  ] as const) {
    const gender = res.meta.gender === 'male' ? '男' : '女';
    const target = gender === '男' ? '太阴' : '太阳';
    const p = findStarPalace(chart, target);
    const s = p?.stars.find(x => x.name === target);
    const role = gender === '男' ? '看妻' : '看夫';
    out.push(
      `- ${label}（${gender}，${role}）：**${target}** 在【${p?.name ?? '—'}】宫${s ? `，${starText(s)}` : ''}`,
    );
  }
  out.push('');

  // ── 桃花与煞星 ──
  out.push('## 五、桃花星与煞星', '');
  for (const [label, chart, fuqi] of [
    ['甲方', ca, fuqiA],
    ['乙方', cb, fuqiB],
  ] as const) {
    const positions = Object.keys(MARRIAGE_STARS_BRIEF)
      .map(name => {
        const p = findStarPalace(chart, name);
        return p ? `${name}在${p.name}` : '';
      })
      .filter(Boolean);
    out.push(`- ${label}桃花/孤克星：${positions.join('、') || '未见'}`);

    const shaInFuqi = fuqi ? fuqi.stars.filter(s => s.type === 'sha').map(s => s.name) : [];
    const shaInSanFang = fuqi ? shaCount(sanFangSiZheng(chart.palaces, fuqi.branch)) : 0;
    out.push(
      `- ${label}夫妻宫煞星：${shaInFuqi.join('、') || '无'}；夫妻宫三方四正煞星合计 ${shaInSanFang} 颗`,
    );
  }
  out.push('');

  // ── 大限同步 ──
  out.push('## 六、大限同步', '');
  for (const [label, chart] of [
    ['甲方', ca],
    ['乙方', cb],
  ] as const) {
    const d = chart.daXians[chart.currentDaXianIndex];
    if (!d) continue;
    const palace = chart.palaces.find(p => p.branch === d.palaceBranch);
    const sf = palace ? sanFangSiZheng(chart.palaces, palace.branch) : [];
    const info = daXianMeta(chart, d);
    out.push(
      `- ${label}：${d.startAge}-${d.endAge} 岁走 ${d.palaceName}宫${info.stemName ? `（${info.stemName}干）` : ''}，` +
        `吉星 ${luckyCount(sf)} 颗、煞星 ${shaCount(sf)} 颗` +
        (info.siHua ? `；大限四化 禄${info.siHua.lu} 权${info.siHua.quan} 科${info.siHua.ke} 忌${info.siHua.ji}` : ''),
    );
  }
  out.push('');

  // ── 命格兼容性速判 ──
  out.push('## 七、命格兼容性速判', '');
  out.push(`- 甲方命宫：${mingStarsA.join('、') || '无主星'}｜乙方命宫：${mingStarsB.join('、') || '无主星'}`);
  const compat = matchCompat(mingStarsA, mingStarsB);
  if (compat.length) {
    out.push(`- 最佳命中：**${compat[0].label}**（${compat[0].stars}）`);
    compat
      .filter(r => r.stars === '★' || r.stars === '★★')
      .forEach(r => out.push(`- ⚠️ 同时命中：${r.label}（${r.stars}）`));
  } else {
    out.push('- 未命中速判表的固定组合，按命格互补性判断');
  }

  const shaPoLang = ['七杀', '破军', '贪狼'];
  const jiYueTongLiang = ['天机', '太阴', '天同', '天梁'];
  const aIsSPL = mingStarsA.some(s => shaPoLang.includes(s));
  const bIsSPL = mingStarsB.some(s => shaPoLang.includes(s));
  const aIsJYTL = mingStarsA.some(s => jiYueTongLiang.includes(s));
  const bIsJYTL = mingStarsB.some(s => jiYueTongLiang.includes(s));
  if (aIsSPL && bIsSPL) {
    out.push('- ⚠️ 双方命宫皆杀破狼：两虎相争结构，火花大但冲突多');
  } else if ((aIsSPL && bIsJYTL) || (bIsSPL && aIsJYTL)) {
    out.push('- 杀破狼 × 机月同梁：动静互补，一方开拓一方守成，需磨合节奏');
  }
  out.push('');

  // ── 缘分类型 ──
  out.push('## 八、缘分类型（四化引动）', '');
  const hitA = huaA.filter(h => {
    const p = findStarPalace(cb, h.star);
    return p?.name === '命宫' || p?.name === '夫妻';
  });
  const hitB = huaB.filter(h => {
    const p = findStarPalace(ca, h.star);
    return p?.name === '命宫' || p?.name === '夫妻';
  });
  const typeOf = (hits: { hua: string; star: string }[]) => {
    if (hits.some(h => h.hua === '忌')) return '化忌引动 —— 逆缘/冤家型，彼此牵挂但过程磨人';
    if (hits.some(h => h.hua === '禄')) return '化禄引动 —— 正缘型，感情顺遂有增益';
    if (hits.some(h => h.hua === '权')) return '化权引动 —— 主动争取型，有张力也有主导方';
    if (hits.some(h => h.hua === '科')) return '化科引动 —— 和谐型，互相尊重、相处体面';
    return '未直接引动对方命宫/夫妻宫';
  };
  out.push(`- 甲方四化 → 乙方命宫/夫妻宫：${hitA.length ? hitA.map(h => `化${h.hua}${h.star}`).join('、') : '无'}`);
  out.push(`  → ${typeOf(hitA)}`);
  out.push(`- 乙方四化 → 甲方命宫/夫妻宫：${hitB.length ? hitB.map(h => `化${h.hua}${h.star}`).join('、') : '无'}`);
  out.push(`  → ${typeOf(hitB)}`);
  out.push('');

  // ── 判定要素清单 ──
  const shaA = fuqiA ? shaCount([fuqiA]) : 0;
  const shaB = fuqiB ? shaCount([fuqiB]) : 0;
  const jiToSpouse =
    huaA.filter(h => h.hua === '忌').some(h => findStarPalace(cb, h.star)?.name === '夫妻') ||
    huaB.filter(h => h.hua === '忌').some(h => findStarPalace(ca, h.star)?.name === '夫妻');

  out.push('## 九、判定要素清单', '');
  out.push(`- ${aToB.length && bToA.length ? '✅' : '⬜'} 双方夫妻宫互映（天作之合结构）`);
  out.push(`- ${aToB.length || bToA.length ? '✅' : '⬜'} 单向夫妻宫对应命宫（次级良配结构）`);
  out.push(`- ${jiToSpouse ? '⚠️' : '⬜'} 化忌飞入对方夫妻宫`);
  out.push(`- ${shaA + shaB === 0 ? '✅' : '⬜'} 双方夫妻宫本宫无煞星（实际：甲 ${shaA} 颗 / 乙 ${shaB} 颗）`);
  out.push('');
  out.push('参考评级口径（引擎内置）：');
  for (const [level, desc] of Object.entries(HEMING_SCORE_CRITERIA)) {
    out.push(`- ${level}：${desc}`);
  }
  out.push('');

  console.log(out.join('\n'));
}

main();
