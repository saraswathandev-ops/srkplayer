import Feather from 'react-native-vector-icons/Feather';
import { BlurView } from '@react-native-community/blur';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import {
    Dimensions,
    GestureResponderEvent,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { RepeatMode, useActiveTrack } from 'react-native-track-player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTrackPlayer } from '@/context/TrackPlayerContext';
import { useAppTheme } from '@/hooks/useAppTheme';

const { width: SCREEN_W } = Dimensions.get('window');
const ARTWORK_SIZE = SCREEN_W - 80;
const SLIDER_TRACK_HEIGHT = 4;

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Simple touch-based progress slider (no extra packages needed)
// ---------------------------------------------------------------------------
interface ProgressBarProps {
    value: number;
    max: number;
    primaryColor: string;
    trackColor: string;
    onSeek: (seconds: number) => void;
}

function ProgressBar({ value, max, primaryColor, trackColor, onSeek }: ProgressBarProps) {
    const barRef = useRef<View>(null);
    const [barWidth, setBarWidth] = useState(1);
    const progress = max > 0 ? Math.min(value / max, 1) : 0;

    const handleTouch = (e: GestureResponderEvent) => {
        barRef.current?.measure((_x, _y, width, _h, pageX) => {
            const touchX = e.nativeEvent.pageX - pageX;
            const ratio = Math.max(0, Math.min(1, touchX / width));
            onSeek(ratio * max);
        });
    };

    return (
        <View
            ref={barRef}
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
            style={[styles.sliderTrack, { backgroundColor: trackColor }]}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={handleTouch}
            onResponderMove={handleTouch}
            onResponderRelease={handleTouch}
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

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------
export default function AudioPlayerScreen() {
    const { colors, isDark } = useAppTheme();
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const activeTrack = useActiveTrack();
    const {
        isPlaying,
        position,
        duration,
        playPause,
        skipToNext,
        skipToPrev,
        seekTo,
        setRepeat,
        setRate,
    } = useTrackPlayer();

    const [repeatMode, setRepeatMode] = useState<RepeatMode>(RepeatMode.Off);
    const [speedIdx, setSpeedIdx] = useState(SPEED_OPTIONS.indexOf(1));

    const artwork =
        typeof activeTrack?.artwork === 'string' ? activeTrack.artwork : null;
    const title = activeTrack?.title ?? 'No Track';
    const artist = activeTrack?.artist ?? 'Unknown Artist';
    const album = typeof activeTrack?.album === 'string' ? activeTrack.album : '';

    const cycleRepeat = useCallback(async () => {
        const next =
            repeatMode === RepeatMode.Off
                ? RepeatMode.Queue
                : repeatMode === RepeatMode.Queue
                    ? RepeatMode.Track
                    : RepeatMode.Off;
        setRepeatMode(next);
        await setRepeat(next);
    }, [repeatMode, setRepeat]);

    const cycleSpeed = useCallback(async () => {
        const nextIdx = (speedIdx + 1) % SPEED_OPTIONS.length;
        setSpeedIdx(nextIdx);
        await setRate(SPEED_OPTIONS[nextIdx]);
    }, [speedIdx, setRate]);

    const repeatColor =
        repeatMode === RepeatMode.Off
            ? (colors.textSecondary ?? colors.text)
            : colors.primary;
    const repeatBadgeLabel =
        repeatMode === RepeatMode.Track ? '1' : '';

    return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
            {/* Blurred artwork background */}
            {artwork && (
                <>
                    <FastImage
                        source={{ uri: artwork }}
                        style={StyleSheet.absoluteFill as any}
                        resizeMode={FastImage.resizeMode.cover}
                    />
                    {Platform.OS === 'ios' && (
                        <BlurView
                            blurType={isDark ? 'dark' : 'light'}
                            blurAmount={90}
                            style={StyleSheet.absoluteFill}
                        />
                    )}
                </>
            )}

            {/* Gradient overlay */}
            <LinearGradient
                colors={['transparent', `${colors.background}ee`, colors.background]}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
            />

            {/* Top bar */}
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

                {/* Spacer */}
                <View style={styles.iconBtn} />
            </View>

            {/* Artwork */}
            <View style={styles.artworkContainer}>
                <View style={[styles.artworkShadow, { shadowColor: colors.primary ?? '#000' }]}>
                    {artwork ? (
                        <FastImage
                            source={{ uri: artwork }}
                            style={styles.artworkImage}
                            resizeMode={FastImage.resizeMode.cover}
                        />
                    ) : (
                        <View
                            style={[
                                styles.artworkImage,
                                styles.artworkPlaceholder,
                                { backgroundColor: colors.card },
                            ]}
                        >
                            <Feather name="music" size={80} color={colors.primary} />
                        </View>
                    )}
                </View>
            </View>

            {/* Track info */}
            <View style={styles.infoSection}>
                <Text style={[styles.trackTitle, { color: colors.text }]} numberOfLines={2}>
                    {title}
                </Text>
                <Text
                    style={[styles.artistName, { color: colors.textSecondary ?? colors.text }]}
                    numberOfLines={1}
                >
                    {album ? `${artist} • ${album}` : artist}
                </Text>
            </View>

            {/* Progress */}
            <View style={styles.progressSection}>
                <ProgressBar
                    value={position}
                    max={duration > 0 ? duration : 1}
                    primaryColor={colors.primary}
                    trackColor={`${colors.text}22`}
                    onSeek={(secs) => void seekTo(secs)}
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

            {/* Controls */}
            <View style={styles.controlsRow}>
                {/* Repeat */}
                <Pressable
                    onPress={() => void cycleRepeat()}
                    style={({ pressed }) => [styles.sideBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                    <View>
                        <Feather name="repeat" size={22} color={repeatColor} />
                        {repeatBadgeLabel ? (
                            <View style={[styles.repeatBadge, { backgroundColor: colors.primary }]}>
                                <Text style={styles.repeatBadgeText}>{repeatBadgeLabel}</Text>
                            </View>
                        ) : null}
                    </View>
                </Pressable>

                {/* Skip prev */}
                <Pressable
                    onPress={() => void skipToPrev()}
                    style={({ pressed }) => [styles.controlBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                    <Feather name="skip-back" size={28} color={colors.text} />
                </Pressable>

                {/* Play / Pause */}
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

                {/* Skip next */}
                <Pressable
                    onPress={() => void skipToNext()}
                    style={({ pressed }) => [styles.controlBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                    <Feather name="skip-forward" size={28} color={colors.text} />
                </Pressable>

                {/* Speed */}
                <Pressable
                    onPress={() => void cycleSpeed()}
                    style={({ pressed }) => [styles.sideBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                    <Text
                        style={[
                            styles.speedText,
                            {
                                color:
                                    speedIdx === SPEED_OPTIONS.indexOf(1)
                                        ? (colors.textSecondary ?? colors.text)
                                        : colors.primary,
                            },
                        ]}
                    >
                        {SPEED_OPTIONS[speedIdx]}×
                    </Text>
                </Pressable>
            </View>

            <View style={{ height: insets.bottom + 16 }} />
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        paddingHorizontal: 24,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    topTitle: {
        fontSize: 16,
        fontFamily: 'Inter_600SemiBold',
        letterSpacing: 0.4,
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
        marginVertical: 24,
    },
    artworkShadow: {
        borderRadius: 20,
        shadowOpacity: 0.5,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 24,
        elevation: 16,
    },
    artworkImage: {
        width: ARTWORK_SIZE,
        height: ARTWORK_SIZE,
        borderRadius: 20,
    },
    artworkPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoSection: {
        alignItems: 'center',
        gap: 6,
        marginBottom: 24,
    },
    trackTitle: {
        fontSize: 22,
        fontFamily: 'Inter_700Bold',
        textAlign: 'center',
    },
    artistName: {
        fontSize: 15,
        fontFamily: 'Inter_400Regular',
        textAlign: 'center',
    },
    progressSection: {
        marginBottom: 8,
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
        marginTop: 4,
    },
    timeText: {
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
    },
    sideBtn: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    controlBtn: {
        width: 52,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playBtn: {
        width: 68,
        height: 68,
        borderRadius: 34,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6,
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
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
    speedText: {
        fontSize: 14,
        fontFamily: 'Inter_700Bold',
    },
});
