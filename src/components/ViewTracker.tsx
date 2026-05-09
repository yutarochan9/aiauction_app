'use client'

import { useEffect } from 'react'

export default function ViewTracker({ artworkId }: { artworkId: string }) {
  useEffect(() => {
    fetch('/api/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artworkId }),
    })
  }, [artworkId])
  return null
}
