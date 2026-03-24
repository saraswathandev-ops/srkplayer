import LinearGradient from 'react-native-linear-gradient';
import { Image } from 'react-native';
import React from "react";
import { StyleSheet, View } from "react-native";

import { usePlayer } from "@/context/PlayerContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { type VideoThumbnailSource } from "@/types/player";

type Props = {
  artwork?: VideoThumbnailSource;
};

export function ScreenBackdrop({ artwork }: Props) {
  const { colors, isDark } = useAppTheme();
  const { settings } = usePlayer();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {settings.backgroundArtwork && artwork ? (
        <Image
          source={typeof artwork === 'string' ? { uri: artwork } : artwork as any}
          style={styles.image}
          resizeMode="cover"
          blurRadius={isDark ? 28 : 20}
        />
      ) : null}
      <LinearGradient
        colors={[
          `${colors.background}CC`,
          `${colors.background}F0`,
          colors.background,
        ]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`${colors.primary}30`, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryGlow}
      />
      <LinearGradient
        colors={[`${colors.accent}22`, "transparent"]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.accentGlow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.34,
  },
  primaryGlow: {
    position: "absolute",
    top: -90,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  accentGlow: {
    position: "absolute",
    top: 120,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
});
