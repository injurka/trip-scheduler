/* eslint-disable ts/no-use-before-define */
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import type { ActivitySection, CityWeatherData, DayMetaInfo, PostElementContent, PostStatsDetail } from './schema.type'
import { relations, sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { ONE_GIGABYTE_IN_BYTES } from '~/lib/constants'

export const statusEnum = pgEnum('status', ['completed', 'planned', 'draft'])
export const visibilityEnum = pgEnum('visibility', ['public', 'private'])
export const activityTagEnum = pgEnum('activity_tag', ['activity', 'transport', 'walk', 'food', 'attraction', 'relax'])
export const activitySectionTypeEnum = pgEnum('activity_section_type', ['description', 'gallery', 'geolocation', 'metro', 'booking'])
export const activityStatusEnum = pgEnum('activity_status', ['none', 'completed', 'skipped'])
export const tripImagePlacementEnum = pgEnum('trip_image_placement', ['route', 'memories', 'notes', 'documents'])
export const mediaTypeEnum = pgEnum('media_type', ['image', 'video'])
export const userRoleEnum = pgEnum('user_role', ['user', 'admin'])

export const tripSectionTypeEnum = pgEnum('trip_section_type', [
  'bookings',
  'finances',
  'checklist',
  'documents',
  'notes',
  'memories',
])

export const noteTypeEnum = pgEnum('note_type', ['folder', 'markdown', 'excalidraw'])
export const geoCatalogVersionStateEnum = pgEnum('geo_catalog_version_state', ['loading', 'ready', 'failed'])
export const geoPlaceKindEnum = pgEnum('geo_place_kind', ['settlement', 'island', 'area'])
export const geoPlaceNameOriginEnum = pgEnum('geo_place_name_origin', ['geonames_primary', 'geonames_ascii', 'geonames_alternate', 'app_override'])
export const geoResolutionStatusEnum = pgEnum('geo_resolution_status', ['resolved', 'unresolved', 'needs_review'])

export const countries = pgTable('countries', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  flagUrl: text('flagUrl'),
  sourceCode: text('source_code').unique(),
})

