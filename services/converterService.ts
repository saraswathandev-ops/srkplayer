/**
 * converterService.ts
 *
 * NOTE: ffmpeg-kit-react-native has been removed because its native artifact
 * (com.arthenica:ffmpeg-kit-https:6.0-2) is no longer available on any public
 * Maven repository.  The conversion feature is stubbed out and will throw a
 * descriptive error until an alternative FFmpeg bridge is integrated.
 */

export type ConversionProgressCallback = (percent: number) => void;

export async function convertVideoToAudio(
  _video: { uri: string; duration: number; title?: string },
  _onProgress?: ConversionProgressCallback
): Promise<string> {
  throw new Error(
    "Video-to-audio conversion is currently unavailable. " +
    "The ffmpeg-kit-react-native package has been removed due to a " +
    "dependency resolution issue (ffmpeg-kit-https:6.0-2 is not published). " +
    "Please integrate an alternative FFmpeg bridge to re-enable this feature."
  );
}
