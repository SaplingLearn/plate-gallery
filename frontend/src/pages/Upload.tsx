import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Container } from '@/components/Container'
import { Eyebrow } from '@/components/Eyebrow'
import { RevealOnScroll } from '@/components/RevealOnScroll'
import { useUploadSign, useCreatePlate } from '@/hooks/useApi'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { US_STATES } from '@/lib/states'
import { ApiError } from '@/lib/api'

type UploadStep = 'choose' | 'preview' | 'submitting' | 'error'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export default function Upload() {
  const { loading } = useRequireAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<UploadStep>('choose')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [plateText, setPlateText] = useState('')
  const [stateCode, setStateCode] = useState('')
  const [caption, setCaption] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [errorHeadline, setErrorHeadline] = useState('')

  const signMutation = useUploadSign()
  const createMutation = useCreatePlate()

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setErrorHeadline("Wrong file type.")
      setErrorMessage('Please upload a JPEG, PNG, or WebP image.')
      setStep('error')
      return
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorHeadline("Too large.")
      setErrorMessage('Images must be under 10 MB.')
      setStep('error')
      return
    }

    setFile(selectedFile)
    setPreview(URL.createObjectURL(selectedFile))
    setStep('preview')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) handleFileSelect(droppedFile)
  }, [handleFileSelect])

  const handleSubmit = async () => {
    if (!file || !plateText || !stateCode) return

    setStep('submitting')

    try {
      // Step 1: Get signed URL
      setStatusMessage('Preparing upload...')
      const hashBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const clientHash = 'sha256:' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

      const signData = await signMutation.mutateAsync({
        content_type: file.type,
        file_size_bytes: file.size,
        client_hash: clientHash,
      })

      // Step 2: Upload to Supabase Storage via signed URL
      setStatusMessage('Uploading image...')
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', signData.signed_url)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed')))
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.send(file)
      })

      // Step 3: Create plate (triggers moderation)
      setStatusMessage('Checking your plate...')
      setUploadProgress(100)
      const plate = await createMutation.mutateAsync({
        upload_token: signData.upload_token,
        object_path: signData.object_path,
        plate_text: plateText.toUpperCase(),
        state_code: stateCode,
        caption: caption || undefined,
      })

      setStatusMessage('Published!')
      setTimeout(() => navigate(`/plate/${plate.id}`), 800)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'moderation_rejected') {
        const reason = (err.details as { reason?: string } | undefined)?.reason
        setErrorHeadline("This one didn't make it.")
        setErrorMessage(
          reason === 'not_a_plate' ? "We couldn't find a license plate in this photo." :
          reason === 'explicit' ? 'This image was flagged as inappropriate.' :
          reason === 'duplicate' ? 'This plate has already been uploaded.' :
          reason === 'offensive_text' ? 'The plate text was flagged as offensive.' :
          'This upload was rejected by our moderation system.'
        )
      } else if (err instanceof ApiError && err.code === 'rate_limited') {
        setErrorHeadline("You've uploaded a lot today.")
        setErrorMessage('Come back in a bit.')
      } else {
        setErrorHeadline('Something went wrong.')
        setErrorMessage(err instanceof Error ? err.message : 'Please try again.')
      }
      setStep('error')
    }
  }

  if (loading) return null

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.3 }}
      className="pt-24 pb-16"
    >
      <Container className="max-w-2xl">
        <RevealOnScroll>
          <Eyebrow>Contribute</Eyebrow>
          <h1 className="mt-4 font-display text-4xl text-charcoal md:text-5xl">
            Upload a plate
          </h1>
        </RevealOnScroll>

        <AnimatePresence mode="wait">
          {step === 'choose' && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="mt-12"
            >
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed border-border py-24 transition-colors hover:border-stone"
              >
                <h3 className="font-display text-xl text-charcoal">
                  Drop your photo here
                </h3>
                <p className="mt-2 text-sm text-stone">
                  or click to browse &middot; JPEG, PNG, WebP &middot; max 10 MB
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFileSelect(f)
                  }}
                />
              </div>
            </motion.div>
          )}

          {step === 'preview' && preview && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="mt-12"
            >
              <img
                src={preview}
                alt="Preview"
                className="aspect-[4/3] w-full rounded-sm object-cover"
              />

              <div className="mt-8 space-y-6">
                <div>
                  <label htmlFor="plateText" className="block font-sans text-xs uppercase tracking-[0.2em] text-stone">
                    Plate Text
                  </label>
                  <input
                    id="plateText"
                    type="text"
                    maxLength={8}
                    value={plateText}
                    onChange={(e) => setPlateText(e.target.value.toUpperCase())}
                    placeholder="e.g. FARMLYF"
                    className="mt-2 w-full border-b border-border bg-transparent py-2 font-display text-2xl tracking-[0.1em] text-charcoal outline-none placeholder:text-stone/40 focus:border-charcoal"
                  />
                </div>

                <div>
                  <label htmlFor="stateCode" className="block font-sans text-xs uppercase tracking-[0.2em] text-stone">
                    State
                  </label>
                  <select
                    id="stateCode"
                    value={stateCode}
                    onChange={(e) => setStateCode(e.target.value)}
                    className="mt-2 w-full border-b border-border bg-transparent py-2 font-sans text-sm text-ink outline-none focus:border-charcoal"
                  >
                    <option value="">Select a state</option>
                    {Object.entries(US_STATES).map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="caption" className="block font-sans text-xs uppercase tracking-[0.2em] text-stone">
                    Caption (optional)
                  </label>
                  <input
                    id="caption"
                    type="text"
                    maxLength={140}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Where did you spot it?"
                    className="mt-2 w-full border-b border-border bg-transparent py-2 font-sans text-sm text-ink outline-none placeholder:text-stone/40 focus:border-charcoal"
                  />
                  <p className="mt-1 text-right text-xs text-stone">{caption.length}/140</p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => { setStep('choose'); setFile(null); setPreview(null) }}
                    className="rounded-sm border border-border px-6 py-3 font-sans text-sm text-stone transition-colors hover:text-charcoal"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!plateText || !stateCode}
                    className="flex-1 rounded-sm bg-oxblood px-6 py-3 font-sans text-sm text-bone transition-colors hover:bg-oxblood/90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Submit
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'submitting' && (
            <motion.div
              key="submitting"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="mt-24 text-center"
            >
              <p className="font-display text-xl text-charcoal">{statusMessage}</p>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mx-auto mt-6 h-1 w-48 overflow-hidden rounded-full bg-cream">
                  <motion.div
                    className="h-full bg-oxblood"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </motion.div>
          )}

          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="mt-24 text-center"
            >
              <h2 className="font-display text-2xl text-charcoal">{errorHeadline}</h2>
              <p className="mt-2 text-sm text-stone">{errorMessage}</p>
              <button
                onClick={() => { setStep('choose'); setFile(null); setPreview(null); setUploadProgress(0) }}
                className="link-draw mt-8 font-sans text-sm text-oxblood"
              >
                Try again <span aria-hidden="true">&rarr;</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </Container>
    </motion.main>
  )
}
