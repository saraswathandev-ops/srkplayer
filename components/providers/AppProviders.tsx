import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
// react-native-keyboard-controller removed — not available in bare RN without native install
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PlayerProvider } from "@/context/PlayerContext";
import { TrackPlayerProvider } from "@/context/TrackPlayerContext";

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <PlayerProvider>
            <TrackPlayerProvider>
              <ErrorBoundary>{children}</ErrorBoundary>
            </TrackPlayerProvider>
          </PlayerProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
