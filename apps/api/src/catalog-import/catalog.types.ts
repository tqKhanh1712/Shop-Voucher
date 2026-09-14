export const GIFTPOP_SOURCE = 'giftpop.vn';

export const DEFAULT_GIFTPOP_PRODUCT_URLS = [
  'https://www.giftpop.vn/category/view/CB2604160001',
  'https://www.giftpop.vn/category/view/MP2601260005',
  'https://www.giftpop.vn/category/view/MP2601260006',
  'https://www.giftpop.vn/category/view/MP2601260007',
  'https://www.giftpop.vn/category/view/MP2607290002',
] as const;

export const PARENT_CATEGORIES = [
  { code: 'FOOD_DRINK', nameVi: 'Ẩm thực & Đồ uống', displayOrder: 10 },
  { code: 'SHOPPING_RETAIL', nameVi: 'Mua sắm & Bán lẻ', displayOrder: 20 },
  { code: 'BEAUTY_HEALTH', nameVi: 'Làm đẹp & Sức khỏe', displayOrder: 30 },
  { code: 'DIGITAL_TELECOM', nameVi: 'Kỹ thuật số & Viễn thông', displayOrder: 40 },
  { code: 'ENTERTAINMENT', nameVi: 'Giải trí', displayOrder: 50 },
  { code: 'LIFESTYLE_SERVICES', nameVi: 'Phong cách sống & Dịch vụ', displayOrder: 60 },
  { code: 'TRANSPORT', nameVi: 'Di chuyển', displayOrder: 70 },
  { code: 'OTHER', nameVi: 'Khác', displayOrder: 80 },
] as const;

export const GIFTPOP_CATEGORIES: Record<
  string,
  { nameVi: string; parentCode: (typeof PARENT_CATEGORIES)[number]['code']; displayOrder: number }
> = {
  A101: { nameVi: 'Cà phê - Trà', parentCode: 'FOOD_DRINK', displayOrder: 101 },
  A102: { nameVi: 'Nhà hàng', parentCode: 'FOOD_DRINK', displayOrder: 102 },
  A103: { nameVi: 'Bánh ngọt', parentCode: 'FOOD_DRINK', displayOrder: 103 },
  A104: { nameVi: 'Tiệc buffet', parentCode: 'FOOD_DRINK', displayOrder: 104 },
  A105: { nameVi: 'Nhóm nhà hàng', parentCode: 'FOOD_DRINK', displayOrder: 105 },
  A106: { nameVi: 'Gà rán & Thức ăn nhanh', parentCode: 'FOOD_DRINK', displayOrder: 106 },
  A107: { nameVi: 'Pizza', parentCode: 'FOOD_DRINK', displayOrder: 107 },
  A108: { nameVi: 'Thời trang', parentCode: 'SHOPPING_RETAIL', displayOrder: 108 },
  A109: { nameVi: 'Mỹ phẩm', parentCode: 'BEAUTY_HEALTH', displayOrder: 109 },
  A110: { nameVi: 'Tiệm làm tóc & Spa', parentCode: 'BEAUTY_HEALTH', displayOrder: 110 },
  A111: { nameVi: 'Trang sức', parentCode: 'SHOPPING_RETAIL', displayOrder: 111 },
  A112: { nameVi: 'Sức khỏe & Nha khoa', parentCode: 'BEAUTY_HEALTH', displayOrder: 112 },
  A113: { nameVi: 'Thẻ điện thoại', parentCode: 'DIGITAL_TELECOM', displayOrder: 113 },
  A114: { nameVi: 'Thẻ game', parentCode: 'DIGITAL_TELECOM', displayOrder: 114 },
  A115: { nameVi: 'Rạp chiếu phim', parentCode: 'ENTERTAINMENT', displayOrder: 115 },
  A116: { nameVi: 'Vui chơi & Giải trí', parentCode: 'ENTERTAINMENT', displayOrder: 116 },
  A117: { nameVi: 'Siêu thị & Cửa hàng tiện lợi', parentCode: 'SHOPPING_RETAIL', displayOrder: 117 },
  A118: { nameVi: 'Mẹ và Bé', parentCode: 'SHOPPING_RETAIL', displayOrder: 118 },
  A119: { nameVi: 'Voucher Book', parentCode: 'LIFESTYLE_SERVICES', displayOrder: 119 },
  A120: { nameVi: 'Phong cách sống', parentCode: 'LIFESTYLE_SERVICES', displayOrder: 120 },
  A122: { nameVi: 'Vận chuyển', parentCode: 'TRANSPORT', displayOrder: 122 },
};

export interface RawGiftpopProduct {
  externalSource: string;
  externalId: string;
  sourceUrl: string;
  crawledAt: string;
  title: string;
  description: string;
  termsAndConditions: string;
  originalPrice: number;
  salePrice: number;
  currency: 'VND';
  thumbnailUrl: string;
  usageValidityDays: number | null;
  brandExternalIds: string[];
  categoryExternalIds: string[];
  branchExternalIds: string[];
}

export interface RawGiftpopBrand {
  externalSource: string;
  externalId: string;
  displayName: string;
  logoUrl: string;
  sourceUrl: string;
  crawledAt: string;
}

export interface RawGiftpopBranch {
  externalSource: string;
  externalId: string;
  brandExternalId: string;
  name: string;
  address: string;
  sourceUrl: string;
  crawledAt: string;
}

export interface ParsedGiftpopPage {
  product: Omit<RawGiftpopProduct, 'branchExternalIds'>;
  brands: RawGiftpopBrand[];
  branchCandidates: RawGiftpopBranch[];
}

export type CsvRow = Record<string, string>;

export interface NormalizedDataset {
  campaigns: CsvRow[];
  brands: CsvRow[];
  categories: CsvRow[];
  branches: CsvRow[];
  campaignBrands: CsvRow[];
  campaignCategories: CsvRow[];
  campaignBranches: CsvRow[];
}

export interface ValidationIssue {
  externalId: string;
  errorCode: string;
  errorMessage: string;
}

export interface ValidationResult {
  dataset: NormalizedDataset;
  issues: ValidationIssue[];
}

export interface ImportReport {
  mode: 'dry-run' | 'apply';
  source: string;
  campaigns: {
    inserted: number;
    updated: number;
    unchanged: number;
    rejected: number;
  };
  brands: number;
  categories: number;
  branches: number;
  orphanBranchesRemoved: number;
  completedAt: string;
}
