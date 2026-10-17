import { Image } from 'expo-image';
import { router } from 'expo-router';
import { CaretLeft, ShieldCheck } from 'phosphor-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { PressableScale } from '@/components/pressable-scale';
import { ProgressBar } from '@/components/progress-bar';
import { contentWidth, GUTTER, ScreenHeader } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { Text } from '@/components/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fullName, timeAgo, useAdminOverview, useAdminUsers, type AdminOverview } from '@/lib/admin';
import { MEDIUM_LABEL, type Medium } from '@/lib/catalog';
import { STATUS_LABEL, STATUS_ORDER } from '@/lib/library';

type Tab = 'overview' | 'users';

const READER_LABEL = { men: 'Men', women: 'Women', unspecified: 'Prefer not to say' } as const;
const MEDIA: Medium[] = ['manga', 'comic', 'book'];

/* -------------------------------------------------------------------------- */
/*  Building blocks                                                            */
/* -------------------------------------------------------------------------- */

function StatTile({ label, value, note }: { label: string; value: string | number; note?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text variant="eyebrow" tone="textTertiary">
        {label}
      </Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Text variant="caption" tone="textSecondary" numberOfLines={1}>
        {note ?? ' '}
      </Text>
    </View>
  );
}

function Panel({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.panel, { borderTopColor: theme.border }]}>
      <View style={styles.panelHead}>
        <Text variant="heading">{title}</Text>
        {note && (
          <Text variant="caption" tone="textTertiary">
            {note}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

/** Horizontal bars for one measure across categories. One hue, values in text ink. */
function BarList({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  if (total === 0) {
    return (
      <Text variant="caption" tone="textTertiary">
        Nothing recorded yet.
      </Text>
    );
  }
  return (
    <View style={styles.barList}>
      {rows.map((row) => (
        <View key={row.label} style={styles.barRow} accessible accessibilityLabel={`${row.label}: ${row.value}`}>
          <View style={styles.barLabels}>
            <Text variant="label" numberOfLines={1} style={styles.barLabel}>
              {row.label}
            </Text>
            <Text variant="mono" tone="textSecondary">
              {row.value}
              <Text variant="mono" tone="textTertiary">
                {'  '}
                {Math.round((row.value / total) * 100)}%
              </Text>
            </Text>
          </View>
          <ProgressBar value={row.value / max} height={6} />
        </View>
      ))}
    </View>
  );
}

/** Sign-ups per day. Tap or hover a column to read its exact value. */
function SignupColumns({ days }: { days: AdminOverview['signups_14d'] }) {
  const theme = useTheme();
  const [active, setActive] = useState(days.length - 1);
  const max = Math.max(1, ...days.map((d) => d.count));
  const format = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const current = days[active];

  return (
    <View style={{ gap: Spacing.three }}>
      <View style={styles.readout}>
        <Text style={styles.readoutValue}>{current?.count ?? 0}</Text>
        <Text variant="caption" tone="textSecondary">
          {current?.count === 1 ? 'sign-up' : 'sign-ups'} on {current ? format(current.day) : ''}
        </Text>
      </View>
      <View style={[styles.columns, { borderBottomColor: theme.border }]}>
        {days.map((day, index) => {
          const selected = index === active;
          return (
            <PressableScale
              key={day.day}
              scaleTo={1}
              onPress={() => setActive(index)}
              onHoverIn={() => setActive(index)}
              accessibilityLabel={`${format(day.day)}: ${day.count} sign-ups`}
              style={styles.columnHit}>
              <View
                style={[
                  styles.column,
                  {
                    height: day.count === 0 ? 2 : Math.max(6, (day.count / max) * 96),
                    backgroundColor: day.count === 0 ? theme.surfaceStrong : theme.accent,
                    opacity: selected || day.count === 0 ? 1 : 0.55,
                  },
                ]}
              />
            </PressableScale>
          );
        })}
      </View>
      <View style={styles.axis}>
        <Text variant="caption" tone="textTertiary">
          {days[0] ? format(days[0].day) : ''}
        </Text>
        <Text variant="caption" tone="textTertiary">
          Today
        </Text>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tabs                                                                       */
/* -------------------------------------------------------------------------- */

function Overview() {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const overview = useAdminOverview();
  const data = overview.data;
  const tileWidth = (contentWidth(windowWidth) - GUTTER * 2 - Spacing.three) / 2;

  if (overview.isPending) {
    return (
      <View style={styles.tiles}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} width={tileWidth} height={112} radius={Radius.lg} />
        ))}
      </View>
    );
  }

  if (overview.isError || !data) {
    return (
      <View style={[styles.errorBox, { backgroundColor: theme.accentSoft }]}>
        <Text variant="label" tone="danger">
          Could not load the overview.
        </Text>
        <Text variant="caption" tone="textSecondary">
          {overview.error?.message}
        </Text>
        <Button label="Try again" variant="ghost" onPress={() => overview.refetch()} />
      </View>
    );
  }

  const onboardedShare = data.users ? Math.round((data.onboarded / data.users) * 100) : 0;
  const perUser = data.users ? (data.entries / data.users).toFixed(1) : '0';

  return (
    <Animated.View entering={FadeIn} style={{ gap: Spacing.six }}>
      <View style={styles.tiles}>
        {[
          { label: 'Readers', value: data.users, note: `+${data.new_users_7d} this week` },
          { label: 'Active, 7 days', value: data.active_7d, note: 'Signed in this week' },
          { label: 'Onboarded', value: `${onboardedShare}%`, note: `${data.onboarded} of ${data.users}` },
          { label: 'Shelf entries', value: data.entries, note: `${perUser} per reader` },
          { label: 'Titles cached', value: data.titles, note: 'From AniList and Open Library' },
          { label: 'Avg rating', value: data.avg_rating ?? '—', note: data.avg_rating ? 'Out of 10' : 'No ratings yet' },
        ].map((tile, index) => (
          <Animated.View
            key={tile.label}
            entering={FadeInDown.delay(index * 40).springify().damping(18)}
            style={{ width: tileWidth }}>
            <StatTile {...tile} />
          </Animated.View>
        ))}
      </View>

      <Panel title="Sign-ups" note="Last 14 days">
        <SignupColumns days={data.signups_14d ?? []} />
      </Panel>

      <Panel title="Shelves by status" note={`${data.entries} entries`}>
        <BarList rows={STATUS_ORDER.map((s) => ({ label: STATUS_LABEL[s], value: data.by_status[s] ?? 0 }))} />
      </Panel>

      <Panel title="Shelves by format">
        <BarList rows={MEDIA.map((m) => ({ label: MEDIUM_LABEL[m], value: data.by_medium[m] ?? 0 }))} />
      </Panel>

      <Panel title="Formats readers picked" note="From onboarding">
        <BarList rows={MEDIA.map((m) => ({ label: MEDIUM_LABEL[m], value: data.formats[m] ?? 0 }))} />
      </Panel>

      <Panel title="Who readers pick for" note="From onboarding">
        <BarList
          rows={(['men', 'women', 'unspecified'] as const).map((r) => ({
            label: READER_LABEL[r],
            value: data.readers[r] ?? 0,
          }))}
        />
      </Panel>

      <Panel title="Favourite genres" note="Top 8">
        <BarList rows={data.genres.slice(0, 8).map((g) => ({ label: g.name, value: g.count }))} />
      </Panel>

      <Panel title="Most shelved">
        {data.top_titles.length === 0 ? (
          <Text variant="caption" tone="textTertiary">
            Nothing shelved yet.
          </Text>
        ) : (
          data.top_titles.map((t, index) => (
            <View key={`${t.title}-${index}`} style={styles.listRow}>
              <Text variant="mono" tone="textTertiary" style={styles.rank}>
                {String(index + 1).padStart(2, '0')}
              </Text>
              {t.cover_url ? (
                <Image source={t.cover_url} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, { backgroundColor: theme.surfaceStrong }]} />
              )}
              <View style={styles.listText}>
                <Text variant="label" numberOfLines={1}>
                  {t.title}
                </Text>
                <Text variant="caption" tone="textTertiary">
                  {MEDIUM_LABEL[t.medium]}
                </Text>
              </View>
              <Text variant="mono" tone="textSecondary">
                {t.count} {t.count === 1 ? 'shelf' : 'shelves'}
              </Text>
            </View>
          ))
        )}
      </Panel>

      <Panel title="Recent activity">
        {data.recent_activity.length === 0 ? (
          <Text variant="caption" tone="textTertiary">
            No activity yet.
          </Text>
        ) : (
          data.recent_activity.map((a, index) => (
            <View key={`${a.at}-${index}`} style={[styles.activity, { borderBottomColor: theme.border }]}>
              <Text variant="label" style={styles.listText} numberOfLines={2}>
                {a.who}
                <Text variant="label" tone="textSecondary">
                  {' '}
                  marked{' '}
                </Text>
                {a.title}
                <Text variant="label" tone="textSecondary">
                  {' '}
                  as {STATUS_LABEL[a.status].toLowerCase()}
                </Text>
              </Text>
              <Text variant="mono" tone="textTertiary">
                {timeAgo(a.at)}
              </Text>
            </View>
          ))
        )}
      </Panel>
    </Animated.View>
  );
}

