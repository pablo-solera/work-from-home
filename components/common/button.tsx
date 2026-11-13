type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "md" | "sm" | "icon";

const base = "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-zinc-950 text-white hover:bg-zinc-800",
  secondary: "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
  danger: "bg-red-700 text-white hover:bg-red-800",
  success: "bg-emerald-700 text-white hover:bg-emerald-800",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 py-2 text-sm",
  sm: "min-h-9 px-3 py-1.5 text-sm",
  icon: "size-11",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();
}

export function Button({ variant, size, className, type = "button", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClasses(variant, size, className)} type={type} {...props} />;
}
