import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useIsFocused } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { SearchBar } from "@/components/SearchBar";
import { VideoCard } from "@/components/VideoCard";
import { VideoItem, usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";

export default function RecycleBinScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { getDeletedVideos, restoreVideo, emptyRecycleBin, reloadVideos } = usePlayer();
  const [deletedVideos, setDeletedVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const loadDeletedVideos = useCallback(async () => {
    try {
      const videos = await getDeletedVideos();
      setDeletedVideos(videos);
    } finally {
      setLoading(false);
    }
  }, [getDeletedVideos]);

  useEffect(() => {
    if (isFocused) {
      void loadDeletedVideos();
    }
  }, [isFocused, loadDeletedVideos]);

  const filteredVideos = useMemo(() => {
    if (!query.trim()) return deletedVideos;
    const normalizedQuery = query.trim().toLowerCase();
    return deletedVideos.filter((item) =>
      item.title.toLowerCase().includes(normalizedQuery)
    );
  }, [deletedVideos, query]);

  const handleRestore = useCallback(
    (video: VideoItem) => {
      if (Platform.OS !== "web") {
        ReactNativeHapticFeedback.trigger('impactMedium');
      }
      Alert.alert("Restore Item", `Do you want to restore "${video.title}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "default",
          onPress: async () => {
            await restoreVideo(video.id);
            await reloadVideos();
            await loadDeletedVideos();
          },
        },
      ]);
    },
    [loadDeletedVideos, restoreVideo, reloadVideos]
  );

  const handleEmptyBin = useCallback(() => {
    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger('notificationWarning');
    }
    Alert.alert(
      "Empty Recycle Bin",
      "Are you sure you want to permanently delete ALL items in the recycle bin? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Empty Bin",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            await emptyRecycleBin();
            await loadDeletedVideos();
          },
        },
      ]
    );
  }, [emptyRecycleBin, loadDeletedVideos]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      <View style={{ flexDirection: "row", alignItems: "center", paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.headerBtn,
            {
              backgroundColor: pressed ? colors.backgroundTertiary : "transparent",
              marginRight: 8,
            },
          ]}
        >
          <Feather name="arrow-left" size={24} color={colors.text} />
        </Pressable>
      </View>
      <ScreenHeader
        title="Recycle Bin"
        topPad={0}
        right={
          deletedVideos.length > 0 ? (
            <Pressable
              onPress={handleEmptyBin}
              style={({ pressed }) => [
                styles.headerBtnSecondary,
                {
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather name="trash" size={20} color={colors.error} />
            </Pressable>
          ) : undefined
        }
      />

      <View style={styles.content}>
        <View style={styles.searchWrap}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search deleted items..."
          />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filteredVideos}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 20 },
            ]}
            ListEmptyComponent={
              <EmptyState
                icon="trash-2"
                title="Recycle Bin is Empty"
                subtitle="Items you temporarily delete will appear here."
              />
            }
            renderItem={({ item }) => (
              <View style={styles.cardWrap}>
                <VideoCard
                  video={item}
                  compact
                  onPress={() => {
                    handleRestore(item);
                  }}
                  onLongPress={() => {
                    handleRestore(item);
                  }}
                  trailing={
                    <View style={styles.restoreIcon}>
                      <Ionicons name="refresh-circle-outline" size={24} color={colors.primary} />
                    </View>
                  }
                />
              </View>
            )}
            maxToRenderPerBatch={8}
            windowSize={11}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  cardWrap: {
    opacity: 0.85,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnSecondary: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreIcon: {
    padding: 8,
  },
});
