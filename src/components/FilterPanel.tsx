import Link from "next/link";
import type { SkillTaxonomy } from "@prisma/client";
import type { SearchFilters } from "@/lib/search";

export function FilterPanel({
  filters,
  taxonomy,
  total,
}: {
  filters: SearchFilters;
  taxonomy: SkillTaxonomy[];
  total: number;
}) {
  const modelTypes = taxonomy.filter((t) => t.category === "model_type" && t.active);
  const frameworks = taxonomy.filter((t) => t.category === "framework" && t.active);
  const scales: { value: string; label: string }[] = [
    { value: "toy", label: "Toy" },
    { value: "coursework", label: "Coursework" },
    { value: "production", label: "Production" },
    { value: "oss", label: "Open source" },
  ];

  return (
    <form className="card filters" method="get" action="/recruiter">
      <div className="card__head">
        <div>
          <h2 className="card__title">Filters</h2>
          <p className="card__hint">{total} candidate(s) match</p>
        </div>
        <Link className="btn btn--ghost btn--sm" href="/recruiter">
          Reset
        </Link>
      </div>

      <div className="filter-group">
        <h4>Free text</h4>
        <input
          className="input"
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Headline or project result…"
          aria-label="Free text search"
        />
      </div>

      <div className="filter-group">
        <h4>Verification</h4>
        <select className="input" name="verification" defaultValue={filters.verification}>
          <option value="all">All profiles</option>
          <option value="has_verified">Has ≥1 verified claim</option>
          <option value="verified_only">Verified-only profiles</option>
        </select>
      </div>

      <div className="filter-group">
        <h4>Model types</h4>
        <div className="filter-options">
          {modelTypes.map((skill) => (
            <label className="filter-option" key={skill.id}>
              <input
                type="checkbox"
                name="modelTypes"
                value={skill.name}
                defaultChecked={filters.modelTypes.includes(skill.name)}
              />
              {skill.name}
            </label>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <h4>Frameworks</h4>
        <div className="filter-options">
          {frameworks.map((skill) => (
            <label className="filter-option" key={skill.id}>
              <input
                type="checkbox"
                name="frameworks"
                value={skill.name}
                defaultChecked={filters.frameworks.includes(skill.name)}
              />
              {skill.name}
            </label>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <h4>Deployment & data</h4>
        <div className="stack" style={{ gap: 8 }}>
          <label className="check">
            <input type="checkbox" name="deployment" value="1" defaultChecked={filters.deployment} />
            Has a verified deployment
          </label>
          <label className="check">
            <input type="checkbox" name="dataExposure" value="1" defaultChecked={filters.dataExposure} />
            Data engineering exposure
          </label>
        </div>
      </div>

      <div className="filter-group">
        <h4>Project scale (minimum)</h4>
        <select className="input" name="minScale" defaultValue={filters.minScale ?? ""}>
          <option value="">Any scale</option>
          {scales.map((scale) => (
            <option key={scale.value} value={scale.value}>
              {scale.label} or above
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <h4>Seniority</h4>
        <div className="filter-options">
          {(["junior", "mid"] as const).map((band) => (
            <label className="filter-option" key={band}>
              <input
                type="checkbox"
                name="seniority"
                value={band}
                defaultChecked={filters.seniority.includes(band)}
              />
              {band === "junior" ? "Junior" : "Mid"}
            </label>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <h4>Years of experience</h4>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            style={{ width: 74 }}
            type="number"
            name="yearsMin"
            min={0}
            max={40}
            placeholder="Min"
            defaultValue={filters.yearsMin ?? ""}
            aria-label="Minimum years"
          />
          <span className="faint">to</span>
          <input
            className="input"
            style={{ width: 74 }}
            type="number"
            name="yearsMax"
            min={0}
            max={40}
            placeholder="Max"
            defaultValue={filters.yearsMax ?? ""}
            aria-label="Maximum years"
          />
        </div>
      </div>

      <button className="btn btn--primary btn--wide" type="submit" style={{ marginTop: 14 }}>
        Apply filters
      </button>
    </form>
  );
}
