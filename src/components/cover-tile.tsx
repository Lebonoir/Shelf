import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { MEDIUM_LABEL, type CatalogItem } from '@/lib/catalog';

import { Cover } from './cover';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Props = {
  item: CatalogItem;
  width: number;
  /** Small line under the title; defaults to the format and year. */
  meta?: string;
};

export const openTitle = (item: CatalogItem) =>
  router.push({ pathname: '/title/[key]', params: { key: item.key } });

export function CoverTile({ item, width, meta }: Props) {
  const fallbackMeta = [MEDIUM_LABEL[item.medium], item.year].filter(Boolean).join(' · ');
  return (
    <PressableScale
      onPress={() => openTitle(item)}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={{ width }}>
      <Cover uri={item.coverUrl} title={item.title} width={width} label={MEDIUM_LABEL[item.medium]} byline={item.authors[0]} />
      <View style={styles.caption}>
        <Text variant="label" numberOfLines={2}>
          {item.title}
        </Text>
        <Text variant="caption" tone="textTertiary" numberOfLines={1}>
          {meta ?? fallbackMeta}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  caption: {
    marginTop: Spacing.two + 2,
    gap: 3,
  },
});
