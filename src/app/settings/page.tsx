'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  display_name: string
  bio: string
  avatar_url: string
  sns_url: string
  portfolio_url: string
  roles: string[]
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
  { key: 'new_bid',          label: 'New bid on your listing',          desc: 'Someone places a bid on your avatar' },
  { key: 'won',              label: 'Auction won',                      desc: 'You win an auction' },
  { key: 'payment_deadline', label: 'Payment deadline',                desc: 'Reminder before your payment deadline expires' },
  { key: 'follow_listed',    label: 'New listing from followed creator', desc: 'A creator you follow lists a new avatar' },
]

const ROLES = [
  {
    key: 'identity_holder',
    label: 'Identity Holder',
    desc: 'You own the rights to a face, voice, or character and want to license it',
    icon: '👤',
  },
  {
    key: 'creator',
    label: 'Creator',
    desc: 'You use AI tools to build avatars and sell them on behalf of identity holders',
    icon: '🎨',
  },
  {
    key: 'buyer',
    label: 'Buyer',
    desc: 'You want to purchase AI avatar usage rights at auction',
    icon: '🛒',
  },
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
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<Profile>({
    display_name: '', bio: '', avatar_url: '', sns_url: '', portfolio_url: '', roles: [],
  })
  const [notif, setNotif] = useState<NotifSettings>(DEFAULT_NOTIF)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.auth.getUser().then(async ({ data }) => {
        if (!data.user) { router.replace('/auth/login'); return }
        const { data: prof } = await supabase
          .from('users')
          .select('display_name, bio, avatar_url, sns_url, portfolio_url, roles, identity_verified')
          .eq('id', data.user.id)
          .single()
        if (prof) {
          setProfile({
            display_name: prof.display_name ?? '',
            bio: prof.bio ?? '',
            avatar_url: prof.avatar_url ?? '',
            sns_url: prof.sns_url ?? '',
            portfolio_url: prof.portfolio_url ?? '',
            roles: prof.roles ?? [],
          })
          setAvatarPreview(prof.avatar_url ?? '')
          if ((prof as any).identity_verified) {
            setVerificationStatus('verified')
          } else {
            const { data: vr } = await supabase
              .from('identity_verifications')
              .select('status')
              .eq('user_id', data.user!.id)
              .maybeSingle()
            setVerificationStatus(vr?.status ?? null)
          }
        }
      }),
      fetch('/api/settings').then(r => r.json()).then(data => {
        if (data && !data.error) setNotif({ ...DEFAULT_NOTIF, ...data })
      }),
    ]).finally(() => setLoading(false))
  }, [])

  const toggleRole = (role: string) => {
    setProfile(p => ({
      ...p,
      roles: p.roles.includes(role) ? p.roles.filter(r => r !== role) : [...p.roles, role],
    }))
    setStatus('idle')
  }

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

  const isCreator = profile.roles.includes('creator')

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
            onChange={e => { setProfile(p => ({ ...p, display_name: e.target.value })); setStatus('idle') }}
            placeholder="Your name"
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#B8902A]"
          />
        </div>

        {/* 自己紹介 */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Bio</label>
          <textarea
            value={profile.bio}
            onChange={e => { setProfile(p => ({ ...p, bio: e.target.value })); setStatus('idle') }}
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
            onChange={e => { setProfile(p => ({ ...p, sns_url: e.target.value })); setStatus('idle') }}
            placeholder="https://..."
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#B8902A]"
          />
        </div>
      </section>

      {/* ロール選択 */}
      <section className="bg-white rounded-2xl border border-stone-200 p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Your Roles</h2>
          <p className="text-xs text-gray-400 mt-1">Select all that apply. You can have multiple roles.</p>
        </div>
        <div className="space-y-3">
          {ROLES.map(({ key, label, desc, icon }) => {
            const active = profile.roles.includes(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleRole(key)}
                className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-colors ${
                  active
                    ? 'border-[#B8902A] bg-amber-50'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold ${active ? 'text-[#B8902A]' : 'text-gray-900'}`}>{label}</p>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      active ? 'border-[#B8902A] bg-[#B8902A]' : 'border-stone-300'
                    }`}>
                      {active && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Identity Holder 身元確認バナー */}
        {profile.roles.includes('identity_holder') && (
          <div className={`rounded-xl p-4 border ${
            verificationStatus === 'verified'
              ? 'bg-green-50 border-green-200'
              : verificationStatus === 'pending' || verificationStatus === 'in_review'
              ? 'bg-amber-50 border-amber-200'
              : verificationStatus === 'rejected'
              ? 'bg-red-50 border-red-200'
              : 'bg-stone-50 border-stone-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {verificationStatus === 'verified' ? (
                  <>
                    <span className="text-green-600 text-lg">✓</span>
                    <div>
                      <p className="text-sm font-semibold text-green-800">Identity Verified</p>
                      <p className="text-xs text-green-600">You can approve avatar creation agreements.</p>
                    </div>
                  </>
                ) : verificationStatus === 'pending' || verificationStatus === 'in_review' ? (
                  <>
                    <span className="text-amber-500 text-lg">⏳</span>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Verification Under Review</p>
                      <p className="text-xs text-amber-600">We are reviewing your documents. This usually takes 1-2 business days.</p>
                    </div>
                  </>
                ) : verificationStatus === 'rejected' ? (
                  <>
                    <span className="text-red-500 text-lg">✗</span>
                    <div>
                      <p className="text-sm font-semibold text-red-800">Verification Failed</p>
                      <p className="text-xs text-red-600">Your documents were not accepted. Please resubmit.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-gray-400 text-lg">🪪</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Identity Verification Required</p>
                      <p className="text-xs text-gray-500">Verify your identity to approve avatar agreements and protect your rights.</p>
                    </div>
                  </>
                )}
              </div>
              {verificationStatus !== 'verified' && verificationStatus !== 'pending' && verificationStatus !== 'in_review' && (
                <a href="/verify" className="shrink-0 text-xs font-semibold bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white px-4 py-2 rounded-lg transition-colors">
                  Verify Now →
                </a>
              )}
            </div>
          </div>
        )}

        {/* クリエイターのポートフォリオURL */}
        {isCreator && (
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Portfolio URL <span className="text-gray-300">(shown to identity holders when you apply)</span></label>
            <input
              type="url"
              value={profile.portfolio_url}
              onChange={e => { setProfile(p => ({ ...p, portfolio_url: e.target.value })); setStatus('idle') }}
              placeholder="https://..."
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-[#B8902A]"
            />
          </div>
        )}
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
