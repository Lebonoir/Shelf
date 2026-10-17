import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !key) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY in .env');
}

/* -------------------------------------------------------------------------- */
/*  "Remember me"                                                              */
/*  On: the session is saved to disk and survives app restarts.               */
/*  Off: it lives in memory (and the tab's sessionStorage on web), so closing */
/*  the app signs you out.                                                     */
/* -------------------------------------------------------------------------- */

const REMEMBER_KEY = 'shelf.remember-me';

type Client = ReturnType<typeof createClient<Database>>;
type AuthState = { remember: boolean; preference: Promise<void> | null; memory: Map<string, string> };

// Kept on globalThis so hot reloads share one client and one remember-me state.
// Two clients sharing a session both refresh its rotating token, Supabase
// revokes it, and you get signed out.
const shared = globalThis as typeof globalThis & {
  __shelfSupabase?: Client;
  __shelfAuthState?: AuthState;
  __shelfAppStateListener?: boolean;
};
const state: AuthState = (shared.__shelfAuthState ??= {
  remember: true,
  preference: null,
  memory: new Map(),
});

const tabSession = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' ? window.sessionStorage : null;

function loadPreference() {
  state.preference ??= AsyncStorage.getItem(REMEMBER_KEY).then((value) => {
    state.remember = value !== 'false';
  });
  return state.preference;
}

const sessionStore: SupportedStorage = {
  async getItem(name) {
    await loadPreference();
    if (state.remember) return AsyncStorage.getItem(name);
    return state.memory.get(name) ?? tabSession()?.getItem(name) ?? null;
  },
  async setItem(name, value) {
    await loadPreference();
    if (state.remember) {
      await AsyncStorage.setItem(name, value);
      return;
    }
    state.memory.set(name, value);
    tabSession()?.setItem(name, value);
    // Never leave an older remembered session on disk.
    await AsyncStorage.removeItem(name);
  },
  async removeItem(name) {
    state.memory.delete(name);
    tabSession()?.removeItem(name);
    await AsyncStorage.removeItem(name);
  },
};

export async function getRememberMe() {
  await loadPreference();
  return state.remember;
}

/** Call before signing in so the new session is stored the right way. */
export async function setRememberMe(value: boolean) {
  state.remember = value;
  state.preference = Promise.resolve();
  await AsyncStorage.setItem(REMEMBER_KEY, String(value));
}

export const supabase: Client =
  shared.__shelfSupabase ??
  (shared.__shelfSupabase = createClient<Database>(url, key, {
    auth: {
      storage: sessionStore,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  }));

// Only refresh tokens while the app is in the foreground.
if (Platform.OS !== 'web' && !shared.__shelfAppStateListener) {
  shared.__shelfAppStateListener = true;
  AppState.addEventListener('change', (appState) => {
    if (appState === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
