function PageHeaderRoot({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function PageHeaderEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-zinc-500">{children}</p>;
}

function PageHeaderTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="mt-1 text-3xl font-semibold text-zinc-950">{children}</h1>;
}

function PageHeaderDescription({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 max-w-2xl text-sm text-zinc-600">{children}</p>;
}

export const PageHeader = Object.assign(PageHeaderRoot, {
  Description: PageHeaderDescription,
  Eyebrow: PageHeaderEyebrow,
  Title: PageHeaderTitle,
});
