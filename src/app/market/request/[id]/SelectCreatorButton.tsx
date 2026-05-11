'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SelectCreatorButton({
  applicationId,
  requestId,
  creatorId,
  creatorName,
}: {
  applicationId: string
  requestId: string
  creatorId: string
  creatorName: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSelect = async () => {
    setLoading(true)
    await fetch('/api/requests/select-creator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId, requestId, creatorId }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleSelect}
      disabled={loading}
      className="mt-2 w-full text-xs bg-[#B8902A] hover:bg-[#a07820] disabled:bg-stone-200 text-white font-semibold py-2 rounded-lg transition-colors"
    >
      {loading ? 'Selecting...' : `Select ${creatorName}`}
    </button>
  )
}
