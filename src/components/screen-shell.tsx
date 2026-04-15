type ScreenShellProps = {
  title: string;
  description: string;
};

export function ScreenShell({ title, description }: ScreenShellProps) {
  return (
    <section className="screen-shell">
      <header className="screen-header">
        <p className="screen-eyebrow">Dashboard Screen</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>

      <div className="screen-body">
        <p>Phase 1 shell is ready for this route.</p>
      </div>
    </section>
  );
}
