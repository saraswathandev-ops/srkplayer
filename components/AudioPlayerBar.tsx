import Feather from 'react-native-vector-icons/Feather';
import FastImage from 'react-native-fast-image';
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useActiveTrack } from 'react-native-track-player';

import { useTrackPlayer } from '@/context/TrackPlayerContext';
import { useAppTheme } from '@/hooks/useAppTheme';

interface AudioPlayerBarProps {
    bottomInset?: number;
}

export function AudioPlayerBar({ bottomInset = 0 }: AudioPlayerBarProps) {
    const { colors } = useAppTheme();
    const navigation = useNavigation<any>();
    const { isPlaying, playPause, skipToNext } = useTrackPlayer();
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
                duration: 220,
                useNativeDriver: true,
            }).start();
        }
    }, [isVisible, slideAnim]);

    if (!activeTrack) return null;

    const artwork = typeof activeTrack.artwork === 'string' ? activeTrack.artwork : null;
    const title = activeTrack.title ?? 'Unknown';
    const artist = activeTrack.artist ?? 'Unknown Artist';

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    backgroundColor: colors.backgroundSecondary ?? colors.card,
                    borderTopColor: colors.border,
                    bottom: bottomInset,
                    transform: [{ translateY: slideAnim }],
                },
            ]}
        >
            {/* Tap anywhere on the bar to open full-screen player */}
            <TouchableOpacity
                style={styles.infoRow}
                activeOpacity={0.8}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onPress={() => navigation.navigate('audio-player')}
            >
                {/* Artwork */}
                <View
                    style={[
                        styles.artworkWrap,
                        { backgroundColor: colors.card ?? '#222' },
                    ]}
                >
                    {artwork ? (
                        <FastImage source={{ uri: artwork }} style={styles.artwork} resizeMode={FastImage.resizeMode.cover} />
                    ) : (
                        <Feather name="music" size={22} color={colors.primary} />
                    )}
                </View>

                {/* Title + artist */}
                <View style={styles.textWrap}>
                    <Text
                        style={[styles.title, { color: colors.text }]}
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                    <Text
                        style={[styles.artist, { color: colors.textSecondary ?? colors.text }]}
                        numberOfLines={1}
                    >
                        {artist}
                    </Text>
                </View>
            </TouchableOpacity>

            {/* Controls */}
            <View style={styles.controls}>
                <Pressable
                    onPress={() => void playPause()}
                    style={({ pressed }) => [
                        styles.controlBtn,
                        { backgroundColor: pressed ? `${colors.primary}22` : 'transparent' },
                    ]}
                    hitSlop={8}
                >
                    <Feather
                        name={isPlaying ? 'pause' : 'play'}
                        size={22}
                        color={colors.text}
                    />
                </Pressable>

                <Pressable
                    onPress={() => void skipToNext()}
                    style={({ pressed }) => [
                        styles.controlBtn,
                        { backgroundColor: pressed ? `${colors.primary}22` : 'transparent' },
                    ]}
                    hitSlop={8}
                >
                    <Feather name="skip-forward" size={22} color={colors.text} />
                </Pressable>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 64,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        zIndex: 100,
        elevation: 10,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: -2 },
        shadowRadius: 8,
    },
    infoRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    artworkWrap: {
        width: 44,
        height: 44,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    artwork: {
        width: 44,
        height: 44,
    },
    textWrap: {
        flex: 1,
        gap: 2,
    },
    title: {
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
    },
    artist: {
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    controlBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
