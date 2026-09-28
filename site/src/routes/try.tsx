import { createFileRoute } from "@tanstack/react-router";
import { DocxExperience } from "@/components/docx/DocxExperience";
import { TryLanding } from "@/components/docx/TryLanding";

export const Route = createFileRoute("/try")({
  head: () => ({
    meta: [
      { title: "Try Loupe — Look closer at your Word documents" },
      {
        name: "description",
        content:
          "Open a DOCX or DOCM file to view it with its retained comments and tracked changes. Processing stays on your device.",
      },
      { property: "og:title", content: "Try Loupe — Look closer at your Word documents" },
      {
        property: "og:description",
        content: "View a Word document with its retained comments and tracked changes, right in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TryPage,
});

function TryPage() {
  return <DocxExperience source="try" renderLanding={(p) => <TryLanding {...p} />} />;
}