export const geoCatalogVersions = pgTable('geo_catalog_versions', {
  id: text('id').primaryKey(),
  manifest: jsonb('manifest').$type<Record<string, unknown>>().notNull(),
  checksum: text('checksum').notNull(),
  state: geoCatalogVersionStateEnum('state').notNull().default('loading'),
  importerVersion: text('importer_version').notNull(),
  counts: jsonb('counts').$type<Record<string, number>>().notNull().default({}),
  downloadedAt: timestamp('downloaded_at', { withTimezone: true }).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const geoCatalogCountries = pgTable('geo_catalog_countries', {
  code: text('code').primaryKey(),
  geonamesId: text('geonames_id').notNull().unique(),
  sourceName: text('source_name').notNull(),
  asciiName: text('ascii_name').notNull(),
  nameRu: text('name_ru'),
  legacyCountryId: text('legacy_country_id').references(() => countries.id, { onDelete: 'set null' }),
  sourceModifiedAt: date('source_modified_at'),
  catalogVersion: text('catalog_version').references(() => geoCatalogVersions.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const geoPlaces = pgTable('geo_places', {
  id: uuid('id').primaryKey(),
  source: text('source').notNull().default('geonames'),
  sourceId: text('source_id').notNull(),
  countryCode: text('country_code').notNull().references(() => geoCatalogCountries.code, { onDelete: 'restrict' }),
  catalogVersion: text('catalog_version').references(() => geoCatalogVersions.id, { onDelete: 'restrict' }),
  featureCode: text('feature_code').notNull(),
  kind: geoPlaceKindEnum('kind').notNull().default('settlement'),
  primaryName: text('primary_name').notNull(),
  asciiName: text('ascii_name').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  admin1Code: text('admin1_code'),
  admin2Code: text('admin2_code'),
  regionName: text('region_name'),
  timezone: text('timezone'),
  population: bigint('population', { mode: 'number' }).notNull().default(0),
  sourceModifiedAt: date('source_modified_at'),
  sourcePresentInLatestSubset: boolean('source_present_in_latest_subset').notNull().default(true),
  retired: boolean('retired').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  sourceKey: uniqueIndex('geo_places_source_key_uq').on(t.source, t.sourceId),
  countryKindNameIdx: index('geo_places_country_kind_name_idx').on(t.countryCode, t.kind, t.primaryName),
  latitudeRange: check('geo_places_latitude_range_check', sql`${t.latitude} >= -90 AND ${t.latitude} <= 90`),
  longitudeRange: check('geo_places_longitude_range_check', sql`${t.longitude} >= -180 AND ${t.longitude} <= 180`),
}))

export const geoPlaceNames = pgTable('geo_place_names', {
  id: uuid('id').primaryKey().defaultRandom(),
  placeId: uuid('place_id').notNull().references(() => geoPlaces.id, { onDelete: 'cascade' }),
  language: text('language').notNull().default(''),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  prefixKey: text('prefix_key').notNull(),
  origin: geoPlaceNameOriginEnum('origin').notNull(),
  isPreferred: boolean('is_preferred').notNull().default(false),
  isHistorical: boolean('is_historical').notNull().default(false),
  sourceNameId: text('source_name_id'),
  catalogVersion: text('catalog_version').references(() => geoCatalogVersions.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  placeLanguageNameUq: uniqueIndex('geo_place_names_place_language_name_uq').on(t.placeId, t.language, t.normalizedName),
  prefixLookupIdx: index('geo_place_names_prefix_lookup_idx').on(t.prefixKey.op('text_pattern_ops')),
  normalizedLookupIdx: index('geo_place_names_normalized_lookup_idx').on(t.normalizedName),
}))

export const geoResolutionAudit = pgTable('geo_resolution_audit', {
  id: uuid('id').primaryKey().defaultRandom(),
  migrationRunId: text('migration_run_id').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  fieldPath: text('field_path').notNull(),
  position: integer('position'),
  sourceLabel: text('source_label').notNull(),
  context: jsonb('context').$type<Record<string, unknown>>().notNull().default({}),
  status: geoResolutionStatusEnum('status').notNull(),
  reason: text('reason').notNull(),
  candidates: jsonb('candidates').$type<Array<Record<string, unknown>>>().notNull().default([]),
  chosenPlaceId: uuid('chosen_place_id').references(() => geoPlaces.id, { onDelete: 'restrict' }),
  ruleProvenance: jsonb('rule_provenance').$type<Record<string, unknown>>().notNull().default({}),
  beforeFingerprint: text('before_fingerprint').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  runIdx: index('geo_resolution_audit_run_idx').on(t.migrationRunId),
  entityIdx: index('geo_resolution_audit_entity_idx').on(t.entityType, t.entityId),
  statusIdx: index('geo_resolution_audit_status_idx').on(t.status),
}))

export const plans = pgTable('plans', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  maxTrips: integer('max_trips').notNull().default(1),
  maxStorageBytes: bigint('max_storage_bytes', { mode: 'number' }).notNull().default(ONE_GIGABYTE_IN_BYTES),
  monthlyLlmCredits: bigint('monthly_llm_credits', { mode: 'number' }).notNull().default(100000),
  isDeveloping: boolean('is_developing').default(false).notNull(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: userRoleEnum('role').notNull().default('user'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  password: text('password'),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  coverUrl: text('cover_url'),

  githubId: text('github_id').unique(),
  googleId: text('google_id').unique(),
  telegramId: text('telegram_id').unique(),
  yandexId: text('yandex_id').unique(),

  planId: integer('plan_id').references(() => plans.id).notNull().default(1),
  currentTripsCount: integer('current_trips_count').notNull().default(0),
  currentStorageBytes: bigint('current_storage_bytes', { mode: 'number' }).notNull().default(0),
  llmCreditsUsed: bigint('llm_credits_used', { mode: 'number' }).notNull().default(0),
  llmCreditsPeriodStartDate: timestamp('llm_credits_period_start_date', { withTimezone: true }).defaultNow().notNull(),
  statusText: text('status_text'),
  statusEmoji: text('status_emoji'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  emailIndex: index('email_idx').on(t.email),
}))

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull(),
  email: text('email').unique(),
  name: text('name').notNull(),
  password: text('password').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, t => ({
  emailIndex: index('verification_email_idx').on(t.email),
}))

export const refreshTokens = pgTable('refresh_tokens', {
  id: serial('id').primaryKey(),
  token: text('token').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const trips = pgTable('trips', {
  id: uuid('id').primaryKey(),
  shareSlug: text('share_slug').unique(),
  title: text('title').notNull(),
  imageUrl: text('image_url'),
  description: text('description'),
  descriptionShort: text('description_short'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: statusEnum('status').notNull().default('draft'),
  budget: real('budget'),
  currency: text('currency').default('RUB'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  weatherByPlaceId: jsonb('weather_by_place_id').$type<Record<string, CityWeatherData>>(),
  visibility: visibilityEnum('visibility').notNull().default('private'),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const tripGeoPlaces = pgTable('trip_geo_places', {
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  placeId: uuid('place_id').notNull().references(() => geoPlaces.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  pk: primaryKey({ columns: [t.tripId, t.position] }),
  placeIdx: index('trip_geo_places_place_idx').on(t.placeId),
  positionCheck: check('trip_geo_places_position_check', sql`${t.position} >= 0`),
}))

export const tripSections = pgTable('trip_sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  type: tripSectionTypeEnum('type').notNull(),
  title: text('title').notNull(),
  icon: text('icon'),
  content: jsonb('content').$type<any>().default('{}'),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const tripNotes = pgTable('trip_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id').references((): AnyPgColumn => tripNotes.id, { onDelete: 'cascade' }),
  type: noteTypeEnum('type').notNull(),
  title: text('title').notNull(),
  content: text('content'),
  color: text('color'),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  parentIdx: index('trip_notes_parent_idx').on(t.parentId),
  tripIdx: index('trip_notes_trip_idx').on(t.tripId),
}))

export const tripParticipants = pgTable('trip_participants', {
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, t => ({
  pk: primaryKey({ columns: [t.tripId, t.userId] }),
}))

export const tripImages = pgTable('trip_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  originalName: text('original_name').notNull(),
  url: text('url').notNull(),
  mediaType: mediaTypeEnum('media_type').default('image').notNull(),
  placement: tripImagePlacementEnum('placement').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
  takenAt: timestamp('taken_at'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  width: integer('width'),
  height: integer('height'),
  variants: jsonb('variants').$type<Record<string, string>>(),
  metadata: jsonb('metadata'),
})

export const tripNoteImages = pgTable('trip_note_images', {
  noteId: uuid('note_id').notNull().references(() => tripNotes.id, { onDelete: 'cascade' }),
  imageId: uuid('image_id').notNull().references(() => tripImages.id, { onDelete: 'cascade' }),
}, t => ({
  pk: primaryKey({ columns: [t.noteId, t.imageId] }),
}))

export const days = pgTable('days', {
  id: uuid('id').primaryKey(),
  date: date('date'),
  title: text('title').notNull(),
  description: text('description'),
  note: text('note'),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  meta: jsonb('meta').$type<DayMetaInfo[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const activities = pgTable('activities', {
  id: uuid('id').primaryKey(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  title: text('title').notNull(),
  sections: jsonb('sections').$type<ActivitySection[]>().notNull().default([]),
  tag: activityTagEnum('tag'),
  status: activityStatusEnum('status').notNull().default('none'),
  dayId: uuid('day_id').notNull().references(() => days.id, { onDelete: 'cascade' }),
})

export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp'),
  comment: text('comment'),
  imageId: uuid('image_id').references(() => tripImages.id, { onDelete: 'cascade' }),
  title: text('title'),
  tag: activityTagEnum('tag'),
  sourceActivityId: uuid('source_activity_id').references(() => activities.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  rating: integer('rating'),
  tags: jsonb('tags').$type<string[]>().default([]),
})

export const llmModels = pgTable('llm_models', {
  id: text('id').primaryKey(),
  costPerMillionInputTokens: real('cost_per_million_input_tokens').notNull().default(0),
  costPerMillionOutputTokens: real('cost_per_million_output_tokens').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const llmTokenUsage = pgTable('llm_token_usage', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  model: text('model').notNull().references(() => llmModels.id, { onDelete: 'set null' }),
  operation: text('operation').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  userIdIndex: index('llm_usage_user_id_idx').on(t.userId),
}))

export const commentParentTypeEnum = pgEnum('comment_parent_type', ['trip', 'day'])

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id').notNull(),
  parentType: commentParentTypeEnum('parent_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  parentIndex: index('parent_idx').on(t.parentId),
}))

export const metroSystems = pgTable('metro_systems', {
  id: text('id').primaryKey(),
  city: text('city').notNull().unique(),
  country: text('country').notNull(),
  geoPlaceId: uuid('geo_place_id').references(() => geoPlaces.id, { onDelete: 'set null' }),
})

export const metroLines = pgTable('metro_lines', {
  id: text('id').primaryKey(),
  systemId: text('system_id').notNull().references(() => metroSystems.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  lineNumber: text('line_number'),
  isCircular: boolean('is_circular').notNull().default(false),
  color: text('color').notNull(),
})

export const metroStations = pgTable('metro_stations', {
  id: text('id').primaryKey(),
  systemId: text('system_id').notNull().references(() => metroSystems.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
})

export const metroLineStations = pgTable('metro_line_stations', {
  lineId: text('line_id').notNull().references(() => metroLines.id, { onDelete: 'cascade' }),
  stationId: text('station_id').notNull().references(() => metroStations.id, { onDelete: 'cascade' }),
  order: integer('order').notNull().default(0),
}, t => ({
  pk: primaryKey({ columns: [t.lineId, t.stationId] }),
}))

// Durable S3 cleanup outbox. It deliberately survives deletion of the owning post.
export const storageCleanupTasks = pgTable('storage_cleanup_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  keys: jsonb('keys').$type<string[]>().notNull().default([]),
  prefix: text('prefix'),
  uploadId: text('upload_id'),
  keepIfMediaUrl: text('keep_if_media_url'),
  availableAt: timestamp('available_at', { withTimezone: true }).defaultNow().notNull(),
  attempts: integer('attempts').default(0).notNull(),
  lastError: text('last_error'),
}, t => ({ availableIdx: index('storage_cleanup_available_idx').on(t.availableAt) }))

export const postMediaTypeEnum = pgEnum('post_media_type', ['image', 'video'])

export const postMedia = pgTable('post_media', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').notNull().references((): AnyPgColumn => posts.id, { onDelete: 'cascade' }),
  originalName: text('original_name').notNull(),
  url: text('url').notNull(),
  type: postMediaTypeEnum('type').default('image').notNull(),
  isPrivate: boolean('is_private').default(false).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
  order: integer('order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  takenAt: timestamp('taken_at'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  width: integer('width'),
  height: integer('height'),
  variants: jsonb('variants').$type<Record<string, string>>(),
  metadata: jsonb('metadata'),
}, t => ({
  postIdx: index('post_media_post_id_idx').on(t.postId),
}))

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  insight: text('insight'),
  description: text('description'),
  country: text('country'),
  startDate: date('start_date'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  status: statusEnum('status').notNull().default('draft'),
  viewsCount: integer('views_count').default(0).notNull(),
  likesCount: integer('likes_count').default(0).notNull(),
  savesCount: integer('saves_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  statsDetail: jsonb('stats_detail').$type<PostStatsDetail>().notNull().default({
    views: 0,
    duration: 0,
  }),
}, t => ({
  countryIdx: index('posts_country_idx').on(t.country),
  tagsIdx: index('posts_tags_idx').on(t.tags),
}))

export const marks = pgTable('marks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  categoryId: integer('category_id').notNull().default(1),
  startAt: timestamp('start_at', { withTimezone: true }),
  duration: integer('duration').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const marksRelations = relations(marks, ({ one }) => ({
  user: one(users, {
    fields: [marks.userId],
    references: [users.id],
  }),
}))

export const postElements = pgTable('post_elements', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  order: integer('order').notNull().default(0),
  title: text('title'),
  day: integer('day').notNull().default(1),
  time: text('time'),
  content: jsonb('content').$type<PostElementContent[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  postIdx: index('post_elements_post_id_idx').on(t.postId),
}))

export const savedPosts = pgTable('saved_posts', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  pk: primaryKey({ columns: [t.userId, t.postId] }),
}))

export const postLikes = pgTable('post_likes', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  pk: primaryKey({ columns: [t.userId, t.postId] }),
}))

export const postWhitelist = pgTable('post_whitelist', {
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  pk: primaryKey({ columns: [t.postId, t.userId] }),
  postIdx: index('post_whitelist_post_id_idx').on(t.postId),
  userIdx: index('post_whitelist_user_id_idx').on(t.userId),
}))

export const blogs = pgTable('blogs', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').unique().notNull(),
  title: text('title').notNull(),
  excerpt: text('excerpt'),
  content: text('content').notNull(),
  coverImage: text('cover_image'),
  publishedAt: timestamp('published_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const pushSubscriptions = pgTable('push_subscriptions', {
  endpoint: text('endpoint').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  keys: jsonb('keys').$type<{ p256dh: string, auth: string }>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const pushTokens = pgTable('push_tokens', {
  token: text('token').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('rustore'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  userIdx: index('push_tokens_user_id_idx').on(t.userId),
  providerUserIdx: index('push_tokens_provider_user_idx').on(t.provider, t.userId),
}))

export const tripSubscriptions = pgTable('trip_subscriptions', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  pk: primaryKey({ columns: [t.userId, t.tripId] }),
}))

export const destinationTypeEnum = pgEnum('destination_type', ['country', 'city'])

export const destinationReviews = pgTable('destination_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: destinationTypeEnum('type').notNull(),
  countryId: text('country_id').notNull().references(() => countries.id, { onDelete: 'restrict' }),
  city: text('city'),
  geoPlaceId: uuid('geo_place_id').references(() => geoPlaces.id, { onDelete: 'restrict' }),
  coverUrl: text('cover_url'),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  content: text('content'),
  metrics: jsonb('metrics').$type<Record<string, number>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  typeIdx: index('dest_reviews_type_idx').on(t.type),
  countryIdx: index('dest_reviews_country_idx').on(t.countryId),
  geoPlaceIdx: index('dest_reviews_geo_place_idx').on(t.geoPlaceId),
  userIdx: index('dest_reviews_user_idx').on(t.userId),
  cityGeoPlaceCheck: check('dest_reviews_city_geo_place_check', sql`(${t.type} = 'country' AND ${t.geoPlaceId} IS NULL) OR (${t.type} = 'city' AND ${t.geoPlaceId} IS NOT NULL)`),
}))

export const highlights = pgTable('highlights', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  countryId: text('country_id').notNull().references(() => countries.id, { onDelete: 'restrict' }),
  city: text('city').notNull(),
  geoPlaceId: uuid('geo_place_id').notNull().references(() => geoPlaces.id, { onDelete: 'restrict' }),
  address: text('address'),
  comment: text('comment'),

  // Гео и метаданные
  latitude: real('latitude'),
  longitude: real('longitude'),
  takenAt: timestamp('taken_at'),
  width: integer('width'),
  height: integer('height'),
  variants: jsonb('variants').$type<Record<string, string>>(),
  metadata: jsonb('metadata'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  countryIdx: index('highlights_country_idx').on(t.countryId),
  geoPlaceIdx: index('highlights_geo_place_idx').on(t.geoPlaceId),
  userIdIdx: index('highlights_user_idx').on(t.userId),
}))

