import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export function RevealOnScroll({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      className={clsx(className)}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1],
        delay,
      }}
      viewport={{ once: true, margin: '-10%' }}
    >
      {children}
    </motion.div>
  )
}
