import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';

import { useAppTheme } from '../../hooks/useAppTheme';

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
const TAB_BAR_HEIGHT_BASE = 88;

export default function TabNavigator() {
    const safeAreaInsets = useSafeAreaInsets();
    const { colors, isDark } = useAppTheme();
    const isIOS = Platform.OS === 'ios';

    const tabBarHeight = TAB_BAR_HEIGHT_BASE + safeAreaInsets.bottom;

    return (
        <View style={{ flex: 1 }}>
            <Tab.Navigator
                screenOptions={{
                    headerShown: false,
                    tabBarActiveTintColor: colors.primary,
                    tabBarInactiveTintColor: colors.tabIconDefault,
                    tabBarLabelStyle: {
                        fontSize: 12,
                        fontWeight: '600',
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
                        paddingTop: 10,
                    },
                    tabBarItemStyle: {
                        marginHorizontal: 4,
                        borderRadius: 22,
                    },
                    tabBarActiveBackgroundColor: `${colors.primary}22`,
                }}
            >
                <Tab.Screen
                    name="Home"
                    component={HomeScreen}
                    options={{
                        tabBarIcon: ({ color, size }) => <Feather name="home" size={size || 20} color={color} />,
                    }}
                />
                <Tab.Screen
                    name="Library"
                    component={LibraryScreen}
                    options={{
                        tabBarIcon: ({ color, size }) => <Feather name="film" size={size || 20} color={color} />,
                    }}
                />
                <Tab.Screen
                    name="Audio"
                    component={AudioScreen}
                    options={{
                        tabBarIcon: ({ color, size }) => <Feather name="music" size={size || 20} color={color} />,
                    }}
                />
                <Tab.Screen
                    name="Playlists"
                    component={PlaylistsScreen}
                    options={{
                        tabBarIcon: ({ color, size }) => <Feather name="list" size={size || 20} color={color} />,
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
                        tabBarIcon: ({ color, size }) => <Feather name="search" size={size || 20} color={color} />,
                    }}
                />
                <Tab.Screen
                    name="Settings"
                    component={SettingsScreen}
                    options={{
                        tabBarIcon: ({ color, size }) => <Feather name="settings" size={size || 20} color={color} />,
                    }}
                />
            </Tab.Navigator>

            <AudioPlayerBar bottomInset={tabBarHeight} />
        </View>
    );
}