export const geoWeatherCache = pgTable('geo_weather_cache', {
  placeId: uuid('place_id').notNull().references(() => geoPlaces.id, { onDelete: 'restrict' }),
  month: integer('month').notNull(),
  generationVersion: text('generation_version').notNull(),
  inputFingerprint: text('input_fingerprint').notNull(),
  data: jsonb('data').$type<CityWeatherData>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  pk: primaryKey({ columns: [t.placeId, t.month, t.generationVersion] }),
  monthCheck: check('geo_weather_cache_month_check', sql`${t.month} BETWEEN 1 AND 12`),
}))

// --- RELATIONS ---

export const highlightsRelations = relations(highlights, ({ one }) => ({
  user: one(users, {
    fields: [highlights.userId],
    references: [users.id],
  }),
  country: one(countries, {
    fields: [highlights.countryId],
    references: [countries.id],
  }),
  geoPlace: one(geoPlaces, {
    fields: [highlights.geoPlaceId],
    references: [geoPlaces.id],
  }),
}))

export const destinationReviewsRelations = relations(destinationReviews, ({ one }) => ({
  user: one(users, {
    fields: [destinationReviews.userId],
    references: [users.id],
  }),
  country: one(countries, {
    fields: [destinationReviews.countryId],
    references: [countries.id],
  }),
  geoPlace: one(geoPlaces, {
    fields: [destinationReviews.geoPlaceId],
    references: [geoPlaces.id],
  }),
}))

