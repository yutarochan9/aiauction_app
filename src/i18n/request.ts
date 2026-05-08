import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export default getRequestConfig(async () => {
  // cookieから言語設定を取得（デフォルトは日本語）
  const cookieStore = await cookies()
  const locale = cookieStore.get('locale')?.value ?? 'ja'

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
