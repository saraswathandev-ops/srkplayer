import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import TabNavigator from './TabNavigator';

// Import screens from app folder currently
import PlayerScreen from '../../app/player';
import AudioPlayerScreen from '../../app/audio-player';
import NetworkStreamScreen from '../../app/network-stream';
import RecycleBinScreen from '../../app/recycle-bin';
import FolderScreen from '../../app/folder/[id]';
import PlaylistScreen from '../../app/playlist/[id]';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
    return (
        <Stack.Navigator
            id="Root"
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="TabsRoot" component={TabNavigator} />

            <Stack.Group screenOptions={{ presentation: 'fullScreenModal' }}>
                <Stack.Screen name="player" component={PlayerScreen} />
                <Stack.Screen name="audio-player" component={AudioPlayerScreen} />
            </Stack.Group>

            <Stack.Screen name="folder" component={FolderScreen} />
            <Stack.Screen name="playlist" component={PlaylistScreen} />
            <Stack.Screen name="network-stream" component={NetworkStreamScreen} />
            <Stack.Screen name="recycle-bin" component={RecycleBinScreen} />
        </Stack.Navigator>
    );
}