export const tripsRelations = relations(trips, ({ one, many }) => ({
  user: one(users, {
    fields: [trips.userId],
    references: [users.id],
  }),
  days: many(days),
  images: many(tripImages),
  memories: many(memories),
  participants: many(tripParticipants),
  sections: many(tripSections),
  notes: many(tripNotes),
  cityLinks: many(tripGeoPlaces),
}))

export const tripGeoPlacesRelations = relations(tripGeoPlaces, ({ one }) => ({
  trip: one(trips, {
    fields: [tripGeoPlaces.tripId],
    references: [trips.id],
  }),
  place: one(geoPlaces, {
    fields: [tripGeoPlaces.placeId],
    references: [geoPlaces.id],
  }),
}))

export const countriesRelations = relations(countries, ({ many }) => ({
  geoCatalogCountries: many(geoCatalogCountries),
}))

export const geoCatalogCountriesRelations = relations(geoCatalogCountries, ({ one, many }) => ({
  legacyCountry: one(countries, {
    fields: [geoCatalogCountries.legacyCountryId],
    references: [countries.id],
  }),
  catalogVersion: one(geoCatalogVersions, {
    fields: [geoCatalogCountries.catalogVersion],
    references: [geoCatalogVersions.id],
  }),
  places: many(geoPlaces),
}))

