import React from "react"
import { INDUSTRIES } from "@/lib/industries"
import Link from "next/link"

export default function IndustryGridSection() {
  return (
    <section id="industries" className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
            Industries
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Purpose-built for your industry
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">
            Pre-configured knowledge structures and workflows tailored to the compliance,
            terminology, and customer expectations of each sector.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {INDUSTRIES.map((industry) => (
            <Link
              key={industry.slug}
              href={`/${industry.slug}`}
              className="group rounded-xl border border-border bg-card p-6 flex flex-col items-center text-center hover:border-primary/40 hover:shadow-md transition-all duration-200"
            >
              <span className="text-3xl mb-3">{industry.emoji}</span>
              <h3 className="font-semibold text-foreground text-sm mb-1">{industry.name}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {industry.tagline}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
