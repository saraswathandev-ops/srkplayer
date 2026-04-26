import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import { useActiveTrack } from 'react-native-track-player';

import { useAppTheme } from '../../hooks/useAppTheme';
import { usePlayer } from '../../context/PlayerContext';
import { useTrackPlayer } from '../../context/TrackPlayerContext';

// Import screens from app folder for now until we move them completely
import HomeScreen from '../../app/(tabs)/index';
import LibraryScreen from '../../app/(tabs)/library';
import AudioScreen from '../../app/(tabs)/audio';
import PlaylistsScreen from '../../app/(tabs)/playlists';
import YoutubeScreen from '../../app/(tabs)/youtube';
import SearchScreen from '../../app/(tabs)/search';
import SettingsScreen from '../../app/(tabs)/settings';

import { AudioPlayerBar } from '../../components/AudioPlayerBar';

const Tab = createBottomTabNavigator();
const TAB_BAR_HEIGHT_BASE = 72;

export default function TabNavigator() {
    const safeAreaInsets = useSafeAreaInsets();
    const { colors, isDark } = useAppTheme();
    const { settings } = usePlayer();
    const { stopPlayer } = useTrackPlayer();
    const activeTrack = useActiveTrack();
    const isIOS = Platform.OS === 'ios';

    const tabBarHeight = TAB_BAR_HEIGHT_BASE + safeAreaInsets.bottom;
    const showLabels = settings.tabBarLabels !== 'never';

    const handleTabChangeClear = () => {
        if (!activeTrack) return;
        void stopPlayer();
    };

    return (
        <View style={{ flex: 1 }}>
            <Tab.Navigator
                id="RootTabs"
                screenListeners={{
                    tabPress: handleTabChangeClear,
                }}
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarActiveTintColor: colors.primary,
                    tabBarInactiveTintColor: colors.tabIconDefault,
                    tabBarShowLabel: showLabels,
                    tabBarLabelStyle: {
                        fontSize: 10,
                        fontFamily: 'Inter_700Bold',
                        marginBottom: 4,
                    },
                    tabBarStyle: {
                        position: 'absolute',
                        backgroundColor: isIOS ? 'transparent' : colors.background,
                        borderTopWidth: 0,
                        borderTopColor: colors.border,
                        elevation: 0,
                        height: tabBarHeight,
                        paddingBottom: safeAreaInsets.bottom,
                        paddingTop: 12,
                    },
                    tabBarItemStyle: {
                        marginHorizontal: 8,
                        borderRadius: 20,
                        paddingVertical: 4,
                    },
                    tabBarActiveBackgroundColor: `${colors.primary}18`,
                    tabBarLabel: ({ focused, color }) => {
                        if (settings.tabBarLabels === 'never') return null;
                        if (settings.tabBarLabels === 'active' && !focused) return null;
                        return (
                            <Text style={{ 
                                color, 
                                fontSize: 10, 
                                fontFamily: 'Inter_700Bold',
                                marginBottom: 4 
                            }}>
                                {route.name}
                            </Text>
                        );
                    }
                })}
            >
                <Tab.Screen
                    name="Home"
                    component={HomeScreen}
                    options={{
                        tabBarIcon: ({ color, size }) => <Feather name="home" size={20} color={color} />,
                    }}
                />
                <Tab.Screen
                    name="Library"
                    component={LibraryScreen}
                    options={{
                        tabBarIcon: ({ color, size }) => <Feather name="film" size={20} color={color} />,
                    }}
                />
                <Tab.Screen
                    name="Audio"
                    component={AudioScreen}
                    options={{
                        tabBarIcon: ({ color, size }) => <Feather name="music" size={20} color={color} />,
                    }}
                />
                <Tab.Screen
                    name="Playlists"
                    component={PlaylistsScreen}
                    options={{
                        tabBarIcon: ({ color, size }) => <Feather name="list" size={20} color={color} />,
                    }}
                />
                <Tab.Screen
                    name="YouTube"
                    component={YoutubeScreen}
                    options={{
                        tabBarButton: () => null, // Hidden tab
                    }}
                />
                <Tab.Screen
                    name="Search"
                    component={SearchScreen}
                    options={{
                        tabBarIcon: ({ color, size }) => <Feather name="search" size={20} color={color} />,
                    }}
                />
                <Tab.Screen
                    name="Settings"
                    component={SettingsScreen}
                    options={{
                        tabBarIcon: ({ color, size }) => <Feather name="settings" size={20} color={color} />,
                    }}
                />
            </Tab.Navigator>

            <AudioPlayerBar bottomInset={tabBarHeight} />
        </View>
    );
}
