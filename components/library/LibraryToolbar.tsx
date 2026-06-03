import Feather from "react-native-vector-icons/Feather";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { LIST_HPAD, RADIUS } from "@/constants/layout";
import { useAppTheme } from "@/hooks/useAppTheme";
import { type SortDirection, type SortMode } from "@/types/player";

type FilterOption = {
  key: string;
  label: string;
  active: boolean;
  onPress: () => void;
};

type Props = {
  sortField: SortMode;
  sortDirection: SortDirection;
  sortFields: SortMode[];
  onChangeSortField: (field: SortMode) => void;
  onToggleSortDirection: () => void;
  filters?: FilterOption[];
  rightSlot?: React.ReactNode;
};

const SORT_LABELS: Record<SortMode, string> = {
  date: "Date",
  name: "Name",
  size: "Size",
};

export function LibraryToolbar({
  sortField,
  sortDirection,
  sortFields,
  onChangeSortField,
  onToggleSortDirection,
  filters,
  rightSlot,
}: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.sortRow}>
          {sortFields.map((field) => {
            const active = sortField === field;
            return (
              <Pressable
                key={field}
                onPress={() => onChangeSortField(field)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? "#fff" : colors.textSecondary },
                  ]}
                >
                  {SORT_LABELS[field]}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={onToggleSortDirection}
            style={[
              styles.directionChip,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather
              name={sortDirection === "desc" ? "arrow-down" : "arrow-up"}
              size={15}
              color={colors.primary}
            />
            <Text style={[styles.chipText, { color: colors.text }]}>
              {SORT_LABELS[sortField]}
            </Text>
          </Pressable>
        </View>
        {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
      </View>

      {filters && filters.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filters.map((filter) => (
            <Pressable
              key={filter.key}
              onPress={filter.onPress}
              style={[
                styles.chip,
                {
                  backgroundColor: filter.active ? `${colors.primary}1A` : colors.card,
                  borderColor: filter.active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: filter.active ? colors.primary : colors.textSecondary },
                ]}
              >
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sortRow: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterRow: {
    paddingRight: LIST_HPAD,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  directionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  rightSlot: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
