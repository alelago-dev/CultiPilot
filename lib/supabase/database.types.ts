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
      plant_measurements: {
        Row: {
          id: string;
          user_id: string;
          plant_id: string;
          measured_at: string;
          source: "manual" | "sensor" | "device";
          temperature_c: number | null;
          leaf_temperature_c: number | null;
          ambient_humidity_percent: number | null;
          substrate_moisture_percent: number | null;
          height_cm: number | null;
          water_amount_ml: number | null;
          irrigation_ph: number | null;
          irrigation_ec_ms_cm: number | null;
          irrigation_ppm: number | null;
          runoff_amount_ml: number | null;
          runoff_ph: number | null;
          runoff_ec_ms_cm: number | null;
          ppfd_umol_m2_s: number | null;
          lighting: string | null;
          observations: string | null;
          photo_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plant_id: string;
          measured_at?: string;
          source: "manual" | "sensor" | "device";
          temperature_c?: number | null;
          leaf_temperature_c?: number | null;
          ambient_humidity_percent?: number | null;
          substrate_moisture_percent?: number | null;
          height_cm?: number | null;
          water_amount_ml?: number | null;
          irrigation_ph?: number | null;
          irrigation_ec_ms_cm?: number | null;
          irrigation_ppm?: number | null;
          runoff_amount_ml?: number | null;
          runoff_ph?: number | null;
          runoff_ec_ms_cm?: number | null;
          ppfd_umol_m2_s?: number | null;
          lighting?: string | null;
          observations?: string | null;
          photo_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["plant_measurements"]["Insert"]>;
      };
      plant_insights: {
        Row: {
          id: string;
          user_id: string;
          plant_id: string;
          source: "calculated" | "suggestion";
          kind: "alert" | "comparison" | "missing-data" | "trend";
          title: string;
          body: string;
          evidence: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plant_id: string;
          source: "calculated" | "suggestion";
          kind: "alert" | "comparison" | "missing-data" | "trend";
          title: string;
          body: string;
          evidence?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["plant_insights"]["Insert"]>;
      };
      sensor_devices: {
        Row: {
          id: string;
          user_id: string;
          plant_ref: string;
          name: string;
          token_hash: string;
          active: boolean;
          last_seen_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plant_ref: string;
          name: string;
          token_hash: string;
          active?: boolean;
          last_seen_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sensor_devices"]["Insert"]>;
      };
      sensor_measurements: {
        Row: {
          id: string;
          user_id: string;
          plant_ref: string;
          device_id: string;
          measured_at: string;
          temperature_c: number | null;
          leaf_temperature_c: number | null;
          ambient_humidity_percent: number | null;
          substrate_moisture_percent: number | null;
          ppfd_umol_m2_s: number | null;
          observations: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plant_ref: string;
          device_id: string;
          measured_at?: string;
          temperature_c?: number | null;
          leaf_temperature_c?: number | null;
          ambient_humidity_percent?: number | null;
          substrate_moisture_percent?: number | null;
          ppfd_umol_m2_s?: number | null;
          observations?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sensor_measurements"]["Insert"]>;
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
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
          last_notified_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
          last_notified_date?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_sensor_device: {
        Args: { target_plant_ref: string; device_name: string };
        Returns: { device_id: string; device_token: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
