'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  display_name: string
  bio: string
  avatar_url: string
  sns_url: string
}

type NotifSettings = {
  notify_push_outbid: boolean
  notify_push_new_bid: boolean
  notify_push_won: boolean
  notify_push_payment_deadline: boolean
  notify_push_follow_listed: boolean
}

const DEFAULT_NOTIF: NotifSettings = {
  notify_push_outbid: true,
  notify_push_new_bid: true,
  notify_push_won: true,
  notify_push_payment_deadline: true,
  notify_push_follow_listed: true,
}

const NOTIFICATION_ITEMS = [
  { key: 'outbid',           label: 'Outbid',                          desc: "Someone places a higher bid on an auction you're bidding on" },
  { key: 'new_bid',          label: 'New bid on your listing',          desc: 'Someone places a bid on your artwork' },
  { key: 'won',              label: 'Auction won',                      desc: 'You win an auction' },
  { key: 'payment_deadline', label: 'Payment deadline',                desc: 'Reminder before your payment deadline expires' },
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
  const fileRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<Profile>({ display_name: '', bio: '', avatar_url: '', sns_url: '' })
  const [notif, setNotif] = useState<NotifSettings>(DEFAULT_NOTIF)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.auth.getUser().then(async ({ data }) => {
        if (!data.user) return
        const { data: prof } = await supabase.from('users').select('display_name, bio, avatar_url, sns_url').eq('id', data.user.id).single()
        if (prof) {
          setProfile({ display_name: prof.display_name ?? '', bio: prof.bio ?? '', avatar_url: prof.avatar_url ?? '', sns_url: prof.sns_url ?? '' })
          setAvatarPreview(prof.avatar_url ?? '')
        }
      }),
      fetch('/api/settings').then(r => r.json()).then(data => {
        if (data && !data.error) setNotif({ ...DEFAULT_NOTIF, ...data })
      }),
    ]).finally(() => setLoading(false))
  }, [])

  const setN = (key: keyof NotifSettings, value: boolean) => {
    setNotif(prev => ({ ...prev, [key]: value }))
    setStatus('idle')
  }

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const path = `${user.id}/avatar_${Date.now()}.webp`
    const { error } = await supabase.storage.from('artwork-previews').upload(path, file, { contentType: file.type, upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('artwork-previews').getPublicUrl(path)
      setProfile(p => ({ ...p, avatar_url: data.publicUrl }))
      setAvatarPreview(data.publicUrl)
    }
    setUploading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setStatus('idle')
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/profile/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile),
        }),
        fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notif),
        }),
      ])
      if (!r1.ok || !r2.ok) throw new Error()
      setStatus('saved')
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="max-w-2xl mx-auto py-12 text-gray-400 text-sm">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-16">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {status === 'error' && (
        <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-3">Failed to save. Please try again.</p>
      )}

      {/* アカウント設定 */}
      <section className="bg-white rounded-2xl border border-stone-200 p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-900">Account</h2>

        {/* アバター */}
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full overflow-hidden bg-stone-100 flex items-center justify-center cursor-pointer border-2 border-stone-200 hover:border-[#B8902A] transition-colors shrink-0"
            onClick={() => fileRef.current?.click()}
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-sm text-[#B8902A] hover:underline"
            >
              {uploading ? 'Uploading...' : 'Change avatar'}
            </button>
            <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WebP</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
        </div>

        {/* 表示名 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Display Name</label>
          <input
            type="text"
            value={profile.display_name}
            onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))}
            placeholder="Your name"
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#B8902A]"
          />
        </div>

        {/* 自己紹介 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Bio</label>
          <textarea
            value={profile.bio}
            onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
            rows={3}
            placeholder="Tell people about yourself..."
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#B8902A] resize-none"
          />
        </div>

        {/* 外部リンク */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Website / SNS URL</label>
          <input
            type="url"
            value={profile.sns_url}
            onChange={e => setProfile(p => ({ ...p, sns_url: e.target.value }))}
            placeholder="https://..."
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#B8902A]"
          />
        </div>
      </section>

      {/* プッシュ通知設定 */}
      <section className="bg-white rounded-2xl border border-stone-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">Push Notifications</h2>
        <div className="divide-y divide-stone-100">
          {NOTIFICATION_ITEMS.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-4">
              <div className="pr-4">
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
              <Toggle
                checked={(notif as any)[`notify_push_${key}`]}
                onChange={v => setN(`notify_push_${key}` as keyof NotifSettings, v)}
              />
            </div>
          ))}
        </div>
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
