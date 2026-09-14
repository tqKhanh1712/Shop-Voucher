# Giftpop catalog CSV pipeline

This pipeline is for the project's non-commercial educational catalog only. It does not simulate payments or represent a commercial partnership with Giftpop or the displayed brands.

## Data flow

1. `catalog:crawl` checks `robots.txt`, fetches at a limited rate, and writes source-shaped CSV files under `raw/`.
2. `catalog:normalize` converts source fields into canonical CSV files matching the database relationships.
3. `catalog:validate` rejects invalid prices, windows, URLs, source content, references, and datasets with more than 10 branches.
4. `catalog:import` defaults to dry-run. `--apply` is required for database writes.
5. Imports use `(external_source, external_id)` as stable identities, so rerunning the same files updates or skips records instead of creating duplicates.

## Source to database mapping

| Giftpop page | Normalized CSV | Database |
| --- | --- | --- |
| Product title | `campaigns.title` | `Voucher_Campaigns.title` |
| “Thông tin sản phẩm” | `campaigns.description` | `Voucher_Campaigns.description` |
| “Chú ý” | `campaigns.terms_and_conditions` | `Voucher_Campaigns.terms_and_conditions` |
| Current price | `campaigns.sale_price` | `Voucher_Campaigns.sale_price` |
| Struck-through price | `campaigns.original_price` | `Voucher_Campaigns.original_price` |
| Relative expiry | `campaigns.usage_validity_days` | `Voucher_Campaigns.usage_validity_days` |
| Main image | `campaigns.thumbnail_url` | `Voucher_Campaigns.thumbnail_url` |
| Product URL/code | source identity fields | campaign provenance columns |
| Brand label/logo/code | `brands.csv` | `Catalog_Brands` |
| Giftpop category code | `categories.csv` | `Voucher_Categories` |
| Store cards | `branches.csv` | `Branches` |

Parent category codes are internal and stable: `FOOD_DRINK`, `SHOPPING_RETAIL`, `BEAUTY_HEALTH`, `DIGITAL_TELECOM`, `ENTERTAINMENT`, `LIFESTYLE_SERVICES`, `TRANSPORT`, and `OTHER`.

For the September 2026 demo catalog, normalization assigns each new voucher a deterministic pseudo-random sale start from September 20 through September 30 in the Vietnam timezone. Relative validity is selected from 7, 30, or 45 days. The external product id is the seed, so normalizing the same CSV again produces the same schedule.

## Commands

Run from `apps/api`:

```powershell
npm run catalog:crawl -- --output data/catalog/giftpop/sample-5 --limit 5 --max-branches 10
npm run catalog:normalize -- --input data/catalog/giftpop/sample-5
npm run catalog:validate -- --input data/catalog/giftpop/sample-5
npm run catalog:import -- --input data/catalog/giftpop/sample-5
npm run catalog:import -- --input data/catalog/giftpop/sample-5 --apply
```

Use `--max-branches 0` when importing more campaigns while retaining the existing small branch catalog without adding new store locations.

The import command reads `DATABASE_URL` through the existing backend environment loader. It never logs connection strings or credentials.

## Safety rules

- `sale_price` must be positive and strictly less than `original_price`.
- Source product URLs must belong to Giftpop; all stored URLs must use HTTPS.
- Description and terms are stored as cleaned plain text, never raw HTML.
- Missing campaign, brand, or category rows never trigger automatic deletion.
- After relationship sync, only orphaned Giftpop branches with no campaign, staff, or usage history are removed.
- Existing inventory counters and campaign windows are preserved on update.
- The all-or-nothing import transaction allows up to 120 seconds for medium demo batches.
- Browser-facing Supabase roles remain deny-by-default; the frontend reads through NestJS.
