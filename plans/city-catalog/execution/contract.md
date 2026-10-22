# Geo catalog transition contract

Статус: **A1/A3 initial contract, 2026-10-22**. Server DTOs and bounded search/get-by-ID reads are implemented in `apps/server/src/modules/geo/geo.schemas.ts`; write integration and legacy resolver remain for A4/A10.

## Identity and labels

- App ID is UUIDv5 using the standard URL namespace and the exact UTF-8 name `https://www.geonames.org/<sourceId>`.
- Preserve `source` + `sourceId` as a unique external identity. GeoNames countries live in `geo_catalog_countries` keyed by source code; `legacyCountryId` is nullable and only links to an existing app country when `countries.sourceCode` has been explicitly populated. Never infer or rewrite existing country IDs.
- A `GeoPlaceRef` contains ID, display name, source country code/name, an optional legacy country ID, region label, kind, coordinates, timezone and retired flag. Names shown to users are labels only; selection writes the ID.
- `kind` is `settlement`, `island` or `area`. Profile and flight controls accept settlement only; trip destinations may accept curated kinds after server validation.

## Trip projection and write invariant

- Legacy `cities: string[]` remains a display projection during rollout.
- New reads add ordered `cityRefs: GeoPlaceRef[]` with `position`, and `unresolvedCities` with `position`, original `label` and resolution status.
- A changed city list is submitted as ordered `cityIds: UUID[]`; duplicate IDs are rejected. The caller submits this field only after all retained legacy entries have been selected or explicitly removed.
- Title-only and other unrelated PATCH operations omit `cityIds` and preserve current resolved and unresolved links.
- A resolved link always has `placeId`; unresolved/review links have no selected `placeId` and preserve the original label. Deleting a trip cascades its links; deleting/retiring a catalog place never erases a trip reference.

## Other structured fields

- Highlights and destination reviews add nullable `geoPlaceId`; existing `city` strings and precise record coordinates remain intact during transition.
- Metro systems add a nullable place association; metro system IDs remain independent.
- Manually selected flight segments add optional `departureCityId` / `arrivalCityId`, while existing city strings remain human-readable snapshots. Airport, terminal, route coordinates and source ticket text are not rewritten.
- New weather cache identity is `(placeId, month, generationVersion)` and includes an input fingerprint. The name-keyed cache is used only by legacy string requests.
- New trip weather snapshots are stored in `weatherByPlaceId`; `weatherData` remains a legacy display projection. ID requests use catalog coordinates and never consult the name-keyed cache. The old string request is compatibility-only.
- Public search/get-by-ID and server mutations validate IDs, kind and country. Raw text never creates catalog entries. LLM output is a label/candidate, not trusted identity.

## Search bounds

- Query is trimmed and 2–100 characters; locale is `ru | en`; result count is 1–30 with default 20.
- ID hydration accepts at most 100 unique IDs and includes retired referenced places.
- API search ranks exact and prefix matches and returns at most 30 unique places. Resolver ambiguity rules remain for A3/A10; exact/prefix candidates are not identity proof by themselves.
