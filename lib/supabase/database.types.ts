export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          locale: string;
          legal_use_consented_at: string | null;
          privacy_consented_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          locale?: string;
          legal_use_consented_at?: string | null;
          privacy_consented_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      grow_spaces: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          mode: string;
          approximate_region: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          mode: string;
          approximate_region?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["grow_spaces"]["Insert"]>;
      };
      plants: {
        Row: {
          id: string;
          user_id: string;
          space_id: string;
          name: string;
          variety: string | null;
          seed_profile_id: string | null;
          seed_type: string | null;
          custom_seed_notes: string | null;
          started_at: string | null;
          mode: string;
          pot: string | null;
          substrate: string | null;
          lighting: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          space_id: string;
          name: string;
          variety?: string | null;
          seed_profile_id?: string | null;
          seed_type?: string | null;
          custom_seed_notes?: string | null;
          started_at?: string | null;
          mode: string;
          pot?: string | null;
          substrate?: string | null;
          lighting?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["plants"]["Insert"]>;
      };
      calendar_events: {
        Row: {
          id: string;
          user_id: string;
          plant_id: string;
          title: string;
          description: string | null;
          event_type: "watering" | "photo" | "cleaning" | "review";
          source: "manual" | "horticultural";
          start_date: string;
          recurrence_active: boolean;
          recurrence_every_days: number | null;
          recurrence_end_date: string | null;
          completed_dates: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plant_id: string;
          title: string;
          description?: string | null;
          event_type: "watering" | "photo" | "cleaning" | "review";
          source: "manual" | "horticultural";
          start_date: string;
          recurrence_active?: boolean;
          recurrence_every_days?: number | null;
          recurrence_end_date?: string | null;
          completed_dates?: string[];
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["calendar_events"]["Insert"]>;
      };
      user_app_snapshots: {
        Row: {
          user_id: string;
          key: string;
          payload: Json;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          key?: string;
          payload: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_app_snapshots"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
