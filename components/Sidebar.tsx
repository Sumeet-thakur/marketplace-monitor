"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: GridIcon },
  { href: "/listings", label: "Listings", icon: ListIcon },
  { href: "/integrations", label: "Integrations", icon: PlugIcon },
  { href: "/health", label: "API Health", icon: PulseIcon },
  { href: "/sync", label: "Sync Activity", icon: ClockIcon },
  { href: "/logs", label: "Logs", icon: TerminalIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-surface/60 flex flex-col h-screen sticky top-0">
      <div className="px-4 py-5 flex items-center gap-2 border-b border-border-soft">
        <span className="h-2 w-2 rounded-full bg-signal-live pulse-dot" />
        <span className="font-display font-semibold tracking-tight">Overwatch</span>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-surface-3 text-text font-medium"
                  : "text-text-muted hover:text-text hover:bg-surface-2"
              }`}
            >
              <Icon active={active} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-4 border-t border-border-soft">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
        >
          <ExitIcon />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function iconProps(active?: boolean) {
  return {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: active ? "var(--signal-info)" : "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function GridIcon({ active }: { active?: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function ListIcon({ active }: { active?: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}
function PlugIcon({ active }: { active?: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <path d="M9 2v6M15 2v6M6 8h12l-1 5a5 5 0 0 1-10 0z" />
      <path d="M12 17v5" />
    </svg>
  );
}
function PulseIcon({ active }: { active?: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </svg>
  );
}
function ClockIcon({ active }: { active?: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}
function TerminalIcon({ active }: { active?: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <path d="M4 5h16v14H4z" />
      <path d="M7 9l3 3-3 3M13 15h4" />
    </svg>
  );
}
function ExitIcon() {
  return (
    <svg {...iconProps(false)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
