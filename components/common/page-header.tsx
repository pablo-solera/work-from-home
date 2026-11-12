function PageHeaderRoot({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function PageHeaderTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="text-2xl font-semibold tracking-tight text-balance text-zinc-950 sm:text-3xl">{children}</h1>;
}

function PageHeaderDescription({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 max-w-2xl text-sm text-zinc-600">{children}</p>;
}

export const PageHeader = Object.assign(PageHeaderRoot, {
  Description: PageHeaderDescription,
  Title: PageHeaderTitle,
});
