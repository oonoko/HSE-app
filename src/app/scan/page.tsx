'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useApp } from '@/lib/context'
import { Suspense } from 'react'

function ScanContent() {
  const { user, ready, lang } = useApp()
  const router = useRouter()
  const params = useSearchParams()
  const qrCode = params.get('location')

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }

    if (qrCode) {
      fetch('/api/locations')
        .then(r => r.json())
        .then(result => {
          const loc = result.data?.find((item: { qr_code: string }) => item.qr_code === qrCode)
          if (loc) router.push(`/quiz?location=${loc.id}`)
        })
    }
  }, [ready, user, router, qrCode])

  if (!user) return null

  return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 20 }}>📱</div>
      <h2 style={{ fontWeight: 700, fontSize: 20, color: '#0d2d6b', marginBottom: 8 }}>
        {lang === 'mn' ? 'QR Уншиж байна...' : 'Reading QR Code...'}
      </h2>
      {qrCode ? (
        <p style={{ color: '#6b7280' }}>
          {lang === 'mn' ? `Код: ${qrCode}` : `Code: ${qrCode}`}
        </p>
      ) : (
        <p style={{ color: '#6b7280' }}>
          {lang === 'mn' ? 'QR код олдсонгүй' : 'No QR code found'}
        </p>
      )}
    </div>
  )
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>}>
      <ScanContent />
    </Suspense>
  )
}