export const geoCatalogVersionsRelations = relations(geoCatalogVersions, ({ many }) => ({
  places: many(geoPlaces),
  names: many(geoPlaceNames),
}))

export const geoPlacesRelations = relations(geoPlaces, ({ one, many }) => ({
  country: one(geoCatalogCountries, {
    fields: [geoPlaces.countryCode],
    references: [geoCatalogCountries.code],
  }),
  catalogVersion: one(geoCatalogVersions, {
    fields: [geoPlaces.catalogVersion],
    references: [geoCatalogVersions.id],
  }),
  names: many(geoPlaceNames),
  tripLinks: many(tripGeoPlaces),
  weather: many(geoWeatherCache),
  highlights: many(highlights),
  destinationReviews: many(destinationReviews),
  metroSystems: many(metroSystems),
  resolutionAudit: many(geoResolutionAudit, { relationName: 'geo_audit_chosen_place' }),
}))

export const geoPlaceNamesRelations = relations(geoPlaceNames, ({ one }) => ({
  place: one(geoPlaces, {
    fields: [geoPlaceNames.placeId],
    references: [geoPlaces.id],
  }),
  catalogVersion: one(geoCatalogVersions, {
    fields: [geoPlaceNames.catalogVersion],
    references: [geoCatalogVersions.id],
  }),
}))

