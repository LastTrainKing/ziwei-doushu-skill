/**
 * 出生信息 → 命盘的公共逻辑
 * chart.ts / heming.ts 共用，避免两套解析各自跑偏。
 */
import { generateChart, type LunarMonthPolicy } from './engine/algorithm';
import { PROVINCES } from './engine/cities';
import { SI_HUA_TABLE } from './engine/constants';
import { Lunar } from 'lunar-javascript';
import type { BirthInfo, Palace, DaXian, ZiweiChart } from './engine/types';

export const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
export const STEMS = '甲乙丙丁戊己庚辛壬癸';
export const LEAP_POLICIES: LunarMonthPolicy[] = ['split', 'next-month', 'prev-month', 'origin-month'];

const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

export class BirthError extends Error {}

export interface BirthSpec {
  date?: string;
  time?: string;
  branch?: string;
  city?: string;
  longitude?: string;
  gender?: string;
  name?: string;
  lunar?: boolean;
  leapMonth?: boolean;
  leap?: string;
}

export interface PlaceInfo {
  province: string;
  city: string;
  longitude: number;
}

export interface BirthMeta {
  place: PlaceInfo | null;
  longitude?: number;
  unknownTime: boolean;
  hour: number;
  gender: 'male' | 'female';
  solarNote: string;
  clockNote: string;
  lunarConverted: string;
  clockTime?: string;
}

export interface BirthResult {
  chart: ZiweiChart;
  birthInfo: BirthInfo;
  meta: BirthMeta;
}

export function lunarMonthName(month: number) {
  const n = Math.abs(month);
  return `${month < 0 ? '闰' : ''}${LUNAR_MONTHS[n - 1] ?? n}月`;
}

export function lunarDayName(day: number) {
  if (day === 10) return '初十';
  if (day === 20) return '二十';
  if (day === 30) return '三十';
  if (day < 10) return `初${DIGITS[day]}`;
  if (day < 20) return `十${DIGITS[day - 10]}`;
  return `廿${DIGITS[day - 20]}`;
}

/** 大限四化：引擎没算就按大限宫干现推 */
export function daXianMeta(chart: ZiweiChart, d: DaXian) {
  const stem =
    typeof d.stemIndex === 'number'
      ? d.stemIndex
      : chart.palaces.find(p => p.branch === d.palaceBranch)?.stem;
  const stemName = d.stemName ?? (typeof stem === 'number' ? STEMS[stem] : '');
  const table = typeof stem === 'number' ? SI_HUA_TABLE[stem] : undefined;
  const siHua = d.siHua ?? (table ? { lu: table[0], quan: table[1], ke: table[2], ji: table[3] } : null);
  return { stemName, siHua };
}

function normalizePlace(name: string) {
  return name.replace(/[省市自治区特别行政区]/g, '').trim();
}

export function findCity(query: string): PlaceInfo | null {
  const q = normalizePlace(query);
  if (!q) return null;

  for (const province of PROVINCES) {
    for (const city of province.cities) {
      if (normalizePlace(city.name) === q) {
        return { province: province.name, city: city.name, longitude: city.longitude };
      }
    }
  }
  for (const province of PROVINCES) {
    for (const city of province.cities) {
      const n = normalizePlace(city.name);
      if (n.includes(q) || q.includes(n)) {
        return { province: province.name, city: city.name, longitude: city.longitude };
      }
    }
  }
  for (const province of PROVINCES) {
    const n = normalizePlace(province.name);
    if (n === q || n.includes(q) || q.includes(n)) {
      const city = province.cities[0];
      if (city) return { province: province.name, city: city.name, longitude: city.longitude };
    }
  }
  return null;
}

