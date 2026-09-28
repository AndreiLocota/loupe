import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Explains what the Loupe library does versus what this Word inspector adds. */
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
            What the viewer does, and what this inspector adds.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-xs leading-relaxed text-muted-foreground">
          <p>
            <strong className="font-medium text-foreground">The Loupe viewer</strong> renders the
            document: laying out and drawing pages, search and stepping between matches, text
            selection, zoom, page navigation, thumbnails, and the geometry that says where text sits.
            It has no interface of its own.
          </p>
          <p>
            <strong className="font-medium text-foreground">This Word inspector</strong> is a demo
            application built on top: the layout, stored details, retained comments and tracked
            changes, the timeline, findings and review marks with export. These are not part of the
            library API. Review marks stay in this browser session; your Word file is never modified.
          </p>
          <p>
            This browser demo accepts Word files only. The library also handles PDF and images.
          </p>
          <Link
            to="/developers"
            onClick={() => setOpen(false)}
            className="inline-block font-medium text-primary underline-offset-4 hover:underline"
          >
            Use Loupe in your app →
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
