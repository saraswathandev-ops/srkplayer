import React, { useEffect, useRef } from 'react';
import { Alert, AppState, BackHandler, Platform, StatusBar } from 'react-native';
import SystemNavigationBar from 'react-native-system-navigation-bar';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import RootNavigator from '@/src/navigation/RootNavigator';

import { AppProviders } from '@/components/providers/AppProviders';
import { requestDeviceMediaLibraryPermission } from '@/services/deviceMediaLibrary';
import { checkAndHandleCrashLoop, logCrash } from '@/services/crashManager';
import { clearVideoCache, hasVideoCache } from '@/services/videoService';
import { log } from '@/utils/logger';

const L = log('App');
const navigationRef = createNavigationContainerRef();

export default function App() {
    // Track whether a back-press exit prompt is already showing so we
    // never stack multiple dialogs at once.
    const exitPromptActiveRef = useRef(false);
    const initCompletedRef = useRef(false);

    useEffect(() => {
        const applyFullscreen = () => {
            StatusBar.setHidden(true);
            if (Platform.OS === 'android') {
                StatusBar.setTranslucent(true);
                StatusBar.setBackgroundColor('transparent');
                SystemNavigationBar.stickyImmersive().catch(() => undefined);
            }
        };

        applyFullscreen();
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                applyFullscreen();
            }
        });

        return () => subscription.remove();
    }, []);

    // ── Android hardware back-button: ask before exiting ──────────────────────
    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const handler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (navigationRef.isReady() && navigationRef.canGoBack()) {
                return false;
            }

            if (exitPromptActiveRef.current) return true; // already showing

            exitPromptActiveRef.current = true;
            L.info('back-press exit prompt shown');

            Alert.alert(
                'Exit SKR Player?',
                'Do you want to exit the app?',
                [
                    {
                        text: 'Continue',
                        style: 'cancel',
                        onPress: () => {
                            exitPromptActiveRef.current = false;
                            L.info('exit cancelled — continuing');
                        },
                    },
                    {
                        text: 'Exit',
                        style: 'destructive',
                        onPress: () => {
                            exitPromptActiveRef.current = false;
                            L.info('user confirmed exit');
                            BackHandler.exitApp();
                        },
                    },
                ],
                { cancelable: false }
            );

            // Return true = we handled the back press (prevents default OS back).
            return true;
        });

        return () => handler.remove();
    }, []);

    // ── App lifecycle: init, foreground/background transitions ────────────────
    useEffect(() => {
        let isActive = true;

        const init = async () => {
            try {
                if (initCompletedRef.current) {
                    L.info('init skipped - already complete');
                    return;
                }

                if (AppState.currentState !== 'active') {
                    L.info('init skipped — AppState not active', { state: AppState.currentState });
                    return;
                }

                L.info('init start');

                const resetOccurred = await checkAndHandleCrashLoop();
                if (resetOccurred && isActive) {
                    L.warn('crash loop detected — app was reset');
                    setTimeout(() => {
                        Alert.alert(
                            'Crash Recovery',
                            'Recovery mode was applied because the app failed to launch several times. Your media library was preserved.'
                        );
                    }, 1000);
                }

                await requestDeviceMediaLibraryPermission().catch((e) => {
                    L.warn('media permission request failed', e);
                    console.warn(e);
                });

                L.info('init complete');
                initCompletedRef.current = true;
            } catch (error) {
                L.error('init failed', error);
                console.error('App init failed:', error);
                void logCrash(
                    error instanceof Error ? error : new Error(String(error)),
                    'App startup init'
                );
            }
        };

        const subscription = AppState.addEventListener('change', (nextState) => {
            L.info('AppState changed', { state: nextState });
            if (nextState === 'active') {
                void init();
            } else if (nextState === 'background') {
                if (hasVideoCache()) {
                    const cleared = clearVideoCache();
                    if (cleared) {
                        L.info('going to background - cleared video cache');
                    }
                } else {
                    L.info('going to background - video cache already empty');
                }
            }
        });

        // Run once on mount if already active
        void init();

        return () => {
            isActive = false;
            subscription.remove();
            L.info('App unmounted');
        };
    }, []);

    return (
        <AppProviders>
            <StatusBar hidden translucent backgroundColor="transparent" />
            <NavigationContainer ref={navigationRef}>
                <RootNavigator />
            </NavigationContainer>
        </AppProviders>
    );
}
