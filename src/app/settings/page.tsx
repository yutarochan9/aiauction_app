'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const COUNTRIES = [
  '', 'Japan', 'United States', 'United Kingdom', 'Canada', 'Australia',
  'Germany', 'France', 'South Korea', 'China', 'Taiwan', 'Singapore',
  'Brazil', 'India', 'Mexico', 'Netherlands', 'Spain', 'Italy', 'Other',
]

type Settings = {
  language: string
  country: string
  notify_email_outbid: boolean
  notify_email_new_bid: boolean
  notify_email_won: boolean
  notify_email_payment_deadline: boolean
  notify_email_follow_listed: boolean
  notify_push_outbid: boolean
  notify_push_new_bid: boolean
  notify_push_won: boolean
  notify_push_payment_deadline: boolean
  notify_push_follow_listed: boolean
}

const DEFAULT: Settings = {
  language: 'en',
  country: '',
  notify_email_outbid: true,
  notify_email_new_bid: true,
  notify_email_won: true,
  notify_email_payment_deadline: true,
  notify_email_follow_listed: true,
  notify_push_outbid: true,
  notify_push_new_bid: true,
  notify_push_won: true,
  notify_push_payment_deadline: true,
  notify_push_follow_listed: true,
}

const NOTIFICATION_ITEMS = [
  { key: 'outbid',            label: 'Outbid',                  desc: 'Someone places a higher bid on an auction you\'re bidding on' },
  { key: 'new_bid',           label: 'New bid on your listing',  desc: 'Someone places a bid on your artwork' },
  { key: 'won',               label: 'Auction won',             desc: 'You win an auction' },
  { key: 'payment_deadline',  label: 'Payment deadline',        desc: 'Reminder before your payment deadline expires' },
  { key: 'follow_listed',     label: 'New listing from followed artist', desc: 'An artist you follow lists a new artwork' },
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${checked ? 'bg-[#B8902A]' : 'bg-stone-300'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<Settings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) setSettings({ ...DEFAULT, ...data })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const set = (key: keyof Settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    setSaved(true)
    if (settings.language !== (document.cookie.match(/locale=([^;]+)/)?.[1] ?? 'en')) {
      document.cookie = `locale=${settings.language}; path=/; max-age=31536000`
      router.refresh()
    }
  }

  if (loading) return <div className="max-w-2xl mx-auto py-12 text-gray-400 text-sm">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white text-sm font-semibold px-6 py-2 rounded-xl transition-colors"
        >
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      {/* 地域・言語 */}
      <section className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-900">Region & Language</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Language</label>
            <select
              value={settings.language}
              onChange={e => set('language', e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#B8902A]"
            >
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Country / Region</label>
            <select
              value={settings.country}
              onChange={e => set('country', e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#B8902A]"
            >
              {COUNTRIES.map(c => <option key={c} value={c}>{c || '— Select —'}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* 通知設定 */}
      <section className="bg-white rounded-2xl border border-stone-200 p-6 space-y-6">
        <h2 className="text-base font-semibold text-gray-900">Notifications</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left pb-3 text-xs text-gray-400 font-medium w-1/2">Event</th>
                <th className="text-center pb-3 text-xs text-gray-400 font-medium w-1/4">Email</th>
                <th className="text-center pb-3 text-xs text-gray-400 font-medium w-1/4">Push</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {NOTIFICATION_ITEMS.map(({ key, label, desc }) => (
                <tr key={key}>
                  <td className="py-4 pr-4">
                    <p className="text-gray-900 font-medium text-sm">{label}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{desc}</p>
                  </td>
                  <td className="text-center py-4">
                    <div className="flex justify-center">
                      <Toggle
                        checked={(settings as any)[`notify_email_${key}`]}
                        onChange={v => set(`notify_email_${key}` as keyof Settings, v)}
                      />
                    </div>
                  </td>
                  <td className="text-center py-4">
                    <div className="flex justify-center">
                      <Toggle
                        checked={(settings as any)[`notify_push_${key}`]}
                        onChange={v => set(`notify_push_${key}` as keyof Settings, v)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* アカウント情報 */}
      <section className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">Account</h2>
        <p className="text-xs text-gray-400">
          To change your display name, avatar, or SNS link, visit your{' '}
          <a href="/profile/edit" className="text-[#B8902A] hover:underline">profile page</a>.
        </p>
        <p className="text-xs text-gray-400">
          To delete your account or update your email, please contact support.
        </p>
      </section>

      <div className="flex justify-end pb-12">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#2C2C2C] hover:bg-[#3C3C3C] disabled:bg-stone-200 text-white text-sm font-semibold px-8 py-3 rounded-xl transition-colors"
        >
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
