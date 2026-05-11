'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

const PRESET_TAGS = [
  'anime', 'realistic', 'fantasy', 'cyberpunk', 'vtuber',
  'chibi', 'sci-fi', 'dark', 'cute', 'futuristic',
]

export default function SearchFilter({
  currentQ,
  currentTag,
  currentSort,
}: {
  currentQ: string
  currentTag: string
  currentSort: string
}) {
  const router = useRouter()
  const [q, setQ] = useState(currentQ)
  const [, startTransition] = useTransition()

  const updateParams = (newQ: string, newTag: string, sort?: string) => {
    const params = new URLSearchParams()
    if (newQ) params.set('q', newQ)
    if (newTag) params.set('tag', newTag)
    if (sort ?? currentSort) params.set('sort', sort ?? currentSort)
    startTransition(() => {
      router.push(`/?${params.toString()}`)
    })
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Search input */}
      <form
        onSubmit={(e) => { e.preventDefault(); updateParams(q, currentTag) }}
        className="relative"
      >
        <svg className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search avatars..."
          className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-10 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#B8902A] transition-colors text-sm"
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(''); updateParams('', currentTag) }}
            className="absolute right-3 top-3.5 text-gray-300 hover:text-gray-500"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </form>

      {/* Tag filters */}
      <div className="flex flex-wrap gap-2">
        {PRESET_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => updateParams(q, currentTag === tag ? '' : tag)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              currentTag === tag
                ? 'bg-[#2C2C2C] text-white'
                : 'bg-stone-100 text-gray-500 hover:bg-stone-200'
            }`}
          >
            #{tag}
          </button>
        ))}
      </div>
    </div>
  )
}
