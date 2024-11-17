import { sql } from "drizzle-orm";
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
    teacherSlugIdx: uniqueIndex("teacher_slug_idx").on(teachers.slug),
    teacherDharmaSeedIdIdx: uniqueIndex("teacher_dharma_seed_id_idx").on(
      teachers.dharmaSeedId
    ),
  })
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
    talkSlugIdx: uniqueIndex("talk_slug_idx").on(talks.slug),
    talkTeacherIdx: index("talk_teacher_idx").on(talks.teacherId),
  })
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
    centerSlugIdx: uniqueIndex("center_slug_idx").on(centers.slug),
    centerNameIdx: uniqueIndex("center_name_idx").on(centers.name),
    centerDharmaSeedSubdomainIdx: uniqueIndex(
      "center_dharma_seed_subdomain_idx"
    ).on(centers.dharmaSeedSubdomain),
  })
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
    retreatSlugIdx: uniqueIndex("retreat_slug_idx").on(retreats.slug),
    retreatDharmaSeedIdIdx: uniqueIndex("retreat_dharma_seed_id_idx").on(
      retreats.dharmaSeedId
    ),
  })
);
