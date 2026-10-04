import { existsSync } from "node:fs";
import { join } from "node:path";
import { StructuredData } from "@/components/seo/StructuredData";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { CapabilityMarquee } from "@/components/sections/CapabilityMarquee";
import { Hook } from "@/components/sections/Hook";
import { PainPoints } from "@/components/sections/PainPoints";
import { Approach } from "@/components/sections/Approach";
import { BusinessFunctions } from "@/components/sections/BusinessFunctions";
import { Services } from "@/components/sections/Services";
import { Process } from "@/components/sections/Process";
import { About } from "@/components/sections/About";
import { Faq } from "@/components/sections/Faq";

export default function Home() {
  // Whether the intro film (and its poster) are in public/media. The page is
  // prerendered, so this runs once at build (per request in dev). Passing it
  // stops About probing for the files from the browser, which logs a 404 to
  // the console on every visit while no film exists. Literal paths keep file
  // tracing to these two files.
  const hasFilm = existsSync(join(process.cwd(), "public/media/intro.mp4"));
  const hasPoster = existsSync(join(process.cwd(), "public/media/intro-poster.jpg"));

  return (
    <>
      <StructuredData />
      <Nav />
      <main id="main" className="flex-1">
        <Hero />
        <CapabilityMarquee />
        <Hook />
        <PainPoints />
        <Approach />
        <BusinessFunctions />
        <Services />
        <Process />
        <About hasFilm={hasFilm} hasPoster={hasPoster} />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
