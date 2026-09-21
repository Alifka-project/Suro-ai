import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { CapabilityMarquee } from "@/components/sections/CapabilityMarquee";
import { IntroVideo } from "@/components/sections/IntroVideo";
import { RootCauses } from "@/components/sections/RootCauses";
import { Services } from "@/components/sections/Services";
import { Process } from "@/components/sections/Process";
import { Results } from "@/components/sections/Results";
import { Faq } from "@/components/sections/Faq";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main" className="flex-1">
        <Hero />
        <CapabilityMarquee />
        <IntroVideo />
        <RootCauses />
        <Services />
        <Process />
        <Results />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
