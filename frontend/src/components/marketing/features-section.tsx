import React from "react"
import {
  BookOpen,
  BarChart3,
  Headphones,
  Key,
  MessageSquare,
  UserCircle,
} from "lucide-react"

type FeatureCard = {
  icon: React.ReactNode
  title: string
  description: string
  span?: "col" | "row" | "none"
}

const features: FeatureCard[] = [
  {
    icon: <BookOpen className="w-6 h-6" aria-hidden="true" />,
    title: "Knowledge Base",
    description:
      "Upload PDFs, docs, and web pages. Your agent answers from your content — always accurate, always cited.",
    span: "col",
  },
  {
    icon: <BarChart3 className="w-6 h-6" aria-hidden="true" />,
    title: "Real-time Analytics",
    description:
      "Track message volume, top topics, and feedback scores. Know exactly how your agent is performing.",
  },
  {
    icon: <Headphones className="w-6 h-6" aria-hidden="true" />,
    title: "Live Handoff",
    description:
      "When the agent can't help, escalate to a human support agent instantly. Full conversation context transferred.",
  },
  {
    icon: <UserCircle className="w-6 h-6" aria-hidden="true" />,
    title: "Custom Persona",
    description:
      "Give your agent a name, personality, and tone that matches your brand. System prompt, topics, and greeting — all configurable.",
    span: "col",
  },
  {
    icon: <MessageSquare className="w-6 h-6" aria-hidden="true" />,
    title: "Embeddable Widget",
    description:
      "One script tag. Drop a fully-branded chat widget onto any website in minutes — no backend work needed.",
  },
  {
    icon: <Key className="w-6 h-6" aria-hidden="true" />,
    title: "API Access",
    description:
      "Generate API keys and integrate your agent into any product via REST. Full control over authentication and rate limits.",
  },
]

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
            Features
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Everything you need to ship
            <br />
            a world-class support agent
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">
            No ML expertise. No infrastructure headaches. Just configure, upload, and deploy.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={[
                "group relative rounded-xl border border-border bg-card p-6",
                "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200",
                feature.span === "col" ? "lg:col-span-1" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary/20 transition-colors">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
