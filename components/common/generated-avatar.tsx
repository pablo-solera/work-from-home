type GeneratedAvatarProps = {
  name: string;
  className?: string;
};

const AVATAR_TONES = [
  "bg-indigo-700",
  "bg-emerald-700",
  "bg-sky-700",
  "bg-violet-700",
  "bg-rose-700",
  "bg-amber-700",
  "bg-teal-700",
  "bg-fuchsia-700",
  "bg-zinc-700",
] as const;

export function getUserInitials(name: string) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "?";
}

function getAvatarTone(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function GeneratedAvatar({ name, className = "size-10 text-sm" }: GeneratedAvatarProps) {
  return (
    <div aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${getAvatarTone(name)} ${className}`}>
      {getUserInitials(name)}
    </div>
  );
}
