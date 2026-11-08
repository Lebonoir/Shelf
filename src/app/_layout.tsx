import { Fraunces_400Regular, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useIsAdmin } from '@/lib/admin';
import { useProfile } from '@/lib/profile';
import { AuthProvider, useAuth } from '@/providers/auth';

SplashScreen.preventAutoHideAsync();

// Web-only fixes:
// - Scrollbars eat into the width the layout is computed from and knock every
//   screen off its gutter. Shelf is a phone-first app: hide them.
// - Text fields draw their own focus border, so the browser's outline on the
//   inner <input> showed up as a second ring inside it. Buttons keep theirs.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = [
    '* { scrollbar-width: none; } *::-webkit-scrollbar { display: none; }',
    'input, textarea { outline: none !important; }',
  ].join('\n');
  document.head.appendChild(style);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular,
    Fraunces_600SemiBold,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    GeistMono_500Medium,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator ready={fontsLoaded || !!fontError} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigator({ ready }: { ready: boolean }) {
  const { session, loading } = useAuth();
  const scheme = useColorScheme();
  const theme = useTheme();
  const userId = session?.user.id;
  const lastUser = useRef(userId);
  const profile = useProfile(!!session);
  const isAdmin = useIsAdmin(!!session);
  // Wait for the admin check too: until it answers, the admin route is hidden, and
  // landing on /admin then (a reload, a fresh sign-in) bounced or showed a blank screen.
  const profileLoading = !!session && (profile.isPending || isAdmin.isPending);
  // If the profile can't load, don't trap the user in onboarding; let them in.
  const onboarded = !!profile.data?.onboardedAt || profile.isError;

  useEffect(() => {
    if (ready && !loading && !profileLoading) SplashScreen.hideAsync();
  }, [ready, loading, profileLoading]);

  // Never show one account's shelf to another after switching.
  useEffect(() => {
    if (lastUser.current !== userId) queryClient.clear();
    lastUser.current = userId;
  }, [userId]);

  if (!ready || loading || profileLoading) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: theme.background,
      card: theme.background,
      text: theme.text,
      border: theme.border,
      primary: theme.accent,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
        <Stack.Protected guard={!!session && onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="title/[key]" />
          <Stack.Screen name="find" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        {/* The server also checks admin on every query; this only hides the route. */}
        <Stack.Protected guard={!!session && onboarded && isAdmin.data === true}>
          <Stack.Screen name="admin" />
        </Stack.Protected>
        {/* Feedback is for readers; admins read it in the admin inbox instead. */}
        <Stack.Protected guard={!!session && onboarded && isAdmin.data === false}>
          <Stack.Screen name="feedback" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        {/* Reachable before onboarding, and again later to retake the questions. */}
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="onboarding" options={{ gestureEnabled: onboarded }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
