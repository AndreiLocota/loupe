import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Discreet, opt-in explanation of what the underlying renderer does versus
 * what this particular app adds on top. No access flow, no promises.
 */
export function BuiltWithLoupe({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(
          "rounded-sm text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        Built with Loupe
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Built with Loupe</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            How this page is put together.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
          <p>
            Loupe renders the document itself. Everything to do with the page — laying out and
            drawing each page, searching the text and stepping between matches, selecting text,
            zooming, moving between pages, page thumbnails, and the geometry that says where a piece
            of text sits — comes from it. It has no interface of its own.
          </p>
          <p>
            Everything around the document was built for this app: the single-screen layout, reading
            the file&apos;s stored details and any retained evidence, the timeline, the comment
            callouts, and the review marks and their export. The callouts simply display comments
            that are already saved inside your Word file, placed using Loupe&apos;s geometry. The
            review marks are new notes you add here and are kept only in this browser session until
            you export them. Neither one is written back into your Word file, which is never
            modified.
          </p>

          <p>
            Loupe reads other document formats through separate adapters, but this particular demo
            accepts supported Word files only.
          </p>
          <p>
            Raw comments and stored properties stay readable and copyable in the findings panel.
            Developer access to Loupe is not publicly available yet.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
