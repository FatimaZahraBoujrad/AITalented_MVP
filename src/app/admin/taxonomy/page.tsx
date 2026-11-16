import type { SkillCategory } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { CATEGORY_LABEL } from "@/lib/labels";
import { createTaxonomyAction, toggleTaxonomyAction } from "@/app/actions/admin";
import { Flash, PageHeader } from "@/components/ui";

const CATEGORIES: SkillCategory[] = ["model_type", "framework", "deployment", "data", "other"];

export default async function TaxonomyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  await requireRole("admin");
  const skills = await db.skillTaxonomy.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const usage = await db.skillClaim.groupBy({
    by: ["skillName"],
    _count: { skillName: true },
  });
  const usageMap = new Map(usage.map((u) => [u.skillName, u._count.skillName]));

  return (
    <div className="shell">
      <PageHeader
        kicker="Admin"
        title="Skill vocabulary"
        sub="Additive only in the MVP — no renames, because renames orphan claims. Deactivating keeps existing claims visible but removes the term from the builder."
      />
      <Flash error={params.error} success={params.success} />

      <div className="grid grid--2" style={{ alignItems: "start" }}>
        <section className="card">
          <h2 className="card__title">Add a skill</h2>
          <p className="card__hint">Name it the way engineers write it.</p>
          <form action={createTaxonomyAction} className="stack" style={{ gap: 12, marginTop: 12 }}>
            <div className="field">
              <label htmlFor="name">Skill name</label>
              <input id="name" className="input" name="name" required maxLength={60} placeholder="e.g. FlashAttention" />
            </div>
            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" className="input" name="category" defaultValue="framework">
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABEL[category]}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn--primary" type="submit">
              Add to vocabulary
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="card__title">Vocabulary ({skills.length})</h2>
          <p className="card__hint">Usage counts show claimed profiles per term.</p>
          <div className="stack" style={{ gap: 14, marginTop: 12 }}>
            {CATEGORIES.map((category) => {
              const group = skills.filter((s) => s.category === category);
              if (group.length === 0) return null;
              return (
                <div key={category}>
                  <div className="kicker" style={{ marginBottom: 6 }}>{CATEGORY_LABEL[category]}</div>
                  {group.map((skill) => (
                    <div className="kv" key={skill.id}>
                      <dt>
                        {skill.name}{" "}
                        <span className="faint">· {usageMap.get(skill.name) ?? 0} claim(s)</span>{" "}
                        {!skill.active ? <span className="badge badge--unverified">inactive</span> : null}
                      </dt>
                      <dd>
                        <form action={toggleTaxonomyAction}>
                          <input type="hidden" name="taxonomyId" value={skill.id} />
                          <button className="btn btn--ghost btn--sm" type="submit">
                            {skill.active ? "Deactivate" : "Reactivate"}
                          </button>
                        </form>
                      </dd>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
