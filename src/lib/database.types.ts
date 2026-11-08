// Generated from the Supabase "Shelf" project schema. Regenerate after migrations.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      feedback: {
        Row: {
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['feedback_kind'];
          message: string;
          platform: string | null;
          resolved_at: string | null;
          screen: string | null;
          status: Database['public']['Enums']['feedback_status'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['feedback_kind'];
          message: string;
          platform?: string | null;
          resolved_at?: string | null;
          screen?: string | null;
          status?: Database['public']['Enums']['feedback_status'];
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['feedback_kind'];
          message?: string;
          platform?: string | null;
          resolved_at?: string | null;
          screen?: string | null;
          status?: Database['public']['Enums']['feedback_status'];
          user_id?: string;
        };
        Relationships: [];
      };
      library_entries: {
        Row: {
          created_at: string;
          finished_at: string | null;
          id: string;
          notes: string | null;
          progress: number;
          rating: number | null;
          started_at: string | null;
          status: Database['public']['Enums']['read_status'];
          title_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          notes?: string | null;
          progress?: number;
          rating?: number | null;
          started_at?: string | null;
          status?: Database['public']['Enums']['read_status'];
          title_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          notes?: string | null;
          progress?: number;
          rating?: number | null;
          started_at?: string | null;
          status?: Database['public']['Enums']['read_status'];
          title_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'library_entries_title_id_fkey';
            columns: ['title_id'];
            isOneToOne: false;
            referencedRelation: 'titles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          first_name: string | null;
          formats: Database['public']['Enums']['medium'][];
          genres: string[];
          id: string;
          last_name: string | null;
          middle_name: string | null;
          onboarded_at: string | null;
          reader: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          first_name?: string | null;
          formats?: Database['public']['Enums']['medium'][];
          genres?: string[];
          id?: string;
          last_name?: string | null;
          middle_name?: string | null;
          onboarded_at?: string | null;
          reader?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          first_name?: string | null;
          formats?: Database['public']['Enums']['medium'][];
          genres?: string[];
          id?: string;
          last_name?: string | null;
          middle_name?: string | null;
          onboarded_at?: string | null;
          reader?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      titles: {
        Row: {
          authors: string[];
          cover_url: string | null;
          created_at: string;
          genres: string[];
          id: string;
          medium: Database['public']['Enums']['medium'];
          source: string;
          source_id: string;
          synopsis: string | null;
          title: string;
          total_units: number | null;
          unit: string;
          year: number | null;
        };
        Insert: {
          authors?: string[];
          cover_url?: string | null;
          created_at?: string;
          genres?: string[];
          id?: string;
          medium: Database['public']['Enums']['medium'];
          source: string;
          source_id: string;
          synopsis?: string | null;
          title: string;
          total_units?: number | null;
          unit?: string;
          year?: number | null;
        };
        Update: {
          authors?: string[];
          cover_url?: string | null;
          created_at?: string;
          genres?: string[];
          id?: string;
          medium?: Database['public']['Enums']['medium'];
          source?: string;
          source_id?: string;
          synopsis?: string | null;
          title?: string;
          total_units?: number | null;
          unit?: string;
          year?: number | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_feedback: {
        Args: never;
        Returns: {
          created_at: string;
          email: string | null;
          first_name: string | null;
          id: string;
          kind: Database['public']['Enums']['feedback_kind'];
          last_name: string | null;
          message: string;
          platform: string | null;
          resolved_at: string | null;
          screen: string | null;
          status: Database['public']['Enums']['feedback_status'];
          user_id: string;
        }[];
      };
      admin_overview: { Args: never; Returns: Json };
      admin_users: {
        Args: never;
        Returns: {
          created_at: string;
          email: string;
          entries: number;
          first_name: string | null;
          id: string;
          is_admin: boolean;
          last_name: string | null;
          last_sign_in_at: string | null;
          middle_name: string | null;
          onboarded: boolean;
        }[];
      };
      is_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      feedback_kind: 'idea' | 'bug' | 'other';
      feedback_status: 'new' | 'resolved';
      medium: 'book' | 'manga' | 'comic';
      read_status: 'reading' | 'planned' | 'completed' | 'on_hold' | 'dropped';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
