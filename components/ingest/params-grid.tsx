export function ParamsGrid({ params }: { params: Record<string, unknown> }) {
  const entries = Object.entries(params).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0));
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No parameters extracted.</p>;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-4">
      {entries.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2 border-b py-1">
          <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
          <dd className="font-mono text-xs">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
