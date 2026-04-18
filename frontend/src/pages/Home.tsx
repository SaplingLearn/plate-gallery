import { Link, useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef, useState, memo } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { Container } from '@/components/Container'
import { Eyebrow } from '@/components/Eyebrow'
import { RevealOnScroll } from '@/components/RevealOnScroll'
import { PlateCard } from '@/components/PlateCard'
import { Divider } from '@/components/Divider'
import { useRecentPlates, useLeaderboard, useMapSummary } from '@/hooks/useApi'
import type { StateSummary } from '@/lib/types'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

const FIPS_TO_CODE: Record<string, string> = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT',
  '10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL',
  '18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
  '25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE',
  '32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND',
  '39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
  '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
  '55':'WI','56':'WY',
}

function getFillColor(count: number): string {
  if (count === 0) return '#EBE4D4'
  if (count <= 5) return '#a0ac97'
  if (count <= 25) return '#8a9a81'
  return '#7A8471'
}

const HomeMapChart = memo(function HomeMapChart({
  stateMap,
  onStateClick,
  onStateHover,
}: {
  stateMap: Map<string, StateSummary>
  onStateClick: (code: string) => void
  onStateHover: (data: { name: string; count: number; x: number; y: number } | null) => void
}) {
  return (
    <ComposableMap projection="geoAlbersUsa" projectionConfig={{ scale: 900 }}>
      <Geographies geography={GEO_URL}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const code = FIPS_TO_CODE[geo.id]
            if (!code) return null
            const count = stateMap.get(code)?.plate_count ?? 0
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                onClick={() => onStateClick(code)}
                onMouseEnter={(e) => {
                  const rect = (e.target as SVGElement).getBoundingClientRect()
                  onStateHover({ name: geo.properties.name, count, x: rect.left + rect.width / 2, y: rect.top })
                }}
                onMouseLeave={() => onStateHover(null)}
                style={{
                  default: { fill: getFillColor(count), stroke: '#D8D1C2', strokeWidth: 0.5, outline: 'none', cursor: 'pointer' },
                  hover: { fill: count > 0 ? '#6a7a62' : '#D8D1C2', stroke: '#D8D1C2', strokeWidth: 0.5, outline: 'none', cursor: 'pointer' },
                  pressed: { fill: '#5a6a52', outline: 'none' },
                }}
              />
            )
          })
        }
      </Geographies>
    </ComposableMap>
  )
})

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
  const navigate = useNavigate()
  const [tooltip, setTooltip] = useState<{ name: string; count: number; x: number; y: number } | null>(null)

  const states = data?.states ?? []
  const unlocked = states.filter((s) => s.plate_count > 0).length
  const stateMap = new Map<string, StateSummary>()
  states.forEach((s) => stateMap.set(s.code, s))

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
          </div>

          <div className="relative mt-8 w-full">
            <HomeMapChart
              stateMap={stateMap}
              onStateClick={(code) => navigate(`/states/${code}`)}
              onStateHover={setTooltip}
            />
            {tooltip && (
              <div
                className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded bg-charcoal px-3 py-2 text-xs text-bone shadow-lg"
                style={{ left: tooltip.x, top: tooltip.y - 8 }}
              >
                <span className="font-medium">{tooltip.name}</span>
                <span className="ml-2 text-bone/60">{tooltip.count} plates</span>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-2 flex items-center justify-end gap-4">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-cream border border-border" />
              <span className="text-xs text-stone">0</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: '#a0ac97' }} />
              <span className="text-xs text-stone">1–5</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: '#8a9a81' }} />
              <span className="text-xs text-stone">6–25</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-sage" />
              <span className="text-xs text-stone">26+</span>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link to="/states" className="link-draw font-sans text-sm text-oxblood">
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
