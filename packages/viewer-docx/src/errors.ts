import { createError, type ViewerError } from "@veridox-ai/loupe-core";
import {
  OoxmlDecodedImageLimitError,
  OoxmlError,
  OoxmlResourceLimitError,
} from "@silurus/ooxml/docx";

/** OoxmlError codes that mean the file needs (a different) password. */
const PASSWORD_CODES = new Set(["encrypted", "invalid-password"]);

function isViewerError(err: unknown): err is ViewerError {
  return (
    err instanceof Error &&
    typeof (err as ViewerError).code === "string" &&
    typeof (err as ViewerError).recoverable === "boolean"
  );
}

/**
 * Map an @silurus/ooxml failure onto the ViewerError vocabulary. Matching
 * falls back to `err.name` because worker-mode errors may cross the thread
 * boundary via structured clone and lose their prototype chain.
 */
export function toDocxViewerError(err: unknown): Error {
  // Abort and already-mapped errors pass through untouched.
  if (err instanceof DOMException && err.name === "AbortError") return err;
  if (isViewerError(err)) return err;

  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : String(err);

  if (
    err instanceof OoxmlResourceLimitError ||
    err instanceof OoxmlDecodedImageLimitError ||
    name === "OoxmlResourceLimitError" ||
    name === "OoxmlDecodedImageLimitError"
  ) {
    return createError("RESOURCE_EXHAUSTED", message, { format: "docx" });
  }

  const code =
    err instanceof OoxmlError
      ? err.code
      : name === "OoxmlError"
        ? (err as { code?: string }).code
        : undefined;
  if (code && PASSWORD_CODES.has(code)) {
    return createError("PASSWORD_REQUIRED", message, { format: "docx" });
  }

  return createError("DECODE_ERROR", message || "DOCX render failed", {
    format: "docx",
  });
}
