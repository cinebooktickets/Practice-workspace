export type Industry = {
  slug: string
  name: string
  emoji: string
  tagline: string
  headline: string
  stats: { value: string; label: string }[]
  useCases: string[]
  painPoints: string[]
}

export const INDUSTRIES: Industry[] = [
  {
    slug: "aviation",
    name: "Aviation",
    emoji: "✈️",
    tagline: "Passenger support at 35,000 feet",
    headline: "Keep passengers informed, agents focused",
    stats: [
      { value: "68%", label: "of passenger queries are repetitive FAQs" },
      { value: "4.2×", label: "faster resolution vs. traditional IVR" },
      { value: "24/7", label: "availability across all time zones" },
      { value: "92%", label: "passenger satisfaction score with AI support" },
    ],
    useCases: [
      "Flight status and delay notifications",
      "Baggage policy and lost baggage claims",
      "Seat upgrade and check-in assistance",
      "Loyalty program balance and tier enquiries",
      "Rebooking and cancellation flows",
    ],
    painPoints: [
      "Contact centre overwhelmed during disruptions",
      "Agents spend 70% of time on low-value FAQs",
      "Inconsistent answers across channels",
      "Long hold times damage NPS scores",
    ],
  },
  {
    slug: "insurance",
    name: "Insurance",
    emoji: "🛡️",
    tagline: "Claims and policy support — instant and compliant",
    headline: "Reduce claims handling time by 60%",
    stats: [
      { value: "60%", label: "reduction in first-response time" },
      { value: "3×", label: "more claims processed per agent per day" },
      { value: "99%", label: "regulatory compliance on every response" },
      { value: "$42", label: "average cost savings per deflected call" },
    ],
    useCases: [
      "Policy coverage and exclusions lookup",
      "First notice of loss (FNOL) intake",
      "Claims status updates and document requests",
      "Premium calculation and renewal reminders",
      "Fraud detection escalation routing",
    ],
    painPoints: [
      "Complex policy language confuses customers",
      "Compliance risk on every customer interaction",
      "High cost per contact in claims operations",
      "Peak demand spikes after weather events",
    ],
  },
  {
    slug: "banking",
    name: "Banking",
    emoji: "🏦",
    tagline: "Secure, instant answers for every account holder",
    headline: "Deflect 55% of tier-1 support volume",
    stats: [
      { value: "55%", label: "tier-1 support volume deflected" },
      { value: "< 2s", label: "average response time" },
      { value: "256-bit", label: "AES encryption on all data flows" },
      { value: "38%", label: "reduction in branch visit volume" },
    ],
    useCases: [
      "Account balance and transaction history",
      "Card block/unblock and replacement requests",
      "Loan eligibility and repayment schedules",
      "Fraud alert acknowledgement and dispute filing",
      "Branch and ATM locator",
    ],
    painPoints: [
      "Branch staff overwhelmed with digital product queries",
      "Customers expect 24/7 access without waiting",
      "Regulatory requirements for auditability",
      "High cost of contact centre at scale",
    ],
  },
  {
    slug: "entertainment",
    name: "Entertainment",
    emoji: "🎬",
    tagline: "Fan experiences that never go dark",
    headline: "Support millions of fans simultaneously",
    stats: [
      { value: "10M+", label: "concurrent users supported without degradation" },
      { value: "0.4s", label: "median response latency" },
      { value: "85%", label: "of support tickets resolved without human escalation" },
      { value: "5×", label: "lower cost vs. human-only support during peak events" },
    ],
    useCases: [
      "Subscription and billing management",
      "Content availability by region",
      "Streaming quality troubleshooting",
      "Event ticketing and refund policies",
      "Parental controls and account security",
    ],
    painPoints: [
      "Massive volume spikes around new releases and events",
      "Global audience across dozens of languages and time zones",
      "High churn risk if support experience disappoints",
      "Content rights queries require precise, up-to-date answers",
    ],
  },
  {
    slug: "healthcare",
    name: "Healthcare",
    emoji: "🏥",
    tagline: "Patient-first support that complies with HIPAA",
    headline: "Reduce no-shows and administrative overhead",
    stats: [
      { value: "42%", label: "reduction in missed appointments" },
      { value: "HIPAA", label: "compliant by design" },
      { value: "78%", label: "of admin queries handled without staff intervention" },
      { value: "2.1×", label: "improvement in patient satisfaction scores" },
    ],
    useCases: [
      "Appointment scheduling, reminders, and rescheduling",
      "Pre-visit instructions and preparation guides",
      "Prescription refill status and pharmacy routing",
      "Insurance coverage verification",
      "Post-discharge follow-up and care instructions",
    ],
    painPoints: [
      "Administrative staff overwhelmed with phone enquiries",
      "High no-show rates cost clinics significant revenue",
      "Strict compliance requirements for patient data",
      "Patients need answers outside office hours",
    ],
  },
  {
    slug: "retail",
    name: "Retail",
    emoji: "🛍️",
    tagline: "Convert browsers into buyers, 24/7",
    headline: "Increase conversion by 23% with instant product guidance",
    stats: [
      { value: "23%", label: "increase in conversion rate" },
      { value: "67%", label: "of cart abandonment prevented with proactive support" },
      { value: "4.8★", label: "average customer satisfaction rating" },
      { value: "< 30s", label: "average time to first helpful response" },
    ],
    useCases: [
      "Product recommendations and size guides",
      "Order tracking and delivery status",
      "Returns, exchanges, and refund processing",
      "Stock availability and store locator",
      "Loyalty points and promotional code queries",
    ],
    painPoints: [
      "Support volume scales with promotions and sales events",
      "High cost of returns due to poor pre-purchase guidance",
      "Customers expect instant answers while shopping",
      "Seasonal hiring cycles for support teams are expensive",
    ],
  },
  {
    slug: "telecom",
    name: "Telecom",
    emoji: "📡",
    tagline: "Resolve billing and technical issues before churn happens",
    headline: "Cut churn by addressing issues in real time",
    stats: [
      { value: "31%", label: "reduction in customer churn" },
      { value: "5M+", label: "support interactions handled monthly" },
      { value: "89%", label: "first-contact resolution rate" },
      { value: "€18", label: "average cost savings per deflected contact" },
    ],
    useCases: [
      "Data plan usage and top-up assistance",
      "Network outage status and estimated resolution",
      "SIM swap and porting requests",
      "Bill explanation and dispute resolution",
      "Device compatibility and settings guidance",
    ],
    painPoints: [
      "Billing complexity generates high contact volume",
      "Network incidents create sudden support surges",
      "Churn is highest in the first 90 days after sign-up",
      "Technical troubleshooting requires deep product knowledge",
    ],
  },
  {
    slug: "public-sector",
    name: "Public Sector",
    emoji: "🏛️",
    tagline: "Accessible government services for every citizen",
    headline: "Make government services accessible at scale",
    stats: [
      { value: "73%", label: "of citizen queries resolved without staff involvement" },
      { value: "WCAG 2.1", label: "accessibility compliant" },
      { value: "18", label: "languages supported out of the box" },
      { value: "40%", label: "reduction in call centre operating costs" },
    ],
    useCases: [
      "Benefits eligibility and application status",
      "Permit and licence application guidance",
      "Tax and rate payment assistance",
      "Service appointment booking",
      "Emergency services and contact directory",
    ],
    painPoints: [
      "Citizens expect digital-first service delivery",
      "Budget constraints limit headcount expansion",
      "Accessibility and multilingual requirements are mandatory",
      "High volume of repetitive policy and procedure queries",
    ],
  },
]

