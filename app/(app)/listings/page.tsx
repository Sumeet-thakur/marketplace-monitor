"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { formatPrice, formatMileage, timeAgo } from "@/lib/format";

interface Listing {
  id: string;
  source: string;
  title: string;
  price: number | null;
  currency: string | null;
  year: number | null;
  mileage: number | null;
  location: string | null;
  imageUrl: string | null;
  firstSeenAt: string;
  status: string;
}

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minYear, setMinYear] = useState("");
  const [maxYear, setMaxYear] = useState("");
  const [location, setLocation] = useState("");
  const [newOnly, setNewOnly] = useState(false);
  const [sort, setSort] = useState("newest");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (source) params.set("source", source);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (minYear) params.set("minYear", minYear);
    if (maxYear) params.set("maxYear", maxYear);
    if (location) params.set("location", location);
    if (newOnly) params.set("newOnly", "true");
    params.set("sort", sort);
    params.set("limit", "100");

    const res = await fetch(`/api/listings?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setListings(data.listings);
      setSources(data.sources);
      setTotal(data.total);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, source, minPrice, maxPrice, minYear, maxYear, location, newOnly, sort]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce text inputs
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Listings</h1>
          <p className="text-sm text-text-muted mt-0.5">{total.toLocaleString()} listings matched</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <input
          placeholder="Search title, make, model…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="col-span-2 rounded-lg bg-surface-2 border border-border px-3 py-1.5 text-sm outline-none focus:border-signal-info"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-lg bg-surface-2 border border-border px-3 py-1.5 text-sm outline-none focus:border-signal-info"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          placeholder="Min price"
          type="number"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          className="rounded-lg bg-surface-2 border border-border px-3 py-1.5 text-sm outline-none focus:border-signal-info"
        />
        <input
          placeholder="Max price"
          type="number"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          className="rounded-lg bg-surface-2 border border-border px-3 py-1.5 text-sm outline-none focus:border-signal-info"
        />
        <input
          placeholder="Min year"
          type="number"
          value={minYear}
          onChange={(e) => setMinYear(e.target.value)}
          className="rounded-lg bg-surface-2 border border-border px-3 py-1.5 text-sm outline-none focus:border-signal-info"
        />
        <input
          placeholder="Max year"
          type="number"
          value={maxYear}
          onChange={(e) => setMaxYear(e.target.value)}
          className="rounded-lg bg-surface-2 border border-border px-3 py-1.5 text-sm outline-none focus:border-signal-info"
        />
        <input
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="rounded-lg bg-surface-2 border border-border px-3 py-1.5 text-sm outline-none focus:border-signal-info"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg bg-surface-2 border border-border px-3 py-1.5 text-sm outline-none focus:border-signal-info"
        >
          <option value="newest">Sort: newest</option>
          <option value="first_seen">Sort: first seen</option>
          <option value="price_asc">Sort: price ↑</option>
          <option value="price_desc">Sort: price ↓</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-text-muted px-1">
          <input type="checkbox" checked={newOnly} onChange={(e) => setNewOnly(e.target.checked)} />
          New listings only
        </label>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-dim border-b border-border-soft">
              <th className="px-4 py-2.5 font-normal">Source</th>
              <th className="px-4 py-2.5 font-normal">Vehicle</th>
              <th className="px-4 py-2.5 font-normal text-right">Price</th>
              <th className="px-4 py-2.5 font-normal">Year</th>
              <th className="px-4 py-2.5 font-normal">Mileage</th>
              <th className="px-4 py-2.5 font-normal">Location</th>
              <th className="px-4 py-2.5 font-normal">First Seen</th>
              <th className="px-4 py-2.5 font-normal">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && listings.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                  No listings match these filters.
                </td>
              </tr>
            )}
            {!loading &&
              listings.map((listing) => (
                <tr key={listing.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-text-muted">{listing.source}</td>
                  <td className="px-4 py-2">
                    <Link href={`/listings/${listing.id}`} className="hover:text-signal-info flex items-center gap-2">
                      <img
                        src={listing.imageUrl ?? "https://placehold.co/48x36/161d28/5c6779?text=%20"}
                        alt=""
                        className="h-8 w-11 object-cover rounded bg-surface-2 shrink-0"
                      />
                      <span className="truncate max-w-xs">{listing.title}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{formatPrice(listing.price, listing.currency)}</td>
                  <td className="px-4 py-2 font-mono text-text-muted">{listing.year ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-text-muted">{formatMileage(listing.mileage)}</td>
                  <td className="px-4 py-2 text-text-muted">{listing.location ?? "—"}</td>
                  <td className="px-4 py-2 text-text-muted text-xs">{timeAgo(listing.firstSeenAt)}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={listing.status} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
