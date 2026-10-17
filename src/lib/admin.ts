import { useQuery } from '@tanstack/react-query';

import type { Medium } from './catalog';
import type { ReadStatus } from './library';
import { supabase } from './supabase';

export type AdminOverview = {
  users: number;
  new_users_7d: number;
  active_7d: number;
  onboarded: number;
  titles: number;
  entries: number;
  avg_rating: number | null;
  by_status: Partial<Record<ReadStatus, number>>;
  by_medium: Partial<Record<Medium, number>>;
  formats: Partial<Record<Medium, number>>;
  readers: Partial<Record<'men' | 'women' | 'unspecified', number>>;
  genres: { name: string; count: number }[];
  signups_14d: { day: string; count: number }[];
  top_titles: { title: string; medium: Medium; cover_url: string | null; count: number }[];
  recent_activity: { who: string; title: string; status: ReadStatus; at: string }[];
};

export type AdminUser = {
  id: string;
  email: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  onboarded: boolean;
  entries: number;
  is_admin: boolean;
};

/** Whether the signed-in user is an admin. The server decides; this only drives the UI. */
export function useIsAdmin(enabled = true) {
  return useQuery({
    queryKey: ['is-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) throw error;
      return data;
    },
    enabled,
    staleTime: Infinity,
  });
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_overview');
      if (error) throw error;
      return data as unknown as AdminOverview;
    },
    staleTime: 30_000,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_users');
      if (error) throw error;
      return data as AdminUser[];
    },
    staleTime: 30_000,
  });
}

export function fullName(user: Pick<AdminUser, 'first_name' | 'middle_name' | 'last_name'>) {
  return [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ');
}

/** "just now", "5m ago", "3h ago", "2d ago", then a date. */
export function timeAgo(iso: string | null) {
  if (!iso) return 'never';
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
