import { CSSProperties } from "react";
import { MapPin, BriefcaseBusiness } from "lucide-react";
import RichTextContent from "@/components/RichTextContent";
import { HiringPage, PublicHiringPage } from "@/lib/hiring";

export default function HiringPagePreview({
  page,
  companyName,
}: {
  page: HiringPage | PublicHiringPage;
  companyName: string;
}) {
  return (
    <section
      className="hiring-job"
      style={{ "--hiring-accent": page.accentColor } as CSSProperties}
    >
      <header>
        <span className="hiring-company">{companyName}</span>
        <p>Careers</p>
        <h1>{page.title || "Your job title"}</h1>
        <div className="hiring-job-meta">
          <span>
            <BriefcaseBusiness size={16} />
            {page.employmentType}
          </span>
          <span>
            <MapPin size={16} />
            {[page.location, page.workMode].filter(Boolean).join(" · ")}
          </span>
        </div>
        {page.introduction && (
          <p className="hiring-intro">{page.introduction}</p>
        )}
      </header>
      <div className="hiring-job-description">
        <h2>About the role</h2>
        <RichTextContent
          value={
            page.description ||
            "Add the role, responsibilities and what you’re looking for."
          }
        />
      </div>
    </section>
  );
}
