/**
 * 支持的国家/地区区号清单（见 proposal.md「What Changes」、design.md Decisions 第 4 条）。
 *
 * 清单以外的区号需要作为独立 OpenSpec Change 评估国际短信可行性与号码格式规则，
 * 不得在本能力内自行扩充（见 proposal.md「Out of Scope」）。
 *
 * ⚠️ 下方正则是工程近似值（design.md Risks 第 1 条），已标记为需要后续审核的 Open Question，
 * 上线前需与真实号码样本及腾讯云国际短信实际支持的号码格式核对。
 */
export interface SupportedRegion {
  countryCode: string;
  label: string;
  phoneRegex: RegExp;
}

export const SUPPORTED_REGIONS: readonly SupportedRegion[] = [
  { countryCode: '+86', label: '中国大陆', phoneRegex: /^1[3-9]\d{9}$/ },
  { countryCode: '+852', label: '中国香港', phoneRegex: /^[4-9]\d{7}$/ },
  { countryCode: '+853', label: '中国澳门', phoneRegex: /^6\d{7}$/ },
  { countryCode: '+886', label: '中国台湾', phoneRegex: /^9\d{8}$/ },
  { countryCode: '+1', label: '美国/加拿大', phoneRegex: /^[2-9]\d{9}$/ },
  { countryCode: '+65', label: '新加坡', phoneRegex: /^[3689]\d{7}$/ },
  { countryCode: '+61', label: '澳大利亚', phoneRegex: /^4\d{8}$/ },
  { countryCode: '+44', label: '英国', phoneRegex: /^7\d{9}$/ },
  { countryCode: '+81', label: '日本', phoneRegex: /^[7-9]0\d{8}$/ },
  { countryCode: '+82', label: '韩国', phoneRegex: /^10\d{7,8}$/ },
] as const;

export const DEFAULT_COUNTRY_CODE = '+86';

export function findSupportedRegion(countryCode: string): SupportedRegion | undefined {
  return SUPPORTED_REGIONS.find((region) => region.countryCode === countryCode);
}

export function isValidPhoneNumber(countryCode: string, phoneNumber: string): boolean {
  const region = findSupportedRegion(countryCode);
  if (!region) {
    return false;
  }
  return region.phoneRegex.test(phoneNumber);
}

/** 微信返回的区号是不带 "+" 的纯数字字符串（如 "86"），统一补齐为本项目格式（如 "+86"）。 */
export function normalizeCountryCode(rawCountryCode: string): string {
  return rawCountryCode.startsWith('+') ? rawCountryCode : `+${rawCountryCode}`;
}
