import { StructuredData } from "@/components/seo/StructuredData";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { FilmTour } from "@/components/sections/FilmTour";
import { CapabilityMarquee } from "@/components/sections/CapabilityMarquee";
import { PainPoints } from "@/components/sections/PainPoints";
import { Approach } from "@/components/sections/Approach";
import { BusinessFunctions } from "@/components/sections/BusinessFunctions";
import { Services } from "@/components/sections/Services";
import { About } from "@/components/sections/About";
import { Faq } from "@/components/sections/Faq";

export default function Home() {
  return (
    <>
      <StructuredData />
      <Nav />
      <main id="main" className="flex-1">
        <Hero />
        <FilmTour />
        <CapabilityMarquee />
        <PainPoints />
        <Approach />
        <BusinessFunctions />
        <Services />
        <About />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
