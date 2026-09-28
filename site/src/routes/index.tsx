import { createFileRoute } from "@tanstack/react-router";
import { DocxExperience } from "@/components/docx/DocxExperience";
import { TryLanding } from "@/components/docx/TryLanding";

const TITLE = "Loupe — Look closer at your documents";
const DESCRIPTION =
  "Try Loupe’s document viewer with a Word file. Everything runs in your browser — view pages, retained comments and tracked changes.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return <DocxExperience source="home" renderLanding={(p) => <TryLanding {...p} />} />;
}
