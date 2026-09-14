"use client";

import React from "react";
import { Tag, X, Filter, ChevronDown, MapPin } from "lucide-react";

interface CategoryFilterOption {
  code: string;
  name: string;
  campaignCount: number;
  children?: CategoryFilterOption[];
}

interface ProvinceFilterOption {
  code: string;
  name: string;
  campaignCount: number;
}

interface PartnerFilterOption {
  partnerId: string;
  companyName: string;
}

export type CatalogValidityStatus = "ALL" | "AVAILABLE" | "UPCOMING";

export interface FilterSidebarProps {
  category: string;
  categories: CategoryFilterOption[];
  totalCampaigns: number;
  onCategoryChange: (value: string) => void;
  province: string;
  provinces: ProvinceFilterOption[];
  onProvinceChange: (value: string) => void;
  partnerId: string;
  partners: PartnerFilterOption[];
  onPartnerChange: (value: string) => void;
  validityStatus: CatalogValidityStatus;
  onValidityChange: (value: CatalogValidityStatus) => void;
  minDiscount: string;
  onMinDiscountChange: (value: string) => void;
  maxPrice: string;
  setMaxPrice: (val: string) => void;
  onFilter: () => void;
  onClear: () => void;
  onQuickPrice?: (val: string) => void;
}

