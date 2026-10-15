interface FormMessageProps {
  tone: "error" | "success" | "info";
  children: string;
}

export function FormMessage({ tone, children }: FormMessageProps) {
  const className =
    tone === "error"
      ? "border-danger bg-danger-soft text-danger"
      : tone === "success"
        ? "border-accent bg-accent-soft text-accent"
        : "border-border bg-surface-muted text-muted";

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border px-3 py-2 text-sm ${className}`}
    >
      {children}
    </p>
  );
}
