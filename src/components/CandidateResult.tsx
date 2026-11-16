import Link from "next/link";
import type { CandidateCard } from "@/lib/search";
import { SCALE_LABEL, SENIORITY_LABEL } from "@/lib/labels";
import { addToShortlistAction } from "@/app/actions/recruiter";
import { Badge } from "./ui";

export function CandidateResult({ card, back }: { card: CandidateCard; back: string }) {
  const project = card.strongestProject;
  return (
    <article className="cand">
      <div>
        <div className="cand__name">
          <Link href={`/recruiter/candidates/${card.id}`} className="link">
            {card.fullName}
          </Link>
          <Badge status="verified" label={`${card.verifiedSkillCount} verified`} />
          {card.hasVerifiedDeployment ? <Badge status="verified" label="Deployment verified" /> : null}
        </div>
        <p className="cand__headline">{card.headline || "No headline yet"}</p>
        <div className="cand__meta">
          <span>{SENIORITY_LABEL[card.seniorityBand]}</span>
          <span>{card.yearsExperience} yrs experience</span>
          {card.location ? <span>{card.location}</span> : null}
          <span>{card.verifiedCredentialCount} verified credential(s)</span>
          <span>Updated {card.updatedAt.toLocaleDateString("en-GB")}</span>
        </div>
        {card.topSkills.length > 0 ? (
          <div className="cand__skills">
            {card.topSkills.map((skill) => (
              <span key={skill.id} className="badge badge--verified">
                {skill.skillName}
              </span>
            ))}
            {card.verifiedSkillCount > 3 ? (
              <span className="chip">+{card.verifiedSkillCount - 3} more</span>
            ) : null}
          </div>
        ) : (
          <div className="cand__skills">
            <span className="badge badge--unverified">No verified skills yet</span>
          </div>
        )}
        {project ? (
          <div className="cand__project">
            <strong>{project.title}</strong> · {SCALE_LABEL[project.projectScale]}
            {project.result ? <span> — {project.result}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="cand__side">
        <Link className="btn btn--primary btn--sm" href={`/recruiter/candidates/${card.id}`}>
          View profile
        </Link>
        <form action={addToShortlistAction}>
          <input type="hidden" name="profileId" value={card.id} />
          <input type="hidden" name="back" value={back} />
          <button className="btn btn--ghost btn--sm" type="submit">
            Shortlist
          </button>
        </form>
        <span className="score">{card.completenessScore}% complete</span>
      </div>
    </article>
  );
}
