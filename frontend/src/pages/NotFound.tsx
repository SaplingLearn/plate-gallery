import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plate as PlateSvg } from '@/components/Plate'

export default function NotFound() {
  return (
    <motion.main
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.25 }}
      className="flex min-h-[calc(100vh-72px)] items-center justify-center px-8 py-10"
    >
      <div
        className="w-full max-w-[640px] rounded-[22px] border-[1.5px] border-rule bg-paper p-10 text-center"
        style={{ boxShadow: '0 4px 0 var(--color-rule)' }}
      >
        <div className="font-mono text-[11px] font-bold uppercase tracking-[1.5px] text-ink-muted">
          ERROR · 404 · DEAD END
        </div>
        <div className="mt-2 font-display text-[96px] font-black uppercase leading-[0.88] tracking-[-3px] text-ink">
          WRONG <br />EXIT.
        </div>
        <p className="mt-3 text-[15px] font-semibold text-ink-soft">
          This road leads nowhere. The page you're looking for has moved or
          never existed.
        </p>
        <div className="mt-6 flex justify-center">
          <PlateSvg text="404OOPS" state="CA" width={300} tilt={-3} />
        </div>
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <Link
            to="/"
            className="rounded-full bg-rust px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-wide text-white"
            style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
          >
            BACK TO THE FEED →
          </Link>
          <Link
            to="/states"
            className="rounded-full border-[1.5px] border-rule bg-cream px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-wide text-ink"
          >
            BROWSE THE MAP
          </Link>
        </div>
      </div>
    </motion.main>
  )
}
