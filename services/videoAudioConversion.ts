import RNFS from "react-native-fs";
import { FFmpegKit, ReturnCode } from "@wokcito/ffmpeg-kit-react-native";
import type { VideoItem } from "@/types/player";
import { documentDirectory } from "@/utils/FileSystem";

export type AudioConversionFormat = "mp3" | "m4a" | "aac";
export type AudioConversionProgress = { progress: number; elapsedSeconds: number; outputPath?: string };
export type AudioConversionResult = { outputUri: string; outputPath: string; format: AudioConversionFormat; size: number };
let activeSessionId: number | null = null;

function shellQuote(value: string) { return "'" + value.replace(/'/g, "'\\''") + "'"; }
function normalizePath(uri: string) { return uri.startsWith("file://") ? uri.slice(7) : uri; }
function safeName(title: string) { return (title || "Audio").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim().slice(0, 100) || "Audio"; }
function codecArguments(format: AudioConversionFormat) {
  if (format === "m4a") return ["-vn", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"];
  if (format === "aac") return ["-vn", "-c:a", "aac", "-b:a", "192k", "-f", "adts"];
  return ["-vn", "-c:a", "libmp3lame", "-b:a", "192k", "-id3v2_version", "3"];
}
function metadataArguments(video: VideoItem) {
  const args: string[] = [];
  if (video.title?.trim()) args.push("-metadata", "title=" + video.title.trim());
  if (video.artist?.trim()) args.push("-metadata", "artist=" + video.artist.trim());
  if (video.album?.trim()) args.push("-metadata", "album=" + video.album.trim());
  return args;
}
export async function convertVideoToAudio(video: VideoItem, format: AudioConversionFormat, onProgress?: (p: AudioConversionProgress) => void): Promise<AudioConversionResult> {
  if (video.mediaType !== "video") throw new Error("Only video files can be converted to audio.");
  if (activeSessionId !== null) throw new Error("Another audio conversion is already running.");
  const sourcePath = normalizePath(video.uri);
  const sourceInfo = await RNFS.stat(sourcePath).catch(() => null);
  if (!sourceInfo?.isFile()) throw new Error("The source video is no longer available.");
  const outputDirectory = documentDirectory.replace(/\/$/, "") + "/Converted Audio";
  await RNFS.mkdir(outputDirectory);
  const baseName = safeName(video.title) + "." + format;
  let outputPath = outputDirectory + "/" + baseName;
  if (await RNFS.exists(outputPath)) outputPath = outputDirectory + "/" + Date.now() + "-" + baseName;
  const duration = Number(video.duration || 0);
  const durationSeconds = duration > 10000 ? duration / 1000 : duration;
  const args = ["-y", "-i", shellQuote(sourcePath), "-map", "0:a:0?", ...codecArguments(format), ...metadataArguments(video).map(shellQuote), shellQuote(outputPath)];
  onProgress?.({ progress: 0, elapsedSeconds: 0 });
  const session = await FFmpegKit.executeAsync(args.join(" "), async completed => { if (activeSessionId === completed.getSessionId()) activeSessionId = null; }, undefined, statistics => {
    const elapsedSeconds = Number(statistics.getTime?.() || 0) / 1000;
    const progress = durationSeconds > 0 ? Math.min(0.99, elapsedSeconds / durationSeconds) : 0;
    onProgress?.({ progress, elapsedSeconds });
  });
  activeSessionId = session.getSessionId();
  const returnCode = await session.getReturnCode();
  if (ReturnCode.isCancel(returnCode)) { activeSessionId = null; await RNFS.unlink(outputPath).catch(() => undefined); throw new Error("Audio conversion was cancelled."); }
  if (!ReturnCode.isSuccess(returnCode)) { activeSessionId = null; await RNFS.unlink(outputPath).catch(() => undefined); throw new Error((await session.getFailStackTrace()) || "FFmpeg could not convert this video."); }
  activeSessionId = null;
  const outputInfo = await RNFS.stat(outputPath);
  if (!outputInfo.isFile() || Number(outputInfo.size) <= 0) throw new Error("Conversion finished without a valid audio file.");
  onProgress?.({ progress: 1, elapsedSeconds: durationSeconds, outputPath });
  return { outputUri: "file://" + outputPath, outputPath, format, size: Number(outputInfo.size) };
}
export function cancelVideoToAudioConversion() { if (activeSessionId === null) return false; FFmpegKit.cancel(activeSessionId); return true; }
export function isVideoToAudioConversionRunning() { return activeSessionId !== null; }