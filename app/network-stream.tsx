import Feather from 'react-native-vector-icons/Feather';
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, ScrollView } from "react-native";

import { ScreenBackdrop } from "@/components/layout/ScreenBackdrop";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useScreenSpacing } from "@/hooks/useScreenSpacing";

export default function NetworkStreamScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();
  const { topPad } = useScreenSpacing();
  const { addVideo, setCurrentVideo } = usePlayer();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handlePlay = async () => {
    if (!url.trim()) {
      setErrorMsg("Please enter a valid video URL.");
      return;
    }
    setErrorMsg("");
    setIsLoading(true);

    try {
      const storedVideo = await addVideo({
        title: "Network Stream",
        uri: url.trim(),
        duration: 0,
        size: 0,
        dateAdded: Date.now(),
        mediaType: "video",
        folder: "Network Streams",
      });

      setCurrentVideo(storedVideo);
      navigation.replace("player", { id: storedVideo.id });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to launch stream.");
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenBackdrop />
      <ScreenHeader title="Network Stream" topPad={topPad} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.iconWrap}>
          <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}20` }]}>
            <Feather name="globe" size={32} color={colors.primary} />
          </View>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Play from URL</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Enter an HTTP, HTTPS, or M3U8 link to stream media directly over the network without downloading.
        </Text>

        <View style={styles.inputWrap}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: errorMsg ? "#FF4B4B" : colors.border,
                color: colors.text,
              },
            ]}
            placeholder="https://example.com/video.mp4"
            placeholderTextColor={colors.textTertiary}
            value={url}
            onChangeText={(txt) => {
              setUrl(txt);
              setErrorMsg("");
            }}
            autoCapitalize="none"
            autoCorrect={false}
            selectTextOnFocus
          />
        </View>

        {errorMsg ? (
          <Text style={[styles.errorText, { color: "#FF4B4B" }]}>{errorMsg}</Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.playBtn,
            { backgroundColor: colors.primary, opacity: pressed || isLoading ? 0.8 : 1 },
          ]}
          onPress={handlePlay}
          disabled={isLoading}
        >
          <Feather name="play" size={20} color="#fff" />
          <Text style={styles.playBtnText}>{isLoading ? "Loading..." : "Play Stream"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: "center",
  },
  iconWrap: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  inputWrap: {
    width: "100%",
    marginBottom: 16,
  },
  input: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  errorText: {
    alignSelf: "flex-start",
    fontSize: 13,
    marginBottom: 16,
    fontFamily: "Inter_500Medium",
  },
  playBtn: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 8,
  },
  playBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
