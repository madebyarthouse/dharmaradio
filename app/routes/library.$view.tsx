import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Bookmark, Clock3, Heart, History } from "lucide-react";
import { useLibraryTalks, type LibraryView } from "~/hooks/use-library-talks";
import { noindex, shellHeaders } from "~/lib/shell-route";
import { formatCount } from "~/lib/format";
import { TalkList } from "~/components/talk-row";
import { ListSkeleton, RequireAccount } from "~/components/library-ui";
import { EmptyState, PageHeader, Pagination, buttonClass } from "~/components/ui/primitives";

const VIEWS: Record<
  LibraryView,
  { title: string; eyebrow: string; empty: string; emptyBody: string; icon: React.ReactNode }
> = {
  "in-progress": {
    title: "Continue listening",
    eyebrow: "In progress",
    empty: "Nothing in progress",
    emptyBody: "Talks you start will wait here, right where you paused.",
    icon: <Clock3 size={20} />,
  },
  saved: {
    title: "Saved for later",
    eyebrow: "Saved",
    empty: "Nothing saved yet",
    emptyBody: "Tap the bookmark on any talk to keep it here for later.",
    icon: <Bookmark size={20} />,
  },
  liked: {
    title: "Talks you love",
    eyebrow: "Liked",
    empty: "No liked talks yet",
    emptyBody: "Use the heart to remember the talks that stayed with you.",
    icon: <Heart size={20} />,
  },
  history: {
    title: "Listening history",
    eyebrow: "History",
    empty: "No history yet",
    emptyBody: "Everything you listen to appears here, newest first.",
    icon: <History size={20} />,
  },
};

const isView = (value: string | undefined): value is LibraryView =>
  Boolean(value && value in VIEWS);

export function loader({ params }: LoaderFunctionArgs) {
  if (!isView(params.view)) throw new Response("Not Found", { status: 404 });
  return null;
}

export const meta: MetaFunction = ({ params }) => [
  { title: `${isView(params.view) ? VIEWS[params.view].title : "Library"} — Dharma Radio` },
  noindex,
];
export const headers = shellHeaders;

export default function LibraryViewPage() {
  const { view } = useParams();
  const config = VIEWS[view as LibraryView];

  return (
    <div className="animate-rise">
      <Link
        to="/library"
        className="-ml-2 mt-6 inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-sm text-ink-soft hover:text-ink"
      >
        <ArrowLeft size={16} /> Library
      </Link>
      <PageHeader eyebrow={config.eyebrow} title={config.title} className="pt-2 md:pt-4" />
      <RequireAccount>
        <ViewList view={view as LibraryView} />
      </RequireAccount>
    </div>
  );
}

function ViewList({ view }: { view: LibraryView }) {
  const [params] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const state = useLibraryTalks(view, page);
  const config = VIEWS[view];

  if (state.status === "error") {
    return (
      <EmptyState title="Couldn’t load your library" action={<button className={buttonClass("secondary")} onClick={() => window.location.reload()}>Try again</button>}>
        Check your connection and try again.
      </EmptyState>
    );
  }
  if (state.status !== "ready") return <ListSkeleton />;

  if (state.talks.length === 0) {
    return (
      <EmptyState
        icon={config.icon}
        title={config.empty}
        action={
          <Link to="/talks" className={buttonClass("primary")}>
            Browse talks
          </Link>
        }
      >
        {config.emptyBody}
      </EmptyState>
    );
  }

  return (
    <>
      <p className="mb-2 text-sm text-ink-faint">{formatCount(state.total, "talk")}</p>
      <TalkList talks={state.talks} />
      <Pagination current={state.page} pages={state.totalPages} />
    </>
  );
}
