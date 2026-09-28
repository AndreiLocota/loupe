import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy alias: the interactive experience now lives at /. */
export const Route = createFileRoute("/try")({
  beforeLoad: () => {
    throw redirect({ to: "/", statusCode: 301 });
  },
});
