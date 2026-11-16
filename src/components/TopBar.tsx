import Link from "next/link";
import type { ParticipationRole } from "@/components/top-bar-types";
import { logoutAction } from "@/app/actions/auth";
import { NavLinks } from "./NavLinks";

export function TopBar({
  user,
}: {
  user: { email: string; role: ParticipationRole } | null;
}) {
  const navItems =
    user?.role === "candidate"
      ? [
          { href: "/candidate", label: "Overview" },
          { href: "/candidate/profile", label: "Profile builder" },
          { href: "/candidate/preview", label: "Preview" },
          { href: "/candidate/inbox", label: "Inbox" },
          { href: "/candidate/settings", label: "Settings" },
        ]
      : user?.role === "recruiter"
        ? [
            { href: "/recruiter", label: "Search" },
            { href: "/recruiter/shortlists", label: "Shortlists" },
            { href: "/recruiter/saved-searches", label: "Saved searches" },
            { href: "/recruiter/outreach", label: "Outreach" },
            { href: "/recruiter/billing", label: "Billing" },
          ]
        : user?.role === "admin"
          ? [
              { href: "/admin", label: "Metrics" },
              { href: "/admin/verification", label: "Verification" },
              { href: "/admin/taxonomy", label: "Taxonomy" },
              { href: "/admin/recruiters", label: "Recruiters" },
              { href: "/admin/invites", label: "Invites" },
              { href: "/admin/audit", label: "Audit" },
              { href: "/admin/outbox", label: "Outbox" },
            ]
          : [];

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href={user ? `/${user.role}` : "/"} className="brand" aria-label="AITalented home">
          <span className="brand-mark">AT</span>
          <span>
            AITalented
            <small>Verified ML index</small>
          </span>
        </Link>

        {user ? <NavLinks items={navItems} /> : <nav className="nav" />}

        {user ? (
          <div className="user-chip">
            <span className="email-text">{user.email}</span>
            <span className="role-tag">{user.role}</span>
            <form action={logoutAction}>
              <button className="btn btn--ghost btn--sm" type="submit">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <div className="actions">
            <Link className="btn btn--ghost btn--sm" href="/login">
              Log in
            </Link>
            <Link className="btn btn--primary btn--sm" href="/signup">
              Build profile
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
