import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="mt-auto border-t-[1.5px] border-rule bg-cream">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-8 py-12 md:grid-cols-4">
        <div>
          <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink-muted">
            Explore
          </div>
          <ul className="space-y-1.5">
            <li><Link to="/" className="text-sm font-semibold text-ink hover:text-rust">Feed</Link></li>
            <li><Link to="/states" className="text-sm font-semibold text-ink hover:text-rust">USA Map</Link></li>
            <li><Link to="/leaderboard" className="text-sm font-semibold text-ink hover:text-rust">Leaderboards</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink-muted">
            Contribute
          </div>
          <ul className="space-y-1.5">
            <li><Link to="/upload" className="text-sm font-semibold text-ink hover:text-rust">Post a Plate</Link></li>
            <li><Link to="/about" className="text-sm font-semibold text-ink hover:text-rust">About</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink-muted">
            Account
          </div>
          <ul className="space-y-1.5">
            <li><Link to="/profile" className="text-sm font-semibold text-ink hover:text-rust">Profile</Link></li>
            <li><Link to="/login" className="text-sm font-semibold text-ink hover:text-rust">Sign in</Link></li>
          </ul>
        </div>
        <div>
          <Link to="/" className="font-display text-2xl font-black tracking-tight text-ink">
            PLATE<span className="text-rust">GALLERY</span>
          </Link>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            A community gallery of American vanity plates.
          </p>
        </div>
      </div>
      <div className="border-t border-paper-edge px-8 py-5 text-center font-mono text-[11px] font-bold uppercase tracking-[1.5px] text-ink-muted">
        © {new Date().getFullYear()} PlateGallery · Built for BostonHacks
      </div>
    </footer>
  )
}
