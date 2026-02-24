

# Fix Share URLs to Use Published Domain

## Problem
All share links use `window.location.origin`, which in the development/preview environment returns the `id-preview--*.lovable.app` URL. This URL requires Lovable authentication and is not accessible to external users. Shared chain links need to use the public-facing domain.

## Solution
Create a utility function that returns the correct base URL for sharing. Since the project is not yet published (no published URL exists), we need to construct the correct `lovableproject.com` URL using the project ID.

All 4 files that use `window.location.origin` for chain sharing will be updated:

1. `src/components/chains/ChainCard.tsx` (line 57)
2. `src/pages/ChainPage.tsx` (line 152)
3. `src/components/chains/ChainDetailsModal.tsx` (line 122)
4. `src/contexts/AuthContext.tsx` (line 140) - email redirect URL

## Technical Details

### New utility: `src/utils/getBaseUrl.ts`
```typescript
export const getShareBaseUrl = (): string => {
  const projectId = '932358f2-26f5-465a-b493-c072c610ccf5';
  // In production or when a custom domain is set, use window.location.origin
  // For Lovable preview environments, use the lovableproject.com domain
  if (window.location.hostname.includes('id-preview') || 
      window.location.hostname.includes('lovable.app')) {
    return `https://${projectId}.lovableproject.com`;
  }
  return window.location.origin;
};
```

This approach:
- Detects if running in the Lovable preview environment
- Returns the correct `lovableproject.com` URL for sharing
- Falls back to `window.location.origin` when on a custom domain or the published domain (future-proof)

### Files updated
Replace `window.location.origin` with `getShareBaseUrl()` in:
- `src/components/chains/ChainCard.tsx` -- share handler
- `src/pages/ChainPage.tsx` -- share handler
- `src/components/chains/ChainDetailsModal.tsx` -- share achievement handler
- `src/contexts/AuthContext.tsx` -- email redirect URL (so verification emails link to the correct domain)

