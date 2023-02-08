import { z } from "zod";

const RetreatRSSItemValidator = z.object({
  title: z.string(),
  link: z.string(),
  pubDate: z.string(),
  enclosure: z.object({
    length: z.string(),
    type: z.string(),
    url: z.string(),
  }),
  content: z.string(),
  contentSnippet: z.string(),
  guid: z.string(),
  isoDate: z.string(),
  itunes: z.object({
    author: z.string(),
    subtitle: z.string(),
    summary: z.string(),
    explicit: z.string(),
    duration: z.string(),
  }),
});

export const RetreatRSSFeedValidator = z.object({
  items: z.array(RetreatRSSItemValidator),
  feedUrl: z.string(),
  image: z.object({ link: z.string(), url: z.string(), title: z.string() }),
  paginationLinks: z.object({ self: z.string() }),
  title: z.string(),
  description: z.string(),
  link: z.string(),
  language: z.string(),
  copyright: z.string(),
  lastBuildDate: z.string(),
  itunes: z.object({
    owner: z.object({ name: z.string(), email: z.string() }),
    image: z.string(),
    categories: z.array(z.string()),
    categoriesWithSubs: z.array(
      z.object({
        name: z.string(),
        subs: z.array(z.object({ name: z.string() })),
      })
    ),
    keywords: z.array(z.string()),
    author: z.string(),
    summary: z.string(),
    explicit: z.string(),
  }),
});

export type RetreatRSSFeed = z.infer<typeof RetreatRSSFeedValidator>;
