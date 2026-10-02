import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/hooks/useAppTheme';
import { getLyrics, type LyricLine } from '@/services/lyricsService';

type Props = {
    track: { id: string; title: string; artist?: string | null; duration?: number | null };
    position: number;
    onSeek: (seconds: number) => void;
    onClose: () => void;
};

export function AudioLyricsView({ track, position, onSeek, onClose }: Props) {
    const { colors } = useAppTheme();
    const [lines, setLines] = useState<LyricLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [source, setSource] = useState<string>('');
    const [error, setError] = useState(false);
    const scrollRef = useRef<ScrollView>(null);
    const rowOffsets = useRef<Record<number, number>>({});

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(false);
        setLines([]);
        void getLyrics(track).then((result) => {
            if (cancelled) return;
            if (!result) setError(true);
            else {
                setLines(result.lines);
                setSource(result.source);
            }
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [track.id]);

    const activeIndex = useMemo(() => {
        let index = -1;
        for (let i = 0; i < lines.length; i += 1) {
            if (position >= lines[i].time) index = i;
            else break;
        }
        return index;
    }, [lines, position]);

    useEffect(() => {
        if (activeIndex < 0) return;
        const y = rowOffsets.current[activeIndex];
        if (y == null) return;
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 150), animated: true });
    }, [activeIndex]);

    return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <View style={styles.headerText}>
                    <Text style={[styles.heading, { color: colors.text }]}>Lyrics</Text>
                    <Text style={[styles.subheading, { color: colors.textSecondary }]} numberOfLines={1}>
                        {track.title}{track.artist ? ` • ${track.artist}` : ''}
                    </Text>
                </View>
                <Pressable onPress={onClose} style={styles.close}>
                    <Feather name="x" size={22} color={colors.text} />
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={[styles.status, { color: colors.textSecondary }]}>Finding synchronized lyrics…</Text>
                </View>
            ) : error || lines.length === 0 ? (
                <View style={styles.center}>
                    <Feather name="music" size={42} color={colors.textSecondary} />
                    <Text style={[styles.status, { color: colors.text }]}>Lyrics not found</Text>
                    <Pressable
                        onPress={() => {
                            setLoading(true);
                            setError(false);
                            void getLyrics(track, true).then((result) => {
                                setLines(result?.lines ?? []);
                                setSource(result?.source ?? '');
                                setError(!result);
                                setLoading(false);
                            });
                        }}
                        style={[styles.retry, { backgroundColor: colors.primary }]}
                    >
                        <Feather name="refresh-cw" size={15} color="#fff" />
                        <Text style={styles.retryText}>Search again</Text>
                    </Pressable>
                </View>
            ) : (
                <ScrollView ref={scrollRef} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                    <View style={styles.sourcePill}>
                        <Text style={[styles.sourceText, { color: colors.textSecondary }]}>
                            {source === 'local' ? 'Offline lyrics' : 'LRCLIB synchronized lyrics'}
                        </Text>
                    </View>
                    {lines.map((line, index) => (
                        <Pressable
                            key={`${line.time}-${index}`}
                            onPress={() => onSeek(line.time)}
                            onLayout={(event) => { rowOffsets.current[index] = event.nativeEvent.layout.y; }}
                            style={styles.line}
                        >
                            <Text style={[
                                styles.lineText,
                                { color: index === activeIndex ? colors.text : colors.textSecondary },
                                index === activeIndex && { color: colors.primary, fontSize: 21, fontFamily: 'Inter_700Bold' },
                            ]}>
                                {line.text}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: { minHeight: 72, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
    headerText: { flex: 1, minWidth: 0 },
    heading: { fontSize: 22, fontFamily: 'Inter_700Bold' },
    subheading: { marginTop: 4, fontSize: 12, fontFamily: 'Inter_500Medium' },
    close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
    status: { fontSize: 14, textAlign: 'center', fontFamily: 'Inter_500Medium' },
    retry: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 8 },
    retryText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
    list: { paddingHorizontal: 20, paddingVertical: 36, paddingBottom: 80 },
    sourcePill: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginBottom: 18, backgroundColor: 'rgba(127,127,127,0.12)' },
    sourceText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
    line: { minHeight: 58, justifyContent: 'center', paddingVertical: 9 },
    lineText: { fontSize: 17, lineHeight: 25, textAlign: 'center', fontFamily: 'Inter_600SemiBold' },
});
