import { inferProvinceCode, VIETNAM_PROVINCE_CODES } from './vietnam-provinces';

describe('Vietnam provinces', () => {
  it('contains unique two-digit province codes', () => {
    expect(new Set(VIETNAM_PROVINCE_CODES).size).toBe(
      VIETNAM_PROVINCE_CODES.length,
    );
    expect(VIETNAM_PROVINCE_CODES.every((code) => /^\d{2}$/.test(code))).toBe(
      true,
    );
  });

  it('recognizes common Ho Chi Minh City address aliases', () => {
    expect(inferProvinceCode('123 Lê Lợi, Quận 1, TP. HCM')).toBe('79');
    expect(inferProvinceCode('Cửa hàng trung tâm Sài Gòn')).toBe('79');
  });

  it('returns null when an address has no reliable province name', () => {
    expect(inferProvinceCode('12 Nguyễn Huệ, Quận 1')).toBeNull();
  });
});
