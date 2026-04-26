import Feather from 'react-native-vector-icons/Feather';
import React, { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";
import { useFontScale } from "@/hooks/useFontScale";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
};

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search media...",
  onClear,
}: Props) {
  const { colors } = useAppTheme();
  const { apply } = useFontScale();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: isFocused ? colors.primary : colors.border,
          shadowColor: colors.primary,
          shadowOpacity: isFocused ? 0.14 : 0,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}14` }]}>
        <Feather name="search" size={13} color={isFocused ? colors.primary : colors.textTertiary} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, { color: colors.text, fontSize: apply(13) }]}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => {
            onChangeText("");
            onClear?.();
          }}
          hitSlop={10}
        >
          <Feather name="x-circle" size={14} color={colors.textTertiary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 0,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
});