export const geoResolutionAuditRelations = relations(geoResolutionAudit, ({ one }) => ({
  chosenPlace: one(geoPlaces, {
    fields: [geoResolutionAudit.chosenPlaceId],
    references: [geoPlaces.id],
    relationName: 'geo_audit_chosen_place',
  }),
}))

export const geoWeatherCacheRelations = relations(geoWeatherCache, ({ one }) => ({
  place: one(geoPlaces, {
    fields: [geoWeatherCache.placeId],
    references: [geoPlaces.id],
  }),
}))

export const tripSectionsRelations = relations(tripSections, ({ one }) => ({
  trip: one(trips, {
    fields: [tripSections.tripId],
    references: [trips.id],
  }),
}))

export const tripNotesRelations = relations(tripNotes, ({ one, many }) => ({
  trip: one(trips, {
    fields: [tripNotes.tripId],
    references: [trips.id],
  }),
  parent: one(tripNotes, {
    fields: [tripNotes.parentId],
    references: [tripNotes.id],
    relationName: 'parent_child',
  }),
  children: many(tripNotes, {
    relationName: 'parent_child',
  }),
  noteImages: many(tripNoteImages),
}))

export const tripParticipantsRelations = relations(tripParticipants, ({ one }) => ({
  trip: one(trips, {
    fields: [tripParticipants.tripId],
    references: [trips.id],
  }),
  user: one(users, {
    fields: [tripParticipants.userId],
    references: [users.id],
  }),
}))

