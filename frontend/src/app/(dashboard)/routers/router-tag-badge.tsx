export function RouterTagBadge({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {tag}
    </span>
  );
}
