import { relations, sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

export const teachers = sqliteTable(
  "teachers",
  {
    id: integer("id").primaryKey().notNull(),
    slug: text("slug").unique().notNull(),
    name: text("name").notNull(),
    description: text("description"),
    profileImageUrl: text("profile_image_url"),
    websiteUrl: text("website_url"),
    donationUrl: text("donation_url"),
    dharmaSeedId: integer("dharma_seed_id").unique().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    publishedOn: integer("published_on", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (teachers) => ({
    // Existing indexes
    teacherSlugIdx: uniqueIndex("teacher_slug_idx").on(teachers.slug),
    teacherDharmaSeedIdIdx: uniqueIndex("teacher_dharma_seed_id_idx").on(
      teachers.dharmaSeedId,
    ),
    // Search and sort indexes
    teacherNameIdx: index("teacher_name_idx").on(teachers.name),
    // Timestamp indexes
    teacherCreatedAtIdx: index("teacher_created_at_idx").on(teachers.createdAt),
    teacherPublishedOnIdx: index("teacher_published_on_idx").on(
      teachers.publishedOn,
    ),
    teacherUpdatedAtIdx: index("teacher_updated_at_idx").on(teachers.updatedAt),
    // Compound indexes for common queries
    teacherNamePublishedIdx: index("teacher_name_published_idx").on(
      teachers.name,
      teachers.publishedOn,
    ),
  }),
);

export const talks = sqliteTable(
  "talks",
  {
    id: integer("id").primaryKey().notNull(),
    slug: text("slug").unique().notNull(),
    title: text("title").notNull(),
    description: text("description"),
    audioUrl: text("audio_url").notNull(),
    externalGuid: text("external_guid").notNull(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachers.id),
    centerId: integer("center_id").references(() => centers.id),
    retreatId: integer("retreat_id").references(() => retreats.id),
    dharmaSeedId: integer("dharma_seed_id").unique().notNull(),
    duration: integer("duration").notNull(),
    publicationDate: integer("publicationDate", {
      mode: "timestamp",
    }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (talks) => ({
    // Existing unique indexes
    talkSlugIdx: uniqueIndex("talk_slug_idx").on(talks.slug),

    // Foreign key indexes
    talkTeacherIdx: index("talk_teacher_idx").on(talks.teacherId),
    talkCenterIdx: index("talk_center_idx").on(talks.centerId),
    talkRetreatIdx: index("talk_retreat_idx").on(talks.retreatId),

    // Search indexes
    titleSearchIdx: index("talk_title_search_idx").on(talks.title),
    descriptionSearchIdx: index("talk_description_search_idx").on(
      talks.description,
    ),

    // Sort field indexes
    titleSortIdx: index("talk_title_sort_idx").on(talks.title),
    durationSortIdx: index("talk_duration_sort_idx").on(talks.duration),

    // Timestamp indexes
    publicationDateIdx: index("talk_publication_date_idx").on(
      talks.publicationDate,
    ),
    createdAtIdx: index("talk_created_at_idx").on(talks.createdAt),
    updatedAtIdx: index("talk_updated_at_idx").on(talks.updatedAt),

    // Compound indexes for common query patterns
    teacherPublicationIdx: index("talk_teacher_publication_idx").on(
      talks.teacherId,
      talks.publicationDate,
    ),
    centerPublicationIdx: index("talk_center_publication_idx").on(
      talks.centerId,
      talks.publicationDate,
    ),
    retreatPublicationIdx: index("talk_retreat_publication_idx").on(
      talks.retreatId,
      talks.publicationDate,
    ),
    titlePublicationIdx: index("talk_title_publication_idx").on(
      talks.title,
      talks.publicationDate,
    ),
    durationPublicationIdx: index("talk_duration_publication_idx").on(
      talks.duration,
      talks.publicationDate,
    ),
  }),
);

export const centers = sqliteTable(
  "centers",
  {
    id: integer("id").primaryKey().notNull(),
    slug: text("slug").unique().notNull(),
    name: text("name").notNull(),
    description: text("description"),
    dharmaSeedSubdomain: text("dharma_seed_subdomain").unique().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (centers) => ({
    // Existing unique indexes
    centerSlugIdx: uniqueIndex("center_slug_idx").on(centers.slug),
    centerNameIdx: uniqueIndex("center_name_idx").on(centers.name),
    centerDharmaSeedSubdomainIdx: uniqueIndex(
      "center_dharma_seed_subdomain_idx",
    ).on(centers.dharmaSeedSubdomain),
    // Timestamp indexes
    centerCreatedAtIdx: index("center_created_at_idx").on(centers.createdAt),
    centerUpdatedAtIdx: index("center_updated_at_idx").on(centers.updatedAt),
    // Search indexes
    centerDescriptionIdx: index("center_description_idx").on(
      centers.description,
    ),
  }),
);

export const retreats = sqliteTable(
  "retreats",
  {
    id: integer("id").primaryKey().notNull(),
    slug: text("slug").unique().notNull(),
    title: text("title").notNull(),
    description: text("description"),
    language: text("language").notNull(),
    dharmaSeedId: integer("dharma_seed_id").unique().notNull(),
    lastBuildDate: integer("last_build_date", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (retreats) => ({
    // Existing unique indexes
    retreatSlugIdx: uniqueIndex("retreat_slug_idx").on(retreats.slug),
    retreatDharmaSeedIdIdx: uniqueIndex("retreat_dharma_seed_id_idx").on(
      retreats.dharmaSeedId,
    ),
    retreatCreatedAtIdx: index("retreat_created_at_idx").on(retreats.createdAt),
    retreatUpdatedAtIdx: index("retreat_updated_at_idx").on(retreats.updatedAt),
    // Search and filter indexes
    retreatTitleIdx: index("retreat_title_idx").on(retreats.title),
    retreatDescriptionIdx: index("retreat_description_idx").on(
      retreats.description,
    ),
    retreatLanguageIdx: index("retreat_language_idx").on(retreats.language),
  }),
);

// Relations remain the same
export const centersRelations = relations(centers, ({ many }) => ({
  talks: many(talks),
}));

export const teachersRelations = relations(teachers, ({ many }) => ({
  talks: many(talks),
}));

export const retreatsRelations = relations(retreats, ({ many }) => ({
  talks: many(talks),
}));

export const talksRelations = relations(talks, ({ one }) => ({
  center: one(centers, {
    fields: [talks.centerId],
    references: [centers.id],
  }),
  retreat: one(retreats, {
    fields: [talks.retreatId],
    references: [retreats.id],
  }),
  teacher: one(teachers, {
    fields: [talks.teacherId],
    references: [teachers.id],
  }),
}));
