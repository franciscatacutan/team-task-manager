export default function ArchiveBadge({ archived }: { archived: boolean }) {
  if (!archived) return null;
  return (
    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
      Archived
    </span>
  );
}
