import React, { forwardRef } from 'react';
import { FlatList, FlatListProps } from 'react-native';

// Try to load FlashList dynamically, falling back to standard FlatList
let FlashListComponent: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const flashListModule = require('@shopify/flash-list');
  FlashListComponent = flashListModule?.FlashList || null;
} catch {
  FlashListComponent = null;
}

export interface AdaptiveListProps<T> extends FlatListProps<T> {
  estimatedItemSize?: number;
  useStandardFlatList?: boolean;
}

export const AdaptiveList = forwardRef<any, AdaptiveListProps<any>>((props, ref) => {
  const { estimatedItemSize, useStandardFlatList, ...restProps } = props;

  if (FlashListComponent && !useStandardFlatList) {
    return <FlashListComponent ref={ref} estimatedItemSize={estimatedItemSize || 80} {...restProps} />;
  }

  return <FlatList ref={ref} {...(restProps as FlatListProps<any>)} />;
});

AdaptiveList.displayName = 'AdaptiveList';

export default AdaptiveList;
