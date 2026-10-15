interface MockDataNoteProps {
  children: string;
}

export function MockDataNote({ children }: MockDataNoteProps) {
  return (
    <p
      role="note"
      className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-muted"
    >
      {children}
    </p>
  );
}
