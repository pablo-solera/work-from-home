import packageJson from "@/package.json";

export function AppFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white px-6 py-4 text-center text-xs text-zinc-500">
      WFH App · v{packageJson.version}
    </footer>
  );
}
