import { Form, Link, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Children, isValidElement, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { config } from "~/config";
import { cn } from "~/lib/cn";

/*
 * Type hierarchy, used everywhere:
 *   title      Newsreader, upright, tight
 *   supporting Geist Mono 14-15px, ink-soft
 *   meta       Geist Mono 12px, ink-faint, tabular
 */
export const metaClass = "text-xs leading-5 tabular-nums text-ink-faint";

export function Avatar({
  src,
  name,
  size = 40,
  className,
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper-sunken font-mono text-ink-faint ring-1 ring-inset ring-line",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.3) }}
    >
      {initials}
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          width={size}
          height={size}
          className="absolute inset-0 size-full object-cover saturate-[.85]"
        />
      ) : null}
    </span>
  );
}

export function PageHeader({
  breadcrumbs,
  title,
  description,
  children,
  className,
}: {
  /** Where this page sits, in place of a label above the title. */
  breadcrumbs?: Crumb[];
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("relative pb-6 pt-7 md:pb-8 md:pt-12", className)}>
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <h1 className={titleClass}>{title}</h1>
      {description ? (
        <div className="mt-3 max-w-[60ch] text-pretty text-sm leading-relaxed text-ink-soft md:text-[0.9375rem]">
          {description}
        </div>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </header>
  );
}

export const titleClass =
  "text-balance font-serif text-[2.375rem] font-normal leading-[1.04] tracking-[-0.02em] md:text-[3.25rem]";

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("py-6 md:py-8", className)}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-[1.5rem] leading-tight tracking-[-0.01em] md:text-[1.75rem]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group mb-5 inline-flex items-center gap-1.5 text-[0.8125rem] text-ink-faint transition-colors hover:text-ink"
    >
      <ArrowLeft size={14} className="transition-transform duration-200 ease-out group-hover:-translate-x-0.5" />
      {children}
    </Link>
  );
}

export type Crumb = { label: string; to: string };

/**
 * Where a page sits: each step up is a link, the page itself is the last step.
 * Long names truncate; on small screens far ancestors fold into an ellipsis.
 * Indexable pages also describe the trail to search engines as a BreadcrumbList.
 */
export function Breadcrumbs({
  items,
  className,
  structuredData = true,
}: {
  items: Crumb[];
  className?: string;
  structuredData?: boolean;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: new URL(item.to, config.productionUrl).href,
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className={cn("mb-5 min-w-0", className)}>
      {structuredData ? (
        <script
          type="application/ld+json"
          // JSON-LD inside HTML: escape "<" so a title can never close the script.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      ) : null}
      <ol className="flex min-w-0 items-center gap-1 text-[0.8125rem] text-ink-faint">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          const parent = i === items.length - 2;
          return (
            <li
              key={item.to}
              className={cn(
                "flex min-w-0 items-center gap-1",
                !last && !parent && "max-sm:hidden",
                last ? "shrink" : "shrink-0",
              )}
            >
              {last ? (
                <span aria-current="page" className="block truncate text-ink-soft">
                  {item.label}
                </span>
              ) : (
                <>
                  {parent && i > 0 ? (
                    <span aria-hidden className="sm:hidden">
                      …
                      <ChevronRight size={13} className="ml-1 inline opacity-60" />
                    </span>
                  ) : null}
                  <Link to={item.to} className="block max-w-[14rem] truncate rounded-sm transition-colors hover:text-ink">
                    {item.label}
                  </Link>
                  <ChevronRight size={13} aria-hidden className="shrink-0 opacity-60" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * A horizontal shelf: native scroll with snap, keyboard-focusable, edges that fade
 * where there is more, quiet arrow buttons on wider screens, and items that arrive
 * one after another.
 */
export function Shelf({
  title,
  action,
  children,
  label,
  className,
  listClassName,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** Accessible name for the scroll region. */
  label: string;
  className?: string;
  listClassName?: string;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft >= max - 2 });
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const page = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };

  const arrow =
    "press inline-flex size-9 items-center justify-center rounded-full text-ink-soft ring-1 ring-inset ring-line hover:bg-paper-sunken hover:text-ink disabled:pointer-events-none disabled:opacity-30";

  return (
    <section className={cn("py-6 md:py-8", className)}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-serif text-[1.5rem] leading-tight tracking-[-0.01em] md:text-[1.75rem]">{title}</h2>
        <div className="flex items-center gap-3">
          {action}
          <div className="hidden gap-1.5 md:flex">
            <button type="button" onClick={() => page(-1)} disabled={edges.start} aria-label="Scroll back" className={arrow}>
              <ChevronLeft size={17} />
            </button>
            <button type="button" onClick={() => page(1)} disabled={edges.end} aria-label="Scroll forward" className={arrow}>
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </div>
      <div className="relative">
        <ul
          ref={ref}
          onScroll={measure}
          aria-label={label}
          // A scrollable region must be reachable by keyboard so arrow keys can scroll it.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className={cn(
            "bleed-shell flex snap-x snap-mandatory items-start gap-4 overflow-x-auto pb-3 pt-1 outline-none scrollbar-none focus-visible:shadow-[inset_0_0_0_2px_var(--accent)]",
            listClassName,
          )}
        >
          {Children.map(children, (child, i) =>
            isValidElement(child) ? (
              <li className="stagger shrink-0 snap-start" style={{ "--i": i } as React.CSSProperties}>
                {child}
              </li>
            ) : null,
          )}
        </ul>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 -left-5 w-8 bg-gradient-to-r from-paper to-transparent transition-opacity duration-200 sm:-left-8 lg:-left-12 lg:w-12",
            edges.start ? "opacity-0" : "opacity-100",
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 -right-5 w-8 bg-gradient-to-l from-paper to-transparent transition-opacity duration-200 sm:-right-8 lg:-right-12 lg:w-12",
            edges.end ? "opacity-0" : "opacity-100",
          )}
        />
      </div>
    </section>
  );
}

/** An on/off choice: a native button with switch semantics and a sliding thumb. */
export function Switch({
  checked,
  onChange,
  label,
  labelledBy,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  labelledBy?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 ease-out",
        checked ? "bg-accent" : "bg-paper-sunken ring-1 ring-inset ring-line-strong",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-1 size-5 rounded-full shadow-soft transition-[translate,background-color] duration-200 ease-out",
          checked ? "translate-x-5 bg-on-accent" : "bg-ink-faint",
        )}
      />
    </button>
  );
}

