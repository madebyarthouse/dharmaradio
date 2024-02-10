import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const teachers = sqliteTable(
  "teachers",
  {
    id: integer("id").primaryKey().notNull(),
    slug: text("slug").unique().notNull(),
    name: text("name"),
    description: text("description"),
    profileImageUrl: text("profile_image_url"),
    dharmaSeedId: integer("dharma_seed_id").unique().notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    publishedOn: integer("published_on", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (teachers) => ({
    slugIdx: uniqueIndex("slugIdx").on(teachers.slug),
    nameIdx: uniqueIndex("dharmaSeedIdx").on(teachers.dharmaSeedId),
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
    slugIdx: uniqueIndex("slugIdx").on(talks.slug),
    teacherIdx: uniqueIndex("teacherIdx").on(talks.teacherId),
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
    slugIdx: uniqueIndex("slugIdx").on(centers.slug),
    nameIdx: uniqueIndex("dharmaSeedIdx").on(centers.name),
    dharmaSeedSubdomainIdx: uniqueIndex("dharmaSeedSubdomainIdx").on(
      centers.dharmaSeedSubdomain
    ),
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
    slugIdx: uniqueIndex("slugIdx").on(retreats.slug),
    dharmaSeedId: uniqueIndex("dharmaSeedId").on(retreats.dharmaSeedId),
  })
);
