import Nav from "@/components/nav";
import HeroSection from "@/components/hero-section";
import FeaturesSection from "@/components/features-section";
import ArchSection from "@/components/arch-section";
import DeploySection from "@/components/deploy-section";
import FooterSection from "@/components/footer-section";

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <HeroSection />
        <hr className="divider" />
        <FeaturesSection />
        <hr className="divider" />
        <ArchSection />
        <hr className="divider" />
        <DeploySection />
        <hr className="divider" />
      </main>
      <FooterSection />
    </>
  );
}
