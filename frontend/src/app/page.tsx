import React from "react"
import MarketingNav from "@/components/marketing/marketing-nav"
import HeroSection from "@/components/marketing/hero-section"
import FeaturesSection from "@/components/marketing/features-section"
import { HowItWorksSection, StatsSection, CTASection } from "@/components/marketing/how-it-works-section"
import IndustryGridSection from "@/components/marketing/industry-grid-section"
import MarketingFooter from "@/components/marketing/marketing-footer"

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <MarketingNav />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <StatsSection />
      <IndustryGridSection />
      <CTASection />
      <MarketingFooter />
    </main>
  )
}
