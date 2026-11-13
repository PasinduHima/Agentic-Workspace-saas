import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="topo-bg flex flex-col items-center px-6 pt-24 pb-28 text-center sm:pt-32">
        <p className="flex items-center gap-2.5 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
          <span aria-hidden className="size-1.5 rotate-45 bg-primary" />
          Early Access
        </p>

        <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl md:text-7xl">
          An <span className="text-primary">outpost</span> for whatever
          you&apos;re building
        </h1>

        <p className="mt-6 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
          Docs and canvases in one workspace, with an AI agent that draws and
          writes alongside you and your team, live.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-11 px-5 text-base">
            <Link href="/sign-up">Start building free</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-11 px-5 text-base"
          >
            <Link href="#how-it-works">See how it works</Link>
          </Button>
        </div>

        {/* survey-frame sits on the wrapper: the card's overflow-hidden would clip the marks. */}
        <div className="survey-frame scroll-tilt mt-28 w-full max-w-5xl">
          <div className="overflow-hidden rounded-xl border bg-card shadow-2xl shadow-black/50">
            <video
              className="block aspect-video w-full object-cover"
              poster="/videos/hero-poster.jpg"
              width={1600}
              height={900}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="Outpost product demo"
            >
              <source src="/videos/hero.webm" type="video/webm" />
              <source src="/videos/hero.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </section>
    </main>
  );
}
