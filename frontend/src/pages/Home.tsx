import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { Container } from '@/components/Container'
import { Eyebrow } from '@/components/Eyebrow'
import { RevealOnScroll } from '@/components/RevealOnScroll'
import { PlateCard } from '@/components/PlateCard'
import { Divider } from '@/components/Divider'
import { useRecentPlates, useLeaderboard, useMapSummary } from '@/hooks/useApi'
import { US_STATES } from '@/lib/states'

function Hero() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])

  return (
    <section ref={ref} className="relative flex min-h-[85vh] items-center overflow-hidden md:min-h-screen">
      {/* Background */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-charcoal via-ink to-charcoal"
        style={{ y }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(107,47,47,0.3),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_60%,rgba(184,102,58,0.15),transparent_60%)]" />
      </motion.div>

      {/* Decorative vertical line */}
      <div className="absolute left-[33%] top-0 bottom-0 w-px bg-bone/10 hidden md:block" />

      <Container className="relative z-10 py-32">
        <div className="max-w-3xl">
          <Eyebrow className="text-bone/60">
            A Community Gallery of American Vanity Plates
          </Eyebrow>
          <h1 className="mt-6 font-display text-5xl font-normal leading-[1.1] tracking-tight text-bone md:text-7xl">
            Every plate tells a story.
          </h1>
          <p className="mt-6 max-w-xl font-sans text-base leading-relaxed text-bone/60">
            Discover, share, and vote on the most creative vanity license plates
            spotted across all fifty states.
          </p>
          <Link
            to="/gallery"
            className="link-draw mt-10 inline-flex items-center gap-2 font-sans text-sm text-bone/80 hover:text-bone"
          >
            Explore the gallery <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </Container>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="font-sans text-xs uppercase tracking-[0.2em] text-bone/40">
          Scroll
        </span>
      </motion.div>
    </section>
  )
}

function LatestPlates() {
  const { data } = useRecentPlates(8)
  const plates = data?.items ?? []

  return (
    <section className="py-24">
      <Container>
        <RevealOnScroll>
          <Eyebrow>Recently Added</Eyebrow>
          <h2 className="mt-4 font-display text-3xl text-charcoal md:text-4xl">
            Fresh off the road
          </h2>
        </RevealOnScroll>

        {plates.length > 0 ? (
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {plates.map((plate, i) => (
              <RevealOnScroll key={plate.id} delay={i * 0.08}>
                <PlateCard plate={plate} priority={i < 4} />
              </RevealOnScroll>
            ))}
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/5] rounded-sm bg-cream" />
                <div className="mt-3 h-3 w-20 rounded bg-cream" />
                <div className="mt-2 h-5 w-32 rounded bg-cream" />
              </div>
            ))}
          </div>
        )}

        <RevealOnScroll>
          <div className="mt-12 text-center">
            <Link to="/gallery" className="link-draw font-sans text-sm text-oxblood">
              View all plates <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </RevealOnScroll>
      </Container>
    </section>
  )
}

function MapPreview() {
  const { data } = useMapSummary()
  const states = data?.states ?? []
  const unlocked = states.filter((s) => s.plate_count > 0).length

  return (
    <section className="bg-cream py-24">
      <Container>
        <RevealOnScroll>
          <div className="flex flex-col items-center text-center">
            <Eyebrow>Explore by State</Eyebrow>
            <h2 className="mt-4 font-display text-3xl text-charcoal md:text-4xl">
              The United States of Vanity
            </h2>
            <p className="mt-4 max-w-md text-sm text-stone">
              {unlocked > 0
                ? `${unlocked} of 51 states unlocked. Help fill the map.`
                : 'No states unlocked yet. Be the first to contribute.'}
            </p>

            {/* Mini map grid as a visual stand-in */}
            <div className="mt-10 grid w-full max-w-2xl grid-cols-6 gap-1 sm:grid-cols-9 md:grid-cols-11">
              {Object.keys(US_STATES).map((code) => {
                const stateData = states.find((s) => s.code === code)
                const hasPlates = stateData && stateData.plate_count > 0
                return (
                  <Link
                    key={code}
                    to={`/states/${code}`}
                    className={`flex aspect-square items-center justify-center rounded-sm text-[10px] font-sans font-medium transition-colors ${
                      hasPlates
                        ? 'bg-sage text-bone hover:bg-sage/80'
                        : 'bg-border/50 text-stone/60 hover:bg-border'
                    }`}
                    title={`${US_STATES[code]}: ${stateData?.plate_count ?? 0} plates`}
                  >
                    {code}
                  </Link>
                )
              })}
            </div>

            <Link to="/states" className="link-draw mt-10 font-sans text-sm text-oxblood">
              Open the map <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </RevealOnScroll>
      </Container>
    </section>
  )
}

function TopOfTheWeek() {
  const { data } = useLeaderboard('week', 10)
  const plates = data?.items ?? []

  if (plates.length === 0) return null

  return (
    <section className="py-24">
      <Container>
        <RevealOnScroll>
          <Eyebrow>Top of the Week</Eyebrow>
          <h2 className="mt-4 font-display text-3xl text-charcoal md:text-4xl">
            Fan favorites
          </h2>
        </RevealOnScroll>

        <div className="mt-12 flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
          {plates.map((plate, i) => (
            <RevealOnScroll
              key={plate.id}
              delay={i * 0.08}
              className="w-64 flex-shrink-0 snap-start"
            >
              <PlateCard plate={plate} />
            </RevealOnScroll>
          ))}
        </div>
      </Container>
    </section>
  )
}

function EditorialBlock() {
  return (
    <section className="py-32">
      <Container>
        <RevealOnScroll>
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-display text-2xl leading-relaxed text-charcoal md:text-3xl">
              Behind every vanity plate is someone who thought long and hard
              about seven characters. This gallery celebrates that commitment.
            </p>
            <Link to="/about" className="link-draw mt-8 inline-block font-sans text-sm text-oxblood">
              Learn more about PlateGallery <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </RevealOnScroll>
      </Container>
    </section>
  )
}

function CTABand() {
  return (
    <section className="relative overflow-hidden bg-charcoal py-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(107,47,47,0.2),transparent_70%)]" />
      <Container className="relative z-10">
        <RevealOnScroll>
          <div className="mx-auto max-w-xl text-center">
            <h2 className="font-display text-4xl text-bone md:text-5xl">
              Spot one. Share it.
            </h2>
            <Link
              to="/upload"
              className="link-draw mt-8 inline-block font-sans text-sm text-bone/80 hover:text-bone"
            >
              Upload a plate <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </RevealOnScroll>
      </Container>
    </section>
  )
}

export default function Home() {
  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.3 }}
    >
      <Hero />
      <LatestPlates />
      <Divider className="mx-auto max-w-7xl" />
      <MapPreview />
      <TopOfTheWeek />
      <EditorialBlock />
      <CTABand />
    </motion.main>
  )
}
