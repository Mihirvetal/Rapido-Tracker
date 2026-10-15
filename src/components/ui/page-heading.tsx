interface PageHeadingProps {
  title: string;
  description?: string;
}

export function PageHeading({ title, description }: PageHeadingProps) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="mt-1 text-sm text-muted">{description}</p>
      ) : null}
    </header>
  );
}
