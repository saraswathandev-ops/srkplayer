import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { AppState } from 'react-native';
import TrackPlayer, {
    RepeatMode,
    State,
    Track,
    useActiveTrack,
    usePlaybackState,
    useProgress,
} from 'react-native-track-player';
import { VolumeManager } from 'react-native-volume-manager';

import {
    isAudioPlayInFlight,
    isTrackPlayerReady,
    resetSetupFlag,
    setAudioPlayInFlight,
    setupTrackPlayer,
    videoItemToTrack,
} from '@/services/trackPlayerService';
import { releasePlayerSession, requestFreshVideoSession } from '@/services/playerSession';
import { PlayerManager } from '@/services/PlayerManager';
import { usePlayer } from '@/context/PlayerContext';
import { type VideoItem } from '@/types/player';
import { log } from '@/utils/logger';

const L = log('TrackPlayerContext');

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
const TRACK_PLAYER_SETUP_WAIT_MS = 2500;
const MIN_NATIVE_VOLUME_DELTA = 0.01;

function waitForAppToBecomeActive(timeoutMs = TRACK_PLAYER_SETUP_WAIT_MS): Promise<boolean> {
    if (AppState.currentState === 'active') {
        return Promise.resolve(true);
    }

    return new Promise((resolve) => {
        let settled = false;
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active' && !settled) {
                settled = true;
                subscription.remove();
                clearTimeout(timeoutId);
                resolve(true);
            }
        });

        const timeoutId = setTimeout(() => {
            if (settled) return;
            settled = true;
            subscription.remove();
            resolve(false);
        }, timeoutMs);
    });
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function TrackPlayerProvider({ children }: { children: React.ReactNode }) {
    const isSetupRef = useRef(false);
    const setupInFlightRef = useRef<Promise<void> | null>(null);
    const playInFlightRef = useRef(false);
    const playRequestIdRef = useRef(0);
    const pendingPlayRequestRef = useRef<{ videos: VideoItem[]; startIndex: number } | null>(null);
    const countedTrackRef = useRef<string | null>(null);
    const lastNativeVolumeRef = useRef(1);
    const lastSavedPlaybackRef = useRef<{ id: string | null; position: number }>({
        id: null,
        position: 0,
    });
    const queueRef = useRef<VideoItem[]>([]);
    const orderedQueueRef = useRef<VideoItem[]>([]);
    const { incrementPlayCount, updateLastPosition } = usePlayer();
    const activeTrack = useActiveTrack();
    const { state } = usePlaybackState();
    // Poll at 500ms when actively playing/buffering; slow to 5s when paused to save battery.
    const isActiveState = state === State.Playing || state === State.Buffering || state === State.Loading;
    const { position, duration } = useProgress(isActiveState ? 500 : 5000);
    const [repeatMode, setRepeatModeState] = useState<RepeatMode>(RepeatMode.Off);
    const [shuffleEnabled, setShuffleEnabled] = useState(false);
    const [volume, setVolumeState] = useState(1);

    const ensureTrackPlayerSetup = useCallback(async () => {
        if (isSetupRef.current) return;
        if (setupInFlightRef.current) {
            await setupInFlightRef.current;
            return;
        }

        setupInFlightRef.current = (async () => {
            try {
                L.audio('setupTrackPlayer start');
                await setupTrackPlayer();
                isSetupRef.current = isTrackPlayerReady();
                L.audio('setupTrackPlayer done', { ready: isSetupRef.current });
            } catch (err) {
                L.error('setupTrackPlayer failed', err);
                console.error("TrackPlayer setup failed:", err);
                isSetupRef.current = false;
            } finally {
                setupInFlightRef.current = null;
            }
        })();

        await setupInFlightRef.current;

        if (!isSetupRef.current && AppState.currentState !== 'active') {
            const becameActive = await waitForAppToBecomeActive();
            if (becameActive) {
                await ensureTrackPlayerSetup();
            }
        }
    }, []);

    useEffect(() => {
        void ensureTrackPlayerSetup();

        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active' && !isSetupRef.current) {
                void ensureTrackPlayerSetup();
            }
        });

        return () => subscription.remove();
    }, [ensureTrackPlayerSetup]);

    useEffect(() => {
        let mounted = true;
        void VolumeManager.getVolume()
            .then((result) => {
                if (mounted && typeof result.volume === 'number') {
                    lastNativeVolumeRef.current = result.volume;
                    setVolumeState(result.volume);
                }
            })
            .catch(() => undefined);

        const subscription = VolumeManager.addVolumeListener((result) => {
            if (typeof result.volume === 'number') {
                lastNativeVolumeRef.current = result.volume;
                setVolumeState(result.volume);
            }
        });

        return () => {
            mounted = false;
            subscription.remove();
        };
    }, []);

    const isPlaying = isActiveState;
    const isReady = state !== State.None && state !== State.Error;

    // The active track id is stored in the RNTP track's `id` field which we
    // set to video.id inside videoItemToTrack
    const activeId = (activeTrack?.id as string | undefined) ?? null;

    useEffect(() => {
        if (!activeId || countedTrackRef.current === activeId) return;
        countedTrackRef.current = activeId;
        void incrementPlayCount(activeId);
    }, [activeId, incrementPlayCount]);

    useEffect(() => {
        if (!activeId) return;
        if (!Number.isFinite(position) || position < 1) return;

        const previous = lastSavedPlaybackRef.current;
        const trackChanged = previous.id !== activeId;
        const positionChangedEnough = Math.abs(position - previous.position) >= 10;

        if (!trackChanged && !positionChangedEnough) return;

        lastSavedPlaybackRef.current = { id: activeId, position };
        void updateLastPosition(
            activeId,
            position,
            Number.isFinite(duration) && duration > 0 ? duration : undefined
        );
    }, [activeId, duration, position, updateLastPosition]);

    // -------------------------------------------------------------------------
    // Actions
    // -------------------------------------------------------------------------
    const playAudio = useCallback(async (videos: VideoItem[], startIndex = 0) => {
        pendingPlayRequestRef.current = { videos, startIndex };
        const requestId = ++playRequestIdRef.current;

        if (playInFlightRef.current) {
            L.audio('playAudio queued latest request', { requestId, count: videos.length, startIndex });
            return;
        }

        playInFlightRef.current = true;
        setAudioPlayInFlight(true);
        try {
            while (pendingPlayRequestRef.current) {
                const currentRequest = pendingPlayRequestRef.current;
                pendingPlayRequestRef.current = null;
                const activeRequestId = playRequestIdRef.current;
                const requestedVideos = currentRequest.videos;
                const requestedStartIndex = currentRequest.startIndex;
                const tracks = requestedVideos.map(videoItemToTrack);

                L.audio('playAudio start', {
                    requestId: activeRequestId,
                    count: requestedVideos.length,
                    startIndex: requestedStartIndex,
                    title: requestedVideos[requestedStartIndex]?.title,
                });
                if (tracks.length === 0) continue;
                queueRef.current = requestedVideos;
                orderedQueueRef.current = requestedVideos;
                setShuffleEnabled(false);
            // Stop any active video session — PlayerManager fires the stop callback on player.tsx
                await PlayerManager.playAudio();
                if (activeRequestId !== playRequestIdRef.current) continue;
            // Destroy any existing video session so the next video open starts clean.
                releasePlayerSession();
                requestFreshVideoSession();
                await ensureTrackPlayerSetup();
                if (activeRequestId !== playRequestIdRef.current) continue;

                if (!isTrackPlayerReady()) {
                    throw new Error("TrackPlayer setup not ready yet.");
                }

                await TrackPlayer.stop().catch(() => undefined);
                if (activeRequestId !== playRequestIdRef.current) continue;

                await TrackPlayer.reset();
                if (activeRequestId !== playRequestIdRef.current) continue;

                await TrackPlayer.add(tracks);
                if (activeRequestId !== playRequestIdRef.current) continue;

                if (requestedStartIndex > 0) {
                    await TrackPlayer.skip(requestedStartIndex);
                    if (activeRequestId !== playRequestIdRef.current) continue;
                }

                await TrackPlayer.play();
                if (activeRequestId !== playRequestIdRef.current) continue;

                L.audio('playAudio playing', { requestId: activeRequestId, startIndex: requestedStartIndex });
            }
        } catch (error) {
            L.error('playAudio failed', error);
            console.log("Audio playback start failed", error);
        } finally {
            playInFlightRef.current = false;
            setAudioPlayInFlight(false);
        }
    }, [ensureTrackPlayerSetup]);

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
                await ensureTrackPlayerSetup();
                if (!isTrackPlayerReady()) {
                    throw new Error("TrackPlayer setup not ready yet.");
                }
                await TrackPlayer.play();
            }
        } catch (error) {
            console.log("Audio play/pause failed", error);
        }
    }, [ensureTrackPlayerSetup, isPlaying]);

    const skipToNext = useCallback(async () => {
        await TrackPlayer.skipToNext().catch((error) => console.log("Audio next failed", error));
    }, []);
    const skipToPrev = useCallback(async () => {
        await TrackPlayer.skipToPrevious().catch((error) => console.log("Audio previous failed", error));
    }, []);
    const seekTo = useCallback(async (s: number) => {
        await TrackPlayer.seekTo(s).catch((error) => console.log("Audio seek failed", error));
        if (activeId) {
            lastSavedPlaybackRef.current = { id: activeId, position: s };
            void updateLastPosition(
                activeId,
                Math.max(0, s),
                Number.isFinite(duration) && duration > 0 ? duration : undefined
            );
        }
    }, [activeId, duration, updateLastPosition]);
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
        if (Math.abs(nextVolume - lastNativeVolumeRef.current) <= MIN_NATIVE_VOLUME_DELTA) {
            return;
        }
        lastNativeVolumeRef.current = nextVolume;
        await VolumeManager.setVolume(nextVolume, {
            type: 'music',
            showUI: false,
            playSound: false,
        }).catch((error) => console.log("Volume set failed", error));
    }, []);
    const stopPlayer = useCallback(async () => {
        const requestId = ++playRequestIdRef.current;
        pendingPlayRequestRef.current = null;
        countedTrackRef.current = null;
        lastSavedPlaybackRef.current = { id: null, position: 0 };
        queueRef.current = [];
        orderedQueueRef.current = [];
        setAudioPlayInFlight(false);
        L.audio('stopPlayer called', { requestId });
        try {
            await PlayerManager.stopAudio();
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
