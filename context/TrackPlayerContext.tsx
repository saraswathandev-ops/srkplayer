import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
} from 'react';
import TrackPlayer, {
    RepeatMode,
    State,
    useActiveTrack,
    usePlaybackState,
    useProgress,
} from 'react-native-track-player';

import { setupTrackPlayer, videoItemToTrack } from '@/services/trackPlayerService';
import { type VideoItem } from '@/types/player';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TrackPlayerContextType {
    /** The VideoItem id of the currently active track, or null */
    activeId: string | null;
    isPlaying: boolean;
    isReady: boolean;
    position: number;   // seconds
    duration: number;   // seconds
    /** Load a list of audio VideoItems and start playing at startIndex */
    playAudio: (videos: VideoItem[], startIndex?: number) => Promise<void>;
    playPause: () => Promise<void>;
    skipToNext: () => Promise<void>;
    skipToPrev: () => Promise<void>;
    seekTo: (seconds: number) => Promise<void>;
    setRepeat: (mode: RepeatMode) => Promise<void>;
    setRate: (rate: number) => Promise<void>;
    stopPlayer: () => Promise<void>;
}

const TrackPlayerContext = createContext<TrackPlayerContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function TrackPlayerProvider({ children }: { children: React.ReactNode }) {
    const isSetupRef = useRef(false);
    const activeTrack = useActiveTrack();
    const { state } = usePlaybackState();
    const { position, duration } = useProgress(500);

    // Setup RNTP once on mount
    useEffect(() => {
        if (isSetupRef.current) return;
        isSetupRef.current = true;
        void setupTrackPlayer();
    }, []);

    const isPlaying =
        state === State.Playing || state === State.Buffering || state === State.Loading;
    const isReady = state !== State.None && state !== State.Error;

    // The active track id is stored in the RNTP track's `id` field which we
    // set to video.id inside videoItemToTrack
    const activeId = (activeTrack?.id as string | undefined) ?? null;

    // -------------------------------------------------------------------------
    // Actions
    // -------------------------------------------------------------------------
    const playAudio = useCallback(async (videos: VideoItem[], startIndex = 0) => {
        const tracks = videos.map(videoItemToTrack);
        await TrackPlayer.reset();
        await TrackPlayer.add(tracks);
        if (startIndex > 0) {
            await TrackPlayer.skip(startIndex);
        }
        await TrackPlayer.play();
    }, []);

    const playPause = useCallback(async () => {
        if (isPlaying) {
            await TrackPlayer.pause();
        } else {
            await TrackPlayer.play();
        }
    }, [isPlaying]);

    const skipToNext = useCallback(() => TrackPlayer.skipToNext(), []);
    const skipToPrev = useCallback(() => TrackPlayer.skipToPrevious(), []);
    const seekTo = useCallback((s: number) => TrackPlayer.seekTo(s), []);
    const setRepeat = useCallback(async (mode: RepeatMode): Promise<void> => {
        await TrackPlayer.setRepeatMode(mode);
    }, []);
    const setRate = useCallback((rate: number) => TrackPlayer.setRate(rate), []);
    const stopPlayer = useCallback(async () => {
        await TrackPlayer.stop();
        await TrackPlayer.reset();
    }, []);

    const value: TrackPlayerContextType = {
        activeId,
        isPlaying,
        isReady,
        position,
        duration,
        playAudio,
        playPause,
        skipToNext,
        skipToPrev,
        seekTo,
        setRepeat,
        setRate,
        stopPlayer,
    };

    return (
        <TrackPlayerContext.Provider value={value}>
            {children}
        </TrackPlayerContext.Provider>
    );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useTrackPlayer(): TrackPlayerContextType {
    const ctx = useContext(TrackPlayerContext);
    if (!ctx) throw new Error('useTrackPlayer must be used inside TrackPlayerProvider');
    return ctx;
}
