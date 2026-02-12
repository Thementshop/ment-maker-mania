

# Fix: "Share This Chain" Button

## Problem

The Web Share API (`navigator.share`) is detected as available inside the preview iframe, so the code tries to use it. However, the iframe lacks permission, causing a `NotAllowedError`. The error is caught and silently logged ("Share cancelled"), but the code never falls back to copying to clipboard.

## Solution

Change the share function to always copy to clipboard first (reliable), then optionally try `navigator.share` as a bonus. This ensures the user always gets feedback.

### File: `src/components/chains/ChainDetailsModal.tsx`

Replace `handleShareAchievement` (~lines 118-130) with:

```typescript
async function handleShareAchievement() {
  const chainUrl = `${window.location.origin}/chain/${chain.chain_id}`;
  console.log('Share URL:', chainUrl);

  // Always copy to clipboard first
  try {
    await navigator.clipboard.writeText(chainUrl);
    toast.success('Link copied! 🔗');
  } catch {
    // Clipboard API may also fail in iframe — manual fallback
    const textarea = document.createElement('textarea');
    textarea.value = chainUrl;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    toast.success('Link copied! 🔗');
  }

  // Optionally try native share (non-blocking)
  if (navigator.share) {
    navigator.share({
      title: `Join "${chain.chain_name || 'Kindness Chain'}" 💚`,
      text: `I'm part of a kindness chain with ${chain.share_count} shares!`,
      url: chainUrl,
    }).catch(() => {}); // silently ignore if denied
  }
}
```

Key changes:
- Clipboard copy happens **first and always**, so the user gets the toast immediately
- Console logs the generated URL for debugging
- `navigator.share` is attempted afterwards as a bonus (won't block the toast)
- Includes a `document.execCommand('copy')` fallback for environments where the Clipboard API is also restricted

