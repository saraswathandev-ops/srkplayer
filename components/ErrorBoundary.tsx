import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Alert } from 'react-native';
import { forceResetApp, logCrash } from '@/services/crashManager';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("Uncaught error:", error, errorInfo);
    void logCrash(error, errorInfo.componentStack ?? undefined);
  }

  handleReset = () => {
    Alert.alert(
      "Reset Application?",
      "This will clear all your settings and media library to fix the crash loop. The actual video files on your device will NOT be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Reset Everything", 
          style: "destructive", 
          onPress: async () => {
            await forceResetApp();
            // In a real app, we might need a native restart here.
            // For now, we'll try to just clear the error state.
            this.setState({ hasError: false, error: null, errorInfo: null });
            // Alert user to restart manually if possible
            Alert.alert("Reset Complete", "The app has been reset. Please close and reopen the app for a clean start.");
          }
        }
      ]
    );
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.emoji}>⚠️</Text>
            <Text style={styles.title}>Oops! Something went wrong.</Text>
            <Text style={styles.subtitle}>
              The app encountered an unexpected error. We've logged the details to help fix it.
            </Text>
            
            <ScrollView style={styles.errorScroll}>
              <Text style={styles.errorText}>
                {this.state.error?.toString()}
                {"\n\n"}
                {this.state.errorInfo?.componentStack}
              </Text>
            </ScrollView>

            <TouchableOpacity style={styles.resetButton} onPress={this.handleReset}>
              <Text style={styles.resetButtonText}>Reset App & Clear Crash</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorScroll: {
    maxHeight: 200,
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  errorText: {
    color: '#ff6b6b',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
  },
  resetButton: {
    backgroundColor: '#ff4b4b',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  resetButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  retryButton: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#aaa',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
