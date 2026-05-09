'use client'

import { useState } from 'react'

type Offer = {
  id: string
  amount: number
  expires_at: string
  artworks: { id: string; title_ja: string; title_en: string; image_url: string | null }
}

export default function SecondChanceSection({
  offers,
  locale,
}: {
  offers: Offer[]
  locale: string
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, string>>({})

  const respond = async (offerId: string, accept: boolean) => {
    setLoading(offerId)
    try {
      const res = await fetch('/api/second-chance/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId, accept }),
      })
      const data = await res.json()
      if (!accept) {
        setMessages((p) => ({ ...p, [offerId]: 'Offer declined.' }))
      } else if (data.url) {
        window.location.href = data.url
      } else {
        setMessages((p) => ({ ...p, [offerId]: data.error ?? 'Error' }))
      }
    } catch {
      setMessages((p) => ({ ...p, [offerId]: 'Network error' }))
    }
    setLoading(null)
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">🎯 Second Chance Offers</h2>
      <p className="text-xs text-gray-400 mb-4">The original winner didn't pay. You can purchase this artwork at your bid price.</p>
      <div className="space-y-4">
        {offers.map((offer) => {
          const artwork = offer.artworks
          const title = locale === 'ja' ? artwork?.title_ja : artwork?.title_en
          const hoursLeft = Math.max(0, Math.floor((new Date(offer.expires_at).getTime() - Date.now()) / 3600000))

          if (messages[offer.id] === 'Offer declined.') {
            return (
              <div key={offer.id} className="bg-stone-50 rounded-xl p-4 border border-stone-200 text-xs text-gray-400">
                Offer declined.
              </div>
            )
          }

          return (
            <div key={offer.id} className="bg-[#FBF6EC] rounded-xl p-5 border border-[#B8902A] space-y-3">
              <div className="flex items-center gap-4">
                {artwork?.image_url && (
                  <img src={artwork.image_url} alt={title} className="w-14 h-14 rounded-lg object-cover pointer-events-none" draggable={false} />
                )}
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{title}</p>
                  <p className="text-2xl font-bold text-[#B8902A]">${offer.amount.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">Expires in {hoursLeft}h</p>
                </div>
              </div>

              {messages[offer.id] ? (
                <p className="text-xs text-gray-500">{messages[offer.id]}</p>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => respond(offer.id, true)}
                    disabled={loading === offer.id}
                    className="flex-1 bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                  >
                    {loading === offer.id ? 'Processing...' : 'Accept & Pay'}
                  </button>
                  <button
                    onClick={() => respond(offer.id, false)}
                    disabled={loading === offer.id}
                    className="px-5 bg-white hover:bg-stone-50 text-gray-500 border border-stone-300 py-2.5 rounded-xl text-sm transition-colors"
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
