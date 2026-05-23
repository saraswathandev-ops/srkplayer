import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { enableFreeze } from 'react-native-screens';

import TabNavigator from '@/src/navigation/TabNavigator';

// Globally disable react-native-screens' "freeze inactive screens"
// optimization. The optimization pauses React effects on blurred screens,
// which produced the rapid unmount/remount cycle visible during
// mid-playback transitions ("[VideoPlayer] unmounted ... mounted"). The
// freezeOnBlur:false screen options below cover the navigator-level case;
// this call is the global belt-and-braces guard. Safe — pre-screens
// optimization defaults.
enableFreeze(false);

import PlayerScreen from '@/app/player';
import AudioPlayerScreen from '@/app/audio-player';
import NetworkStreamScreen from '@/app/network-stream';
import RecycleBinScreen from '@/app/recycle-bin';
import FolderScreen from '@/app/folder/[id]';
import PlaylistScreen from '@/app/playlist/[id]';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
    return (
        <Stack.Navigator
            id="Root"
            // freezeOnBlur:false keeps the player's React effects alive when
            // another screen briefly takes focus. react-native-screens
            // otherwise paused the player mid-playback on some Android
            // devices, producing rapid unmount/remount cycles (visible in
            // logs as "[VideoPlayer] unmounted ... mounted" with the same
            // routeVideoId).
            screenOptions={{
                headerShown: false,
                freezeOnBlur: false,
            }}
        >
            <Stack.Screen name="TabsRoot" component={TabNavigator} />

            <Stack.Group screenOptions={{ presentation: 'fullScreenModal' }}>
                <Stack.Screen
                    name="player"
                    component={PlayerScreen}
                    options={{
                        // Redundant with screenOptions.freezeOnBlur above, but
                        // explicit here as a safety belt for the long-lived
                        // playback screen.
                        freezeOnBlur: false,
                    }}
                />
                <Stack.Screen name="audio-player" component={AudioPlayerScreen} />
            </Stack.Group>

            <Stack.Screen name="folder" component={FolderScreen} />
            <Stack.Screen name="playlist" component={PlaylistScreen} />
            <Stack.Screen name="network-stream" component={NetworkStreamScreen} />
            <Stack.Screen name="recycle-bin" component={RecycleBinScreen} />
        </Stack.Navigator>
    );
}
