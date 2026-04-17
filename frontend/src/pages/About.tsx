import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Container } from '@/components/Container'
import { RevealOnScroll } from '@/components/RevealOnScroll'

export default function About() {
  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.3 }}
      className="pt-32 pb-16"
    >
      <Container className="max-w-2xl">
        <RevealOnScroll>
          <h1 className="font-display text-4xl text-charcoal md:text-5xl">
            About PlateGallery
          </h1>
        </RevealOnScroll>

        <RevealOnScroll delay={0.1}>
          <div className="mt-10 space-y-6 font-sans text-base leading-relaxed text-ink">
            <p>
              PlateGallery is a community-driven gallery dedicated to the art of
              American vanity license plates. From the clever to the absurd,
              every plate tells a story about its owner.
            </p>
            <p>
              Spot a vanity plate in the wild? Snap a photo, upload it here, and
              let the community vote. We're on a mission to catalog the most
              creative plates from all 50 states (plus DC).
            </p>
            <p>
              Every upload passes through automated moderation to keep the gallery
              clean and respectful. Our system checks that images contain real
              license plates, screens for inappropriate content, and catches
              duplicates — all in real time, with no manual review queue.
            </p>
            <p>
              Built as a hackathon project for BostonHacks. The frontend runs on
              Cloudflare Pages with React and Tailwind. The backend is a FastAPI
              service backed by Supabase for authentication, storage, and Postgres.
            </p>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={0.2}>
          <div className="mt-12">
            <Link to="/gallery" className="link-draw font-sans text-sm text-oxblood">
              Start exploring <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </RevealOnScroll>
      </Container>
    </motion.main>
  )
}
