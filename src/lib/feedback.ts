import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

import type { Database, Enums } from './database.types';
import { supabase } from './supabase';

export type FeedbackKind = Enums<'feedback_kind'>;
export type FeedbackStatus = Enums<'feedback_status'>;
export type AdminFeedback = Database['public']['Functions']['admin_feedback']['Returns'][number];

export const FEEDBACK_KIND_LABEL: Record<FeedbackKind, string> = {
  idea: 'Idea',
  bug: 'Something broke',
  other: 'Other',
};

export const FEEDBACK_MAX_LENGTH = 2000;

/** Sends feedback as the signed-in reader; the database fills in who sent it. */
export function useSendFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, message, screen }: { kind: FeedbackKind; message: string; screen?: string }) => {
      const { error } = await supabase.from('feedback').insert({
        kind,
        message: message.trim(),
        screen: screen?.slice(0, 200) || null,
        platform: Platform.OS,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'feedback'] }),
  });
}

/** Every reader's feedback, newest unresolved first. Admin only; the server checks. */
export function useAdminFeedback(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'feedback'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_feedback');
      if (error) throw error;
      return data;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useSetFeedbackStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FeedbackStatus }) => {
      const { error } = await supabase
        .from('feedback')
        .update({ status, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
        .eq('id', id);
      if (error) throw error;
    },
    // Flip the row in place so the inbox responds instantly.
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'feedback'] });
      const previous = queryClient.getQueryData<AdminFeedback[]>(['admin', 'feedback']);
      queryClient.setQueryData<AdminFeedback[]>(['admin', 'feedback'], (rows) =>
        rows?.map((row) => (row.id === id ? { ...row, status } : row)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => queryClient.setQueryData(['admin', 'feedback'], context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin', 'feedback'] }),
  });
}