/** Facts about a page, set apart by space rather than separators. */
export function MetaList({ items, className }: { items: ReactNode[]; className?: string }) {
  const shown = items.filter((item) => item !== null && item !== undefined && item !== false && item !== "");
  return (
    <p className={cn("flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] tabular-nums text-ink-soft", className)}>
      {shown.map((item, i) => (
        <span key={i}>{item}</span>
      ))}
    </p>
  );
}

export function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group inline-flex shrink-0 items-center gap-1 text-[0.8125rem] text-ink-soft transition-colors hover:text-ink"
    >
      {children}
      <ArrowRight size={14} className="transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
    </Link>
  );
}

/** GET form so search works without JS and results stay edge-cacheable by URL. */
export function SearchField({
  placeholder,
  defaultValue,
  className,
  action,
}: {
  placeholder: string;
  defaultValue?: string;
  className?: string;
  /** Submit to another route, e.g. the home page searching /talks. */
  action?: string;
}) {
  const [params] = useSearchParams();

  return (
    <Form method="get" action={action} role="search" className={cn("relative", className)}>
      <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        key={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="search"
        className="h-12 w-full rounded-full bg-paper-sunken pl-11 pr-4 text-[0.9375rem] text-ink outline-none ring-1 ring-inset ring-transparent transition-[box-shadow,background-color] duration-150 placeholder:text-ink-faint focus:bg-paper-raised focus:ring-line-strong"
      />
      {action
        ? null
        : (["sort", "order", "kind", "length"] as const).map((key) => {
            const value = params.get(key);
            return value ? <input key={key} type="hidden" name={key} value={value} /> : null;
          })}
    </Form>
  );
}

export type SortOption = { field: string; label: string; defaultOrder?: "asc" | "desc" };

export function SortTabs({ options, current, order }: { options: SortOption[]; current: string; order: string }) {
  const [params] = useSearchParams();

  return (
    <nav aria-label="Sort" className="flex items-center gap-1 overflow-x-auto scrollbar-none">
      {options.map((option) => {
        const active = option.field === current;
        const next = new URLSearchParams(params);
        next.set("sort", option.field);
        next.set("order", active ? (order === "asc" ? "desc" : "asc") : option.defaultOrder ?? "desc");
        next.delete("page");

        return (
          <Link
            key={option.field}
            to={`?${next}`}
            preventScrollReset
            aria-current={active ? "true" : undefined}
            className={cn(
              "press inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[0.8125rem]",
              active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-sunken hover:text-ink",
            )}
          >
            {option.label}
            {active ? (
              <span aria-hidden className="text-[0.6875rem] opacity-70">
                {order === "asc" ? "↑" : "↓"}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** A sticky bar under the top bar, for sort controls above a long list. */
export function ListBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "bleed-shell sticky top-[var(--bar-h)] z-20 mb-2 flex items-center justify-between gap-4 border-b border-line bg-paper/90 py-2 backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Pagination({ current, pages }: { current: number; pages: number }) {
  const [params] = useSearchParams();
  if (pages <= 1) return null;

  const hrefFor = (page: number) => {
    const next = new URLSearchParams(params);
    if (page <= 1) next.delete("page");
    else next.set("page", String(page));
    const qs = next.toString();
    return qs ? `?${qs}` : ".";
  };

  const linkClass =
    "press inline-flex h-10 items-center gap-2 rounded-full px-4 text-[0.8125rem] hover:bg-paper-sunken aria-disabled:pointer-events-none aria-disabled:opacity-30";

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-between border-t border-line pt-5">
      <Link to={hrefFor(current - 1)} aria-disabled={current <= 1} tabIndex={current <= 1 ? -1 : undefined} className={linkClass}>
        <ArrowLeft size={16} /> Previous
      </Link>
      <span className="text-xs tabular-nums text-ink-faint">
        Page {current} of {pages.toLocaleString("en-US")}
      </span>
      <Link
        to={hrefFor(current + 1)}
        aria-disabled={current >= pages}
        tabIndex={current >= pages ? -1 : undefined}
        className={linkClass}
      >
        Next <ArrowRight size={16} />
      </Link>
    </nav>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center border-y border-line px-6 py-14 text-center">
      {icon ? <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-paper-sunken text-ink-soft">{icon}</div> : null}
      <h3 className="font-serif text-[1.375rem] leading-tight">{title}</h3>
      {children ? <p className="mt-2 max-w-sm text-[0.8125rem] leading-relaxed text-ink-soft">{children}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "accent";
}) {
  return <button {...props} className={cn(buttonClass(variant), className)} />;
}

export function buttonClass(variant: "primary" | "secondary" | "ghost" | "accent" = "primary") {
  return cn(
    "press inline-flex h-11 select-none items-center justify-center gap-2 rounded-full px-5 text-[0.8125rem] font-medium disabled:pointer-events-none disabled:opacity-50",
    variant === "primary" && "bg-ink text-paper hover:bg-ink/88",
    variant === "accent" && "bg-accent text-on-accent hover:bg-accent/90",
    variant === "secondary" && "bg-paper-raised text-ink ring-1 ring-inset ring-line-strong hover:bg-paper-sunken",
    variant === "ghost" && "text-ink-soft hover:bg-paper-sunken hover:text-ink",
  );
}

/**
 * Native radios dressed as a soft pill track: arrow keys, forms and screen
 * readers for free. The checked option is lifted onto raised paper.
 */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  className?: string;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-full bg-paper-sunken p-1", className)}>
      {options.map((option) => (
        <label key={option.value} className="relative flex-auto" title={option.title}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="peer absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
          />
          <span
            className={cn(
              "pointer-events-none flex h-8 min-w-10 items-center justify-center whitespace-nowrap rounded-full px-2.5 text-[0.8125rem] tabular-nums transition-[background-color,color,box-shadow] duration-150",
              "peer-focus-visible:shadow-[0_0_0_2px_var(--paper),0_0_0_4px_var(--accent)]",
              value === option.value ? "bg-paper-raised text-ink shadow-soft" : "text-ink-faint peer-hover:text-ink",
            )}
          >
            {option.label}
          </span>
        </label>
      ))}
    </div>
  );
}

/** A removable filter, shown above a list when the URL narrows it. */
export function FilterChip({ to, children, label }: { to: string; children: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      preventScrollReset
      aria-label={label}
      className="press group inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-wash pl-3 pr-2 text-[0.8125rem] text-ink hover:bg-paper-sunken"
    >
      {children}
      <X size={14} className="text-ink-faint transition-colors group-hover:text-ink" />
    </Link>
  );
}
