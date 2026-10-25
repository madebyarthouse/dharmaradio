import type { PlayerTalk } from "~/contexts/audio-context";

/** The one talk shape every list in the UI renders. Routes map their loader rows into it. */
export type TalkListItem = {
  id: number;
  slug: string;
  title: string;
  duration: number;
  audioUrl: string;
  publicationDate: Date | string | number | null;
  teacher: { name: string; slug: string; profileImageUrl: string | null } | null;
  center: { name: string; slug: string } | null;
  retreat: { title: string; slug: string } | null;
};

type Nullable<T> = { [K in keyof T]: T[K] | null };

/** Rows from `leftJoin` selects come back with nested objects whose fields may all be null. */
export function fromNestedRow(row: {
  id: number;
  slug: string;
  title: string;
  duration: number;
  audioUrl: string;
  publicationDate: Date | string | number | null;
  teacher?: Nullable<{ name: string; slug: string; profileImageUrl: string | null }> | null;
  center?: Nullable<{ name: string; slug: string }> | null;
  retreat?: Nullable<{ title: string; slug: string }> | null;
}): TalkListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    duration: row.duration,
    audioUrl: row.audioUrl,
    publicationDate: row.publicationDate,
    teacher:
      row.teacher?.name && row.teacher.slug
        ? {
            name: row.teacher.name,
            slug: row.teacher.slug,
            profileImageUrl: row.teacher.profileImageUrl ?? null,
          }
        : null,
    center:
      row.center?.name && row.center.slug
        ? { name: row.center.name, slug: row.center.slug }
        : null,
    retreat:
      row.retreat?.title && row.retreat.slug
        ? { title: row.retreat.title, slug: row.retreat.slug }
        : null,
  };
}

/** Rows that select flat `teacherName`/`centerSlug`/... columns. */
export function fromFlatRow(
  row: {
    id: number;
    slug: string;
    title: string;
    duration: number;
    audioUrl: string;
    publicationDate: Date | string | number | null;
    teacherName?: string | null;
    teacherSlug?: string | null;
    teacherProfileImageUrl?: string | null;
    centerName?: string | null;
    centerSlug?: string | null;
    retreatTitle?: string | null;
    retreatSlug?: string | null;
  },
  defaults: Partial<Pick<TalkListItem, "teacher" | "center" | "retreat">> = {},
): TalkListItem {
  return fromNestedRow({
    ...row,
    teacher: row.teacherName
      ? {
          name: row.teacherName,
          slug: row.teacherSlug ?? null,
          profileImageUrl: row.teacherProfileImageUrl ?? null,
        }
      : defaults.teacher ?? null,
    center: row.centerName
      ? { name: row.centerName, slug: row.centerSlug ?? null }
      : defaults.center ?? null,
    retreat: row.retreatTitle
      ? { title: row.retreatTitle, slug: row.retreatSlug ?? null }
      : defaults.retreat ?? null,
  });
}

export function toPlayerTalk(talk: TalkListItem): PlayerTalk {
  return {
    id: talk.id,
    slug: talk.slug,
    title: talk.title,
    duration: talk.duration,
    audioUrl: talk.audioUrl,
    teacher: talk.teacher?.name ?? null,
    teacherSlug: talk.teacher?.slug ?? null,
    artworkUrl: talk.teacher?.profileImageUrl ?? null,
    centerName: talk.center?.name ?? null,
    centerSlug: talk.center?.slug ?? null,
    retreatTitle: talk.retreat?.title ?? null,
    retreatSlug: talk.retreat?.slug ?? null,
  };
}
