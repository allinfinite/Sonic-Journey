/**
 * Native file export for Capacitor iOS app.
 * Saves audio blobs to the device filesystem and opens the iOS share sheet.
 * Falls back to browser download on web.
 */
import { Capacitor } from '@capacitor/core';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function saveAndShareFile(
  blob: Blob,
  filename: string
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // Web fallback — use browser download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  // Native iOS — write to Documents and open share sheet
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');

  const base64 = await blobToBase64(blob);

  const result = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Documents,
  });

  await Share.share({
    title: 'Sonic Journey Export',
    url: result.uri,
    dialogTitle: 'Save or share your audio',
  });
}
