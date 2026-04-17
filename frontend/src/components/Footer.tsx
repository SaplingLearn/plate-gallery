import { Link } from 'react-router-dom'
import { Container } from './Container'
import { Divider } from './Divider'

export function Footer() {
  return (
    <footer className="mt-auto bg-cream">
      <Container>
        <Divider className="my-0" />
        <div className="grid grid-cols-2 gap-8 py-16 md:grid-cols-4">
          <div>
            <h4 className="mb-4 font-sans text-xs uppercase tracking-[0.2em] text-stone">
              Explore
            </h4>
            <ul className="space-y-2">
              <li><Link to="/gallery" className="text-sm text-ink hover:text-charcoal">Gallery</Link></li>
              <li><Link to="/states" className="text-sm text-ink hover:text-charcoal">Map</Link></li>
              <li><Link to="/leaderboard" className="text-sm text-ink hover:text-charcoal">Leaderboard</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-sans text-xs uppercase tracking-[0.2em] text-stone">
              Contribute
            </h4>
            <ul className="space-y-2">
              <li><Link to="/upload" className="text-sm text-ink hover:text-charcoal">Upload a Plate</Link></li>
              <li><Link to="/about" className="text-sm text-ink hover:text-charcoal">About</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-sans text-xs uppercase tracking-[0.2em] text-stone">
              Account
            </h4>
            <ul className="space-y-2">
              <li><Link to="/profile" className="text-sm text-ink hover:text-charcoal">Profile</Link></li>
              <li><Link to="/login" className="text-sm text-ink hover:text-charcoal">Sign In</Link></li>
            </ul>
          </div>
          <div>
            <Link to="/" className="font-display text-lg text-charcoal">
              PlateGallery
            </Link>
            <p className="mt-2 text-sm text-stone leading-relaxed">
              A community gallery of American vanity plates.
            </p>
          </div>
        </div>
        <div className="border-t border-border py-6 text-center text-xs text-stone">
          &copy; {new Date().getFullYear()} PlateGallery. Built for BostonHacks.
        </div>
      </Container>
    </footer>
  )
}
