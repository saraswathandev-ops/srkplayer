import React, { useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './navigation/RootNavigator';

import { AppProviders } from '../components/providers/AppProviders';
import { requestDeviceMediaLibraryPermission } from '../services/deviceMediaLibrary';
import { checkAndHandleCrashLoop, logCrash } from '../services/crashManager';

export default function App() {
    useEffect(() => {
        let isActive = true;

        const init = async () => {
            try {
                // Wait for AppState to be active to ensure we are attached to an Activity
                if (AppState.currentState !== 'active') {
                    return;
                }

                const resetOccurred = await checkAndHandleCrashLoop();
                if (resetOccurred && isActive) {
                    setTimeout(() => {
                        Alert.alert(
                            "Crash Recovery",
                            "The app has been reset to a clean state because it failed to launch several times. Your media library will be rescanned."
                        );
                    }, 1000);
                }

                await requestDeviceMediaLibraryPermission().catch(console.warn);
            } catch (error) {
                console.error('App init failed:', error);
                void logCrash(
                    error instanceof Error ? error : new Error(String(error)),
                    'App startup init'
                );
            }
        };

        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                init();
            }
        });

        // Run once if already active
        init();

        return () => {
            isActive = false;
            subscription.remove();
        };
    }, []);

    return (
        <AppProviders>
            <NavigationContainer>
                <RootNavigator />
            </NavigationContainer>
        </AppProviders>
    );
}
