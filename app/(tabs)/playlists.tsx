import Feather from "react-native-vector-icons/Feather";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { HeaderIconButton } from "@/components/library/HeaderIconButton";
import { ListEmptyState } from "@/components/library/ListStates";
import { AppHeader } from "@/components/layout/AppHeader";
import { ScreenBackdrop } from "@/components/layout/ScreenBackdrop";
import { PlaylistCard } from "@/components/PlaylistCard";
import { LIST_HPAD } from "@/constants/layout";
import { Playlist, usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useScreenSpacing } from "@/hooks/useScreenSpacing";
import { useTabSwipeNavigation } from "@/hooks/useTabSwipeNavigation";
import { log } from "@/utils/logger";

const L = log("PlaylistsScreen");

export default function PlaylistsScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();
  const { playlists, createPlaylist, videos } = usePlayer();
  const swipeNavigation = useTabSwipeNavigation("playlists");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    L.info("mounted", { playlistCount: playlists.length });
    return () => L.info("unmounted");
  }, []);

  useEffect(() => {
    L.info("playlists updated", { count: playlists.length });
  }, [playlists.length]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.resolve();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    L.info("create playlist", { name: newName.trim() });

    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger("notificationSuccess");
    }

    await createPlaylist(newName.trim());
    setNewName("");
    setShowCreate(false);
  };

  const handlePlaylistPress = (playlist: Playlist) => {
    L.nav("open playlist", { id: playlist.id, name: playlist.name });
    navigation.navigate("playlist", { id: playlist.id });
  };

  const createPlaylistModal = (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[
        styles.modalOverlay,
        Platform.OS === "web" ? styles.webModalOverlay : null,
      ]}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setShowCreate(false)}
      />
      <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.modalTitle, { color: colors.text }]}>
          New Playlist
        </Text>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Playlist name"
          placeholderTextColor={colors.textTertiary}
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: colors.backgroundTertiary,
              borderColor: colors.border,
            },
          ]}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        <View style={styles.modalActions}>
          <Pressable
            onPress={() => {
              setShowCreate(false);
              setNewName("");
            }}
            style={[
              styles.cancelBtn,
              { backgroundColor: colors.backgroundTertiary },
            ]}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={handleCreate}
            style={[
              styles.createBtn,
              {
                backgroundColor: newName.trim()
                  ? colors.primary
                  : colors.backgroundTertiary,
              },
            ]}
          >
            <Text
              style={[
                styles.createText,
                {
                  color: newName.trim() ? "#fff" : colors.textTertiary,
                },
              ]}
            >
              Create
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: colors.background }]}
      {...swipeNavigation.panHandlers}
    >
      <Animated.View style={[styles.container, swipeNavigation.animatedStyle]}>
        <ScreenBackdrop artwork={videos[0]?.thumbnail} />
        <AppHeader
          title="Playlists"
          topPad={topPad}
          right={
            <HeaderIconButton
              icon="plus"
              variant="primary"
              onPress={() => {
                if (Platform.OS !== "web") {
                  ReactNativeHapticFeedback.trigger("impactLight");
                }
                setShowCreate(true);
              }}
              accessibilityLabel="Create playlist"
            />
          }
        />

        {playlists.length === 0 ? (
          <ListEmptyState
            icon="list"
            title="No Playlists Yet"
            subtitle="Group your favourite videos into collections for quick access."
            onRefresh={() => void handleRefresh()}
            refreshing={isRefreshing}
            action={
              <Pressable
                onPress={() => setShowCreate(true)}
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              >
                <Feather name="plus" size={14} color="#fff" />
                <Text style={styles.emptyBtnText}>Create Playlist</Text>
              </Pressable>
            }
          />
        ) : (
          <FlatList
            data={playlists}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => void handleRefresh()}
                tintColor={colors.primary}
              />
            }
            renderItem={({ item }) => (
              <PlaylistCard playlist={item} onPress={handlePlaylistPress} />
            )}
          />
        )}

        {Platform.OS === "web" ? (
          showCreate ? createPlaylistModal : null
        ) : (
          <Modal
            visible={showCreate}
            animationType="fade"
            transparent
            onRequestClose={() => setShowCreate(false)}
          >
            {createPlaylistModal}
          </Modal>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    paddingHorizontal: LIST_HPAD,
    paddingTop: 4,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 10,
    minWidth: 200,
    justifyContent: "center",
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  webModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  modalCard: {
    width: "100%",
    borderRadius: 18,
    padding: 18,
    gap: 12,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  createBtn: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  createText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
});
