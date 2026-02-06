
# Implement Sharing, Countdown, and Chain Expiration

## Current Status

| Feature | Current State | What's Missing |
|---------|---------------|----------------|
| Share Button | Uses Web Share API + clipboard fallback | Shares generic text, not a unique chain link |
| Countdown Timer | Shows for "Your Turn" chains only | Needs to show for chain starters too (as observer) |
| Chain Expiration | Timer reaches 0 but nothing happens | Need auto-break logic |
| Recipient View | No special view exists | Need landing page for chain recipients |
| Notifications | No reminder system | Need 12hr and 2hr reminders |

## Implementation Plan

### 1. Create Shareable Chain Links

**Generate unique chain URLs:**
```
Preview: https://id-preview--932358f2-26f5-465a-b493-c072c610ccf5.lovable.app/chain/[chain-id]
Future: https://mentshop.app/chain/[chain-id]
```

**Update `ChainDetailsModal.tsx` share button:**
- Generate link: `${window.location.origin}/chain/${chain.chain_id}`
- Copy to clipboard with visual feedback
- Show toast: "Link copied! 🔗"

### 2. Create Chain Landing Page

**New route: `/chain/:chainId`**

This page will show different views based on who's viewing:

| Viewer Type | What They See |
|-------------|---------------|
| Current Holder | Big countdown, CTA to pass, who sent it, compliment received |
| Chain Starter | Status tracker, who has it now, time remaining for their turn |
| Past Participant | Chain timeline, their contribution |
| Not in Chain | Public chain stats (if we want to allow this) |

**Current Holder View Components:**
```
┌─────────────────────────────────────────┐
│         🔗 "Kindness Wave" Chain        │
│                                         │
│     ┌─────────────────────────────┐     │
│     │    ⏳ 23:45:32               │     │
│     │    TIME REMAINING           │     │
│     └─────────────────────────────┘     │
│                                         │
│  💚 From @donna.pursley:                │
│  "You're the kind of person who makes  │
│   everyone feel welcome!"               │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Pass It Forward →              │    │
│  └─────────────────────────────────┘    │
│                                         │
│  🔥 Don't let the chain break!          │
│  Pass to someone in the next 23 hours   │
└─────────────────────────────────────────┘
```

### 3. Enhanced Countdown for Chain Starters

When viewing chains you started (not your turn):
- Show timer in a lighter style
- Label: "Waiting on @brent • 23:45:32 remaining"
- Add "Send Reminder" button when < 6 hours left

**Update `ChainCardNew.tsx`:**
```typescript
// For chains you started but it's not your turn
{!isYourTurn && chain.started_by === currentUserId && (
  <div className="text-sm text-muted-foreground">
    ⏳ {countdown.formattedTime} for @{chain.current_holder_display_name}
    {countdown.hours < 6 && (
      <Button size="sm" variant="ghost">Send Nudge</Button>
    )}
  </div>
)}
```

### 4. Chain Expiration Logic

**Option A: Client-side check (immediate but not guaranteed)**
- Already partially implemented in `useMentChains`
- On each fetch, check if `expires_at < now` and update status

**Option B: Database function + cron (reliable)**
Create a scheduled edge function that runs every 15 minutes:
```typescript
// supabase/functions/expire-chains/index.ts
await supabase
  .from('ment_chains')
  .update({ status: 'broken', broken_at: new Date() })
  .lt('expires_at', new Date())
  .eq('status', 'active');
```

**Recommended: Both A and B**
- Client-side provides instant feedback
- Cron ensures chains eventually break even if no one visits

### 5. Reminder System (Future Enhancement)

Since this requires server-side notifications (email/SMS), this would need:
- A cron job to check chains approaching expiration
- Integration with email service (Resend, SendGrid) or SMS (Twilio)
- User notification preferences

For now, focus on visual urgency cues in the UI.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/ChainPage.tsx` | Create | Landing page for chain links |
| `src/App.tsx` | Modify | Add route for `/chain/:chainId` |
| `src/components/chains/ChainDetailsModal.tsx` | Modify | Fix share button to copy chain link |
| `src/components/chains/ChainCardNew.tsx` | Modify | Show timer for chain starters |
| `supabase/functions/expire-chains/index.ts` | Create | Cron job to expire chains |
| `supabase/config.toml` | Modify | Add cron schedule |

## Technical Details

### ChainPage Component Structure

```typescript
// src/pages/ChainPage.tsx
const ChainPage = () => {
  const { chainId } = useParams();
  const { user } = useAuth();
  
  // Fetch chain data
  const { data: chain } = useQuery({
    queryKey: ['chain', chainId],
    queryFn: () => fetchChainDetails(chainId)
  });
  
  // Determine viewer type
  const isCurrentHolder = chain?.current_holder === user?.id;
  const isStarter = chain?.started_by === user?.id;
  const isPastParticipant = checkIfParticipated(chainLinks, user?.id);
  
  // Use countdown hook
  const countdown = useCountdown(chain?.expires_at);
  
  // Render appropriate view
  if (isCurrentHolder) return <CurrentHolderView />;
  if (isStarter) return <StarterView />;
  return <PublicView />;
};
```

### Share Button Fix

```typescript
// ChainDetailsModal.tsx - handleShareAchievement()
function handleShareAchievement() {
  const chainUrl = `${window.location.origin}/chain/${chain.chain_id}`;
  
  if (navigator.share) {
    navigator.share({
      title: `Join "${chain.chain_name}" kindness chain!`,
      text: `I'm part of a kindness chain with ${chain.share_count} shares! 💚`,
      url: chainUrl
    });
  } else {
    navigator.clipboard.writeText(chainUrl);
    toast.success('Link copied to clipboard! 🔗');
  }
}
```

### Expire Chains Edge Function

```typescript
// supabase/functions/expire-chains/index.ts
import { createClient } from '@supabase/supabase-js';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await supabase
    .from('ment_chains')
    .update({ 
      status: 'broken', 
      broken_at: new Date().toISOString() 
    })
    .lt('expires_at', new Date().toISOString())
    .eq('status', 'active')
    .select();

  return new Response(JSON.stringify({ 
    expired: data?.length || 0 
  }));
});
```

## Priority Order

1. **Fix Share Button** (5 min) - Quick win
2. **Create ChainPage** (30 min) - Core recipient experience
3. **Add Starter Timer** (10 min) - Better visibility
4. **Expire Chains Cron** (15 min) - Data integrity
5. **Reminder System** (Future) - Requires email/SMS integration

## Questions for You

1. **For unregistered recipients** (like "brent" who received via name only):
   - Should they be able to view the chain without signing up?
   - Or require login/signup to see and pass the chain?

2. **Public visibility**:
   - Can anyone with the link see chain stats?
   - Or only participants?

3. **Nudge/Reminder button**:
   - What should happen when you click "Send Reminder"?
   - In-app only? Or attempt to email/SMS if we have their contact?
