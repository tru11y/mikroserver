import {
  formatElapsedFromMinutes,
  normalizeIpBindingType,
  normalizeProfileName,
  parseRouterUptimeToSeconds,
  parseOptionalPositiveInteger,
} from './router-detail.utils';

describe('router detail utils', () => {
  it('normalizes profile names for stable comparisons', () => {
    expect(normalizeProfileName('  Profile_1  ')).toBe('profile_1');
    expect(normalizeProfileName(undefined)).toBe('');
  });

  it('normalizes ip binding types to the supported enum', () => {
    expect(normalizeIpBindingType('BLOCKED')).toBe('blocked');
    expect(normalizeIpBindingType(' bypassed ')).toBe('bypassed');
    expect(normalizeIpBindingType('unknown')).toBe('regular');
    expect(normalizeIpBindingType(null)).toBe('regular');
  });

  it('parses only strictly positive integer values', () => {
    expect(parseOptionalPositiveInteger('12')).toBe(12);
    expect(parseOptionalPositiveInteger(' 0 ')).toBeUndefined();
    expect(parseOptionalPositiveInteger('abc')).toBeUndefined();
    expect(parseOptionalPositiveInteger('')).toBeUndefined();
  });

  it('formats elapsed minutes for UI display', () => {
    expect(formatElapsedFromMinutes(null)).toBe('-');
    expect(formatElapsedFromMinutes(45)).toBe('45 min');
    expect(formatElapsedFromMinutes(135)).toBe('2h 15min');
    expect(formatElapsedFromMinutes(1500)).toBe('1j 1h');
  });

  it('parses RouterOS uptime strings into sortable seconds', () => {
    expect(parseRouterUptimeToSeconds('5h41m12s')).toBe(20472);
    expect(parseRouterUptimeToSeconds('00:10:07')).toBe(607);
    expect(parseRouterUptimeToSeconds('1d 00:17:08')).toBe(87428);
    expect(parseRouterUptimeToSeconds('')).toBe(0);
  });
});
