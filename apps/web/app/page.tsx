"use client";

import React, {
  Suspense,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { apiRequest } from "../lib/api";
import { getErrorMessage } from "../lib/errors";
import Header from "../components/Header";
import FilterSidebar, {
  type CatalogValidityStatus,
} from "../components/FilterSidebar";
import VoucherCard, {
  type VoucherCampaignCard,
} from "../components/VoucherCard";
import {
  ArrowRight,
  ShieldAlert,
  Ticket,
  Grid,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useDebouncedValue } from "../hooks/use-debounced-value";

interface CatalogCategory {
  code: string;
  name: string;
  campaignCount: number;
  children: Array<{
    code: string;
    name: string;
    campaignCount: number;
  }>;
}

interface CatalogFilters {
  keyword: string;
  categoryCode: string;
  provinceCode: string;
  maxPrice: string;
  sortPrice?: "asc" | "desc" | "";
  sortDiscount?: "asc" | "desc" | "";
  partnerId?: string;
  validityStatus?: CatalogValidityStatus;
  minDiscount?: string;
  page?: number;
  limit?: number;
}

interface PartnerFilterOption {
  partnerId: string;
  companyName: string;
}

interface CatalogResponse {
  data: VoucherCampaignCard[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  facets: {
    totalCampaignCount: number;
    categories: CatalogCategory[];
  };
}

interface CatalogProvince {
  code: string;
  name: string;
  campaignCount: number;
}

function buildCatalogUrl(filters: CatalogFilters) {
  const params = new URLSearchParams();
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.categoryCode) params.set("categoryCode", filters.categoryCode);
  if (filters.provinceCode) params.set("provinceCode", filters.provinceCode);

  if (filters.maxPrice) {
    const rawMaxPrice = filters.maxPrice.replace(/\D/g, "");
    if (rawMaxPrice) params.set("maxPrice", rawMaxPrice);
  }

  if (filters.sortPrice) params.set("sortPrice", filters.sortPrice);
  if (filters.sortDiscount) params.set("sortDiscount", filters.sortDiscount);
  if (filters.partnerId) params.set("partnerId", filters.partnerId);
  if (filters.validityStatus)
    params.set("validityStatus", filters.validityStatus);
  if (filters.minDiscount) params.set("minDiscount", filters.minDiscount);

  params.set("page", (filters.page || 1).toString());
  params.set("limit", (filters.limit || 12).toString());

  const queryString = params.toString();
  return `/vouchers${queryString ? `?${queryString}` : ""}`;
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [initialFilters] = useState<CatalogFilters>(() => {
    const rawMaxPrice = searchParams.get("maxPrice");
    const requestedValidityStatus = searchParams.get("validityStatus");
    const validityStatus: CatalogValidityStatus =
      requestedValidityStatus === "ALL" ||
      requestedValidityStatus === "UPCOMING"
        ? requestedValidityStatus
        : "AVAILABLE";
    return {
      keyword: searchParams.get("keyword") || "",
      categoryCode: searchParams.get("category") || "",
      provinceCode: searchParams.get("province") || "",
      maxPrice: rawMaxPrice ? Number(rawMaxPrice).toLocaleString("vi-VN") : "",
      sortPrice: (searchParams.get("sortPrice") as "asc" | "desc" | "") || "",
      sortDiscount:
        (searchParams.get("sortDiscount") as "asc" | "desc" | "") || "",
      partnerId: searchParams.get("partnerId") || "",
      validityStatus,
      minDiscount: searchParams.get("minDiscount") || "",
      page: Number(searchParams.get("page")) || 1,
      limit: Number(searchParams.get("limit")) || 12,
    };
  });

  const [campaigns, setCampaigns] = useState<VoucherCampaignCard[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [provinces, setProvinces] = useState<CatalogProvince[]>([]);
  const [partners, setPartners] = useState<PartnerFilterOption[]>([]);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [paginationMeta, setPaginationMeta] = useState<
    CatalogResponse["meta"] | null
  >(null);
  const [loading, setLoading] = useState(true);

  // States for filtering
  const [keyword, setKeyword] = useState(initialFilters.keyword);
  const [category, setCategory] = useState(initialFilters.categoryCode);
  const [province, setProvince] = useState(initialFilters.provinceCode);
  const [maxPrice, setMaxPrice] = useState(initialFilters.maxPrice);
  const [sortPrice, setSortPrice] = useState<"asc" | "desc" | "">(
    initialFilters.sortPrice || "",
  );
  const [sortDiscount, setSortDiscount] = useState<"asc" | "desc" | "">(
    initialFilters.sortDiscount || "",
  );
  const [partnerId, setPartnerId] = useState(initialFilters.partnerId || "");
  const [validityStatus, setValidityStatus] = useState<CatalogValidityStatus>(
    initialFilters.validityStatus || "AVAILABLE",
  );
  const [minDiscount, setMinDiscount] = useState(
    initialFilters.minDiscount || "",
  );
  const [page, setPage] = useState(initialFilters.page || 1);
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const lastExecutedKeywordRef = useRef(initialFilters.keyword.trim());
  const [appliedKeyword, setAppliedKeyword] = useState(
    initialFilters.keyword.trim(),
  );
  const limit = 12; // Cố định limit mỗi trang
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const catalogRequestRef = useRef<AbortController | null>(null);

  const fetchCatalog = useCallback(async (filters: CatalogFilters) => {
    catalogRequestRef.current?.abort();
    const controller = new AbortController();
    catalogRequestRef.current = controller;
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await apiRequest<CatalogResponse>(
        buildCatalogUrl(filters),
        {
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted) return;
      setCampaigns(result.data);
      setPaginationMeta(result.meta);
      setCategories(result.facets.categories);
      setTotalCampaigns(result.facets.totalCampaignCount);
      setAppliedKeyword(filters.keyword.trim().replace(/\s+/g, " "));
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setErrorMsg(getErrorMessage(error, "Không thể tải danh sách voucher."));
    } finally {
      if (catalogRequestRef.current === controller) {
        catalogRequestRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) void fetchCatalog(initialFilters);
    });

    async function loadFilterOptions() {
      try {
        const [provinceData, partnerData] = await Promise.all([
          apiRequest<CatalogProvince[]>("/vouchers/provinces"),
          apiRequest<PartnerFilterOption[]>("/vouchers/partners"),
        ]);
        setProvinces(provinceData);
        setPartners(partnerData);
      } catch (error: unknown) {
        setErrorMsg(getErrorMessage(error, "Không thể tải bộ lọc voucher."));
      }
    }

    void loadFilterOptions();
    return () => {
      disposed = true;
      catalogRequestRef.current?.abort();
    };
  }, [fetchCatalog, initialFilters]);

  const updateBrowserFilters = useCallback(
    (filters: CatalogFilters, replace = false) => {
      const params = new URLSearchParams();
      if (filters.keyword) params.set("keyword", filters.keyword);
      if (filters.categoryCode) params.set("category", filters.categoryCode);
      if (filters.provinceCode) params.set("province", filters.provinceCode);

      if (filters.maxPrice) {
        const rawMaxPrice = filters.maxPrice.replace(/\D/g, "");
        if (rawMaxPrice) params.set("maxPrice", rawMaxPrice);
      }

      if (filters.sortPrice) params.set("sortPrice", filters.sortPrice);
      if (filters.sortDiscount)
        params.set("sortDiscount", filters.sortDiscount);
      if (filters.partnerId) params.set("partnerId", filters.partnerId);
      if (filters.validityStatus)
        params.set("validityStatus", filters.validityStatus);
      if (filters.minDiscount) params.set("minDiscount", filters.minDiscount);
      params.set("page", (filters.page || 1).toString());

      const destination = params.size > 0 ? `/?${params.toString()}` : "/";
      if (replace) {
        router.replace(destination, { scroll: false });
      } else {
        router.push(destination, { scroll: false });
      }
    },
    [router],
  );

  const currentFilters = useCallback(
    (): CatalogFilters => ({
      keyword: appliedKeyword,
      categoryCode: category,
      provinceCode: province,
      maxPrice,
      sortPrice,
      sortDiscount,
      partnerId,
      validityStatus,
      minDiscount,
      page,
      limit,
    }),
    [
      category,
      appliedKeyword,
      maxPrice,
      minDiscount,
      page,
      partnerId,
      province,
      sortDiscount,
      sortPrice,
      validityStatus,
    ],
  );

  useEffect(() => {
    const normalizedKeyword = debouncedKeyword.trim().replace(/\s+/g, " ");
    if (
      normalizedKeyword === lastExecutedKeywordRef.current ||
      normalizedKeyword.length === 1
    ) {
      return;
    }

    lastExecutedKeywordRef.current = normalizedKeyword;
    const filters = {
      ...currentFilters(),
      keyword: normalizedKeyword,
      page: 1,
    };
    queueMicrotask(() => {
      setPage(1);
      updateBrowserFilters(filters, true);
      void fetchCatalog(filters);
    });
  }, [currentFilters, debouncedKeyword, fetchCatalog, updateBrowserFilters]);

  const scrollToProducts = () => {
    document
      .getElementById("product-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleHeaderSearch = (newKeyword: string) => {
    const normalizedKeyword = newKeyword.trim().replace(/\s+/g, " ");
    lastExecutedKeywordRef.current = normalizedKeyword;
    setKeyword(newKeyword);
    setPage(1);
    const filters = {
      ...currentFilters(),
      keyword: normalizedKeyword,
      page: 1,
    };
    updateBrowserFilters(filters);
    void fetchCatalog(filters);
    setTimeout(scrollToProducts, 50);
  };

  const handleKeywordChange = (value: string) => {
    setKeyword(value);
    if (value.trim() || lastExecutedKeywordRef.current === "") return;

    lastExecutedKeywordRef.current = "";
    setPage(1);
    const filters = { ...currentFilters(), keyword: "", page: 1 };
    updateBrowserFilters(filters, true);
    void fetchCatalog(filters);
  };

  const handleSidebarFilter = () => {
    setPage(1);
    const filters = { ...currentFilters(), page: 1 };
    updateBrowserFilters(filters);
    void fetchCatalog(filters);
    scrollToProducts();
  };

  const handleCategoryChange = (categoryCode: string) => {
    setCategory(categoryCode);
    setPage(1);
    const filters = { ...currentFilters(), categoryCode, page: 1 };
    updateBrowserFilters(filters);
    void fetchCatalog(filters);
    setTimeout(scrollToProducts, 50);
  };

  const handleProvinceChange = (provinceCode: string) => {
    setProvince(provinceCode);
    setPage(1);
    const filters = { ...currentFilters(), provinceCode, page: 1 };
    updateBrowserFilters(filters);
    void fetchCatalog(filters);
    setTimeout(scrollToProducts, 50);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    const filters = { ...currentFilters(), page: newPage };
    updateBrowserFilters(filters);
    void fetchCatalog(filters);
    scrollToProducts();
  };

  const handleClearFilters = () => {
    setKeyword("");
    lastExecutedKeywordRef.current = "";
    setCategory("");
    setProvince("");
    setMaxPrice("");
    setSortPrice("");
    setSortDiscount("");
    setPartnerId("");
    setValidityStatus("AVAILABLE");
    setMinDiscount("");
    setPage(1);
    router.push("/", { scroll: false });

    void fetchCatalog({
      keyword: "",
      categoryCode: "",
      provinceCode: "",
      maxPrice: "",
      sortPrice: "",
      sortDiscount: "",
      partnerId: "",
      validityStatus: "AVAILABLE",
      minDiscount: "",
      page: 1,
      limit,
    });
    setTimeout(scrollToProducts, 50);
  };

  const getDisplayedCampaigns = () => {
    // Không sort trong JS nữa, API đã xử lý
    return campaigns;
  };

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <Header
        onSearch={handleHeaderSearch}
        onKeywordChange={handleKeywordChange}
        initialKeyword={keyword}
        suggestions={
          keyword.trim() === appliedKeyword && appliedKeyword
            ? campaigns.slice(0, 5).map((campaign) => ({
                campaignId: campaign.campaignId,
                title: campaign.title,
                salePrice: Number(campaign.salePrice),
                originalPrice: Number(campaign.originalPrice),
                thumbnailUrl: campaign.thumbnailUrl,
              }))
            : []
        }
        searchLoading={loading && keyword.trim().length >= 2}
      />

      <section
        className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8"
        aria-labelledby="catalog-title"
      >
        <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
              Kho voucher
            </p>
            <h1
              id="catalog-title"
              className="mt-2 font-black tracking-tight text-slate-900"
            >
              Tìm ưu đãi phù hợp với bạn
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              Tìm kiếm, lọc theo danh mục và so sánh các voucher đang mở bán
              trên hệ thống.
            </p>
          </div>
          <Link
            href="/for-customers"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-5 py-2.5 text-sm font-extrabold text-primary transition hover:border-orange-300 hover:bg-orange-100"
          >
            VoucherNow hoạt động thế nào?
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <main
        id="product-section"
        className="flex-grow max-w-7xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-4 gap-8"
      >
        {/* Sidebar (Desktop) */}
        <div className="hidden lg:block lg:col-span-1">
          <FilterSidebar
            category={category}
            categories={categories}
            totalCampaigns={totalCampaigns}
            onCategoryChange={handleCategoryChange}
            province={province}
            provinces={provinces}
            onProvinceChange={handleProvinceChange}
            partnerId={partnerId}
            partners={partners}
            onPartnerChange={(p) => {
              setPartnerId(p);
              setPage(1);
              const filters = { ...currentFilters(), partnerId: p, page: 1 };
              updateBrowserFilters(filters);
              void fetchCatalog(filters);
              setTimeout(scrollToProducts, 50);
            }}
            validityStatus={validityStatus}
            onValidityChange={(s) => {
              setValidityStatus(s);
              setPage(1);
              const filters = {
                ...currentFilters(),
                validityStatus: s,
                page: 1,
              };
              updateBrowserFilters(filters);
              void fetchCatalog(filters);
              setTimeout(scrollToProducts, 50);
            }}
            minDiscount={minDiscount}
            onMinDiscountChange={(d) => {
              setMinDiscount(d);
              setPage(1);
              const filters = { ...currentFilters(), minDiscount: d, page: 1 };
              updateBrowserFilters(filters);
              void fetchCatalog(filters);
              setTimeout(scrollToProducts, 50);
            }}
            maxPrice={maxPrice}
            setMaxPrice={setMaxPrice}
            onFilter={handleSidebarFilter}
            onClear={handleClearFilters}
            onQuickPrice={(newPrice) => {
              setMaxPrice(newPrice);
              setPage(1);
              const filters = {
                ...currentFilters(),
                maxPrice: newPrice,
                page: 1,
              };
              updateBrowserFilters(filters);
              void fetchCatalog(filters);
              scrollToProducts();
            }}
          />
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-4">
            <div className="flex items-center gap-3">
              <Grid className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
                Danh sách voucher
              </h2>
              <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full ml-2">
                {paginationMeta?.total ?? campaigns.length} kết quả
              </span>
            </div>

            {/* Filter (Mobile) & Sort Buttons */}
            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 w-full sm:w-auto self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
              <div className="lg:hidden shrink-0">
                <Sheet>
                  <SheetTrigger className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-bold text-sm border border-primary/20">
                    <Filter className="h-4 w-4" />
                    Lọc & Sắp xếp
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[min(22rem,88vw)] p-0">
                    <SheetHeader className="p-0 border-0 hidden">
                      <SheetTitle>Bộ lọc</SheetTitle>
                    </SheetHeader>
                    <div className="overflow-y-auto h-full">
                      <FilterSidebar
                        category={category}
                        categories={categories}
                        totalCampaigns={totalCampaigns}
                        onCategoryChange={handleCategoryChange}
                        province={province}
                        provinces={provinces}
                        onProvinceChange={handleProvinceChange}
                        partnerId={partnerId}
                        partners={partners}
                        onPartnerChange={(p) => {
                          setPartnerId(p);
                          setPage(1);
                          const filters = {
                            ...currentFilters(),
                            partnerId: p,
                            page: 1,
                          };
                          updateBrowserFilters(filters);
                          void fetchCatalog(filters);
                          setTimeout(scrollToProducts, 50);
                        }}
                        validityStatus={validityStatus}
                        onValidityChange={(s) => {
                          setValidityStatus(s);
                          setPage(1);
                          const filters = {
                            ...currentFilters(),
                            validityStatus: s,
                            page: 1,
                          };
                          updateBrowserFilters(filters);
                          void fetchCatalog(filters);
                          setTimeout(scrollToProducts, 50);
                        }}
                        minDiscount={minDiscount}
                        onMinDiscountChange={(d) => {
                          setMinDiscount(d);
                          setPage(1);
                          const filters = {
                            ...currentFilters(),
                            minDiscount: d,
                            page: 1,
                          };
                          updateBrowserFilters(filters);
                          void fetchCatalog(filters);
                          setTimeout(scrollToProducts, 50);
                        }}
                        maxPrice={maxPrice}
                        setMaxPrice={setMaxPrice}
                        onFilter={handleSidebarFilter}
                        onClear={handleClearFilters}
                        onQuickPrice={(newPrice) => {
                          setMaxPrice(newPrice);
                          setPage(1);
                          const filters = {
                            ...currentFilters(),
                            maxPrice: newPrice,
                            page: 1,
                          };
                          updateBrowserFilters(filters);
                          void fetchCatalog(filters);
                          scrollToProducts();
                        }}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Sort Buttons */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0 gap-1">
                <button
                  onClick={() => {
                    const val = (
                      sortPrice === ""
                        ? "asc"
                        : sortPrice === "asc"
                          ? "desc"
                          : ""
                    ) as "asc" | "desc" | "";
                    setSortPrice(val);
                    setSortDiscount(""); // clear other sort
                    const filters = {
                      ...currentFilters(),
                      sortPrice: val,
                      sortDiscount: "" as "asc" | "desc" | "",
                    };
                    updateBrowserFilters(filters);
                    void fetchCatalog(filters);
                  }}
                  className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    sortPrice !== ""
                      ? "bg-white text-primary shadow-sm ring-1 ring-slate-200/50"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                  }`}
                >
                  {sortPrice === "asc" ? (
                    <ArrowUpNarrowWide className="h-4 w-4 text-primary" />
                  ) : sortPrice === "desc" ? (
                    <ArrowDownWideNarrow className="h-4 w-4 text-primary" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  )}
                  <span className="whitespace-nowrap">Giá</span>
                </button>
                <button
                  onClick={() => {
                    const val = (
                      sortDiscount === ""
                        ? "desc"
                        : sortDiscount === "desc"
                          ? "asc"
                          : ""
                    ) as "asc" | "desc" | "";
                    setSortDiscount(val);
                    setSortPrice(""); // clear other sort
                    const filters = {
                      ...currentFilters(),
                      sortPrice: "" as "asc" | "desc" | "",
                      sortDiscount: val,
                    };
                    updateBrowserFilters(filters);
                    void fetchCatalog(filters);
                  }}
                  className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    sortDiscount !== ""
                      ? "bg-white text-primary shadow-sm ring-1 ring-slate-200/50"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                  }`}
                >
                  {sortDiscount === "asc" ? (
                    <ArrowUpNarrowWide className="h-4 w-4 text-primary" />
                  ) : sortDiscount === "desc" ? (
                    <ArrowDownWideNarrow className="h-4 w-4 text-primary" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  )}
                  <span className="whitespace-nowrap">% Giảm</span>
                </button>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-800 text-sm p-4 rounded-r-xl flex items-center gap-3 shadow-sm">
              <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-24 text-center">
              <div className="inline-block relative w-12 h-12">
                <div className="absolute top-0 left-0 w-full h-full border-4 border-primary/20 rounded-full"></div>
                <div className="absolute top-0 left-0 w-full h-full border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="mt-4 text-sm font-medium text-slate-500">
                Đang tìm kiếm deal hot...
              </p>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Ticket className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Không tìm thấy voucher phù hợp
              </h3>
              <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                Thử thay đổi từ khóa tìm kiếm hoặc lọc khoảng giá rộng hơn để
                săn nhiều khuyến mãi cực hot khác.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {getDisplayedCampaigns().map((c, i) => (
                  <VoucherCard key={c.campaignId} campaign={c} index={i} />
                ))}
              </div>

              {paginationMeta && paginationMeta.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8 pt-6 border-t border-slate-100">
                  <button
                    onClick={() => handlePageChange(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 rounded-xl text-sm font-bold transition-all border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300"
                  >
                    Trước
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: paginationMeta.totalPages }).map(
                      (_, i) => {
                        const pageNum = i + 1;
                        const isActive = pageNum === page;
                        // Display only a window of pages
                        if (
                          pageNum === 1 ||
                          pageNum === paginationMeta.totalPages ||
                          Math.abs(pageNum - page) <= 1
                        ) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                                isActive
                                  ? "bg-primary text-white shadow-sm ring-1 ring-primary/20"
                                  : "bg-transparent text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        }
                        if (Math.abs(pageNum - page) === 2) {
                          return (
                            <span
                              key={pageNum}
                              className="text-slate-400 font-bold px-1"
                            >
                              ...
                            </span>
                          );
                        }
                        return null;
                      },
                    )}
                  </div>
                  <button
                    onClick={() =>
                      handlePageChange(
                        Math.min(paginationMeta.totalPages, page + 1),
                      )
                    }
                    disabled={page === paginationMeta.totalPages}
                    className="px-4 py-2 rounded-xl text-sm font-bold transition-all border border-slate-200 bg-white text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300"
                  >
                    Sau
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-8 px-4 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 opacity-50 grayscale">
            <Ticket className="h-6 w-6 text-slate-800" />
            <span className="text-xl font-black text-slate-800 tracking-tight">
              VoucherNow
            </span>
          </div>
          <div className="text-center md:text-right">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Hệ thống phân phối Voucher Điện Tử
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Đồ án môn học Thương mại điện tử EC05 - HCMUS © 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomePageContent />
    </Suspense>
  );
}
