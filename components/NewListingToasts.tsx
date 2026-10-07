"use client";

import { useEffect, useState } from "react";
import { OVERWATCH_EVENT, type DashboardEvent } from "./LiveStatus";

interface Toast {
  id: string;
  message: string;
}

export default function NewListingToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function handle(e: Event) {
      const event = (e as CustomEvent<DashboardEvent>).detail;
      if (event.type !== "listing.new") return;
      const title = (event.listing as { title?: string }).title ?? "New listing";
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev.slice(-3), { id, message: `New listing detected: ${title}` }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
    }
    window.addEventListener(OVERWATCH_EVENT, handle);
    return () => window.removeEventListener(OVERWATCH_EVENT, handle);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-enter bg-surface-2 border border-signal-live/30 rounded-lg px-3.5 py-2.5 shadow-xl shadow-black/40 flex items-start gap-2"
        >
          <span className="h-1.5 w-1.5 mt-1.5 rounded-full bg-signal-live pulse-dot shrink-0" />
          <span className="text-sm text-text">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
