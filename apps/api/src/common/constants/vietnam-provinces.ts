export interface VietnamProvince {
  code: string;
  name: string;
}

/**
 * Danh mục đơn vị hành chính cấp tỉnh theo Quyết định 19/2025/QĐ-TTg.
 */
export const VIETNAM_PROVINCES: VietnamProvince[] = [
  { code: '01', name: 'Thành phố Hà Nội' },
  { code: '04', name: 'Tỉnh Cao Bằng' },
  { code: '08', name: 'Tỉnh Tuyên Quang' },
  { code: '11', name: 'Tỉnh Điện Biên' },
  { code: '12', name: 'Tỉnh Lai Châu' },
  { code: '14', name: 'Tỉnh Sơn La' },
  { code: '15', name: 'Tỉnh Lào Cai' },
  { code: '19', name: 'Tỉnh Thái Nguyên' },
  { code: '20', name: 'Tỉnh Lạng Sơn' },
  { code: '22', name: 'Tỉnh Quảng Ninh' },
  { code: '24', name: 'Tỉnh Bắc Ninh' },
  { code: '25', name: 'Tỉnh Phú Thọ' },
  { code: '31', name: 'Thành phố Hải Phòng' },
  { code: '33', name: 'Tỉnh Hưng Yên' },
  { code: '37', name: 'Tỉnh Ninh Bình' },
  { code: '38', name: 'Tỉnh Thanh Hóa' },
  { code: '40', name: 'Tỉnh Nghệ An' },
  { code: '42', name: 'Tỉnh Hà Tĩnh' },
  { code: '44', name: 'Tỉnh Quảng Trị' },
  { code: '46', name: 'Thành phố Huế' },
  { code: '48', name: 'Thành phố Đà Nẵng' },
  { code: '51', name: 'Tỉnh Quảng Ngãi' },
  { code: '52', name: 'Tỉnh Gia Lai' },
  { code: '56', name: 'Tỉnh Khánh Hòa' },
  { code: '66', name: 'Tỉnh Đắk Lắk' },
  { code: '68', name: 'Tỉnh Lâm Đồng' },
  { code: '75', name: 'Tỉnh Đồng Nai' },
  { code: '79', name: 'Thành phố Hồ Chí Minh' },
  { code: '80', name: 'Tỉnh Tây Ninh' },
  { code: '82', name: 'Tỉnh Đồng Tháp' },
  { code: '86', name: 'Tỉnh Vĩnh Long' },
  { code: '91', name: 'Tỉnh An Giang' },
  { code: '92', name: 'Thành phố Cần Thơ' },
  { code: '96', name: 'Tỉnh Cà Mau' },
];

export const VIETNAM_PROVINCE_CODES = VIETNAM_PROVINCES.map(
  (province) => province.code,
);

const PROVINCE_ALIASES: Array<{ code: string; aliases: string[] }> = [
  { code: '01', aliases: ['hà nội', 'ha noi'] },
  { code: '31', aliases: ['hải phòng', 'hai phong'] },
  { code: '46', aliases: ['thành phố huế', 'tp huế', 'tp. huế'] },
  { code: '48', aliases: ['đà nẵng', 'da nang'] },
  {
    code: '79',
    aliases: [
      'hồ chí minh',
      'ho chi minh',
      'tp hcm',
      'tp. hcm',
      'tphcm',
      'sài gòn',
      'sai gon',
    ],
  },
  { code: '92', aliases: ['cần thơ', 'can tho'] },
  ...VIETNAM_PROVINCES.filter(
    (province) => !['01', '31', '46', '48', '79', '92'].includes(province.code),
  ).map((province) => ({
    code: province.code,
    aliases: [province.name.replace(/^Tỉnh /, '').toLowerCase()],
  })),
];

/**
 * Nhận diện mã tỉnh/thành từ địa chỉ tự do khi dữ liệu nguồn có tên rõ ràng.
 * @param address Địa chỉ chi nhánh từ nguồn ngoài.
 * @returns Mã tỉnh/thành hoặc null nếu không thể xác định chắc chắn.
 */
export function inferProvinceCode(
  address: string | null | undefined,
): string | null {
  if (!address) return null;
  const normalizedAddress = address.toLocaleLowerCase('vi-VN');
  return (
    PROVINCE_ALIASES.find(({ aliases }) =>
      aliases.some((alias) => normalizedAddress.includes(alias)),
    )?.code ?? null
  );
}
