import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import TrackPlayer, {
    RepeatMode,
    State,
    Track,
    useActiveTrack,
    usePlaybackState,
    useProgress,
} from 'react-native-track-player';
import { VolumeManager } from 'react-native-volume-manager';

import { setupTrackPlayer, videoItemToTrack } from '@/services/trackPlayerService';
import { usePlayer } from '@/context/PlayerContext';
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
    activeTrack: Track | undefined;
    repeatMode: RepeatMode;
    shuffleEnabled: boolean;
    volume: number;
    /** Load a list of audio VideoItems and start playing at startIndex */
    playAudio: (videos: VideoItem[], startIndex?: number) => Promise<void>;
    playPause: () => Promise<void>;
    skipToNext: () => Promise<void>;
    skipToPrev: () => Promise<void>;
    seekTo: (seconds: number) => Promise<void>;
    seekBy: (seconds: number) => Promise<void>;
    setRepeat: (mode: RepeatMode) => Promise<void>;
    cycleRepeatMode: () => Promise<void>;
    toggleShuffle: () => Promise<void>;
    setRate: (rate: number) => Promise<void>;
    setSystemVolume: (value: number) => Promise<void>;
    stopPlayer: () => Promise<void>;
}

const TrackPlayerContext = createContext<TrackPlayerContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function TrackPlayerProvider({ children }: { children: React.ReactNode }) {
    const isSetupRef = useRef(false);
    const countedTrackRef = useRef<string | null>(null);
    const queueRef = useRef<VideoItem[]>([]);
    const orderedQueueRef = useRef<VideoItem[]>([]);
    const { incrementPlayCount } = usePlayer();
    const activeTrack = useActiveTrack();
    const { state } = usePlaybackState();
    const { position, duration } = useProgress(500);
    const [repeatMode, setRepeatModeState] = useState<RepeatMode>(RepeatMode.Off);
    const [shuffleEnabled, setShuffleEnabled] = useState(false);
    const [volume, setVolumeState] = useState(1);

    // Setup RNTP once on mount
    useEffect(() => {
        if (isSetupRef.current) return;
        isSetupRef.current = true;
        void setupTrackPlayer();
    }, []);

    useEffect(() => {
        let mounted = true;
        void VolumeManager.getVolume()
            .then((result) => {
                if (mounted && typeof result.volume === 'number') {
                    setVolumeState(result.volume);
                }
            })
            .catch(() => undefined);

        const subscription = VolumeManager.addVolumeListener((result) => {
            if (typeof result.volume === 'number') {
                setVolumeState(result.volume);
            }
        });

        return () => {
            mounted = false;
            subscription.remove();
        };
    }, []);

    const isPlaying =
        state === State.Playing || state === State.Buffering || state === State.Loading;
    const isReady = state !== State.None && state !== State.Error;

    // The active track id is stored in the RNTP track's `id` field which we
    // set to video.id inside videoItemToTrack
    const activeId = (activeTrack?.id as string | undefined) ?? null;

    useEffect(() => {
        if (!activeId || countedTrackRef.current === activeId) return;
        countedTrackRef.current = activeId;
        void incrementPlayCount(activeId);
    }, [activeId, incrementPlayCount]);

    // -------------------------------------------------------------------------
    // Actions
    // -------------------------------------------------------------------------
    const playAudio = useCallback(async (videos: VideoItem[], startIndex = 0) => {
        try {
            const tracks = videos.map(videoItemToTrack);
            if (tracks.length === 0) return;
            queueRef.current = videos;
            orderedQueueRef.current = videos;
            setShuffleEnabled(false);
            await setupTrackPlayer();
            await TrackPlayer.stop().catch(() => undefined);
            await TrackPlayer.reset();
            await TrackPlayer.add(tracks);
            if (startIndex > 0) {
                await TrackPlayer.skip(startIndex);
            }
            await TrackPlayer.play();
        } catch (error) {
            console.log("Audio playback start failed", error);
        }
    }, []);

    const rebuildQueue = useCallback(async (videos: VideoItem[], targetActiveId?: string | null) => {
        const tracks = videos.map(videoItemToTrack);
        if (tracks.length === 0) return;

        const activeIndex = targetActiveId
            ? Math.max(0, videos.findIndex((video) => video.id === targetActiveId))
            : 0;

        queueRef.current = videos;
        await TrackPlayer.reset();
        await TrackPlayer.add(tracks);
        if (activeIndex > 0) {
            await TrackPlayer.skip(activeIndex);
        }
    }, []);

    const shuffleQueue = useCallback((items: VideoItem[], targetActiveId?: string | null) => {
        const active = targetActiveId
            ? items.find((item) => item.id === targetActiveId)
            : undefined;
        const rest = items.filter((item) => item.id !== active?.id);

        for (let index = rest.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [rest[index], rest[swapIndex]] = [rest[swapIndex], rest[index]];
        }

        return active ? [active, ...rest] : rest;
    }, []);

    const playPause = useCallback(async () => {
        try {
            if (isPlaying) {
                await TrackPlayer.pause();
            } else {
                await setupTrackPlayer();
                await TrackPlayer.play();
            }
        } catch (error) {
            console.log("Audio play/pause failed", error);
        }
    }, [isPlaying]);

    const skipToNext = useCallback(async () => {
        await TrackPlayer.skipToNext().catch((error) => console.log("Audio next failed", error));
    }, []);
    const skipToPrev = useCallback(async () => {
        await TrackPlayer.skipToPrevious().catch((error) => console.log("Audio previous failed", error));
    }, []);
    const seekTo = useCallback(async (s: number) => {
        await TrackPlayer.seekTo(s).catch((error) => console.log("Audio seek failed", error));
    }, []);
    const seekBy = useCallback(async (seconds: number) => {
        const nextPosition = Math.max(0, Math.min(duration || Number.MAX_SAFE_INTEGER, position + seconds));
        await TrackPlayer.seekTo(nextPosition).catch((error) => console.log("Audio seek failed", error));
    }, [duration, position]);
    const setRepeat = useCallback(async (mode: RepeatMode): Promise<void> => {
        setRepeatModeState(mode);
        await TrackPlayer.setRepeatMode(mode).catch((error) => console.log("Audio repeat failed", error));
    }, []);
    const cycleRepeatMode = useCallback(async () => {
        const next =
            repeatMode === RepeatMode.Off
                ? RepeatMode.Queue
                : repeatMode === RepeatMode.Queue
                    ? RepeatMode.Track
                    : RepeatMode.Off;
        await setRepeat(next);
    }, [repeatMode, setRepeat]);
    const toggleShuffle = useCallback(async () => {
        const queue = queueRef.current;
        const nextShuffle = !shuffleEnabled;
        const resumePosition = position;
        const shouldResume = isPlaying;

        setShuffleEnabled(nextShuffle);

        if (queue.length <= 1) return;

        const nextQueue = nextShuffle
            ? shuffleQueue(orderedQueueRef.current.length > 0 ? orderedQueueRef.current : queue, activeId)
            : orderedQueueRef.current;

        await rebuildQueue(nextQueue, activeId).catch((error) => console.log("Audio shuffle failed", error));
        if (resumePosition > 0) {
            await TrackPlayer.seekTo(resumePosition).catch(() => undefined);
        }
        if (shouldResume) {
            await TrackPlayer.play().catch(() => undefined);
        }
    }, [activeId, isPlaying, position, rebuildQueue, shuffleEnabled, shuffleQueue]);
    const setRate = useCallback(async (rate: number) => {
        await TrackPlayer.setRate(rate).catch((error) => console.log("Audio rate failed", error));
    }, []);
    const setSystemVolume = useCallback(async (value: number) => {
        const nextVolume = Math.max(0, Math.min(1, value));
        setVolumeState(nextVolume);
        await VolumeManager.setVolume(nextVolume, {
            type: 'music',
            showUI: false,
            playSound: false,
        }).catch((error) => console.log("Volume set failed", error));
    }, []);
    const stopPlayer = useCallback(async () => {
        try {
            await TrackPlayer.stop();
            await TrackPlayer.reset();
            // Reset internal queue refs so the bar hides
            queueRef.current = [];
            orderedQueueRef.current = [];
        } catch (err) {
            console.warn('[TrackPlayer] stopPlayer failed:', err);
        }
    }, []);

    const value = useMemo<TrackPlayerContextType>(() => ({
        activeId,
        isPlaying,
        isReady,
        position,
        duration,
        activeTrack,
        repeatMode,
        shuffleEnabled,
        volume,
        playAudio,
        playPause,
        skipToNext,
        skipToPrev,
        seekTo,
        seekBy,
        setRepeat,
        cycleRepeatMode,
        toggleShuffle,
        setRate,
        setSystemVolume,
        stopPlayer,
    }), [
        activeId,
        isPlaying,
        isReady,
        position,
        duration,
        activeTrack,
        repeatMode,
        shuffleEnabled,
        volume,
        playAudio,
        playPause,
        skipToNext,
        skipToPrev,
        seekTo,
        seekBy,
        setRepeat,
        cycleRepeatMode,
        toggleShuffle,
        setRate,
        setSystemVolume,
        stopPlayer,
    ]);

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
