import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Container } from '@/components/Container'

export default function NotFound() {
  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.3 }}
      className="flex min-h-screen items-center justify-center"
    >
      <Container className="text-center">
        <h1 className="font-display text-5xl text-charcoal md:text-7xl">
          This road leads nowhere.
        </h1>
        <p className="mt-6 text-stone">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="link-draw mt-8 inline-block font-sans text-sm text-oxblood"
        >
          Back to the gallery &rarr;
        </Link>
      </Container>
    </motion.main>
  )
}