export const daysRelations = relations(days, ({ one, many }) => ({
  trip: one(trips, {
    fields: [days.tripId],
    references: [trips.id],
  }),
  activities: many(activities),
}))

export const activitiesRelations = relations(activities, ({ one }) => ({
  day: one(days, {
    fields: [activities.dayId],
    references: [days.id],
  }),
}))

export const tripImagesRelations = relations(tripImages, ({ one, many }) => ({
  trip: one(trips, {
    fields: [tripImages.tripId],
    references: [trips.id],
  }),
  noteImages: many(tripNoteImages),
}))

export const tripNoteImagesRelations = relations(tripNoteImages, ({ one }) => ({
  note: one(tripNotes, {
    fields: [tripNoteImages.noteId],
    references: [tripNotes.id],
  }),
  image: one(tripImages, {
    fields: [tripNoteImages.imageId],
    references: [tripImages.id],
  }),
}))

export const memoriesRelations = relations(memories, ({ one }) => ({
  trip: one(trips, {
    fields: [memories.tripId],
    references: [trips.id],
  }),
  image: one(tripImages, {
    fields: [memories.imageId],
    references: [tripImages.id],
  }),
}))

export const commentsRelations = relations(comments, ({ one }) => ({
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}))

export const usersRelations = relations(users, ({ many, one }) => ({
  trips: many(trips),
  refreshTokens: many(refreshTokens),
  tripParticipations: many(tripParticipants),
  comments: many(comments),
  plan: one(plans, {
    fields: [users.planId],
    references: [plans.id],
  }),
  llmTokenUsage: many(llmTokenUsage),
  posts: many(posts),
  savedPosts: many(savedPosts),
  likedPosts: many(postLikes),
  marks: many(marks),
  postWhitelists: many(postWhitelist),
}))

export const llmTokenUsageRelations = relations(llmTokenUsage, ({ one }) => ({
  user: one(users, {
    fields: [llmTokenUsage.userId],
    references: [users.id],
  }),
  llmModel: one(llmModels, {
    fields: [llmTokenUsage.model],
    references: [llmModels.id],
  }),
}))

