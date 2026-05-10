'use client'

import { useEffect, useState } from 'react'

type Settings = {
  language: string
  notify_push_outbid: boolean
  notify_push_new_bid: boolean
  notify_push_won: boolean
  notify_push_payment_deadline: boolean
  notify_push_follow_listed: boolean
}

const DEFAULT: Settings = {
  language: 'en',
  notify_push_outbid: true,
  notify_push_new_bid: true,
  notify_push_won: true,
  notify_push_payment_deadline: true,
  notify_push_follow_listed: true,
}

const NOTIFICATION_ITEMS = [
  { key: 'outbid',           label: 'Outbid',                        desc: 'Someone places a higher bid on an auction you\'re bidding on' },
  { key: 'new_bid',          label: 'New bid on your listing',        desc: 'Someone places a bid on your artwork' },
  { key: 'won',              label: 'Auction won',                    desc: 'You win an auction' },
  { key: 'payment_deadline', label: 'Payment deadline',              desc: 'Reminder before your payment deadline expires' },
  { key: 'follow_listed',    label: 'New listing from followed artist', desc: 'An artist you follow lists a new artwork' },
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${checked ? 'bg-[#B8902A]' : 'bg-stone-300'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) setSettings({ ...DEFAULT, ...data })
      })
      .finally(() => setLoading(false))
  }, [])

  const set = (key: keyof Settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setStatus('idle')
  }

  const handleSave = async () => {
    setSaving(true)
    setStatus('idle')
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error()
      // 言語をcookieに反映してページリロード
      document.cookie = `locale=${settings.language}; path=/; max-age=31536000`
      setStatus('saved')
      setTimeout(() => window.location.reload(), 300)
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="max-w-2xl mx-auto py-12 text-gray-400 text-sm">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white text-sm font-semibold px-6 py-2 rounded-xl transition-colors"
        >
          {saving ? 'Saving...' : status === 'saved' ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      {status === 'error' && (
        <p className="text-red-500 text-sm">Failed to save. Please try again.</p>
      )}

      {/* 言語設定 */}
      <section className="bg-white rounded-2xl border border-stone-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Language</h2>
        <div className="flex gap-3">
          {[{ value: 'en', label: 'English' }, { value: 'ja', label: '日本語' }].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => set('language', value)}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                settings.language === value
                  ? 'border-[#B8902A] bg-[#FBF6EC] text-[#B8902A]'
                  : 'border-stone-200 text-gray-500 hover:border-stone-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* プッシュ通知設定 */}
      <section className="bg-white rounded-2xl border border-stone-200 p-6 space-y-1">
        <h2 className="text-base font-semibold text-gray-900 mb-5">Push Notifications</h2>
        <div className="divide-y divide-stone-100">
          {NOTIFICATION_ITEMS.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-4">
              <div className="pr-4">
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
              <Toggle
                checked={(settings as any)[`notify_push_${key}`]}
                onChange={v => set(`notify_push_${key}` as keyof Settings, v)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* アカウント情報 */}
      <section className="bg-white rounded-2xl border border-stone-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Account</h2>
        <p className="text-xs text-gray-400">
          To change your display name, avatar, or SNS link, visit your{' '}
          <a href="/profile/edit" className="text-[#B8902A] hover:underline">profile page</a>.
        </p>
      </section>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white text-sm font-semibold px-8 py-3 rounded-xl transition-colors"
        >
          {saving ? 'Saving...' : status === 'saved' ? 'Saved ✓' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
