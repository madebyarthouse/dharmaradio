import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { cacheHeader } from "pretty-cache-header";
import { useLoaderData, Link, useNavigate } from "react-router";
import { db } from "~/db/client.server";
import { talks, teachers, centers, retreats } from "~/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { Play, Search, BookOpen, Users, Building2, Mic2 } from "lucide-react";
import { useAudio } from "~/contexts/audio-context";
import { useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Dharma Radio - Your Archive of Wisdom" },
    {
      name: "description",
      content: "Explore thousands of dharma talks from teachers around the world",
    },
  ];
};

const cacheHeaders = {
  "Cache-Control": cacheHeader({
    maxAge: "15min",
    sMaxage: "3hours",
    staleWhileRevalidate: "1day",
  }),
};

export const headers = () => cacheHeaders;

export async function loader({ context }: LoaderFunctionArgs) {
  const database = db(context.cloudflare.env.DB);

  // Get stats
  const [talkStats] = await database
    .select({ count: count() })
    .from(talks);

  const [teacherStats] = await database
    .select({ count: count() })
    .from(teachers);

  const [centerStats] = await database
    .select({ count: count() })
    .from(centers);

  const [retreatStats] = await database
    .select({ count: count() })
    .from(retreats);

  // Fetch recent talks
  const recentTalks = await database
    .select({
      id: talks.id,
      title: talks.title,
      slug: talks.slug,
      duration: talks.duration,
      audioUrl: talks.audioUrl,
      publicationDate: talks.publicationDate,
      teacher: {
        name: teachers.name,
        slug: teachers.slug,
        profileImageUrl: teachers.profileImageUrl,
      },
    })
    .from(talks)
    .leftJoin(teachers, eq(talks.teacherId, teachers.id))
    .orderBy(desc(talks.publicationDate))
    .limit(6);

  // Fetch featured teachers (with most talks)
  const featuredTeachers = await database
    .select({
      id: teachers.id,
      name: teachers.name,
      slug: teachers.slug,
      profileImageUrl: teachers.profileImageUrl,
    })
    .from(teachers)
    .limit(8);

  return {
    stats: {
      talks: talkStats?.count ?? 0,
      teachers: teacherStats?.count ?? 0,
      centers: centerStats?.count ?? 0,
      retreats: retreatStats?.count ?? 0,
    },
    recentTalks,
    featuredTeachers,
  };
}

export default function Home() {
  const { stats, recentTalks, featuredTeachers } = useLoaderData<typeof loader>();
  const { playTalk } = useAudio();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/talks?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handlePlayTalk = (talk: typeof recentTalks[0]) => {
    playTalk({
      id: String(talk.id),
      title: talk.title,
      teacher: talk.teacher?.name,
      teacherSlug: talk.teacher?.slug,
      duration: talk.duration,
      audioUrl: talk.audioUrl,
    });
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
  };

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-12">
      {/* Hero Section with Search */}
      <section className="text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-light text-text-primary tracking-tight">
            Explore the Archive
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Discover thousands of dharma talks from teachers around the world
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
          <div className="neumorphic-card-pressed rounded-full flex items-center px-6 py-4 gap-4">
            <Search size={20} className="text-text-tertiary flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search talks, teachers, topics..."
              className="flex-1 bg-transparent border-none outline-none text-text-primary placeholder:text-text-tertiary"
            />
            <button
              type="submit"
              className="neumorphic-button px-6 py-2 rounded-full text-sm font-medium text-text-primary"
            >
              Search
            </button>
          </div>
        </form>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Link to="/talks" className="neumorphic-card rounded-2xl p-6 hover:scale-105 transition-transform">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="neumorphic-button rounded-full w-14 h-14 flex items-center justify-center">
              <Mic2 size={24} className="text-blue-500" />
            </div>
            <div>
              <div className="text-3xl font-semibold text-text-primary">{stats.talks.toLocaleString()}</div>
              <div className="text-sm text-text-secondary">Talks</div>
            </div>
          </div>
        </Link>

        <Link to="/teachers" className="neumorphic-card rounded-2xl p-6 hover:scale-105 transition-transform">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="neumorphic-button rounded-full w-14 h-14 flex items-center justify-center">
              <Users size={24} className="text-green-500" />
            </div>
            <div>
              <div className="text-3xl font-semibold text-text-primary">{stats.teachers.toLocaleString()}</div>
              <div className="text-sm text-text-secondary">Teachers</div>
            </div>
          </div>
        </Link>

        <Link to="/centers" className="neumorphic-card rounded-2xl p-6 hover:scale-105 transition-transform">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="neumorphic-button rounded-full w-14 h-14 flex items-center justify-center">
              <Building2 size={24} className="text-purple-500" />
            </div>
            <div>
              <div className="text-3xl font-semibold text-text-primary">{stats.centers.toLocaleString()}</div>
              <div className="text-sm text-text-secondary">Centers</div>
            </div>
          </div>
        </Link>

        <Link to="/retreats" className="neumorphic-card rounded-2xl p-6 hover:scale-105 transition-transform">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="neumorphic-button rounded-full w-14 h-14 flex items-center justify-center">
              <BookOpen size={24} className="text-orange-500" />
            </div>
            <div>
              <div className="text-3xl font-semibold text-text-primary">{stats.retreats.toLocaleString()}</div>
              <div className="text-sm text-text-secondary">Retreats</div>
            </div>
          </div>
        </Link>
      </section>

      {/* Recent Talks */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-text-primary">Recent Talks</h2>
          <Link to="/talks" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recentTalks.map((talk) => (
            <div key={talk.id} className="neumorphic-card rounded-2xl p-6 space-y-4 group">
              <div className="flex items-start gap-4">
                {talk.teacher?.profileImageUrl && (
                  <div
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 bg-cover bg-center flex-shrink-0"
                    style={{
                      backgroundImage: `url(${talk.teacher.profileImageUrl})`,
                      filter: "grayscale(90%) contrast(1.05)",
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <Link to={`/talks/${talk.slug}`} className="block">
                    <h3 className="font-medium text-text-primary line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {talk.title}
                    </h3>
                  </Link>
                  {talk.teacher?.name && (
                    <p className="text-sm text-text-secondary mt-1">
                      {talk.teacher.slug ? (
                        <Link to={`/teachers/${talk.teacher.slug}`} className="hover:text-text-primary">
                          {talk.teacher.name}
                        </Link>
                      ) : (
                        talk.teacher.name
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-tertiary">{formatDuration(talk.duration)}</span>
                <button
                  onClick={() => handlePlayTalk(talk)}
                  className="neumorphic-button rounded-full w-10 h-10 flex items-center justify-center text-text-primary hover:scale-110 transition-transform"
                  aria-label="Play"
                >
                  <Play size={16} fill="currentColor" className="ml-0.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Teachers */}
      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-text-primary">Featured Teachers</h2>
          <Link to="/teachers" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {featuredTeachers.map((teacher) => (
            <Link
              key={teacher.id}
              to={`/teachers/${teacher.slug}`}
              className="neumorphic-card rounded-2xl p-4 flex flex-col items-center text-center space-y-3 hover:scale-105 transition-transform"
            >
              <div
                className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 bg-cover bg-center"
                style={{
                  backgroundImage: teacher.profileImageUrl
                    ? `url(${teacher.profileImageUrl})`
                    : undefined,
                  filter: "grayscale(90%) contrast(1.05)",
                }}
              />
              <div className="text-xs font-medium text-text-primary line-clamp-2">
                {teacher.name}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
