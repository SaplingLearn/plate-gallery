import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plate as PlateSvg } from '@/components/Plate'
import { Pill } from '@/components/Pill'
import { PG } from '@/lib/design'

export default function About() {
  return (
    <motion.main
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.25 }}
      className="px-8 py-8"
    >
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-[22px] border-[1.5px] border-rule bg-ink px-8 py-10 text-cream"
        style={{ boxShadow: '0 4px 0 var(--color-rule)' }}
      >
        <svg
          className="absolute inset-0 h-full w-full opacity-30"
          viewBox="0 0 900 300"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <g stroke="var(--color-mustard)" strokeWidth="4" strokeDasharray="30 30" fill="none">
            <line x1="0" y1="230" x2="900" y2="230" />
            <line x1="0" y1="240" x2="900" y2="240" />
          </g>
        </svg>
        <div className="relative flex flex-wrap items-center gap-8">
          <div className="flex-1 min-w-[320px]">
            <div className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[1.5px] text-mustard">
              ABOUT · WHY THIS EXISTS
            </div>
            <div className="font-display text-[82px] font-black uppercase leading-[0.86] tracking-[-2.5px]">
              A LIVING MAP <br />OF ROAD WIT.
            </div>
            <p className="mt-3 max-w-[540px] text-[15px] font-semibold leading-snug text-cream/85">
              PlateGallery is a community archive of America's best vanity
              license plates. Snap one in the wild, upload it, and let the
              country vote on whether it's destiny or just decent pun work.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Pill bg={PG.c.rust} fg={PG.c.cream}>
                ALL 50 + DC
              </Pill>
              <Pill bg={PG.c.mustard} fg={PG.c.ink}>
                AUTO-MODERATED
              </Pill>
              <Pill bg={PG.c.cobalt} fg={PG.c.cream}>
                COMMUNITY-VOTED
              </Pill>
            </div>
          </div>
          <div className="hidden -rotate-3 lg:block">
            <PlateSvg text="HOWDY" state="TX" width={240} />
          </div>
        </div>
      </section>

      {/* Sections */}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div
          className="rounded-[18px] border-[1.5px] border-rule bg-paper p-5"
          style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
        >
          <div className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink-muted">
            HOW IT WORKS
          </div>
          <div className="mt-1 font-display text-[34px] font-black uppercase leading-[0.9] tracking-[-0.8px] text-ink">
            SPOT. SNAP. <br />POST.
          </div>
          <p className="mt-2 text-[14px] font-semibold leading-snug text-ink-soft">
            Upload any vanity plate you spot. Our auto-moderator reads it, screens
            it, and drops it into the gallery. Votes decide what makes the hall
            of plates.
          </p>
        </div>

        <div
          className="rounded-[18px] border-[1.5px] border-rule bg-mustard-lite p-5"
          style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
        >
          <div className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink">
            MODERATION
          </div>
          <div className="mt-1 font-display text-[34px] font-black uppercase leading-[0.9] tracking-[-0.8px] text-ink">
            CLEAN GALLERY, <br />NO QUEUE.
          </div>
          <p className="mt-2 text-[14px] font-semibold leading-snug text-ink">
            Every upload is checked in real time: is it a real plate, does it
            read clean, has it been posted before. No human queue — just instant
            yes-or-no.
          </p>
        </div>

        <div
          className="rounded-[18px] border-[1.5px] border-rule bg-rust p-5 text-cream"
          style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
        >
          <div className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-mustard">
            THE STACK
          </div>
          <div className="mt-1 font-display text-[34px] font-black uppercase leading-[0.9] tracking-[-0.8px]">
            BUILT FOR <br />THE ROAD.
          </div>
          <p className="mt-2 text-[14px] font-semibold leading-snug text-cream/90">
            React + Vite on Cloudflare Pages. FastAPI + Supabase on the back.
            Shipped for BostonHacks — now mapping the country, plate by plate.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[18px] border-[1.5px] border-rule bg-paper p-5">
        <div>
          <div className="font-display text-[28px] font-black uppercase leading-[0.95] tracking-[-0.5px] text-ink">
            SPOTTED A GREAT ONE?
          </div>
          <div className="text-[13px] font-semibold text-ink-soft">
            Post it, rally the votes, claim a state.
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link
            to="/upload"
            className="rounded-full bg-rust px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-wide text-white"
            style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
          >
            POST A PLATE →
          </Link>
          <Link
            to="/"
            className="rounded-full border-[1.5px] border-rule bg-cream px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-wide text-ink"
          >
            BROWSE THE FEED
          </Link>
        </div>
      </div>
    </motion.main>
  )
}
