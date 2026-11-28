import React, { forwardRef, useImperativeHandle, useRef } from "react";
import {
  findNodeHandle,
  Platform,
  requireNativeComponent,
  UIManager,
  type NativeSyntheticEvent,
  type ViewProps,
} from "react-native";
import Video, { type ReactVideoProps } from "react-native-video";

import { createPlaybackCommands, createVlcCommands, type PlaybackCommands, type PlaybackEngine } from "@/features/playback/engines/playbackCommands";

export type VideoSurfaceRef = PlaybackCommands;

type AudioTracks = Parameters<NonNullable<ReactVideoProps["onAudioTracks"]>>[0]["audioTracks"];
export type SubtitleTrack = { index: number; title?: string; selected?: boolean };
type Metadata = {
  durationMs: number;
  width: number;
  height: number;
  audioTracks: AudioTracks;
  subtitleTracks: SubtitleTrack[];
};
type VlcEvent =
  | ({ type: "load" | "metadata" | "tracks" } & Metadata)
  | { type: "loadStart" | "end" | "error" | "subtitleError" }
  | { type: "buffer"; buffering: boolean }
  | { type: "progress"; positionMs: number; durationMs: number };

type NativeProps = ViewProps & {
  uri: string;
  paused?: boolean;
  backgroundPlay?: boolean;
  repeat?: boolean;
  rate?: number;
  volume?: number;
  muted?: boolean;
  audioTrack?: number;
  subtitleTrack?: number;
  subtitleFile?: string;
  resizeMode?: string;
  softwareDecoding?: boolean;
  onVlcEvent: (event: NativeSyntheticEvent<VlcEvent>) => void;
};

const manager = "SrkVlcVideo";
const hasVlc = Platform.OS === "android" && UIManager.hasViewManagerConfig(manager);
const NativeVlc = hasVlc ? requireNativeComponent<NativeProps>(manager) : null;

export const isVlcVideoAvailable = NativeVlc !== null;

type VideoSurfaceProps = ReactVideoProps & {
  engine: PlaybackEngine;
  sessionId?: string;
  softwareDecoding?: boolean;
  subtitleTrack?: number;
  subtitleFile?: string;
  onSubtitleError?: () => void;
  onSubtitleTracks?: (tracks: SubtitleTrack[]) => void;
};

const VideoSurface = forwardRef<VideoSurfaceRef, VideoSurfaceProps>(function VideoSurface(
  { engine, sessionId, softwareDecoding, subtitleTrack, subtitleFile, onSubtitleTracks, onSubtitleError, ...props },
  ref
) {
  const vlcRef = useRef<React.ElementRef<NonNullable<typeof NativeVlc>>>(null);
  const media3Ref = useRef<React.ElementRef<typeof Video>>(null);
  const sourceUri = typeof props.source === "object" ? props.source?.uri : undefined;
  const uri = typeof sourceUri === "string" ? sourceUri : undefined;
  const useVlc = engine === "libvlc" && NativeVlc !== null;

  useImperativeHandle(ref, () => useVlc
    ? createVlcCommands(milliseconds => {
        const tag = findNodeHandle(vlcRef.current);
        if (tag !== null) UIManager.dispatchViewManagerCommand(tag, "seek", [milliseconds]);
      })
    : createPlaybackCommands(seconds => { media3Ref.current?.seek(seconds); }),
  [useVlc]);

  if (!useVlc || !NativeVlc) return <Video {...props} ref={media3Ref} />;
  if (!uri) return null;

  const onVlcEvent = ({ nativeEvent: event }: NativeSyntheticEvent<VlcEvent>) => {
    switch (event.type) {
      case "loadStart":
        props.onLoadStart?.({ uri, type: "", isNetwork: /^https?:\/\//i.test(uri) });
        break;
      case "load":
        onSubtitleTracks?.(event.subtitleTracks);
        props.onLoad?.({
          currentTime: 0,
          duration: event.durationMs / 1000,
          naturalSize: {
            width: event.width,
            height: event.height,
            orientation: event.width >= event.height ? "landscape" : "portrait",
          },
          audioTracks: event.audioTracks,
          textTracks: [],
          videoTracks: [],
        });
        props.onReadyForDisplay?.();
        break;
      case "metadata":
      case "tracks":
        onSubtitleTracks?.(event.subtitleTracks);
        props.onAudioTracks?.({ audioTracks: event.audioTracks });
        break;
      case "buffer":
        props.onBuffer?.({ isBuffering: event.buffering });
        break;
      case "progress":
        props.onProgress?.({
          currentTime: event.positionMs / 1000,
          seekableDuration: event.durationMs / 1000,
          playableDuration: event.durationMs / 1000,
        });
        break;
      case "end":
        props.onEnd?.();
        break;
      case "subtitleError":
        onSubtitleError?.();
        break;
      case "error":
        props.onBuffer?.({ isBuffering: false });
        props.onError?.({ error: { errorCode: "LIBVLC_PLAYBACK", errorString: "libVLC could not open or play this video." } });
        break;
    }
  };

  const selectedTrack = props.selectedAudioTrack?.value;
  return (
    <NativeVlc
      key={JSON.stringify([sessionId, uri, softwareDecoding])}
      ref={vlcRef}
      style={props.style}
      uri={uri}
      paused={props.paused}
      backgroundPlay={props.playInBackground}
      repeat={props.repeat}
      rate={props.rate}
      volume={props.volume}
      muted={props.muted}
      audioTrack={typeof selectedTrack === "number" ? selectedTrack : undefined}
      subtitleTrack={subtitleTrack}
      subtitleFile={subtitleFile}
      resizeMode={props.resizeMode}
      softwareDecoding={softwareDecoding}
      onVlcEvent={onVlcEvent}
    />
  );
});

export default VideoSurface;
