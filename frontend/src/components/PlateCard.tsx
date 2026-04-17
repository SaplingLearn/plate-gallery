import { Link } from 'react-router-dom'
import type { Plate } from '@/lib/types'

export function PlateCard({ plate, priority }: { plate: Plate; priority?: boolean }) {
  return (
    <Link to={`/plate/${plate.id}`} className="group block">
      <div className="overflow-hidden rounded-sm">
        <img
          src={plate.image_thumb_url || plate.image_url}
          alt={`Vanity plate reading '${plate.plate_text}' from ${plate.state_name}`}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="aspect-[4/5] w-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
        />
      </div>
      <div className="mt-3 flex items-center gap-2 font-sans text-xs text-stone">
        <span>{plate.state_code}</span>
        <span aria-hidden="true">&middot;</span>
        <span>{new Date(plate.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </div>
      <h3 className="mt-1 font-display text-xl tracking-tight text-charcoal group-hover:underline group-hover:underline-offset-4 group-hover:decoration-1">
        {plate.plate_text}
      </h3>
    </Link>
  )
}
