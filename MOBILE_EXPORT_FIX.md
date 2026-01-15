# Mobile WAV Export Fix

## Problem
WAV file exports were failing on mobile phones:
- Export appeared to complete successfully
- Page would refresh instead of downloading the file
- No file was saved to device

## Root Cause
The original `downloadBlob()` function used a simple `<a>` tag click approach that:
1. **Fails on mobile Safari** - Programmatic clicks are blocked for security
2. **Triggers navigation** - Blob URLs can cause page refreshes on mobile
3. **No user interaction** - Mobile browsers require user-initiated downloads

## Solution Implemented

### 1. Web Share API Integration
- On mobile devices, uses native **Web Share API** to share the WAV file
- Presents familiar share sheet (Save to Files, share to apps, etc.)
- Works on iOS Safari, Chrome mobile, Android browsers

### 2. Mobile-Safe Download Fallback
If Web Share isn't available:
- Uses `MouseEvent` dispatch instead of direct `.click()`
- Adds `rel="noopener noreferrer"` to prevent navigation
- Prevents default behavior with event handlers
- Proper timing with `setTimeout` for mobile compatibility

### 3. Improved UX on Mobile
- **No auto-close** - Dialog stays open on mobile after export
- **"Done" button** - User manually dismisses after save/share
- Prevents confusion from the share sheet appearing

### 4. Event Prevention
- `preventDefault()` and `stopPropagation()` on export button
- Prevents any form submission or navigation behavior

## Code Changes

### `src/audio/encoders/wav.ts`
- Added `isMobileDevice()` detection
- Rewrote `downloadBlob()` with Web Share API support
- New `triggerDownload()` with mobile safeguards

### `src/components/ExportDialog/ExportDialog.tsx`
- Added event prevention to `handleExport()`
- Mobile detection for auto-close behavior
- "Done" button shown after successful export on mobile

## Testing Recommendations

### Mobile Safari (iOS)
1. Open Sonic Journey on iPhone/iPad
2. Create/load a journey
3. Click "Export Journey"
4. Select WAV format and settings
5. Click "Export WAV"
6. **Expected**: Native share sheet appears
7. Choose "Save to Files" or share destination
8. Verify file saves correctly
9. Click "Done" to close dialog

### Chrome Mobile (Android)
1. Open on Android device
2. Follow export steps
3. **Expected**: Android share sheet appears
4. Save or share file
5. Verify file is accessible

### Desktop (Verification)
1. Test on desktop browsers
2. **Expected**: Traditional download behavior
3. Dialog auto-closes after 1.5s
4. File downloads to default location

## Files Modified

- `src/audio/encoders/wav.ts` - Download mechanism
- `src/components/ExportDialog/ExportDialog.tsx` - UX flow

## Deployment

Built successfully with:
```bash
npm run build
```

Deploy the `dist/` folder to your hosting service.

## Future Enhancements

- Add loading indicator while share sheet is displayed
- Show explicit "File saved!" message on mobile
- Add analytics to track share vs download usage
- Consider PWA install prompt for easier access
- Add option to export to cloud storage (Drive, Dropbox, etc.)
