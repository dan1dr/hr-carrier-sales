import React from 'react'

export default function Footer() {
  return (
    <footer className="shrink-0 relative overflow-hidden">
      <div className="border-t border-border bg-surface-0 relative z-10">
        <div className="max-w-6xl mx-auto px-8 py-5 flex items-center justify-between">
          <p className="text-[12px] text-text-muted">
            Powered by{' '}
            <a
              href="https://www.happyrobot.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-text-primary transition-colors font-medium"
            >
              HappyRobot AI
            </a>
          </p>
          <a
            href="https://www.happyrobot.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-text-muted hover:text-text-primary transition-colors"
          >
            About HappyRobot ↗
          </a>
        </div>
      </div>

      <div className="relative h-24 overflow-hidden">
        <img
          src="/footer-port.png"
          alt=""
          className="w-full h-full object-cover object-center opacity-40"
        />
        <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-surface-0 to-transparent" />
      </div>
    </footer>
  )
}
