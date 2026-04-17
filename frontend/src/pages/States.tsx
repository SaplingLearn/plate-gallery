import { useState, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ComposableMap, Geographies, Geography, Annotation } from 'react-simple-maps'
import { Container } from '@/components/Container'
import { Eyebrow } from '@/components/Eyebrow'
import { RevealOnScroll } from '@/components/RevealOnScroll'
import { useMapSummary } from '@/hooks/useApi'
import type { StateSummary } from '@/lib/types'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

// FIPS → state code lookup
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
  if (count === 0) return '#EBE4D4'  // cream
  if (count <= 5) return '#a0ac97'   // sage light
  if (count <= 25) return '#8a9a81'  // sage medium
  return '#7A8471'                    // sage full
}

const MapChart = memo(function MapChart({
  stateMap,
  onStateClick,
  onStateHover,
}: {
  stateMap: Map<string, StateSummary>
  onStateClick: (code: string) => void
  onStateHover: (data: { code: string; name: string; count: number; x: number; y: number } | null) => void
}) {
  return (
    <ComposableMap projection="geoAlbersUsa" projectionConfig={{ scale: 1000 }}>
      <Geographies geography={GEO_URL}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const fips = geo.id
            const code = FIPS_TO_CODE[fips]
            if (!code) return null
            const stateData = stateMap.get(code)
            const count = stateData?.plate_count ?? 0

            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                onClick={() => onStateClick(code)}
                onMouseEnter={(e) => {
                  const rect = (e.target as SVGElement).getBoundingClientRect()
                  onStateHover({
                    code,
                    name: geo.properties.name,
                    count,
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                  })
                }}
                onMouseLeave={() => onStateHover(null)}
                style={{
                  default: {
                    fill: getFillColor(count),
                    stroke: '#D8D1C2',
                    strokeWidth: 0.5,
                    outline: 'none',
                    cursor: 'pointer',
                  },
                  hover: {
                    fill: count > 0 ? '#6a7a62' : '#D8D1C2',
                    stroke: '#D8D1C2',
                    strokeWidth: 0.5,
                    outline: 'none',
                    cursor: 'pointer',
                  },
                  pressed: {
                    fill: '#5a6a52',
                    outline: 'none',
                  },
                }}
                tabIndex={0}
                role="link"
                aria-label={`${geo.properties.name}: ${count} plates`}
              />
            )
          })
        }
      </Geographies>
      {/* DC annotation */}
      <Annotation subject={[-77.04, 38.91]} dx={30} dy={-20} connectorProps={{ stroke: '#8A8279', strokeWidth: 1 }}>
        <text fontSize={8} fill="#8A8279" textAnchor="start" fontFamily="Inter, sans-serif">
          DC
        </text>
      </Annotation>
    </ComposableMap>
  )
})

export default function States() {
  const { data, isLoading } = useMapSummary()
  const navigate = useNavigate()
  const [tooltip, setTooltip] = useState<{ code: string; name: string; count: number; x: number; y: number } | null>(null)

  const stateMap = new Map<string, StateSummary>()
  data?.states.forEach((s) => stateMap.set(s.code, s))

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.3 }}
      className="pt-24 pb-16"
    >
      <Container>
        <RevealOnScroll>
          <div className="text-center">
            <Eyebrow>Explore by State</Eyebrow>
            <h1 className="mt-4 font-display text-4xl text-charcoal md:text-5xl">
              The United States of Vanity
            </h1>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={0.1}>
          <div className="relative mt-12">
            {isLoading ? (
              <div className="flex aspect-[1.6/1] items-center justify-center rounded-sm bg-cream">
                <p className="font-sans text-sm text-stone">Loading map...</p>
              </div>
            ) : (
              <MapChart
                stateMap={stateMap}
                onStateClick={(code) => navigate(`/states/${code}`)}
                onStateHover={setTooltip}
              />
            )}

            {/* Tooltip */}
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
        </RevealOnScroll>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-end gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-cream border border-border" />
            <span className="text-xs text-stone">0</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: '#a0ac97' }} />
            <span className="text-xs text-stone">1-5</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: '#8a9a81' }} />
            <span className="text-xs text-stone">6-25</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-sage" />
            <span className="text-xs text-stone">26+</span>
          </div>
        </div>
      </Container>
    </motion.main>
  )
}
