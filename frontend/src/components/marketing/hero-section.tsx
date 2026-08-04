import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-b from-[hsl(222,47%,6%)] to-[hsl(222,47%,10%)] pt-16">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(243,75%,59%) 1px, transparent 1px), linear-gradient(90deg, hsl(243,75%,59%) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] sm:w-[400px] md:w-[600px] h-[200px] sm:h-[280px] md:h-[400px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Badge
          variant="outline"
          className="mb-6 border-primary/40 text-primary bg-primary/10 text-sm px-4 py-1"
        >
          AI Support Agents — Built for Operators
        </Badge>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight mb-6">
          Deploy AI Support Agents
          <br />
          <span className="text-primary">in Minutes</span>
        </h1>

        <p className="text-lg sm:text-xl text-[hsl(210,40%,72%)] max-w-2xl mx-auto mb-10 leading-relaxed">
          Give your customers instant, accurate answers — 24/7. Upload your knowledge base,
          configure a persona, and embed a chat widget on your site. No ML expertise required.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" className="w-full sm:w-auto px-8" asChild>
            <Link href="/register">Get Started Free</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto px-8 bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white"
            asChild
          >
            <Link href="/login">Log in to Dashboard</Link>
          </Button>
        </div>

        <p className="mt-6 text-sm text-[hsl(215,20%,55%)]">
          No credit card required · Free tier available · Deploy in under 5 minutes
        </p>

        {/* Dashboard mockup panel — decorative, hidden from screen readers */}
        <div className="mt-16 relative max-w-4xl mx-auto" aria-hidden="true">
          <div className="rounded-xl border border-white/10 bg-[hsl(222,47%,11%)] shadow-2xl overflow-hidden">
            {/* Mock browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-[hsl(222,47%,8%)]">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <div className="ml-4 flex-1 rounded bg-white/5 h-5 max-w-xs" />
            </div>
            {/* Mock dashboard content */}
            <div className="p-6 grid grid-cols-3 gap-4">
              {["Total Messages", "Active Agents", "Avg. Response Time"].map((label, i) => (
                <div key={label} className="rounded-lg bg-white/5 border border-white/10 p-4">
                  <p className="text-xs text-[hsl(215,20%,55%)] mb-1">{label}</p>
                  <p className="text-2xl font-bold text-white">
                    {["24,891", "12", "0.8s"][i]}
                  </p>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6">
              <div className="rounded-lg bg-white/5 border border-white/10 h-24 flex items-center justify-center">
                <div className="flex gap-1 items-end h-12">
                  {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88].map((h, i) => (
                    <div
                      key={i}
                      className="w-4 rounded-sm bg-primary/60"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[hsl(222,47%,10%)] to-transparent pointer-events-none" />
        </div>
      </div>
    </section>
  )
}
