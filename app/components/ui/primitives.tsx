import { Form, Link, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "~/lib/cn";

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
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper-sunken font-serif text-ink-soft ring-1 ring-line",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
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
          className="absolute inset-0 size-full object-cover saturate-[.8]"
        />
      ) : null}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("relative pb-6 pt-8 md:pb-8 md:pt-14", className)}>
      {eyebrow ? (
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-accent-ink">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-balance font-serif text-4xl font-normal leading-[1.05] tracking-tight md:text-6xl">
        {title}
      </h1>
      {description ? (
        <div className="mt-3 max-w-2xl text-pretty text-base text-ink-soft md:text-lg">
          {description}
        </div>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </header>
  );
}

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
        <h2 className="font-serif text-2xl tracking-tight md:text-[1.75rem]">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-1 text-sm text-ink-soft transition-colors hover:text-ink"
    >
      {children}
      <ArrowRight
        size={14}
        className="transition-transform duration-200 ease-calm group-hover:translate-x-0.5"
      />
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
  const sort = params.get("sort");
  const order = params.get("order");

  return (
    <Form method="get" action={action} role="search" className={cn("relative", className)}>
      <Search
        size={18}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
      />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        key={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="search"
        className="h-12 w-full rounded-full border border-line bg-paper-raised pl-11 pr-4 text-ink shadow-soft outline-none transition-[border-color,box-shadow] placeholder:text-ink-faint focus:border-line-strong focus:shadow-[0_0_0_4px_var(--accent-wash)]"
      />
      {sort && !action ? <input type="hidden" name="sort" value={sort} /> : null}
      {order && !action ? <input type="hidden" name="order" value={order} /> : null}
    </Form>
  );
}

export type SortOption = { field: string; label: string; defaultOrder?: "asc" | "desc" };

export function SortTabs({
  options,
  current,
  order,
}: {
  options: SortOption[];
  current: string;
  order: string;
}) {
  const [params] = useSearchParams();

  return (
    <nav aria-label="Sort" className="flex items-center gap-1 overflow-x-auto scrollbar-none">
      {options.map((option) => {
        const active = option.field === current;
        const next = new URLSearchParams(params);
        next.set("sort", option.field);
        next.set(
          "order",
          active ? (order === "asc" ? "desc" : "asc") : option.defaultOrder ?? "desc",
        );
        next.delete("page");

        return (
          <Link
            key={option.field}
            to={`?${next}`}
            preventScrollReset
            aria-current={active ? "true" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-sm transition-colors",
              active
                ? "bg-ink text-paper"
                : "text-ink-soft hover:bg-paper-sunken hover:text-ink",
            )}
          >
            {option.label}
            {active ? (
              <span aria-hidden className="text-xs opacity-70">
                {order === "asc" ? "↑" : "↓"}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
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
    "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm transition-colors hover:bg-paper-sunken aria-disabled:pointer-events-none aria-disabled:opacity-30";

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex items-center justify-between border-t border-line pt-5"
    >
      <Link
        to={hrefFor(current - 1)}
        aria-disabled={current <= 1}
        tabIndex={current <= 1 ? -1 : undefined}
        className={linkClass}
      >
        <ArrowLeft size={16} /> Previous
      </Link>
      <span className="text-sm tabular-nums text-ink-faint">
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
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line-strong px-6 py-14 text-center">
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent-wash text-accent-ink">
          {icon}
        </div>
      ) : null}
      <h3 className="font-serif text-xl">{title}</h3>
      {children ? <p className="mt-2 max-w-sm text-sm text-ink-soft">{children}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      {...props}
      className={cn(buttonClass(variant), className)}
    />
  );
}

export function buttonClass(variant: "primary" | "secondary" | "ghost" = "primary") {
  return cn(
    "inline-flex h-11 select-none items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-[background-color,transform,opacity] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    variant === "primary" && "bg-ink text-paper hover:bg-ink/90",
    variant === "secondary" &&
      "border border-line-strong bg-paper-raised text-ink hover:bg-paper-sunken",
    variant === "ghost" && "text-ink-soft hover:bg-paper-sunken hover:text-ink",
  );
}
