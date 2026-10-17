import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { Text } from './text';

type Props = {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, body, action }: Props) {
  return (
    <View style={styles.root}>
      {icon}
      <Text variant="title" style={styles.title}>
        {title}
      </Text>
      <Text tone="textSecondary" style={styles.body}>
        {body}
      </Text>
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: Spacing.seven,
    paddingRight: Spacing.six,
    gap: Spacing.two,
  },
  title: {
    marginTop: Spacing.three,
  },
  body: {
    maxWidth: 320,
  },
  action: {
    marginTop: Spacing.four,
    alignSelf: 'flex-start',
  },
});
