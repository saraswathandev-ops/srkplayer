import React, { useMemo, useState } from "react";
import { Animated, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { ScreenBackdrop } from "@/components/layout/ScreenBackdrop";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { SearchBar } from "@/components/SearchBar";
import { VideoCard } from "@/components/VideoCard";
import { usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useScreenSpacing } from "@/hooks/useScreenSpacing";
import { useTabSwipeNavigation } from "@/hooks/useTabSwipeNavigation";

export default function SearchScreen() {
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();
  const { videos, searchVideos } = usePlayer();
  const swipeNavigation = useTabSwipeNavigation("search");
  const [query, setQuery] = useState("");

  const results = query.trim() ? searchVideos(query) : [];
  const recentQueries = useMemo(
    () =>
      [...videos]
        .slice(0, 5)
        .map((video) => video.title.split(/[-_]/)[0]?.trim() || video.title)
        .filter((value, index, items) => value.length > 0 && items.indexOf(value) === index),
    [videos]
  );
  const recentlyAdded = [...videos]
    .sort((left, right) => right.dateAdded - left.dateAdded)
    .slice(0, 5);
  const folderCount = new Set(videos.map((video) => video.folder || "Unknown")).size;

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: colors.background }]}
      {...swipeNavigation.panHandlers}
    >
      <Animated.View style={[styles.container, swipeNavigation.animatedStyle]}>
        <ScreenBackdrop artwork={videos[0]?.thumbnail} />
        <ScreenHeader title="Search" topPad={topPad} bottomSpacing={8} />

        <View style={[styles.searchWrap, { backgroundColor: colors.background }]}>
        {/* <View
          style={[
            styles.heroCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.heroEyebrow, { color: colors.primary }]}>Find Faster</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Search across titles, folders, and recent picks.
          </Text>
          <Text style={[styles.heroText, { color: colors.textSecondary }]}>
            {videos.length} media items across {folderCount} folders are ready to filter.
          </Text>
        </View> */}
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search your media..."
        />
        </View>

        {query.trim() ? (
          results.length === 0 ? (
            <EmptyState
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
              renderItem={({ item }) => <VideoCard video={item} compact />}
            />
          )
        ) : (
          <FlatList
            data={recentlyAdded}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
            ListHeaderComponent={
              videos.length > 0 ? (
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
              <EmptyState
                icon="search"
                title="Search Media"
                subtitle="Find video and audio in your library by title or filename"
              />
            }
            renderItem={({ item }) => <VideoCard video={item} compact />}
          />
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    gap: 12,
  },
  heroCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    gap: 8,
  },
  heroEyebrow: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1.3,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "Inter_700Bold",
  },
  heroText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  list: {
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  resultsLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 1.6,
  },
});
