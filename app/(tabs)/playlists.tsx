import Feather from 'react-native-vector-icons/Feather';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { ScreenBackdrop } from "@/components/layout/ScreenBackdrop";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { PlaylistCard } from "@/components/PlaylistCard";
import { Playlist, usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useScreenSpacing } from "@/hooks/useScreenSpacing";
import { useTabSwipeNavigation } from "@/hooks/useTabSwipeNavigation";

export default function PlaylistsScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { topPad, bottomPad } = useScreenSpacing();
  const { playlists, createPlaylist, videos } = usePlayer();
  const swipeNavigation = useTabSwipeNavigation("playlists");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;

    if (Platform.OS !== "web") {
      ReactNativeHapticFeedback.trigger('notificationSuccess');
    }

    await createPlaylist(newName.trim());
    setNewName("");
    setShowCreate(false);
  };

  const handlePlaylistPress = (playlist: Playlist) => {
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
        <ScreenHeader
          title="Playlists"
          topPad={topPad}
          right={
            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") {
                  ReactNativeHapticFeedback.trigger('impactLight');
                }
                setShowCreate(true);
              }}
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={28} color="#fff" />
            </Pressable>
          }
        />

        {/* <View
        style={[
          styles.heroCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.heroEyebrow, { color: colors.primary }]}>Collections</Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          Organize media into clean playback groups.
        </Text>
        <Text style={[styles.heroText, { color: colors.textSecondary }]}>
          {playlists.length} playlists built from {videos.length} library items.
        </Text>
      </View> */}

        {playlists.length === 0 ? (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIconWrap,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="list" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Playlists Yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Group your favourite videos into collections for quick access.
            </Text>
            <Pressable
              onPress={() => setShowCreate(true)}
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={20} color="#fff" />
              <Text style={styles.emptyBtnText}>Create Playlist</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={playlists}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
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
  addBtn: {
    width: 54,
    height: 54,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 16,
  },
  heroCard: {
    marginHorizontal: 16,
    marginBottom: 18,
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    gap: 8,
  },
  heroEyebrow: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1.3,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: "Inter_700Bold",
  },
  heroText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 20,
    borderRadius: 999,
    marginTop: 12,
    minWidth: 280,
    justifyContent: "center",
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emptyIconWrap: {
    width: 168,
    height: 168,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 28,
  },
  emptyTitle: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 18,
    lineHeight: 28,
    textAlign: "center",
    maxWidth: 300,
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  webModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  modalCard: {
    width: "100%",
    borderRadius: 28,
    padding: 24,
    gap: 16,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  createBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  createText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
