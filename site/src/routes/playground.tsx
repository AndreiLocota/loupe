import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";

const Playground = lazy(() =>
  import("@/lib/map-polyfill").then((module) => {
    module.installMapPolyfills();
    return import("@/components/playground/Playground");
  }),
);
export const Route = createFileRoute("/playground")({
  head: () => ({
    meta: [
      { title: "Loupe Playground — Different files. One familiar viewer." },
      {
        name: "description",
        content:
          "Explore Word, layered PDFs and multi-page scans in one browser-based document viewer. Try real search, layers, annotations and geometry.",
      },
      { property: "og:title", content: "Loupe Playground — Different files. One familiar viewer." },
      { property: "og:description", content: "Explore Word, layered PDFs and multi-page scans in one browser-based document viewer. Try real search, layers, annotations and geometry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlaygroundRoute,
});
function PlaygroundRoute() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  return ready ? (
    <Suspense fallback={<div className="p-10">Opening the playground…</div>}>
      <Playground />
    </Suspense>
  ) : (
    <div className="p-10">Opening the playground…</div>
  );
}