export default function FilterSidebar({
  category,
  categories,
  totalCampaigns,
  onCategoryChange,
  province,
  provinces,
  onProvinceChange,
  partnerId,
  partners,
  onPartnerChange,
  validityStatus,
  onValidityChange,
  minDiscount,
  onMinDiscountChange,
  maxPrice,
  setMaxPrice,
  onFilter,
  onClear,
  onQuickPrice,
}: FilterSidebarProps) {
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    if (!rawValue) {
      setMaxPrice("");
      return;
    }
    setMaxPrice(Number(rawValue).toLocaleString("vi-VN"));
  };

  const quickPrices = [
    { label: "< 100K", value: "100.000" },
    { label: "< 200K", value: "200.000" },
    { label: "< 500K", value: "500.000" },
  ];

  const [expandedCategories, setExpandedCategories] = React.useState<
    Record<string, boolean>
  >({});
  const [isPartnerOpen, setIsPartnerOpen] = React.useState(false);
  const [isStatusOpen, setIsStatusOpen] = React.useState(false);

  const toggleCategory = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategories((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const renderCategoryButton = (
    option: CategoryFilterOption,
    nested = false,
    hasChildren = false,
  ) => {
    const isActive = category === option.code;
    const isExpanded = expandedCategories[option.code];
    const isDisabled =
      option.code !== "" && option.campaignCount === 0 && !isActive;

    return (
      <button
        key={option.code || "all"}
        type="button"
        disabled={isDisabled}
        onClick={() => onCategoryChange(option.code)}
        className={`flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-xl text-left transition-all group ${
          nested ? "pl-8" : ""
        } ${
          isActive
            ? "bg-primary text-white shadow-md"
            : isDisabled
              ? "cursor-not-allowed text-slate-300"
              : nested
                ? "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
        }`}
      >
        <span className="flex items-center gap-2">
          {!nested && option.code !== "" && (
            <span
              onClick={(e) => {
                if (hasChildren) toggleCategory(option.code, e);
              }}
              className={`p-1 rounded-md transition-colors ${
                hasChildren
                  ? isActive
                    ? "hover:bg-white/20 cursor-pointer"
                    : "hover:bg-slate-200 cursor-pointer"
                  : "opacity-30"
              }`}
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${isExpanded && hasChildren ? "" : "-rotate-90"}`}
              />
            </span>
          )}
          <span className={!nested && option.code === "" ? "pl-5" : ""}>
            {option.name}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className={isActive ? "text-white/80" : "text-slate-400"}>
            {option.campaignCount}
          </span>
          {isActive && <Tag className="h-3.5 w-3.5 text-white/90" />}
        </span>
      </button>
    );
  };

  return (
    <aside className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Filter className="h-5 w-5 text-primary" />
        <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-tight">
          Bộ lọc tìm kiếm
        </h2>
      </div>

      {/* Đối tác */}
      <div className="space-y-3">
        <label
          htmlFor="partner-filter"
          className="block text-xs font-bold text-slate-700"
        >
          Đối tác cung cấp
        </label>
        <div className="relative">
          <button
            onClick={() => setIsPartnerOpen(!isPartnerOpen)}
            className="w-full flex items-center justify-between appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-primary/50 focus:bg-white"
          >
            <span className="truncate">
              {partnerId === ""
                ? "Tất cả đối tác"
                : partners.find((p) => p.partnerId === partnerId)
                    ?.companyName || "Tất cả đối tác"}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
          </button>

          {isPartnerOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded shadow-md max-h-[160px] overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent text-sm">
              <button
                onClick={() => {
                  onPartnerChange("");
                  setIsPartnerOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 transition-none ${
                  partnerId === ""
                    ? "bg-slate-500 text-white"
                    : "bg-white text-slate-800 hover:bg-slate-500 hover:text-white"
                }`}
              >
                Tất cả đối tác
              </button>
              {partners.map((option) => (
                <button
                  key={option.partnerId}
                  onClick={() => {
                    onPartnerChange(option.partnerId);
                    setIsPartnerOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 transition-none truncate ${
                    partnerId === option.partnerId
                      ? "bg-slate-500 text-white"
                      : "bg-white text-slate-800 hover:bg-slate-500 hover:text-white"
                  }`}
                >
                  {option.companyName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trạng thái hiệu lực */}
      <div className="space-y-3">
        <label
          htmlFor="status-filter"
          className="block text-xs font-bold text-slate-700"
        >
          Trạng thái hiệu lực
        </label>
        <div className="relative">
          <button
            onClick={() => setIsStatusOpen(!isStatusOpen)}
            className="w-full flex items-center justify-between appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-primary/50 focus:bg-white"
          >
            <span className="truncate">
              {validityStatus === "AVAILABLE"
                ? "Đang mở bán"
                : validityStatus === "UPCOMING"
                  ? "Sắp mở bán"
                  : "Tất cả trạng thái"}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
          </button>

          {isStatusOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded shadow-md max-h-[160px] overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent text-sm">
              <button
                onClick={() => {
                  onValidityChange("ALL");
                  setIsStatusOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 transition-none ${
                  validityStatus === "ALL"
                    ? "bg-slate-500 text-white"
                    : "bg-white text-slate-800 hover:bg-slate-500 hover:text-white"
                }`}
              >
                Tất cả trạng thái
              </button>
              <button
                onClick={() => {
                  onValidityChange("AVAILABLE");
                  setIsStatusOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 transition-none ${
                  validityStatus === "AVAILABLE"
                    ? "bg-slate-500 text-white"
                    : "bg-white text-slate-800 hover:bg-slate-500 hover:text-white"
                }`}
              >
                Đang mở bán
              </button>
              <button
                onClick={() => {
                  onValidityChange("UPCOMING");
                  setIsStatusOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 transition-none ${
                  validityStatus === "UPCOMING"
                    ? "bg-slate-500 text-white"
                    : "bg-white text-slate-800 hover:bg-slate-500 hover:text-white"
                }`}
              >
                Sắp mở bán
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mức giảm giá */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-700">
          Mức giảm giá tối thiểu
        </label>
        <div className="flex gap-2 flex-wrap">
          {[10, 20, 30, 50].map((disc) => (
            <button
              key={disc}
              onClick={() => {
                onMinDiscountChange(disc.toString());
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                minDiscount === disc.toString()
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary"
              }`}
            >
              &ge; {disc}%
            </button>
          ))}
          {minDiscount && (
            <button
              onClick={() => {
                onMinDiscountChange("");
              }}
              className="px-2 py-1 text-[10px] text-slate-400 hover:text-slate-600 underline"
            >
              Bỏ chọn
            </button>
          )}
        </div>
      </div>

      {/* Khu vực */}
      <div className="space-y-3">
        <label
          htmlFor="province-filter"
          className="block text-xs font-bold text-slate-700"
        >
          Khu vực
        </label>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            id="province-filter"
            value={province}
            onChange={(event) => onProvinceChange(event.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-primary/50 focus:bg-white"
          >
            <option value="">Tất cả khu vực</option>
            {provinces.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name} ({option.campaignCount})
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* Khoảng giá */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-700">
          Khoảng giá
        </label>

        <div className="grid grid-cols-3 gap-2">
          {quickPrices.map((qp) => (
            <button
              key={qp.value}
              onClick={() => {
                setMaxPrice(qp.value);
                if (onQuickPrice) onQuickPrice(qp.value);
              }}
              className={`text-center px-1 py-1.5 text-[11px] font-bold rounded-lg border transition-all truncate ${
                maxPrice === qp.value
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-primary hover:text-primary"
              }`}
            >
              {qp.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={maxPrice}
            onChange={handlePriceChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") onFilter();
            }}
            placeholder="Tối đa (đ)"
            className="w-full bg-slate-50 border border-slate-200 focus:border-primary/50 focus:bg-white rounded-xl px-3 py-2 text-sm outline-none transition-all"
          />
        </div>
        <button
          onClick={onFilter}
          className="w-full py-2 bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-bold rounded-xl transition-all border border-transparent"
        >
          Áp dụng
        </button>
      </div>

      {/* Danh mục */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-slate-700">
          Danh mục
        </label>
        <div className="flex flex-col gap-1.5">
          {renderCategoryButton({
            code: "",
            name: "Tất cả",
            campaignCount: totalCampaigns,
          })}
          {categories.map((parent) => (
            <div key={parent.code} className="space-y-1">
              {renderCategoryButton(
                parent,
                false,
                (parent.children?.length ?? 0) > 0,
              )}
              {expandedCategories[parent.code] &&
                parent.children?.map((child) =>
                  renderCategoryButton(child, true),
                )}
            </div>
          ))}
        </div>
      </div>

      {/* Xóa lọc */}
      <div className="pt-2 border-t border-slate-100">
        <button
          onClick={onClear}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-white border-2 border-slate-100 hover:border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all"
        >
          <X className="h-4 w-4" />
          Xóa tất cả
        </button>
      </div>
    </aside>
  );
}
