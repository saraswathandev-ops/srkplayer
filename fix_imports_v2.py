import os

file_path = r'e:\Saraswathan\AI\mx-player-source\artifacts\srkplayer\app\player.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the first stable anchor: "import Video,"
anchor = 'import Video, { SelectedTrackType'
anchor_pos = content.find(anchor)

if anchor_pos == -1:
    print("ERROR: Could not find anchor 'import Video, { SelectedTrackType' in file!")
    exit(1)

# Everything before the Video import is garbage — replace it
rest_of_file = content[anchor_pos:]

correct_imports = """\
import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import FastImage from "react-native-fast-image";
import RNFS from "react-native-fs";
"""

# Now check if the rest already has the react-native-video import
# It does — so we just prepend the missing ones before it

# Also need to add React + react-native imports between Video and useSafeAreaInsets
# Find where useSafeAreaInsets is
safe_area_anchor = 'import { useSafeAreaInsets }'
safe_area_pos = rest_of_file.find(safe_area_anchor)

if safe_area_pos == -1:
    print("ERROR: Could not find useSafeAreaInsets anchor!")
    exit(1)

# Everything between Video import line end and useSafeAreaInsets is empty lines — replace
video_import_end = rest_of_file.find('\n', rest_of_file.find('from "react-native-video"'))
if video_import_end == -1:
    print("ERROR: Could not find end of Video import line!")
    exit(1)

before_safe_area = rest_of_file[:video_import_end + 1]
from_safe_area = rest_of_file[safe_area_pos:]

react_imports = """\
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Animated,
  BackHandler,
  FlatList,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
"""

final_content = correct_imports + before_safe_area + react_imports + from_safe_area

# Also fix the missing _loop and _playbackRate variables
# Find the createVideoPlayerShim function and fix the variable block
old_vars = """\
  let _playing = false;
  let _currentTime = 0;
  let _duration = 0;

  let _volume = 1;
  let _muted = false;"""

new_vars = """\
  let _playing = false;
  let _currentTime = 0;
  let _duration = 0;
  let _loop = false;
  let _playbackRate = 1;
  let _volume = 1;
  let _muted = false;"""

if old_vars in final_content:
    final_content = final_content.replace(old_vars, new_vars)
    print("Fixed _loop and _playbackRate variables")
else:
    print("WARNING: Could not find variable block to fix _loop/_playbackRate")
    # Try alternative pattern without exact whitespace
    if '_loop' not in final_content.split('return {')[0].split('createVideoPlayerShim')[1]:
        print("  _loop is definitely missing from the shim function")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(final_content)

print(f"Successfully fixed imports in {file_path}")
print(f"File size: {len(final_content)} bytes")
