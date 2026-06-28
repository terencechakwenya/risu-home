"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Camera, FileText, Settings, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/domain/types";

interface TabItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const BASE_TABS: TabItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/add", label: "Add", icon: Camera },
  { href: "/report", label: "Report", icon: FileText },
];

// Bottom navigation. Manage is admin-only (Terence).
export function TabBar({ role }: { role: Role }) {
  const pathname = usePathname();
  const tabs =
    role === "terence"
      ? [...BASE_TABS, { href: "/manage", label: "Manage", icon: Settings }]
      : BASE_TABS;

  return (
    <nav className="no-print fixed bottom-0 inset-x-0 max-w-md mx-auto bg-white border-t border-slate-100 flex">
      {tabs.map((it) => {
        const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            data-tour={it.href === "/add" ? "add-receipt" : undefined}
            className="flex-1 py-2.5 flex flex-col items-center gap-0.5"
            style={{ color: active ? "#16365C" : "#94a3b8" }}
          >
            <Icon size={20} />
            <span className="text-[10px]">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
