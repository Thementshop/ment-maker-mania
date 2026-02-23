

# Fix Chain Sharing and Recipient Flow

## Problems Found

1. **ChainCard share button is broken**: It copies a text string ("Check out this Ment Chain! Chain #XXXX") instead of the actual chain URL. Recipients get no usable link.

2. **No redirect-back after sign-in**: When an anonymous recipient visits `/chain/:chainId` and clicks "Sign In to Participate", they're taken to `/auth`. After signing in, they're redirected to `/` (home) instead of back to the chain page. They lose context entirely.

## What Already Works

- The **ChainPage** "Share Chain Link" button correctly copies `{origin}/chain/{chainId}` and uses the Web Share API.
- The `/chain/:chainId` route is publicly accessible (no auth wall).
- The "Pass It Forward" button and PassChainModal work correctly for the current holder.

## Changes

### 1. Fix ChainCard Share Button
**File:** `src/components/chains/ChainCard.tsx`

Change the `handleShare` function to copy the actual chain URL (`/chain/{chain_id}`) instead of a plain text string. Also attempt the Web Share API first (matching ChainPage behavior).

### 2. Add Redirect-Back After Auth
**File:** `src/pages/Auth.tsx`

- Read a `returnTo` query parameter from the URL.
- After successful sign-in, redirect to `returnTo` value instead of always going to `/`.

**File:** `src/pages/ChainPage.tsx`

- Update the "Sign In to Participate" button to navigate to `/auth?returnTo=/chain/{chainId}` so users return to the chain after authenticating.

## Technical Details

### ChainCard.tsx change (line 56-66)
```typescript
const handleShare = () => {
  const chainUrl = `${window.location.origin}/chain/${chain.chain_id}`;
  if (navigator.share) {
    navigator.share({
      title: `Join this Kindness Chain! 💚`,
      text: `Check out this Ment Chain with ${chain.links_count} links!`,
      url: chainUrl
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(chainUrl);
    toast({
      title: "Link copied! 🔗",
      description: "Share this link with anyone",
    });
  }
};
```

### Auth.tsx change (line 25-27)
```typescript
// Read returnTo from URL params
const searchParams = new URLSearchParams(window.location.search);
const returnTo = searchParams.get('returnTo') || '/';

if (!isLoading && user) {
  return <Navigate to={returnTo} replace />;
}
```

### ChainPage.tsx change (line 423)
```typescript
<Button onClick={() => navigate(`/auth?returnTo=/chain/${chainId}`)} className="w-full rounded-full">
  Sign In to Participate
</Button>
```
