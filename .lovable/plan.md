
# Replace Ment Chain Section Background Image

## Summary
Replace the current `ment-chain-bg.png` background image in the Ment Chains section with your new candy chain image featuring the green peppermint candies connected by chain links.

## Changes Required

### 1. Add New Image Asset
Copy the uploaded image to the project's assets folder:
- **Source**: `user-uploads://The_Ment_Chain_image_by_ChatGPT-3.png`
- **Destination**: `src/assets/ment-chain-bg.png` (replacing the existing file)

### 2. Update MentChains Component (if needed)
The component already imports from `@/assets/ment-chain-bg.png`, so by replacing the file with the same name, no code changes are required. The new image will automatically be used.

## Technical Notes
- The existing gradient overlay (`bg-gradient-to-t from-background/95 via-background/80 to-background/50`) may need slight adjustment since the new image has a light/white background with sparkles rather than a darker theme
- Consider reducing the gradient opacity to let more of the beautiful candy chain artwork show through

## Visual Result
The Ment Chains section on the homepage will display your new candy chain bracelet image as the background, featuring:
- Green and white striped peppermint candies
- Metallic green chain links connecting the candies
- Sparkly green gradient background with light effects
