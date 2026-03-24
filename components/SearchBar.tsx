import Feather from 'react-native-vector-icons/Feather';
import React, { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { useAppTheme } from "@/hooks/useAppTheme";

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
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: isFocused ? colors.primary : colors.border,
          shadowColor: colors.primary,
          shadowOpacity: isFocused ? 0.16 : 0,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}14` }]}>
        <Feather name="search" size={15} color={isFocused ? colors.primary : colors.textTertiary} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, { color: colors.text }]}
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
          <Feather name="x-circle" size={16} color={colors.textTertiary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 1,
    minHeight: 72,
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 10,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 0,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
});