function Users() {
  const theme = useTheme();
  const users = useAdminUsers();

  if (users.isPending) {
    return (
      <View style={{ gap: Spacing.four }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width="100%" height={84} radius={Radius.lg} />
        ))}
      </View>
    );
  }

  if (users.isError) {
    return (
      <View style={[styles.errorBox, { backgroundColor: theme.accentSoft }]}>
        <Text variant="label" tone="danger">
          Could not load users.
        </Text>
        <Text variant="caption" tone="textSecondary">
          {users.error.message}
        </Text>
        <Button label="Try again" variant="ghost" onPress={() => users.refetch()} />
      </View>
    );
  }

  return (
    <Animated.View entering={FadeIn} style={styles.userList}>
      <Text variant="mono" tone="textTertiary">
        {users.data.length} {users.data.length === 1 ? 'account' : 'accounts'}
      </Text>
      {users.data.map((user) => {
        const name = fullName(user);
        return (
          <View key={user.id} style={[styles.userRow, { borderBottomColor: theme.border }]}>
            <View style={[styles.initials, { backgroundColor: theme.surfaceStrong }]}>
              <Text variant="label" tone="textSecondary">
                {(user.first_name?.[0] ?? user.email[0] ?? '?').toUpperCase()}
                {(user.last_name?.[0] ?? '').toUpperCase()}
              </Text>
            </View>
            <View style={styles.listText}>
              <View style={styles.userNameRow}>
                <Text variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {name || 'No name given'}
                </Text>
                {user.is_admin && (
                  <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
                    <ShieldCheck size={12} color={theme.accent} weight="bold" />
                    <Text variant="caption" tone="accent">
                      Admin
                    </Text>
                  </View>
                )}
              </View>
              <Text variant="caption" tone="textSecondary" numberOfLines={1}>
                {user.email}
              </Text>
              <Text variant="mono" tone="textTertiary">
                Joined {timeAgo(user.created_at)} · seen {timeAgo(user.last_sign_in_at)} · {user.entries} on shelf
                {user.onboarded ? '' : ' · not onboarded'}
              </Text>
            </View>
          </View>
        );
      })}
    </Animated.View>
  );
}

