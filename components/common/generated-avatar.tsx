type GeneratedAvatarProps = {
  name: string;
  className?: string;
};

export function getUserInitials(name: string) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "?";
}

export function GeneratedAvatar({ name, className = "size-10 text-sm" }: GeneratedAvatarProps) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-zinc-950 font-semibold text-white ${className}`}>
      {getUserInitials(name)}
    </div>
  );
}
