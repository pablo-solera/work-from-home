"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type ActiveNavLinkProps = {
  children: React.ReactNode;
  href: string;
  section?: boolean;
};

export function ActiveNavLink({ children, href, section = false }: ActiveNavLinkProps) {
  const pathname = usePathname();
  const active = section ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors md:min-h-10 ${active
        ? "bg-zinc-950 font-semibold text-white"
        : "font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"}`}
      href={href}
    >
      {children}
    </Link>
  );
}
