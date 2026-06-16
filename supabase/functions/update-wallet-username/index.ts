import { createClient } from 'npm:@supabase/supabase-js@2'
import { verifyMessage } from 'npm:viem@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const { address, username, message, signature } = await req.json()

    if (typeof address !== 'string' || typeof username !== 'string' ||
        typeof message !== 'string' || typeof signature !== 'string') {
      return json({ error: 'Invalid payload' }, 400)
    }

    const addr = address.toLowerCase()
    const uname = username.trim()

    if (!/^0x[a-f0-9]{40}$/.test(addr)) return json({ error: 'Invalid wallet address' }, 400)
    if (!/^[A-Za-z0-9_]{3,20}$/.test(uname)) {
      return json({ error: '3-20 chars, letters, numbers, underscore only' }, 400)
    }

    // Message must include the address, the username, and a recent timestamp to prevent replay.
    const m = message.match(
      /^Crypto P2P username update\nWallet: (0x[a-fA-F0-9]{40})\nUsername: ([A-Za-z0-9_]{3,20})\nTimestamp: (\d+)$/
    )
    if (!m) return json({ error: 'Malformed signed message' }, 400)
    const [, signedAddr, signedUname, tsStr] = m
    if (signedAddr.toLowerCase() !== addr) return json({ error: 'Address mismatch' }, 400)
    if (signedUname !== uname) return json({ error: 'Username mismatch' }, 400)
    const ts = Number(tsStr)
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
      return json({ error: 'Signature expired, please try again' }, 400)
    }

    const valid = await verifyMessage({
      address: addr as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    })
    if (!valid) return json({ error: 'Invalid signature' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Uniqueness check (case-insensitive via citext on column).
    const { data: existing } = await supabase
      .from('wallet_profiles')
      .select('wallet_address')
      .eq('username', uname)
      .maybeSingle()
    if (existing && existing.wallet_address.toLowerCase() !== addr) {
      return json({ error: 'Username already taken' }, 409)
    }

    const { error } = await supabase
      .from('wallet_profiles')
      .upsert({ wallet_address: addr, username: uname }, { onConflict: 'wallet_address' })
    if (error) return json({ error: error.message }, 500)

    return json({ ok: true })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Server error' }, 500)
  }
})
