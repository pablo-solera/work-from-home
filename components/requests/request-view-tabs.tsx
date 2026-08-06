import Link from "next/link";

export type RequestViewTab = {
  active: boolean;
  count?: number;
  href: string;
  label: string;
};

export function RequestViewTabs({ ariaLabel, tabs }: { ariaLabel: string; tabs: RequestViewTab[] }) {
  return (
    <nav aria-label={ariaLabel} className="border-b border-zinc-200">
      <ul className="-mb-px flex gap-6 overflow-x-auto">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link aria-current={tab.active ? "page" : undefined} className={`inline-flex cursor-pointer items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 ${tab.active ? "border-sky-700 text-sky-950" : "border-transparent text-zinc-600 hover:border-sky-200 hover:text-zinc-950"}`} href={tab.href}>
              <span>{tab.label}</span>
              {tab.count ? <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tab.active ? "bg-sky-700 text-white" : "border border-sky-200 bg-sky-50 text-sky-800"}`}>{tab.count}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
