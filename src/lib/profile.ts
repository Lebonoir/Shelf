import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Medium } from './catalog';
import type { Genre } from './genres';
import { supabase } from './supabase';

export type Reader = 'men' | 'women';

export type Profile = {
  reader: Reader | null;
  formats: Medium[];
  genres: Genre[];
  onboardedAt: string | null;
};

export const PROFILE_KEY = ['profile'] as const;

async function loadProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('reader, formats, genres, onboarded_at')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    reader: data.reader as Reader | null,
    formats: data.formats,
    genres: data.genres as Genre[],
    onboardedAt: data.onboarded_at,
  };
}

export function useProfile(enabled = true) {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: loadProfile, enabled, staleTime: Infinity });
}

export function useSaveProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (answers: Omit<Profile, 'onboardedAt'>) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('You are signed out.');
      const { error } = await supabase.from('profiles').upsert({
        id: auth.user.id,
        reader: answers.reader,
        formats: answers.formats,
        genres: answers.genres,
        onboarded_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: PROFILE_KEY }),
  });
}
