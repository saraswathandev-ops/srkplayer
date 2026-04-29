import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PlayerProvider } from "@/context/PlayerContext";
import { TrackPlayerProvider } from "@/context/TrackPlayerContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PlayerProvider>
          <TrackPlayerProvider>
            <ErrorBoundary>{children}</ErrorBoundary>
          </TrackPlayerProvider>
        </PlayerProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
