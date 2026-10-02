export type AudioConversionFormat = "mp3" | "m4a" | "aac";
export type AudioConversionProgress = { progress: number; elapsedSeconds: number; outputPath?: string };
export type AudioConversionResult = { outputUri: string; outputPath: string; format: AudioConversionFormat; size: number };
export async function convertVideoToAudio(_video: unknown, _format: AudioConversionFormat, _onProgress?: (p: AudioConversionProgress) => void): Promise<AudioConversionResult> {
  throw new Error("Video to audio conversion is available in the Android app.");
}
export function cancelVideoToAudioConversion() { return false; }
export function isVideoToAudioConversionRunning() { return false; }