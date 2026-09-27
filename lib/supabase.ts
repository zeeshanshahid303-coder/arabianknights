import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

let channelSeq = 0

/**
 * RealtimeClient.channel() returns an ALREADY-REGISTERED channel whenever the
 * topic matches, and RealtimeChannel.on() throws once that channel has joined
 * or is joining. Channel teardown is async: removeChannel() awaits the leave
 * push before the topic is unregistered, so a React remount can run its new
 * effect while the previous mount's channel is still in the registry.
 *
 * Suffixing every subscription with a per-mount counter guarantees a fresh
 * channel is always created, so handlers are never bound to a channel that is
 * already subscribed (or about to be torn down).
 */
export function uniqueChannelTopic(base: string) {
  channelSeq += 1
  return `${base}-${channelSeq}`
}
