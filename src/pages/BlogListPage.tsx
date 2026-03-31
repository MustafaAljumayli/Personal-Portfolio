import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Calendar, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { fetchBlogList, type BlogListResponse } from "@/lib/blog-api";

function formatDate(value: string | null, fallback: string) {
  return new Date(value ?? fallback).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<BlogListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = Number.parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const q = searchParams.get("q") ?? "";
  const year = searchParams.get("year");
  const sort = searchParams.get("sort") === "oldest" ? "oldest" : "newest";

  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchBlogList({
      page,
      pageSize: 6,
      q: q || undefined,
      year: year ? Number.parseInt(year, 10) : null,
      sort,
    })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load posts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, q, sort, year]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, idx) => current - idx);
  }, []);

  const setParams = (next: Record<string, string | null>) => {
    const merged = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (!value) merged.delete(key);
      else merged.set(key, value);
    });
    setSearchParams(merged, { replace: false });
  };

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setParams({ q: searchInput.trim() || null, page: "1" });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Mustafa's writing</p>
            <h1 className="font-display text-4xl font-bold">
              <span className="text-gradient-unc">Blog</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/privacy-policy" className="text-sm text-primary hover:underline">
              Privacy Policy
            </Link>
            <Link to="/" className="rounded-md border border-border/40 px-3 py-2 text-sm hover:bg-secondary/40">
              Back Home
            </Link>
          </div>
        </div>

        <form onSubmit={onSearchSubmit} className="mb-6 grid gap-3 rounded-xl border border-border/40 bg-card/70 p-4 md:grid-cols-12">
          <label className="relative md:col-span-6">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title or excerpt..."
              className="h-11 w-full rounded-md border border-border/40 bg-background pl-9 pr-3 text-sm outline-none ring-primary/40 focus:ring-2"
            />
          </label>
          <select
            className="h-11 rounded-md border border-border/40 bg-background px-3 text-sm md:col-span-2"
            value={sort}
            onChange={(e) => setParams({ sort: e.target.value, page: "1" })}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
          <select
            className="h-11 rounded-md border border-border/40 bg-background px-3 text-sm md:col-span-2"
            value={year ?? ""}
            onChange={(e) => setParams({ year: e.target.value || null, page: "1" })}
          >
            <option value="">All years</option>
            {yearOptions.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
          <button type="submit" className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground md:col-span-2">
            Search
          </button>
        </form>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border/30 bg-card/60 p-5 animate-pulse">
                <div className="mb-3 h-6 w-2/3 rounded bg-secondary/50" />
                <div className="h-4 w-full rounded bg-secondary/40" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="rounded-xl border border-border/30 bg-card/60 p-10 text-center text-muted-foreground">
            No posts found for this query.
          </div>
        ) : (
          <>
            <div className="mb-5 text-sm text-muted-foreground">
              Showing {data.items.length} of {data.total} posts
            </div>
            <div className="grid gap-4">
              {data.items.map((post) => (
                <article key={post.id} className="rounded-xl border border-border/40 bg-card/70 p-5 transition-colors hover:border-primary/40">
                  <div className="flex flex-col gap-4 sm:flex-row">
                    {post.cover_image_url && (
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        loading="lazy"
                        className="h-28 w-full rounded-lg border border-border/30 object-cover sm:w-48"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <Link to={`/blog/${post.slug}`} className="font-display text-2xl font-semibold hover:text-primary">
                        {post.title}
                      </Link>
                      {post.excerpt && <p className="mt-2 line-clamp-2 text-muted-foreground">{post.excerpt}</p>}
                      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {formatDate(post.published_at, post.created_at)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                disabled={page <= 1}
                onClick={() => setParams({ page: String(page - 1) })}
                className="inline-flex items-center gap-2 rounded-md border border-border/40 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {data.page} of {data.totalPages}
              </span>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setParams({ page: String(page + 1) })}
                className="inline-flex items-center gap-2 rounded-md border border-border/40 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
