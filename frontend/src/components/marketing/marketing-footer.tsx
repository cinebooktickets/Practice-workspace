import React from "react"
import Link from "next/link"

export default function MarketingFooter() {
  return (
    <footer className="bg-[hsl(222,47%,8%)] border-t border-white/10 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">PA</span>
              </div>
              <span className="font-semibold text-white">PrimeAssist</span>
            </div>
            <p className="text-sm text-[hsl(215,20%,55%)] leading-relaxed max-w-xs">
              AI support agents that answer instantly, learn from your knowledge base,
              and hand off to humans when it matters.
            </p>
          </div>

          {/* Product links */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Product</h3>
            <nav className="flex flex-col gap-3 text-sm text-[hsl(215,20%,55%)]">
              <Link href="/#features" className="hover:text-white transition-colors">Features</Link>
              <Link href="/#how-it-works" className="hover:text-white transition-colors">How It Works</Link>
              <Link href="/#industries" className="hover:text-white transition-colors">Industries</Link>
            </nav>
          </div>

          {/* Account links */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Account</h3>
            <nav className="flex flex-col gap-3 text-sm text-[hsl(215,20%,55%)]">
              <Link href="/login" className="hover:text-white transition-colors">Log in</Link>
              <Link href="/register" className="hover:text-white transition-colors">Get Started Free</Link>
            </nav>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[hsl(215,20%,40%)]">
            © {new Date().getFullYear()} PrimeAssist. All rights reserved.
          </p>
          <p className="text-xs text-[hsl(215,20%,40%)]">
            Deploy AI support agents in minutes · No ML expertise required
          </p>
        </div>
      </div>
    </footer>
  )
}
