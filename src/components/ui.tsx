import type { ReactNode } from "react";
import type { VerificationStatus } from "@prisma/client";
import { VERIFICATION_LABEL } from "@/lib/labels";

export function Flash({
  error,
  success,
  warn,
}: {
  error?: string;
  success?: string;
  warn?: string;
}) {
  if (!error && !success && !warn) return null;
  return (
    <>
      {error ? (
        <div className="flash flash--error" role="alert">
          <span aria-hidden>!</span>
          <span>{error}</span>
        </div>
      ) : null}
      {success ? (
        <div className="flash flash--success" role="status">
          <span aria-hidden>✓</span>
          <span>{success}</span>
        </div>
      ) : null}
      {warn ? (
        <div className="flash flash--warn" role="status">
          <span aria-hidden>•</span>
          <span>{warn}</span>
        </div>
      ) : null}
    </>
  );
}

export function PageHeader({
  kicker,
  title,
  sub,
  children,
}: {
  kicker?: string;
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        {kicker ? <div className="kicker">{kicker}</div> : null}
        <h1 className="page-title">{title}</h1>
        {sub ? <p className="page-sub">{sub}</p> : null}
      </div>
      {children ? <div className="actions">{children}</div> : null}
    </header>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {hint ? <div className="stat__hint">{hint}</div> : null}
    </div>
  );
}

export function Badge({
  status,
  label,
}: {
  status: VerificationStatus | "verified" | "pending" | "failed" | "unverified" | "manual_review";
  label?: string;
}) {
  const cls =
    status === "verified"
      ? "badge--verified"
      : status === "pending"
        ? "badge--pending"
        : status === "failed"
          ? "badge--failed"
          : status === "manual_review"
            ? "badge--manual"
            : "badge--unverified";
  return <span className={`badge ${cls}`}>{label ?? VERIFICATION_LABEL[status]}</span>;
}

export function Meter({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="meter" aria-label={`Profile completeness ${clamped} of 100`}>
      <div className="meter__fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function Card({
  title,
  hint,
  action,
  children,
  flat,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  flat?: boolean;
}) {
  return (
    <section className={`card${flat ? " card--flat" : ""}`}>
      {title || action ? (
        <div className="card__head">
          <div>
            {title ? <h2 className="card__title">{title}</h2> : null}
            {hint ? <p className="card__hint">{hint}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
