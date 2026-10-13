import { ReactNode } from "react";
import Link from "next/link";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action && <div className="page-actions">{action}</div>}</div>;
}

export function StatCard({ label, value, note, icon, href }: { label: string; value: string | number; note: string; icon: ReactNode; href?: string }) {
  const content = <><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></>;
  return href ? <Link href={href} className="stat-card stat-card-link" aria-label={`${label}: ${value}. Open details`}>{content}</Link> : <article className="stat-card">{content}</article>;
}

export function StatusPill({ value }: { value: string }) {
  return <span className={`status-pill status-${value.toLowerCase().replaceAll(" ", "-")}`}>{value}</span>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><div className="empty-orbit" /><h3>{title}</h3><p>{description}</p></div>;
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="error-banner">{message}</div>;
}
