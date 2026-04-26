import Feather from 'react-native-vector-icons/Feather';
import FastImage from 'react-native-fast-image';
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
    Animated,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useActiveTrack } from 'react-native-track-player';

import { usePlayer } from '@/context/PlayerContext';
import { useTrackPlayer } from '@/context/TrackPlayerContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { getThumbnailUri } from '@/utils/thumbnailSource';

interface AudioPlayerBarProps {
    bottomInset?: number;
}

export function AudioPlayerBar({ bottomInset = 0 }: AudioPlayerBarProps) {
    const { colors } = useAppTheme();
    const navigation = useNavigation<any>();
    const { settings } = usePlayer();
    const { isPlaying, playPause, skipToNext, skipToPrev, stopPlayer } = useTrackPlayer();
    const activeTrack = useActiveTrack();

    const slideAnim = useRef(new Animated.Value(80)).current;
    const wasVisible = useRef(false);
    const hideDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    // Keep last non-null track so bar content stays valid during slide-out / debounce window
    const lastTrackRef = useRef<ReturnType<typeof useActiveTrack>>(undefined);
    if (activeTrack) lastTrackRef.current = activeTrack;

    const isVideoTrack = (activeTrack as any)?.mediaType === 'video';
    const isVisible = !!activeTrack && (!isVideoTrack || settings.backgroundPlay);

    useEffect(() => {
        if (isVisible) {
            // Cancel any pending hide
            if (hideDebounceTimer.current) {
                clearTimeout(hideDebounceTimer.current);
                hideDebounceTimer.current = null;
            }
            if (!wasVisible.current) {
                wasVisible.current = true;
                setIsMounted(true);
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 80,
                    friction: 12,
                }).start();
            }
        } else if (wasVisible.current) {
            // Debounce hide by 450ms to absorb track-switch gaps (TrackPlayer.reset briefly sets activeTrack=undefined)
            hideDebounceTimer.current = setTimeout(() => {
                wasVisible.current = false;
                Animated.timing(slideAnim, {
                    toValue: 80,
                    duration: 250,
                    useNativeDriver: true,
                }).start(({ finished }) => {
                    if (finished) setIsMounted(false);
                });
            }, 450);
        }

        return () => {
            if (hideDebounceTimer.current) {
                clearTimeout(hideDebounceTimer.current);
                hideDebounceTimer.current = null;
            }
        };
    }, [isVisible, slideAnim]);

    // Use last-known track during debounce/animation window so content never flashes to empty
    const displayTrack = activeTrack ?? lastTrackRef.current;
    const displayIsVideoTrack = (displayTrack as any)?.mediaType === 'video';

    const artwork = useMemo(() => getThumbnailUri(displayTrack?.artwork), [displayTrack?.artwork]);
    const title = displayTrack?.title ?? 'Unknown';
    const artist = displayIsVideoTrack
        ? 'Video in background'
        : (displayTrack?.artist ?? displayTrack?.album ?? 'Media Library');

    if (!isMounted) return null;

    const handlePress = () => {
        try {
            if (!displayTrack) return;
            if (displayIsVideoTrack && displayTrack.id) {
                navigation.navigate('player', { id: displayTrack.id });
            } else {
                navigation.navigate('audio-player');
            }
        } catch (e) {
            console.error("Mini-player navigation failed:", e);
        }
    };

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: colors.card,
                    borderTopColor: colors.border,
                    bottom: bottomInset,
                    transform: [{ translateY: slideAnim }],
                },
            ]}
        >
            {/* Background Artwork Overlay (Subtle) */}
            {artwork && (
                <View style={styles.bgOverlay}>
                    <FastImage
                        source={{ uri: artwork }}
                        style={styles.bgImage}
                        resizeMode={FastImage.resizeMode.cover}
                    />
                    <View style={[styles.bgTint, { backgroundColor: `${colors.background}CC` }]} />
                </View>
            )}

            <TouchableOpacity
                style={styles.infoRow}
                activeOpacity={0.8}
                onPress={handlePress}
            >
                <View style={[styles.artworkWrap, { backgroundColor: `${colors.primary}20` }]}>
                    {artwork ? (
                        <FastImage 
                            source={{ uri: artwork }} 
                            style={styles.artwork} 
                            resizeMode={FastImage.resizeMode.cover} 
                        />
                    ) : (
                        <Feather
                            name={displayIsVideoTrack ? 'film' : 'music'}
                            size={18}
                            color={colors.primary}
                        />
                    )}
                </View>
                <View style={styles.textWrap}>
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                        {title}
                    </Text>
                    <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>
                        {artist}
                    </Text>
                </View>
            </TouchableOpacity>

            <View style={styles.controls}>
                <Pressable
                    onPress={() => void skipToPrev()}
                    style={({ pressed }) => [
                        styles.controlBtn,
                        { opacity: pressed ? 0.6 : 1 },
                    ]}
                    hitSlop={8}
                >
                    <Feather name="skip-back" size={20} color={colors.text} />
                </Pressable>

                <Pressable
                    onPress={() => void playPause()}
                    style={({ pressed }) => [
                        styles.playBtn,
                        { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
                    ]}
                    hitSlop={4}
                >
                    <Feather name={isPlaying ? 'pause' : 'play'} size={16} color="#fff" />
                </Pressable>

                <Pressable
                    onPress={() => void skipToNext()}
                    style={({ pressed }) => [
                        styles.controlBtn,
                        { opacity: pressed ? 0.6 : 1 },
                    ]}
                    hitSlop={8}
                >
                    <Feather name="skip-forward" size={20} color={colors.text} />
                </Pressable>

                <Pressable
                    onPress={() => void stopPlayer()}
                    style={({ pressed }) => [
                        styles.closeBtn,
                        { opacity: pressed ? 0.6 : 1 },
                    ]}
                    hitSlop={8}
                >
                    <Feather name="x" size={16} color={colors.textSecondary} />
                </Pressable>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 12,
        right: 12,
        height: 64,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        borderWidth: 1,
        zIndex: 1000,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        overflow: 'hidden',
    },
    bgOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: -1,
    },
    bgImage: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.4,
    },
    bgTint: {
        ...StyleSheet.absoluteFillObject,
    },
    infoRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
    },
    artworkWrap: {
        width: 44,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
    },
    artwork: {
        width: 44,
        height: 44,
    },
    textWrap: {
        flex: 1,
        gap: 2,
        minWidth: 0,
    },
    title: {
        fontSize: 14,
        fontFamily: 'Inter_700Bold',
    },
    artist: {
        fontSize: 11,
        fontFamily: 'Inter_500Medium',
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
    },
    controlBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        marginLeft: 2,
    },
    playBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
    },
});