/* -------------------------------------------------------------------------- */

export default function AdminScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const width = contentWidth(windowWidth);
  const [tab, setTab] = useState<Tab>('overview');
  const overview = useAdminOverview();
  const users = useAdminUsers();
  const refreshing = overview.isRefetching || users.isRefetching;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { width, paddingBottom: insets.bottom + Spacing.seven }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void overview.refetch();
              void users.refetch();
            }}
            tintColor={theme.textTertiary}
          />
        }>
        <PressableScale
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={[styles.back, { borderColor: theme.border }]}>
          <CaretLeft size={18} color={theme.text} weight="bold" />
        </PressableScale>

        <ScreenHeader
          eyebrow="Admin"
          title="Everything on Shelf"
          subtitle="Readers, shelves and what people pick. Pull down to refresh."
        />

        <View style={styles.tabs}>
          <Chip label="Overview" selected={tab === 'overview'} onPress={() => setTab('overview')} />
          <Chip
            label="Users"
            count={users.data?.length}
            selected={tab === 'users'}
            onPress={() => setTab('users')}
          />
        </View>

        {tab === 'overview' ? <Overview /> : <Users />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  tile: {
    padding: Spacing.four,
    gap: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  tileValue: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1,
  },
  panel: {
    gap: Spacing.four,
    paddingTop: Spacing.five,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  barList: {
    gap: Spacing.four,
  },
  barRow: {
    gap: Spacing.two,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.three,
  },
  barLabel: {
    flex: 1,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  readoutValue: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 24,
    lineHeight: 28,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 104,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  columnHit: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    paddingHorizontal: 2,
  },
  column: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rank: {
    width: 22,
  },
  thumb: {
    width: 32,
    height: 48,
    borderRadius: 3,
  },
  listText: {
    flex: 1,
    gap: 2,
  },
  activity: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userList: {
    gap: Spacing.four,
  },
  userRow: {
    flexDirection: 'row',
    gap: Spacing.four,
    paddingBottom: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  initials: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  errorBox: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    alignItems: 'flex-start',
  },
});