export const llmModelsRelations = relations(llmModels, ({ many }) => ({
  usageRecords: many(llmTokenUsage),
}))

export const plansRelations = relations(plans, ({ many }) => ({
  users: many(users),
}))

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}))

export const metroSystemsRelations = relations(metroSystems, ({ one, many }) => ({
  lines: many(metroLines),
  stations: many(metroStations),
  geoPlace: one(geoPlaces, {
    fields: [metroSystems.geoPlaceId],
    references: [geoPlaces.id],
  }),
}))

export const metroLinesRelations = relations(metroLines, ({ one, many }) => ({
  system: one(metroSystems, {
    fields: [metroLines.systemId],
    references: [metroSystems.id],
  }),
  lineStations: many(metroLineStations),
}))

export const metroStationsRelations = relations(metroStations, ({ one, many }) => ({
  system: one(metroSystems, {
    fields: [metroStations.systemId],
    references: [metroSystems.id],
  }),
  lineStations: many(metroLineStations),
}))

export const metroLineStationsRelations = relations(metroLineStations, ({ one }) => ({
  line: one(metroLines, {
    fields: [metroLineStations.lineId],
    references: [metroLines.id],
  }),
  station: one(metroStations, {
    fields: [metroLineStations.stationId],
    references: [metroStations.id],
  }),
}))

export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  elements: many(postElements),
  media: many(postMedia),
  savedBy: many(savedPosts),
  likedBy: many(postLikes),
  whitelist: many(postWhitelist),
}))

export const postWhitelistRelations = relations(postWhitelist, ({ one }) => ({
  post: one(posts, {
    fields: [postWhitelist.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [postWhitelist.userId],
    references: [users.id],
  }),
}))

export const postElementsRelations = relations(postElements, ({ one }) => ({
  post: one(posts, {
    fields: [postElements.postId],
    references: [posts.id],
  }),
}))

export const postMediaRelations = relations(postMedia, ({ one }) => ({
  post: one(posts, {
    fields: [postMedia.postId],
    references: [posts.id],
  }),
}))

export const savedPostsRelations = relations(savedPosts, ({ one }) => ({
  user: one(users, {
    fields: [savedPosts.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [savedPosts.postId],
    references: [posts.id],
  }),
}))

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  user: one(users, {
    fields: [postLikes.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [postLikes.postId],
    references: [posts.id],
  }),
}))

export const trackActivityTypeEnum = pgEnum('track_activity_type', ['still', 'walk', 'bike', 'vehicle', 'rail', 'unknown'])

/** Сырые GPS-точки, выгружаемые батчами с мобильного клиента. */
export const trackPoints = pgTable('track_points', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientPointId: text('client_point_id').notNull().unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull(),
  tsUtc: timestamp('ts_utc', { withTimezone: true }).notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  altitude: real('altitude'),
  accuracy: real('accuracy'),
  speed: real('speed'),
  bearing: real('bearing'),
  activity: trackActivityTypeEnum('activity').notNull().default('unknown'),
  activityConfidence: integer('activity_confidence').notNull().default(0),
  deviceActivity: trackActivityTypeEnum('device_activity'),
  deviceActivityConfidence: integer('device_activity_confidence'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  userTsIndex: index('track_points_user_ts_idx').on(t.userId, t.tsUtc),
  sessionIndex: index('track_points_session_idx').on(t.sessionId),
}))

/** Сегменты после пост-обработки (классификация активности + RDP-сжатие). */
export const trackSegments = pgTable('track_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull(),
  activity: trackActivityTypeEnum('activity').notNull(),
  confidence: real('confidence').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
  distanceM: real('distance_m').notNull().default(0),
  pointCount: integer('point_count').notNull().default(0),
  geometry: jsonb('geometry').$type<[number, number][]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, t => ({
  userSessionIndex: index('track_segments_user_session_idx').on(t.userId, t.sessionId, t.startedAt),
}))
