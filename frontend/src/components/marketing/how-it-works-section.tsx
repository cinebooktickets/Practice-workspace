import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Upload, Settings2, Zap } from "lucide-react"

const steps = [
  {
    icon: <Upload className="w-6 h-6" aria-hidden="true" />,
    step: "01",
    title: "Upload your knowledge base",
    description:
      "Drop in PDFs, Word docs, or paste a URL. PrimeAssist ingests, chunks, and indexes your content automatically.",
  },
  {
    icon: <Settings2 className="w-6 h-6" aria-hidden="true" />,
    step: "02",
    title: "Configure your agent",
    description:
      "Set a persona, system prompt, allowed topics, and greeting message. Preview your agent in the sandbox before going live.",
  },
  {
    icon: <Zap className="w-6 h-6" aria-hidden="true" />,
    step: "03",
    title: "Deploy in one click",
    description:
      "Embed the widget with a single script tag, or call the REST API. Your agent is live and answering questions instantly.",
  },
]

const stats = [
  { value: "5 min", label: "Average time to first deployment" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "< 1s", label: "Median response time" },
  { value: "8", label: "Industries supported out of the box" },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-muted/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
            How It Works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            From zero to deployed
            <br />
            in three steps
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-10 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-border" />

          {steps.map((step) => (
            <div key={step.step} className="relative text-center">
              <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-background border-2 border-primary/30 mb-6 mx-auto">
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  {step.step}
                </span>
                <div className="text-primary">{step.icon}</div>
              </div>
              <h3 className="font-semibold text-foreground text-lg mb-3">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function StatsSection() {
  return (
    <section className="py-16 bg-[hsl(222,47%,10%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl sm:text-4xl font-bold text-white mb-2">{stat.value}</p>
              <p className="text-sm text-[hsl(215,20%,55%)]">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function CTASection() {
  return (
    <section className="py-24 bg-gradient-to-br from-primary/10 via-background to-background border-t border-border">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
          Ready to deploy your first agent?
        </h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
          Join teams across healthcare, insurance, retail, and more who use PrimeAssist
          to deliver faster, smarter support.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" className="px-10" asChild>
            <Link href="/register">Get Started Free</Link>
          </Button>
          <Button size="lg" variant="outline" className="px-10 border-primary/40 text-foreground hover:text-foreground" asChild>
            <Link href="/login">Sign in to Dashboard</Link>
          </Button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Free tier includes 1 agent · 1,000 messages/month · No credit card required
        </p>
      </div>
    </section>
  )
}
