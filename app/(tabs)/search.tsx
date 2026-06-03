import FastImage from "react-native-fast-image";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ListEmptyState, ListLoadingState } from "@/components/library/ListStates";
import { AppHeader } from "@/components/layout/AppHeader";
import { ScreenBackdrop } from "@/components/layout/ScreenBackdrop";
import { SearchBar } from "@/components/SearchBar";
import { LIST_HPAD } from "@/constants/layout";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useScreenSpacing } from "@/hooks/useScreenSpacing";
import { useTabSwipeNavigation } from "@/hooks/useTabSwipeNavigation";
import { getVideos, searchStoredVideos } from "@/services/videoService";
import { type VideoItem } from "@/types/player";
import { formatDuration } from "@/utils/formatters";
import { getThumbnailUri } from "@/utils/thumbnailSource";
import { log } from "@/utils/logger";

const L = log("SearchScreen");

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();
  const swipeNavigation = useTabSwipeNavigation("search");
  const [query, setQuery] = useState("");
  const [recentlyAdded, setRecentlyAdded] = useState<VideoItem[]>([]);
  const [results, setResults] = useState<VideoItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadRecent = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setRecentlyAdded(await getVideos(5));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    L.info("mounted");
    void getVideos(5).then((items) => {
      if (!cancelled) setRecentlyAdded(items);
    });
    return () => {
      cancelled = true;
      L.info("unmounted");
    };
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim();
    let cancelled = false;

    if (!normalizedQuery) {
      setResults([]);
      setIsSearching(false);
      return () => {
        cancelled = true;
      };
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      void searchStoredVideos(normalizedQuery, 50)
        .then((hits) => {
          if (cancelled) return;
          setResults(hits);
          L.info("search", { query: normalizedQuery, results: hits.length });
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const recentQueries = useMemo(
    () =>
      recentlyAdded
        .map((video) => video.title.split(/[-_]/)[0]?.trim() || video.title)
        .filter(
          (value, index, items) =>
            value.length > 0 && items.indexOf(value) === index
        ),
    [recentlyAdded]
  );

  const handleOpenVideo = useCallback(
    (video: VideoItem) => {
      L.nav("open player", { id: video.id, title: video.title });
      navigation.navigate("player", { id: video.id });
    },
    [navigation]
  );

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: colors.background }]}
      {...swipeNavigation.panHandlers}
    >
      <Animated.View style={[styles.container, swipeNavigation.animatedStyle]}>
        <ScreenBackdrop artwork={recentlyAdded[0]?.thumbnail} />
        <AppHeader title="Search" topPad={topPad} bottomSpacing={8} />

        <View style={[styles.searchWrap, { backgroundColor: colors.background }]}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search your media..."
          />
        </View>

        {query.trim() ? (
          isSearching && results.length === 0 ? (
            <ListLoadingState count={4} variant="list" />
          ) : results.length === 0 ? (
            <ListEmptyState
              icon="search"
              title="No Results"
              subtitle={`Nothing matches "${query}"`}
            />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
              ListHeaderComponent={
                <Text style={[styles.resultsLabel, { color: colors.textSecondary }]}>
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </Text>
              }
              renderItem={({ item }) => (
                <SearchMediaRow video={item} onPress={handleOpenVideo} />
              )}
            />
          )
        ) : (
          <FlatList
            data={recentlyAdded}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => void loadRecent()}
                tintColor={colors.primary}
              />
            }
            ListHeaderComponent={
              recentlyAdded.length > 0 ? (
                <View style={styles.headerBlock}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                    Recent
                  </Text>
                  <View style={styles.chips}>
                    {recentQueries.map((item) => (
                      <Pressable
                        key={item}
                        onPress={() => setQuery(item)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: colors.textSecondary }]}>
                          {item}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                    Recent Media
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <ListEmptyState
                icon="search"
                title="Search Media"
                subtitle="Find video and audio in your library by title or filename"
              />
            }
            renderItem={({ item }) => (
              <SearchMediaRow video={item} onPress={handleOpenVideo} />
            )}
          />
        )}
      </Animated.View>
    </Animated.View>
  );
}

function SearchMediaRow({
  video,
  onPress,
}: {
  video: VideoItem;
  onPress: (video: VideoItem) => void;
}) {
  const { colors } = useAppTheme();
  const thumbnailUri = getThumbnailUri(video.thumbnail);

  return (
    <Pressable
      onPress={() => onPress(video)}
      style={({ pressed }) => [
        styles.mediaRow,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      <View style={[styles.mediaThumb, { backgroundColor: colors.backgroundTertiary }]}>
        {thumbnailUri ? (
          <FastImage source={{ uri: thumbnailUri }} style={StyleSheet.absoluteFill} />
        ) : (
          <Text style={[styles.mediaInitial, { color: colors.textSecondary }]}>
            {(video.title || "M").charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.mediaText}>
        <Text style={[styles.mediaTitle, { color: colors.text }]} numberOfLines={1}>
          {video.title}
        </Text>
        <Text style={[styles.mediaMeta, { color: colors.textSecondary }]} numberOfLines={1}>
          {(video.folder || "Unknown") + " | " + formatDuration(video.duration)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    paddingHorizontal: LIST_HPAD,
    paddingBottom: 18,
    gap: 12,
  },
  list: {
    paddingHorizontal: LIST_HPAD,
  },
  headerBlock: {
    gap: 14,
    marginBottom: 8,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  resultsLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 1.6,
  },
  mediaRow: {
    minHeight: 74,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mediaThumb: {
    width: 58,
    height: 58,
    borderRadius: 6,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaInitial: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  mediaText: {
    flex: 1,
    minWidth: 0,
  },
  mediaTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  mediaMeta: {
    marginTop: 5,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
