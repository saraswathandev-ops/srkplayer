import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './navigation/RootNavigator';

// Note: We might need to adjust paths later if we move AppProviders
import { AppProviders } from '../components/providers/AppProviders';

export default function App() {
    return (
        <AppProviders>
            <NavigationContainer>
                <RootNavigator />
            </NavigationContainer>
        </AppProviders>
    );
}
