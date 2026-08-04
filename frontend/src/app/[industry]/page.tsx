import React from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { INDUSTRIES } from "@/lib/industries"
import MarketingNav from "@/components/marketing/marketing-nav"
import MarketingFooter from "@/components/marketing/marketing-footer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, AlertCircle, ChevronLeft } from "lucide-react"

export function generateStaticParams() {
  return INDUSTRIES.map((industry) => ({ industry: industry.slug }))
}

type Props = {
  params: { industry: string }
}

export default function IndustryPage({ params }: Props) {
  const industry = INDUSTRIES.find((i) => i.slug === params.industry)

  if (!industry) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="pt-32 pb-20 bg-gradient-to-b from-[hsl(222,47%,6%)] to-[hsl(222,47%,10%)] text-center px-4">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/#industries"
            className="inline-flex items-center gap-1 text-sm text-[hsl(215,20%,55%)] hover:text-white transition-colors mb-8"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            All Industries
          </Link>
          <div className="text-5xl mb-4">{industry.emoji}</div>
          <Badge
            variant="outline"
            className="mb-4 border-primary/40 text-primary bg-primary/10"
          >
            {industry.name}
          </Badge>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
            {industry.headline}
          </h1>
          <p className="text-lg text-[hsl(210,40%,72%)] max-w-2xl mx-auto mb-10">
            {industry.tagline}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="px-10" asChild>
              <Link href="/register">Get Started Free</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="px-10 border-white/20 text-white hover:bg-white/10"
              asChild
            >
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-[hsl(222,47%,10%)] border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {industry.stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-sm text-[hsl(215,20%,55%)]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases + Pain points */}
      <section className="py-24 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Use cases */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">What your agent handles</h2>
            <ul className="space-y-4">
              {industry.useCases.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pain points */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Problems it solves</h2>
            <ul className="space-y-4">
              {industry.painPoints.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-muted/40 border-t border-border text-center px-4">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            Ready to deploy your {industry.name.toLowerCase()} agent?
          </h2>
          <p className="text-muted-foreground mb-8">
            Set up in minutes. No ML experience needed. Free tier available.
          </p>
          <Button size="lg" className="px-10" asChild>
            <Link href="/register">Get Started Free</Link>
          </Button>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}
