import os

file_path = r'e:\Saraswathan\AI\mx-player-source\artifacts\srkplayer\app\player.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# The first ~15 lines are a mess. We'll replace them with the correct imports.
# We'll look for the first stable line like 'const SPEEDS' or 'import { useSafeAreaInsets'
# Wait, I'll just look for line 10 which was 'import { useSafeAreaInsets'

new_imports = [
    "import Feather from 'react-native-vector-icons/Feather';\n",
    "import Ionicons from 'react-native-vector-icons/Ionicons';\n",
    "import ReactNativeHapticFeedback from \"react-native-haptic-feedback\";\n",
    "import FastImage from \"react-native-fast-image\";\n",
    "import RNFS from \"react-native-fs\";\n",
    "import Video, { SelectedTrackType, ViewType, type VideoRef } from \"react-native-video\";\n",
    "import { useNavigation, useRoute } from \"@react-navigation/native\";\n",
    "import React, { useCallback, useEffect, useMemo, useRef, useState } from \"react\";\n",
    "import {\n",
    "  ActivityIndicator,\n",
    "  Alert,\n",
    "  AppState,\n",
    "  Animated,\n",
    "  BackHandler,\n",
    "  FlatList,\n",
    "  PanResponder,\n",
    "  Platform,\n",
    "  Pressable,\n",
    "  ScrollView,\n",
    "  StatusBar,\n",
    "  StyleSheet,\n",
    "  Text,\n",
    "  TextInput,\n",
    "  View,\n",
    "} from \"react-native\";\n"
]

# Find where the existing imports end and the rest of the file begins.
# We'll look for 'import { useSafeAreaInsets'
start_index = -1
for i, line in enumerate(lines):
    if 'useSafeAreaInsets' in line:
        start_index = i
        break

if start_index != -1:
    # Keep everything from useSafeAreaInsets onwards
    rest_of_file = lines[start_index:]
    final_content = new_imports + rest_of_file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(final_content)
    print("Successfully fixed imports in player.tsx")
else:
    print("Could not find anchor point in player.tsx")
