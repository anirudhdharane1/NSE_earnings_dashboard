// src/components/OCRComponent.tsx
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { createWorker, PSM } from 'tesseract.js'

type OcrResult = {
  rawText: string
  items: Array<{
    originalText: string
    dateISO: string // YYYY-MM-DD
    time24?: string // HH:MM
    afterClose: boolean
  }>
}

type Props = {
  images: File[] // image files selected in the dashboard
  onExtract: (result: OcrResult) => void
}

const MAX_DIM = 2000

async function downscaleImage(file: File): Promise<HTMLCanvasElement> {
  const img = new Image()
  const url = URL.createObjectURL(file)
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = url
    })
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (Math.max(w, h) <= MAX_DIM) {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      return c
    }
    const scale = MAX_DIM / Math.max(w, h)
    const c = document.createElement('canvas')
    c.width = Math.round(w * scale)
    c.height = Math.round(h * scale)
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0, c.width, c.height)
    return c
  } finally {
    URL.revokeObjectURL(url)
  }
}

function parseDateTokens(text: string): { dateISO?: string; time24?: string }[] {
  // Flexible regex patterns
  const monthMap: Record<string, number> = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  // Match common date formats:
  // - DD Mon YYYY (e.g., 12 Aug 2025)
  // - Mon DD, YYYY (e.g., Aug 12, 2025)
  // - DD/MM/YYYY or DD-MM-YYYY
  // - YYYY-MM-DD
  const datePatterns = [
    /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/g,                    // 12 Aug 2025
    /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g,                    // Aug 12, 2025
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g,                         // 12/08/2025 or 12-08-2025
    /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g,                         // 2025-08-12
  ]

  // Times like 15:30, 3:30 PM, 15.30
  const timePattern = /\b(\d{1,2})[:\.](\d{2})\s*(AM|PM|am|pm)?\b/g

  const results: { dateISO?: string; time24?: string }[] = []

  for (const line of lines) {
    // Extract times in the same line
    const times: string[] = []
    let tMatch
    while ((tMatch = timePattern.exec(line)) !== null) {
      let hh = parseInt(tMatch[1], 10)
      const mm = tMatch[1]
      const ap = tMatch[2]?.toLowerCase()
      if (ap === 'pm' && hh < 12) hh += 12
      if (ap === 'am' && hh === 12) hh = 0
      const hhStr = String(hh).padStart(2, '0')
      times.push(`${hhStr}:${mm}`)
    }

    // For each date match found in the line, pair with first found time (if any)
    for (const pat of datePatterns) {
      let m
      while ((m = pat.exec(line)) !== null) {
        let y = 0, mon = 0, d = 0
        if (pat === datePatterns) {
          // DD Mon YYYY
          d = parseInt(m[3], 10)
          const monTxt = m[1].toLowerCase()
          mon = monthMap[monTxt] ?? 0
          y = parseInt(m[2], 10)
        } else if (pat === datePatterns[3]) {
          // Mon DD, YYYY
          const monTxt = m[3].toLowerCase()
          mon = monthMap[monTxt] ?? 0
          d = parseInt(m[1], 10)
          y = parseInt(m[2], 10)
        } else if (pat === datePatterns[1]) {
          // DD/MM/YYYY or DD-MM-YYYY
          d = parseInt(m[3], 10)
          mon = parseInt(m[1], 10)
          y = parseInt(m[2], 10)
        } else {
          // YYYY-MM-DD
          y = parseInt(m[3], 10)
          mon = parseInt(m[1], 10)
          d = parseInt(m[2], 10)
        }
        if (!y || !mon || !d) continue
        const dateISO = new Date(Date.UTC(y, mon - 1, d)).toISOString().slice(0, 10)
        const time24 = times // optional
        results.push({ dateISO, time24 })
      }
    }
  }

  return results
}

function deriveAfterClose(time24?: string): boolean {
  // NSE close cutoff ~15:15; if no time found, assume after-close to be conservative
  if (!time24) return true
  const [hh, mm] = time24.split(':').map(n => parseInt(n, 10))
  if (Number.isNaN(hh) || Number.isNaN(mm)) return true
  return hh > 15 || (hh === 15 && mm >= 15)
}

export default function OCRComponent({ images, onExtract }: Props) {
  const [progress, setProgress] = useState<number>(0)
  const [running, setRunning] = useState(false)
  const workerRef = useRef<ReturnType<typeof createWorker> | null>(null)

  const initWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current
    const worker = await createWorker({
      logger: m => {
        if (m.status === 'recognizing text' && m.progress != null) {
          setProgress(Math.round(m.progress * 100))
        }
      },
    })
    await worker.loadLanguage('eng')
    await worker.initialize('eng')
    await worker.setParameters({
      tessedit_pageseg_mode: String(PSM.SPARSE_TEXT), // robust for posters/calendar-like layouts
    })
    workerRef.current = worker
    return worker
  }, [])

  const cleanup = useCallback(async () => {
    if (workerRef.current) {
      await workerRef.current.terminate()
      workerRef.current = null
    }
  }, [])

  const run = useCallback(async () => {
    if (!images?.length) return
    setRunning(true)
    try {
      const worker = await initWorker()
      let fullText = ''
      const collected: { dateISO?: string; time24?: string }[] = []

      for (let i = 0; i < images.length; i++) {
        const canvas = await downscaleImage(images[i])
        const dataUrl = canvas.toDataURL('image/png')
        const { data: { text } } = await worker.recognize(dataUrl)
        fullText += (i > 0 ? '\n' : '') + text
        const parts = parseDateTokens(text)
        collected.push(...parts)
      }

      // Deduplicate by dateISO+time24, preserve order
      const seen = new Set<string>()
      const items = collected
        .filter(x => x.dateISO)
        .map(x => {
          const key = `${x.dateISO}|${x.time24 || ''}`
          return { key, dateISO: x.dateISO!, time24: x.time24 }
        })
        .filter(({ key }) => {
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .map(({ dateISO, time24 }) => ({
          originalText: '', // optional to keep
          dateISO,
          time24,
          afterClose: deriveAfterClose(time24),
        }))

      onExtract({ rawText: fullText, items })
    } finally {
      setRunning(false)
      setProgress(0)
      // keep worker warm for subsequent runs; call cleanup() when unmounting if desired
    }
  }, [images, initWorker, onExtract])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          className="btn btn-primary"
          onClick={run}
          disabled={running || !images?.length}
        >
          {running ? `OCR ${progress}%` : 'Run OCR'}
        </button>
        {running && <button className="btn btn-secondary" onClick={cleanup}>Cancel</button>}
      </div>
      <p className="text-xs text-muted-foreground">
        OCR runs locally in the browser using tesseract.js. Large images are downscaled for speed.
      </p>
    </div>
  )
}
