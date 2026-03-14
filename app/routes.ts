import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("talks", "routes/talks.tsx"),
  route("talks/:slug", "routes/talks_.$slug.tsx"),
  route("teachers", "routes/teachers.tsx"),
  route("teachers/:slug", "routes/teachers_.$slug.tsx"),
  route("centers", "routes/centers.tsx"),
  route("centers/:slug", "routes/centers_.$slug.tsx"),
  route("retreats", "routes/retreats.tsx"),
  route("retreats/:slug", "routes/retreats_.$slug.tsx"),
  route("api/event", "routes/api.event.ts"),
  route("robots.txt", "routes/[robots.txt].tsx"),
  route("sitemap.xml", "routes/[sitemap.xml].tsx"),
  route("site.webmanifest", "routes/[site.webmanifest].ts"),
  route("js/script.js", "routes/js.[script.js].ts"),
] satisfies RouteConfig;
