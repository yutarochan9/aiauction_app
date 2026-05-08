'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SnsVerifySection({ userId }: { userId: string }) {
  const t = useTranslations('profile')
  const [step, setStep] = useState<'idle' | 'code' | 'submit' | 'done'>('idle')
  const [code, setCode] = useState('')
  const [snsUrl, setSnsUrl] = useState('')
  const [error, setError] = useState('')

  // SNS認証コードを発行
  const generateCode = async () => {
    const supabase = createClient()
    const newCode = `AIAII-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    await supabase.from('users').update({ sns_verification_code: newCode }).eq('id', userId)
    setCode(newCode)
    setStep('code')
  }

  // 投稿URLを検証してバッジを付与
  const verify = async () => {
    if (!snsUrl) return setError('URLを入力してください')
    setError('')

    const supabase = createClient()
    const { data: user } = await supabase
      .from('users')
      .select('sns_verification_code')
      .eq('id', userId)
      .single()

    if (!user?.sns_verification_code) return setError('コードが見つかりません')

    // 投稿URLにコードが含まれているか確認（実際はサーバーサイドで行うべきだが、MVPとしてクライアントで簡易チェック）
    const res = await fetch(`/api/sns-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: snsUrl, code: user.sns_verification_code }),
    })
    const json = await res.json()

    if (json.verified) {
      await supabase.from('users').update({ sns_verified: true, sns_url: snsUrl }).eq('id', userId)
      setStep('done')
    } else {
      setError('確認コードが見つかりませんでした。投稿にコードが含まれているか確認してください。')
    }
  }

  if (step === 'done') {
    return (
      <div className="text-sm text-green-400 font-medium">✓ 認証完了！ページを更新してください</div>
    )
  }

  return (
    <div className="text-right">
      {step === 'idle' && (
        <button
          onClick={generateCode}
          className="text-sm bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          {t('snsVerifyButton')}
        </button>
      )}

      {step === 'code' && (
        <div className="text-left max-w-xs space-y-3">
          <p className="text-sm text-gray-400">
            以下のコードをX（Twitter）またはInstagramに投稿してください：
          </p>
          <code className="block bg-gray-800 text-violet-300 px-4 py-2 rounded-lg text-sm font-mono">
            {code}
          </code>
          <p className="text-sm text-gray-400">投稿後、そのURLを貼り付けてください：</p>
          <input
            type="url"
            value={snsUrl}
            onChange={(e) => setSnsUrl(e.target.value)}
            placeholder="https://x.com/..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            onClick={verify}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white text-sm py-2 rounded-lg transition-colors"
          >
            確認する
          </button>
        </div>
      )}
    </div>
  )
}
