interface DashboardErrorProps {
  message: string;
}

export function DashboardError({ message }: DashboardErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger"
    >
      {message}
    </div>
  );
}
