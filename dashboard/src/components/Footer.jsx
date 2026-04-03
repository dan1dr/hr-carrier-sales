import React from 'react'

const LINKS = {
  product: [
    { label: 'Overview', href: '#', internal: 'overview' },
    { label: 'Calls', href: '#', internal: 'calls' },
    { label: 'Policy', href: '#', internal: 'policy' },
  ],
  company: [
    { label: 'About HappyRobot', href: 'https://www.happyrobot.ai/', external: true },
    { label: 'Careers', href: 'https://www.happyrobot.ai/careers', external: true },
    { label: 'Platform', href: 'https://www.happyrobot.ai/', external: true },
  ],
  legal: [
    { label: 'Privacy', href: 'https://www.happyrobot.ai/', external: true },
    { label: 'Terms', href: 'https://www.happyrobot.ai/', external: true },
  ],
}

export default function Footer({ onNavigate }) {
  return (
    <footer className="border-t border-border bg-surface-0 mt-auto shrink-0">
      <div className="max-w-6xl mx-auto px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <img
                src="/acme-brand.png"
                alt=""
                className="w-8 h-8 rounded-md object-cover ring-1 ring-border"
              />
              <span className="text-[13px] font-semibold text-text-primary">ACME Logistics</span>
            </div>
            <p className="text-[12px] text-text-muted leading-relaxed max-w-xs">
              Inbound carrier sales automation — verify, match, negotiate, and hand off with full operational visibility.
            </p>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-3">Product</h4>
            <ul className="space-y-2">
              {LINKS.product.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.internal)}
                    className="text-[13px] text-text-secondary hover:text-text-primary transition-colors cursor-pointer text-left"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-3">Company</h4>
            <ul className="space-y-2">
              {LINKS.company.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-3">Legal</h4>
            <ul className="space-y-2">
              {LINKS.legal.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-[11px] text-text-muted">
            © {new Date().getFullYear()} ACME Logistics. Operations dashboard powered by{' '}
            <a href="https://www.happyrobot.ai/" target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-text-primary">
              HappyRobot
            </a>
            .
          </p>
          <p className="text-[11px] text-text-muted">
            Internal use · Broker operations
          </p>
        </div>
      </div>
    </footer>
  )
}
