import { readFileSync } from 'fs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const schema = readFileSync('./supabase/schema.sql', 'utf8')

// SQLを文ごとに分割して実行
const statements = schema
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'))

console.log(`${statements.length} 件のSQL文を実行します...`)

for (let i = 0; i < statements.length; i++) {
  const sql = statements[i] + ';'
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.log(`[${i+1}] スキップ or エラー: ${text.slice(0, 100)}`)
  } else {
    console.log(`[${i+1}] OK`)
  }
}
console.log('完了')
