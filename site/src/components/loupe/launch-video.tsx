import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const SRC = "/media/loupe-launch-loop.mp4";
const POSTER = "/media/loupe-launch-poster.jpg";

export function LaunchVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const userPaused = useRef(false);
  const inView = useRef(false);
  const reduced = useRef(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    // The error may fire before hydration attaches React's handler.
    if (v.error) setFailed(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;

    const tryAuto = () => {
      if (userPaused.current || reduced.current || !inView.current || document.hidden) return;
      if (!v.paused) return;
      v.play().then(
        () => setAutoplayBlocked(false),
        () => setAutoplayBlocked(true),
      );
    };
    const stopAuto = () => {
      if (!v.paused) v.pause();
    };

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[entries.length - 1]?.isIntersecting ?? false;
        inView.current = visible;
        if (visible) tryAuto();
        else stopAuto();
      },
      { threshold: 0.4 },
    );
    io.observe(v);
    const onVis = () => (document.hidden ? stopAuto() : tryAuto());
    const onMq = () => {
      reduced.current = mq.matches;
      if (mq.matches) stopAuto();
      else tryAuto();
    };
    document.addEventListener("visibilitychange", onVis);
    mq.addEventListener("change", onMq);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      mq.removeEventListener("change", onMq);
    };
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      userPaused.current = false;
      v.play().then(
        () => setAutoplayBlocked(false),
        () => setAutoplayBlocked(true),
      );
    } else {
      userPaused.current = true;
      v.pause();
    }
  };

  return (
    <figure className="relative mx-auto w-full max-w-[360px] lg:max-w-[380px]">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-card shadow-panel">
        <video
          ref={ref}
          className="block size-full object-cover"
          src={SRC}
          poster={POSTER}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="Loupe document viewer demo"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setFailed(true)}
        >
          <img src={POSTER} alt="" />
        </video>
        {!failed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause demo video" : "Play demo video"}
            aria-pressed={playing}
            className="focus-ring absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-background/90 px-2.5 py-1.5 text-xs font-medium text-foreground backdrop-blur transition-colors hover:bg-background"
          >
            {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
            {playing ? "Pause" : "Play"}
          </button>
        ) : null}
      </div>
      <p role="status" className="sr-only">
        {autoplayBlocked && !playing ? "Autoplay was blocked. Use Play to start the video." : ""}
      </p>
      {failed ? (
        <p role="alert" className="mt-2 text-center text-xs text-muted-foreground">
          The demo video could not be loaded.
        </p>
      ) : null}
    </figure>
  );
}
