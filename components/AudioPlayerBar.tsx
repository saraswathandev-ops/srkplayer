import Feather from 'react-native-vector-icons/Feather';
import FastImage from 'react-native-fast-image';
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useRef, useMemo } from 'react';
import {
    Animated,
    Image,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useActiveTrack } from 'react-native-track-player';

import { useTrackPlayer } from '@/context/TrackPlayerContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { getThumbnailUri } from '@/utils/thumbnailSource';

interface AudioPlayerBarProps {
    bottomInset?: number;
}

export function AudioPlayerBar({ bottomInset = 0 }: AudioPlayerBarProps) {
    const { colors } = useAppTheme();
    const navigation = useNavigation<any>();
    const { isPlaying, playPause, skipToNext, skipToPrev, stopPlayer } = useTrackPlayer();
    const activeTrack = useActiveTrack();

    const slideAnim = useRef(new Animated.Value(80)).current;
    const wasVisible = useRef(false);

    const isVisible = !!activeTrack;

    useEffect(() => {
        if (isVisible && !wasVisible.current) {
            wasVisible.current = true;
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 12,
            }).start();
        } else if (!isVisible && wasVisible.current) {
            wasVisible.current = false;
            Animated.timing(slideAnim, {
                toValue: 80,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [isVisible, slideAnim]);

    const artwork = useMemo(() => getThumbnailUri(activeTrack?.artwork), [activeTrack?.artwork]);
    const title = activeTrack?.title ?? 'Unknown';
    const artist = activeTrack?.artist ?? activeTrack?.album ?? 'Media Library';

    if (!activeTrack) return null;

    const handleClose = () => {
        void stopPlayer();
    };

    const handlePress = () => {
        try {
            if (!activeTrack) return;
            
            // Check if the current track is a video handoff
            if ((activeTrack as any).mediaType === 'video' && activeTrack.id) {
                navigation.navigate('player', { id: activeTrack.id });
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
                    <Image 
                        source={{ uri: artwork }} 
                        style={styles.bgImage} 
                        resizeMode="cover"
                        blurRadius={10}
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
                            name={(activeTrack as any).mediaType === 'video' ? 'film' : 'music'} 
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
                    onPress={handleClose}
                    style={({ pressed }) => [
                        styles.controlBtn,
                        { opacity: pressed ? 0.6 : 1 },
                    ]}
                    hitSlop={8}
                >
                    <Feather name="x" size={20} color={colors.textSecondary} />
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
