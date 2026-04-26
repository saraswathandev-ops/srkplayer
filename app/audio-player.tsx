import { BlurView } from '@react-native-community/blur';
import { useNavigation } from '@react-navigation/native';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    GestureResponderEvent,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { RepeatMode } from 'react-native-track-player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';

import { usePlayer } from '@/context/PlayerContext';
import { useTrackPlayer } from '@/context/TrackPlayerContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { getThumbnailUri } from '@/utils/thumbnailSource';

const SLIDER_TRACK_HEIGHT = 4;
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function formatTime(seconds: number): string {
    if (!seconds || Number.isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

interface ProgressBarProps {
    value: number;
    max: number;
    primaryColor: string;
    trackColor: string;
    onSeek: (value: number) => void;
    onInteractionStart?: () => void;
    onInteractionEnd?: () => void;
}

function ProgressBar({
    value,
    max,
    primaryColor,
    trackColor,
    onSeek,
    onInteractionStart,
    onInteractionEnd,
}: ProgressBarProps) {
    const barRef = useRef<View>(null);
    const [barWidth, setBarWidth] = useState(1);
    const progress = max > 0 ? Math.max(0, Math.min(value / max, 1)) : 0;

    const handleTouch = (event: GestureResponderEvent) => {
        const touchPageX = event.nativeEvent?.pageX;
        if (!Number.isFinite(touchPageX) || max <= 0) return;

        barRef.current?.measure((_x, _y, width, _height, pageX) => {
            if (!Number.isFinite(width) || width <= 0) return;
            const touchX = touchPageX - pageX;
            const ratio = Math.max(0, Math.min(1, touchX / width));
            onSeek(ratio * max);
        });
    };

    return (
        <View
            ref={barRef}
            onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
            style={[styles.sliderTrack, { backgroundColor: trackColor }]}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(event) => {
                onInteractionStart?.();
                handleTouch(event);
            }}
            onResponderMove={handleTouch}
            onResponderRelease={(event) => {
                handleTouch(event);
                onInteractionEnd?.();
            }}
            onResponderTerminate={onInteractionEnd}
        >
            <View
                style={[
                    styles.sliderFill,
                    { width: progress * barWidth, backgroundColor: primaryColor },
                ]}
            />
            <View
                style={[
                    styles.sliderThumb,
                    {
                        left: progress * barWidth - 8,
                        backgroundColor: primaryColor,
                    },
                ]}
            />
        </View>
    );
}

export default function AudioPlayerScreen() {
    const { colors, isDark } = useAppTheme();
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const { width } = useWindowDimensions();
    const {
        videos,
        playlists,
        toggleFavorite,
        addToPlaylist,
    } = usePlayer();
    const {
        activeId,
        activeTrack,
        isPlaying,
        position,
        duration,
        repeatMode,
        shuffleEnabled,
        volume,
        playPause,
        skipToNext,
        skipToPrev,
        seekTo,
        seekBy,
        cycleRepeatMode,
        toggleShuffle,
        setRate,
        setSystemVolume,
    } = useTrackPlayer();

    const [speedIndex, setSpeedIndex] = useState(SPEED_OPTIONS.indexOf(1));
    const [menuVisible, setMenuVisible] = useState(false);
    const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const lastTapRef = useRef<{ x: number; time: number } | null>(null);
    const sliderInteractingRef = useRef(false);
    const rootGestureSuppressedRef = useRef(false);
    const gestureReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handledVideoIdRef = useRef<string | null>(null);

    const activeVideo = useMemo(
        () => videos.find((video) => video.id === activeId),
        [activeId, videos],
    );
    const artwork = getThumbnailUri(activeTrack?.artwork ?? activeVideo?.thumbnail);
    const title = activeTrack?.title ?? activeVideo?.title ?? 'No track playing';
    const artist = activeTrack?.artist ?? activeVideo?.artist ?? 'Unknown Artist';
    const album = typeof activeTrack?.album === 'string'
        ? activeTrack.album
        : activeVideo?.album ?? activeVideo?.folder ?? '';
    const artworkSize = Math.min(width - 72, 340);
    const isFavorite = Boolean(activeVideo?.isFavorite);

    useEffect(() => {
        if ((activeTrack as any)?.mediaType === 'video' && activeId && handledVideoIdRef.current !== activeId) {
            handledVideoIdRef.current = activeId;
            navigation.replace('player', { id: activeId });
        }
    }, [activeTrack, activeId, navigation]);

    useEffect(() => () => {
        if (gestureReleaseTimerRef.current) {
            clearTimeout(gestureReleaseTimerRef.current);
        }
    }, []);

    // Sleep timer countdown — pauses playback when it reaches zero
    useEffect(() => {
        if (sleepTimerRemaining === null || sleepTimerRemaining <= 0) return;
        const interval = setInterval(() => {
            setSleepTimerRemaining((prev) => {
                if (prev === null || prev <= 1) {
                    clearInterval(interval);
                    void playPause().catch(() => undefined);
                    Alert.alert('Sleep Timer', 'Playback stopped by the sleep timer.');
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [sleepTimerRemaining, playPause]);

    const cycleSleepTimer = useCallback(() => {
        const options: Array<number | null> = [15 * 60, 30 * 60, 45 * 60, 60 * 60, null];
        const currentIndex = options.findIndex((o) => o === sleepTimerRemaining);
        const next = options[(currentIndex + 1) % options.length];
        setSleepTimerRemaining(next);
        if (Platform.OS !== 'web') ReactNativeHapticFeedback.trigger('impactLight');
    }, [sleepTimerRemaining]);

    const sleepTimerLabel = sleepTimerRemaining === null
        ? 'Sleep'
        : `${Math.ceil(sleepTimerRemaining / 60)}m`;

    const handleSliderStart = useCallback(() => {
        if (gestureReleaseTimerRef.current) {
            clearTimeout(gestureReleaseTimerRef.current);
        }
        sliderInteractingRef.current = true;
        rootGestureSuppressedRef.current = true;
    }, []);

    const handleSliderEnd = useCallback(() => {
        sliderInteractingRef.current = false;
        gestureReleaseTimerRef.current = setTimeout(() => {
            rootGestureSuppressedRef.current = false;
        }, 120);
    }, []);

    const cycleSpeed = useCallback(async () => {
        const nextIndex = (speedIndex + 1) % SPEED_OPTIONS.length;
        setSpeedIndex(nextIndex);
        await setRate(SPEED_OPTIONS[nextIndex]);
    }, [setRate, speedIndex]);

    const handleVolumeChange = useCallback((nextVolume: number) => {
        const clamped = Math.max(0, Math.min(1, nextVolume));
        const oldStep = Math.round(volume * 10);
        const newStep = Math.round(clamped * 10);
        if (oldStep !== newStep && Platform.OS !== 'web') {
            ReactNativeHapticFeedback.trigger('selection');
        }
        void setSystemVolume(clamped);
    }, [volume, setSystemVolume]);

    const handleShare = useCallback(async () => {
        if (!activeTrack && !activeVideo) return;
        setMenuVisible(false);
        const uri = activeTrack?.url ?? activeVideo?.uri ?? '';
        await Share.share({
            title,
            message: uri ? `${title} - ${artist}\n${uri}` : `${title} - ${artist}`,
            url: uri,
        }).catch(() => undefined);
    }, [activeTrack, activeVideo, artist, title]);

    const handleAddToPlaylist = useCallback(async (playlistId: string) => {
        if (!activeId) return;
        await addToPlaylist(playlistId, activeId).catch(() => undefined);
        setPlaylistModalVisible(false);
    }, [activeId, addToPlaylist]);

    const handleRootTouchStart = useCallback((event: GestureResponderEvent) => {
        if (sliderInteractingRef.current || rootGestureSuppressedRef.current) return;
        const touch = event.nativeEvent;
        touchStartRef.current = {
            x: touch.pageX,
            y: touch.pageY,
            time: Date.now(),
        };
    }, []);

    const handleRootTouchEnd = useCallback((event: GestureResponderEvent) => {
        if (sliderInteractingRef.current || rootGestureSuppressedRef.current || !touchStartRef.current) {
            touchStartRef.current = null;
            return;
        }
        const start = touchStartRef.current;
        touchStartRef.current = null;

        const end = event.nativeEvent;
        const dx = end.pageX - start.x;
        const dy = end.pageY - start.y;
        const elapsed = Date.now() - start.time;

        if (elapsed < 600 && dy > 90 && Math.abs(dx) < 80) {
            navigation.goBack();
            return;
        }
        if (elapsed < 600 && dx < -90 && Math.abs(dy) < 90) {
            void skipToNext();
            return;
        }
        if (elapsed < 600 && dx > 90 && Math.abs(dy) < 90) {
            void skipToPrev();
            return;
        }
        if (elapsed > 260 || Math.abs(dx) > 24 || Math.abs(dy) > 24) return;

        const now = Date.now();
        const previousTap = lastTapRef.current;
        if (previousTap && now - previousTap.time < 300 && Math.abs(end.pageX - previousTap.x) < 80) {
            lastTapRef.current = null;
            void seekBy(end.pageX < width / 2 ? -10 : 10);
        } else {
            lastTapRef.current = { x: end.pageX, time: now };
        }
    }, [navigation, seekBy, skipToNext, skipToPrev, width]);

    const repeatColor = repeatMode === RepeatMode.Off
        ? colors.textSecondary ?? colors.text
        : colors.primary;
    const repeatBadge = repeatMode === RepeatMode.Track ? '1' : '';

    if (!activeTrack && !activeVideo) {
        return (
            <View style={[styles.root, styles.emptyRoot, { backgroundColor: colors.background }]}>
                <View style={[styles.topBar, { marginTop: insets.top + 8 }]}>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        style={({ pressed }) => [
                            styles.iconBtn,
                            { backgroundColor: pressed ? `${colors.primary}22` : colors.card },
                        ]}
                    >
                        <Feather name="chevron-down" size={24} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.topTitle, { color: colors.text }]}>Now Playing</Text>
                    <View style={styles.iconBtn} />
                </View>
                <View style={styles.emptyContent}>
                    <Feather name="music" size={64} color={colors.primary} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No track playing</Text>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        Pick a song from Audio to start playback.
                    </Text>
                    <Pressable
                        onPress={() => navigation.navigate('TabsRoot', { screen: 'Audio' })}
                        style={({ pressed }) => [
                            styles.primaryAction,
                            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                        ]}
                    >
                        <Text style={styles.primaryActionText}>Open Audio</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    return (
        <View
            style={[styles.root, { backgroundColor: colors.background }]}
            onTouchStart={handleRootTouchStart}
            onTouchEnd={handleRootTouchEnd}
        >
            {artwork ? (
                <>
                    <FastImage
                        source={{ uri: artwork }}
                        style={StyleSheet.absoluteFill as any}
                        resizeMode={FastImage.resizeMode.cover}
                    />
                    {Platform.OS === 'ios' ? (
                        <BlurView
                            blurType={isDark ? 'dark' : 'light'}
                            blurAmount={90}
                            style={StyleSheet.absoluteFill}
                        />
                    ) : null}
                </>
            ) : null}

            <LinearGradient
                colors={['transparent', `${colors.background}ee`, colors.background]}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
            />

            <View style={[styles.topBar, { marginTop: insets.top + 8 }]}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    style={({ pressed }) => [
                        styles.iconBtn,
                        { backgroundColor: pressed ? `${colors.primary}22` : `${colors.card}99` },
                    ]}
                >
                    <Feather name="chevron-down" size={24} color={colors.text} />
                </Pressable>
                <Text style={[styles.topTitle, { color: colors.text }]}>Now Playing</Text>
                <Pressable
                    onPress={() => setMenuVisible(true)}
                    style={({ pressed }) => [
                        styles.iconBtn,
                        { backgroundColor: pressed ? `${colors.primary}22` : `${colors.card}99` },
                    ]}
                >
                    <Feather name="more-vertical" size={22} color={colors.text} />
                </Pressable>
            </View>

            <View style={styles.artworkContainer}>
                <View style={[styles.artworkShadow, { shadowColor: colors.primary }]}>
                    {artwork ? (
                        <FastImage
                            source={{ uri: artwork }}
                            style={[styles.artworkImage, { width: artworkSize, height: artworkSize }]}
                            resizeMode={FastImage.resizeMode.cover}
                        />
                    ) : (
                        <View
                            style={[
                                styles.artworkImage,
                                styles.artworkPlaceholder,
                                { width: artworkSize, height: artworkSize, backgroundColor: colors.card },
                            ]}
                        >
                            <Feather name="music" size={80} color={colors.primary} />
                        </View>
                    )}
                </View>
            </View>

            <View style={styles.infoSection}>
                <View style={styles.titleRow}>
                    <View style={styles.titleTextBlock}>
                        <Text style={[styles.trackTitle, { color: colors.text }]} numberOfLines={2}>
                            {title}
                        </Text>
                        <Text
                            style={[styles.artistName, { color: colors.textSecondary ?? colors.text }]}
                            numberOfLines={1}
                        >
                            {album ? `${artist} - ${album}` : artist}
                        </Text>
                    </View>
                    <Pressable
                        disabled={!activeId}
                        onPress={() => activeId && void toggleFavorite(activeId)}
                        style={({ pressed }) => [
                            styles.favoriteBtn,
                            { opacity: pressed ? 0.65 : activeId ? 1 : 0.45 },
                        ]}
                    >
                        <Feather
                            name="heart"
                            size={24}
                            color={isFavorite ? colors.error : colors.text}
                        />
                    </Pressable>
                </View>
            </View>

            <View style={styles.progressSection}>
                <ProgressBar
                    value={position}
                    max={duration > 0 ? duration : 1}
                    primaryColor={colors.primary}
                    trackColor={`${colors.text}22`}
                    onSeek={(seconds) => void seekTo(seconds)}
                    onInteractionStart={handleSliderStart}
                    onInteractionEnd={handleSliderEnd}
                />
                <View style={styles.timeRow}>
                    <Text style={[styles.timeText, { color: colors.textSecondary ?? colors.text }]}>
                        {formatTime(position)}
                    </Text>
                    <Text style={[styles.timeText, { color: colors.textSecondary ?? colors.text }]}>
                        {formatTime(duration > 0 ? duration : 0)}
                    </Text>
                </View>
            </View>

            <View style={styles.controlsRow}>
                <Pressable
                    onPress={() => void toggleShuffle()}
                    style={({ pressed }) => [styles.sideBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                    <Feather
                        name="shuffle"
                        size={22}
                        color={shuffleEnabled ? colors.primary : colors.textSecondary ?? colors.text}
                    />
                </Pressable>
                <Pressable
                    onPress={() => void seekBy(-10)}
                    style={({ pressed }) => [styles.controlBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                    <Feather name="rotate-ccw" size={22} color={colors.text} />
                    <Text style={[styles.smallControlText, { color: colors.text }]}>10</Text>
                </Pressable>
                <Pressable
                    onPress={() => void skipToPrev()}
                    style={({ pressed }) => [styles.controlBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                    <Feather name="skip-back" size={27} color={colors.text} />
                </Pressable>
                <Pressable
                    onPress={() => void playPause()}
                    style={({ pressed }) => [
                        styles.playBtn,
                        { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                    ]}
                >
                    <Feather
                        name={isPlaying ? 'pause' : 'play'}
                        size={32}
                        color="#fff"
                        style={isPlaying ? undefined : { marginLeft: 3 }}
                    />
                </Pressable>
                <Pressable
                    onPress={() => void skipToNext()}
                    style={({ pressed }) => [styles.controlBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                    <Feather name="skip-forward" size={27} color={colors.text} />
                </Pressable>
                <Pressable
                    onPress={() => void seekBy(10)}
                    style={({ pressed }) => [styles.controlBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                    <Feather name="rotate-cw" size={22} color={colors.text} />
                    <Text style={[styles.smallControlText, { color: colors.text }]}>10</Text>
                </Pressable>
                <Pressable
                    onPress={() => void cycleRepeatMode()}
                    style={({ pressed }) => [styles.sideBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                    <View>
                        <Feather name="repeat" size={22} color={repeatColor} />
                        {repeatBadge ? (
                            <View style={[styles.repeatBadge, { backgroundColor: colors.primary }]}>
                                <Text style={styles.repeatBadgeText}>{repeatBadge}</Text>
                            </View>
                        ) : null}
                    </View>
                </Pressable>
            </View>

            <View style={styles.secondaryRow}>
                <Pressable
                    onPress={() => {
                        setMenuVisible(false);
                        setPlaylistModalVisible(true);
                    }}
                    style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                    <Feather name="plus-square" size={18} color={colors.text} />
                    <Text style={[styles.secondaryText, { color: colors.text }]}>Playlist</Text>
                </Pressable>
                <Pressable
                    onPress={() => void handleShare()}
                    style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                    <Feather name="share-2" size={18} color={colors.text} />
                    <Text style={[styles.secondaryText, { color: colors.text }]}>Share</Text>
                </Pressable>
                <Pressable
                    onPress={() => void cycleSpeed()}
                    style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                    <Feather name="zap" size={18} color={colors.text} />
                    <Text style={[styles.secondaryText, { color: colors.text }]}>
                        {SPEED_OPTIONS[speedIndex]}x
                    </Text>
                </Pressable>
                <Pressable
                    onPress={cycleSleepTimer}
                    style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                    <Feather
                        name="moon"
                        size={18}
                        color={sleepTimerRemaining !== null ? colors.primary : colors.text}
                    />
                    <Text style={[styles.secondaryText, { color: sleepTimerRemaining !== null ? colors.primary : colors.text }]}>
                        {sleepTimerLabel}
                    </Text>
                </Pressable>
            </View>

            <View style={styles.controlMetricSection}>
                <Feather name="volume-2" size={20} color={colors.textSecondary ?? colors.text} />
                <View style={styles.controlMetricSlider}>
                    <ProgressBar
                        value={volume}
                        max={1}
                        primaryColor={colors.primary}
                        trackColor={`${colors.text}22`}
                        onSeek={handleVolumeChange}
                        onInteractionStart={handleSliderStart}
                        onInteractionEnd={handleSliderEnd}
                    />
                </View>
                <Text style={[styles.controlMetricText, { color: colors.textSecondary ?? colors.text }]}>
                    {Math.round(volume * 100)}%
                </Text>
            </View>

            <View style={{ height: insets.bottom + 12 }} />

            <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
                <Pressable style={styles.modalBackdrop} onPress={() => setMenuVisible(false)}>
                    <View style={[styles.menuPanel, { backgroundColor: colors.card }]}>
                        <Pressable
                            onPress={() => {
                                setMenuVisible(false);
                                setPlaylistModalVisible(true);
                            }}
                            style={styles.menuItem}
                        >
                            <Feather name="plus-square" size={20} color={colors.text} />
                            <Text style={[styles.menuText, { color: colors.text }]}>Add to playlist</Text>
                        </Pressable>
                        <Pressable onPress={() => void handleShare()} style={styles.menuItem}>
                            <Feather name="share-2" size={20} color={colors.text} />
                            <Text style={[styles.menuText, { color: colors.text }]}>Share</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Modal>

            <Modal
                transparent
                visible={playlistModalVisible}
                animationType="slide"
                onRequestClose={() => setPlaylistModalVisible(false)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setPlaylistModalVisible(false)}>
                    <Pressable style={[styles.playlistPanel, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Add to playlist</Text>
                        {playlists.length === 0 ? (
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No playlists yet.
                            </Text>
                        ) : (
                            <ScrollView style={styles.playlistList}>
                                {playlists.map((playlist) => (
                                    <Pressable
                                        key={playlist.id}
                                        onPress={() => void handleAddToPlaylist(playlist.id)}
                                        style={styles.playlistItem}
                                    >
                                        <Feather name="list" size={20} color={colors.primary} />
                                        <View style={styles.playlistTextBlock}>
                                            <Text style={[styles.playlistName, { color: colors.text }]} numberOfLines={1}>
                                                {playlist.name}
                                            </Text>
                                            <Text style={[styles.playlistCount, { color: colors.textSecondary }]}>
                                                {playlist.videoCount} items
                                            </Text>
                                        </View>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        paddingHorizontal: 22,
    },
    emptyRoot: {
        paddingHorizontal: 24,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    topTitle: {
        fontSize: 15,
        fontFamily: 'Inter_600SemiBold',
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    artworkContainer: {
        alignItems: 'center',
        marginVertical: 18,
    },
    artworkShadow: {
        borderRadius: 22,
        shadowOpacity: 0.45,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 24,
        elevation: 16,
    },
    artworkImage: {
        borderRadius: 22,
    },
    artworkPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoSection: {
        marginBottom: 18,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    titleTextBlock: {
        flex: 1,
        minWidth: 0,
    },
    trackTitle: {
        fontSize: 20,
        fontFamily: 'Inter_700Bold',
    },
    artistName: {
        marginTop: 5,
        fontSize: 13,
        fontFamily: 'Inter_400Regular',
    },
    favoriteBtn: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressSection: {
        marginBottom: 4,
    },
    sliderTrack: {
        width: '100%',
        height: SLIDER_TRACK_HEIGHT,
        borderRadius: SLIDER_TRACK_HEIGHT / 2,
        marginVertical: 12,
        position: 'relative',
    },
    sliderFill: {
        position: 'absolute',
        top: 0,
        left: 0,
        height: SLIDER_TRACK_HEIGHT,
        borderRadius: SLIDER_TRACK_HEIGHT / 2,
    },
    sliderThumb: {
        position: 'absolute',
        top: -(16 / 2 - SLIDER_TRACK_HEIGHT / 2),
        width: 16,
        height: 16,
        borderRadius: 8,
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 2,
    },
    timeText: {
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    sideBtn: {
        width: 34,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    controlBtn: {
        width: 38,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playBtn: {
        width: 62,
        height: 62,
        borderRadius: 31,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
    },
    smallControlText: {
        marginTop: -3,
        fontSize: 9,
        fontFamily: 'Inter_700Bold',
    },
    repeatBadge: {
        position: 'absolute',
        right: -4,
        bottom: -4,
        width: 14,
        height: 14,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
    },
    repeatBadgeText: {
        fontSize: 9,
        color: '#fff',
        fontFamily: 'Inter_700Bold',
    },
    secondaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginTop: 16,
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 36,
    },
    secondaryText: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
    },
    controlMetricSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 12,
    },
    controlMetricSlider: {
        flex: 1,
    },
    controlMetricText: {
        width: 38,
        textAlign: 'right',
        fontSize: 12,
        fontFamily: 'Inter_500Medium',
    },
    emptyContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    emptyTitle: {
        fontSize: 20,
        fontFamily: 'Inter_700Bold',
    },
    emptyText: {
        fontSize: 13,
        fontFamily: 'Inter_400Regular',
        textAlign: 'center',
    },
    primaryAction: {
        marginTop: 10,
        paddingHorizontal: 18,
        minHeight: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryActionText: {
        color: '#fff',
        fontSize: 14,
        fontFamily: 'Inter_700Bold',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
        padding: 18,
    },
    menuPanel: {
        alignSelf: 'flex-end',
        minWidth: 220,
        borderRadius: 12,
        paddingVertical: 8,
        marginBottom: 20,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 48,
        paddingHorizontal: 16,
    },
    menuText: {
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
    },
    playlistPanel: {
        maxHeight: '58%',
        borderRadius: 16,
        padding: 18,
    },
    modalTitle: {
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
        marginBottom: 10,
    },
    playlistList: {
        marginHorizontal: -6,
    },
    playlistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
        paddingHorizontal: 6,
    },
    playlistTextBlock: {
        flex: 1,
        minWidth: 0,
    },
    playlistName: {
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
    },
    playlistCount: {
        marginTop: 2,
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
    },
});
