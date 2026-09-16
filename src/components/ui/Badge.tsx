import clsx from "clsx";

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={clsx("badge", className ?? "bg-gray-100 text-gray-700")}>{children}</span>;
}