/** 与网页端 BirthForm 一致的简化真太阳时换算（只做经度修正） */
export function trueSolarBranch(clockHour: number, clockMinute: number, longitude: number) {
  const clockMinutes = clockHour * 60 + clockMinute;
  const offsetMinutes = (longitude - 120) * 4;
  const solar = (((clockMinutes + offsetMinutes) % 1440) + 1440) % 1440;
  const branch = solar >= 1380 || solar < 60 ? 0 : Math.floor((solar - 60) / 120) + 1;
  const hh = Math.floor(solar / 60);
  const mm = Math.round(solar % 60);
  return { offsetMinutes, branch, solarLabel: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
}

export function parseBranch(input: string): number | null {
  const idx = BRANCHES.indexOf(input);
  if (idx >= 0) return idx;
  const num = Number(input);
  if (Number.isInteger(num) && num >= 0 && num <= 11) return num;
  return null;
}

export function resolveBirth(spec: BirthSpec): BirthResult {
  if (!spec.date) throw new BirthError('缺少出生日期');
  const dateMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(spec.date);
  if (!dateMatch) throw new BirthError(`日期格式不对：${spec.date}，应为 YYYY-MM-DD`);

  let [year, month, day] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])];

  let lunarConverted = '';
  if (spec.lunar) {
    try {
      const lunarMonthInput = spec.leapMonth ? -month : month;
      const solar = Lunar.fromYmd(year, lunarMonthInput, day).getSolar();
      lunarConverted = `农历 ${year} 年 ${spec.leapMonth ? '闰' : ''}${month} 月 ${day} 日 → 公历 ${solar.getYear()}-${solar.getMonth()}-${solar.getDay()}`;
      year = solar.getYear();
      month = solar.getMonth();
      day = solar.getDay();
    } catch {
      throw new BirthError(`农历日期不存在：${year} 年${spec.leapMonth ? '闰' : ''}${month} 月 ${day} 日`);
    }
  }

  const genderInput = (spec.gender ?? 'male').toLowerCase();
  const gender: 'male' | 'female' =
    genderInput === 'female' || genderInput === '女' || genderInput === 'f' ? 'female' : 'male';

  const place = spec.city ? findCity(spec.city) : null;
  if (spec.city && !place) {
    throw new BirthError(`找不到城市「${spec.city}」，可改用 --longitude 指定经度`);
  }
  const longitude = spec.longitude ? Number(spec.longitude) : place?.longitude;

  const unknownTime = !spec.time && !spec.branch;
  let hour = 0;
  let solarNote = '';
  let clockNote = '';

  if (spec.branch) {
    const branch = parseBranch(spec.branch);
    if (branch === null) throw new BirthError(`时辰「${spec.branch}」无法识别，用 0-11 或 子丑寅卯…`);
    hour = branch;
  } else if (spec.time) {
    const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(spec.time);
    if (!timeMatch) throw new BirthError(`时间格式不对：${spec.time}，应为 HH:MM`);
    const clockHour = Number(timeMatch[1]);
    const clockMinute = Number(timeMatch[2]);
    if (clockHour > 23 || clockMinute > 59) throw new BirthError(`时间超出范围：${spec.time}`);

    if (clockHour === 23) {
      const next = new Date(Date.UTC(year, month - 1, day + 1));
      year = next.getUTCFullYear();
      month = next.getUTCMonth() + 1;
      day = next.getUTCDate();
      clockNote = '（23 点属晚子时，已按次日排盘）';
    }

    if (typeof longitude === 'number') {
      const solar = trueSolarBranch(clockHour, clockMinute, longitude);
      hour = solar.branch;
      solarNote = `真太阳时约 ${solar.solarLabel}，经度修正 ${solar.offsetMinutes >= 0 ? '+' : ''}${solar.offsetMinutes.toFixed(0)} 分钟`;
    } else {
      hour = clockHour === 23 ? 0 : Math.floor((clockHour + 1) / 2) % 12;
      solarNote = '未提供出生地，未做真太阳时校正';
    }
  }

  const leap = (spec.leap ?? 'split') as LunarMonthPolicy;
  if (!LEAP_POLICIES.includes(leap)) {
    throw new BirthError(`闰月口径「${leap}」不支持，可选：${LEAP_POLICIES.join(' / ')}`);
  }

  const birthInfo: BirthInfo = {
    year,
    month,
    day,
    hour,
    gender,
    name: spec.name,
    province: place?.province,
    city: place?.city,
    longitude,
  };

  let chart: ZiweiChart;
  try {
    chart = generateChart(birthInfo, { leapMonth: leap });
  } catch (err) {
    throw new BirthError(`排盘失败：${(err as Error).message}`);
  }

  return {
    chart,
    birthInfo,
    meta: {
      place,
      longitude,
      unknownTime,
      hour,
      gender,
      solarNote,
      clockNote,
      lunarConverted,
      clockTime: spec.time,
    },
  };
}

/** 本宫 + 对宫 + 两个三合宫 */
export function sanFangSiZheng(palaces: Palace[], branch: number): Palace[] {
  const wanted = [branch, (branch + 6) % 12, (branch + 4) % 12, (branch + 8) % 12];
  return wanted
    .map(b => palaces.find(p => p.branch === b))
    .filter((p): p is Palace => Boolean(p));
}

export function palaceByBranch(palaces: Palace[], branch: number): Palace | undefined {
  return palaces.find(p => p.branch === branch);
}

export function palaceByBranchOrName(chart: ZiweiChart, name: string): Palace | undefined {
  return chart.palaces.find(p => p.name === name);
}
