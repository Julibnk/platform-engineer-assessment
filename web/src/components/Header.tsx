export function Header() {
  return (
    <header className="border-b bg-background px-6 py-4">
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="Octane11" width={120} height={32} className="h-8 w-auto" />
        <span className="text-sm text-muted-foreground">Campaign Analytics</span>
      </div>
    </header>
  );
}
