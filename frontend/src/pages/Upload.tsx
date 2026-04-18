import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useUploadSign, useCreatePlate } from '@/hooks/useApi'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { US_STATES } from '@/lib/states'
import { ApiError } from '@/lib/api'
import { StateBadge } from '@/components/StateBadge'
import { Pill } from '@/components/Pill'
import { PG } from '@/lib/design'

const MAX_FILE_SIZE = 10 * 1024 * 1024
// iOS Safari auto-converts HEIC camera photos to JPEG when HEIC isn't in the accept list.
// Browsers other than Safari can't render HEIC, so we keep it out of the allowed set entirely.
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type Step = 'choose' | 'details' | 'submitting' | 'error' | 'rejected'

function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2.5">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink">
          {label}
        </div>
        {hint && <div className="text-[11px] font-semibold text-ink-muted">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

export default function Upload() {
  const { loading } = useRequireAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('choose')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [plateText, setPlateText] = useState('')
  const [stateCode, setStateCode] = useState('')
  const [caption, setCaption] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [errorHeadline, setErrorHeadline] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const signMutation = useUploadSign()
  const createMutation = useCreatePlate()

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setErrorHeadline('Wrong file type.')
      setErrorMessage('Please upload a JPEG, PNG, or WebP image.')
      setStep('error')
      return
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorHeadline('Too large.')
      setErrorMessage('Images must be under 10 MB.')
      setStep('error')
      return
    }
    setFile(selectedFile)
    setPreview(URL.createObjectURL(selectedFile))
    setStep('details')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFileSelect(f)
  }, [handleFileSelect])

  async function handleSubmit() {
    if (!file || !plateText || !stateCode) return
    setStep('submitting')
    try {
      setStatusMessage('Preparing upload…')
      const hashBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const clientHash = 'sha256:' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

      const signData = await signMutation.mutateAsync({
        content_type: file.type,
        file_size_bytes: file.size,
        client_hash: clientHash,
      })

      setStatusMessage('Uploading image…')
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', signData.signed_url)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed')))
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.send(file)
      })

      setStatusMessage('Running auto-moderation…')
      const plate = await createMutation.mutateAsync({
        upload_token: signData.upload_token,
        object_path: signData.object_path,
        plate_text: plateText.toUpperCase(),
        state_code: stateCode,
        caption: caption || undefined,
      })

      setStatusMessage('Published!')
      setTimeout(() => navigate(`/plate/${plate.id}`), 600)
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
        setStep('rejected')
      } else if (err instanceof ApiError && err.code === 'rate_limited') {
        setErrorHeadline("You've uploaded a lot today.")
        setErrorMessage('Come back in a bit.')
        setStep('error')
      } else {
        setErrorHeadline('Something went wrong.')
        setErrorMessage(err instanceof Error ? err.message : 'Please try again.')
        setStep('error')
      }
    }
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setPlateText('')
    setStateCode('')
    setCaption('')
    setStatusMessage('')
    setErrorHeadline('')
    setErrorMessage('')
    setStep('choose')
  }

  if (loading) return null

  return (
    <motion.main
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.25 }}
      className="px-10 py-6"
    >
      <div className="flex flex-wrap items-baseline gap-5">
        <h1 className="font-display text-[64px] font-black uppercase leading-[0.9] tracking-[-2px] text-ink">
          POST A PLATE.
        </h1>
        <div className="text-[14px] font-semibold text-ink-soft">
          {step === 'choose' && <>Step <strong className="text-ink">1 of 3</strong> · Pick a photo</>}
          {step === 'details' && <>Step <strong className="text-ink">2 of 3</strong> · Confirm details & submit</>}
          {(step === 'submitting' || step === 'error' || step === 'rejected') && <>Step <strong className="text-ink">3 of 3</strong> · Review</>}
        </div>
        <div className="ml-auto flex gap-1.5">
          {['Snap', 'Details', 'Review'].map((l, i) => {
            const reached = (step === 'choose' && i < 1) ||
              (step === 'details' && i < 2) ||
              ((step === 'submitting' || step === 'error' || step === 'rejected') && i < 3)
            return (
              <div key={l} className="h-2 w-20 rounded-full border-[1.5px] border-rule" style={{ background: reached ? PG.c.rust : PG.c.paperEdge }} />
            )
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Left: preview */}
        <div
          className="flex flex-col rounded-[18px] border-[1.5px] border-rule bg-paper p-5"
          style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
        >
          <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink-muted">
            YOUR SNAP
          </div>
          <div className="flex flex-1 items-center justify-center rounded-xl border-[1.5px] border-dashed border-rule bg-cream p-6">
            {preview ? (
              <div
                className="-rotate-1 overflow-hidden rounded border-[1.5px] border-rule"
                style={{ boxShadow: '0 8px 24px rgba(40,26,10,0.22), 0 2px 0 var(--color-rule)' }}
              >
                <img src={preview} alt="Your plate" className="block h-auto max-h-[360px] w-full max-w-[440px] object-cover" />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="flex w-full flex-col items-center gap-2 py-14 text-center"
              >
                <div className="font-display text-[40px] font-black uppercase tracking-tight text-ink">DROP A PHOTO</div>
                <p className="text-[13px] font-semibold text-ink-soft">
                  or click to browse · JPEG, PNG, WebP · max 10 MB
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFileSelect(f)
                  }}
                />
              </button>
            )}
          </div>

          {step === 'details' && (
            <div className="mt-4 rounded-xl border-[1.5px] border-rule bg-cream p-3.5">
              <div className="mb-2 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-rule bg-mint font-black text-white">
                  ✓
                </div>
                <div>
                  <div className="font-display text-[22px] font-black leading-none tracking-tight text-ink">
                    PHOTO LOCKED IN
                  </div>
                  <p className="text-[12px] font-semibold text-ink-soft">
                    Full moderation runs when you submit.
                  </p>
                </div>
                <div className="ml-auto font-mono text-[10px] font-bold uppercase tracking-wide text-mint">
                  READY
                </div>
              </div>
              {[
                { label: 'Contains a license plate', sub: 'checked after submit' },
                { label: 'Readable plate text', sub: 'we detect + you confirm' },
                { label: 'SFW / non-offensive', sub: 'AI moderation · runs on submit' },
                { label: 'Not a duplicate', sub: 'pHash compared on submit' },
              ].map((c, i) => (
                <div
                  key={c.label}
                  className="flex items-center gap-2.5 py-1.5 text-[13px]"
                  style={{ borderTop: i === 0 ? 'none' : '1px dashed var(--color-paper-edge)' }}
                >
                  <span className="font-black text-ink-muted">○</span>
                  <span className="font-bold text-ink">{c.label}</span>
                  <span className="ml-auto font-mono text-[10px] font-bold text-ink-muted">{c.sub}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: form / status */}
        {step === 'details' && (
          <div className="flex flex-col gap-4">
            <FormRow label="PLATE TEXT" hint="Up to 8 characters. We'll uppercase it.">
              <div
                className="flex items-center gap-3 rounded-xl border-[1.5px] border-rule bg-paper px-4 py-3"
                style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
              >
                <input
                  type="text"
                  value={plateText}
                  onChange={(e) => setPlateText(e.target.value.toUpperCase().slice(0, 8))}
                  placeholder="FARMLYF"
                  maxLength={8}
                  className="flex-1 bg-transparent font-display text-[40px] font-black uppercase leading-none tracking-tight text-ink outline-none placeholder:text-ink-muted"
                />
                <Pill bg={PG.c.mustardLite}>{plateText.length} / 8 CHARS</Pill>
              </div>
            </FormRow>

            <FormRow label="STATE" hint="Where was the plate spotted?">
              <div className="flex flex-wrap gap-2">
                {stateCode ? (
                  <div className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-rule bg-ink px-3.5 py-2.5 text-cream">
                    <StateBadge code={stateCode} />
                    <div>
                      <div className="font-display text-[18px] font-black leading-none tracking-tight">{US_STATES[stateCode]?.toUpperCase()}</div>
                      <div className="text-[11px] font-semibold opacity-70">selected</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStateCode('')}
                      className="ml-2 text-[18px] leading-none opacity-70 hover:opacity-100"
                      aria-label="Clear state"
                    >
                      ×
                    </button>
                  </div>
                ) : null}
                <select
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  className="rounded-xl border-[1.5px] border-rule bg-paper px-3.5 py-2.5 font-sans text-[13px] font-bold text-ink outline-none"
                >
                  <option value="">Choose a state…</option>
                  {Object.entries(US_STATES).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
            </FormRow>

            <FormRow label="CAPTION" hint="Optional. What made you stop?">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 140))}
                placeholder="spotted outside Fenway before the game…"
                rows={3}
                className="w-full resize-none rounded-xl border-[1.5px] border-rule bg-paper px-4 py-3 font-sans text-[15px] font-medium leading-snug text-ink outline-none placeholder:text-ink-muted"
              />
              <div className="mt-1 text-right text-[11px] font-bold text-ink-muted">{caption.length}/140</div>
            </FormRow>

            <div className="mt-auto flex items-center gap-3 pt-2">
              <div className="text-[12px] font-bold text-ink-soft">
                By posting you agree to the <span className="text-cobalt">community guidelines</span>.
              </div>
              <button
                type="button"
                onClick={reset}
                className="ml-auto h-12 rounded-full border-[1.5px] border-rule bg-paper px-5 font-sans text-[14px] font-extrabold text-ink"
              >
                ◀ BACK
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!plateText || !stateCode}
                className="h-12 rounded-full border-[1.5px] border-rule bg-rust px-7 font-display text-[22px] font-black tracking-wide text-white disabled:opacity-60"
                style={{ boxShadow: '0 4px 0 var(--color-rust-deep)' }}
              >
                SUBMIT PLATE →
              </button>
            </div>
          </div>
        )}

        {step === 'choose' && (
          <div className="flex flex-col justify-center">
            <div className="font-display text-[36px] font-black uppercase leading-[0.95] tracking-tight text-ink">
              Step 1 — a clear photo
              <br />
              of the plate.
            </div>
            <p className="mt-3 max-w-md text-[14px] font-semibold text-ink-soft">
              Horizontal crop works best. We'll auto-detect the state and plate text, then you confirm. Max 10 MB.
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-6 h-12 w-fit rounded-full border-[1.5px] border-rule bg-rust px-6 font-display text-[20px] font-black tracking-wide text-white"
              style={{ boxShadow: '0 4px 0 var(--color-rust-deep)' }}
            >
              CHOOSE A PHOTO →
            </button>
          </div>
        )}

        {step === 'submitting' && (
          <div className="flex flex-col items-center justify-center rounded-[18px] border-[1.5px] border-rule bg-paper p-10 text-center">
            <div className="font-display text-[44px] font-black uppercase leading-none tracking-tight text-ink">
              {statusMessage || 'Working…'}
            </div>
            <p className="mt-3 text-[13px] font-semibold text-ink-soft">
              Hang tight — auto-moderation takes a couple seconds.
            </p>
          </div>
        )}

        {(step === 'error' || step === 'rejected') && (
          <div className="flex flex-col items-center justify-center rounded-[18px] border-[1.5px] border-rule bg-mustard-lite p-10 text-center">
            <div className="font-display text-[44px] font-black uppercase leading-[0.95] tracking-tight text-ink">
              {errorHeadline}
            </div>
            <p className="mt-3 text-[14px] font-semibold text-ink">{errorMessage}</p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-full border-[1.5px] border-rule bg-ink px-5 py-2.5 font-sans text-[13px] font-extrabold text-cream"
            >
              Try again →
            </button>
          </div>
        )}
      </div>
    </motion.main>
  )
}
