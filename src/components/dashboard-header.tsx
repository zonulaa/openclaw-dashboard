type DashboardHeaderProps = {
  title: string;
  description: string;
  label?: string;
};

export function DashboardHeader({ title, description, label = "Operations Console" }: DashboardHeaderProps) {
  return (
    <header className="screen-header">
      <p className="screen-eyebrow">{label}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}
