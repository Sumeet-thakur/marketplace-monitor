import { notFound } from "next/navigation";
import Link from "next/link";
import { listingRepo, listingEventRepo } from "@/lib/repositories";
import StatusBadge from "@/components/StatusBadge";
import { formatPrice, formatMileage, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = listingRepo.findById(id);
  if (!listing) notFound();

  const events = listingEventRepo.findByListingId(id);

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/listings" className="text-sm text-text-muted hover:text-text">
        ← Back to listings
      </Link>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <img
          src={listing.imageUrl ?? "https://placehold.co/900x360/161d28/5c6779?text=No+image"}
          alt=""
          className="w-full h-64 object-cover bg-surface-2"
        />
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight">{listing.title}</h1>
              <p className="text-sm text-text-muted mt-1">
                {listing.source} · {listing.location ?? "Unknown location"}
              </p>
            </div>
            <StatusBadge status={listing.status} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Price" value={formatPrice(listing.price, listing.currency)} mono />
            <Field label="Year" value={listing.year ? String(listing.year) : "—"} mono />
            <Field label="Mileage" value={formatMileage(listing.mileage)} mono />
            <Field label="Seller" value={`${listing.sellerName ?? "—"}${listing.sellerType ? ` (${listing.sellerType})` : ""}`} />
          </div>

          {listing.description && (
            <div>
              <div className="text-xs text-text-muted mb-1">Description</div>
              <p className="text-sm text-text leading-relaxed">{listing.description}</p>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-text-dim pt-2 border-t border-border-soft">
            <span>First seen {formatDateTime(listing.firstSeenAt)}</span>
            <span>Last seen {formatDateTime(listing.lastSeenAt)}</span>
            {listing.listingUrl && (
              <a href={listing.listingUrl} target="_blank" rel="noreferrer" className="text-signal-info hover:underline ml-auto">
                View original listing ↗
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-soft">
          <h2 className="text-sm font-medium">Change history</h2>
        </div>
        <ol className="divide-y divide-border-soft">
          {events.map((event) => (
            <li key={event.id} className="px-4 py-3 flex items-start gap-3">
              <span className="font-mono text-xs text-text-dim shrink-0 w-16">
                {new Date(event.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </span>
              <div className="min-w-0">
                <span className="text-sm">{event.message}</span>
                <div className="text-xs text-text-dim">{event.type.replace(/_/g, " ").toLowerCase()}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-surface-2 border border-border-soft rounded-lg px-3 py-2">
      <div className="text-xs text-text-dim mb-0.5">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
