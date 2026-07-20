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
      className={active
        ? "inline-flex cursor-pointer items-center rounded-lg bg-zinc-950 px-3 py-2 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
        : "inline-flex cursor-pointer items-center rounded-lg px-3 py-2 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"}
      href={href}
    >
      {children}
    </Link>
  );
}
