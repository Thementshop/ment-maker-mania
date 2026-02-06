export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chain_links: {
        Row: {
          chain_id: string
          link_id: string
          passed_at: string
          passed_by: string
          passed_to: string
          received_compliment: string
          sent_compliment: string
          was_forwarded: boolean
        }
        Insert: {
          chain_id: string
          link_id?: string
          passed_at?: string
          passed_by: string
          passed_to: string
          received_compliment: string
          sent_compliment: string
          was_forwarded?: boolean
        }
        Update: {
          chain_id?: string
          link_id?: string
          passed_at?: string
          passed_by?: string
          passed_to?: string
          received_compliment?: string
          sent_compliment?: string
          was_forwarded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "chain_links_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "ment_chains"
            referencedColumns: ["chain_id"]
          },
        ]
      }
      ment_chains: {
        Row: {
          broken_at: string | null
          broken_by: string | null
          chain_id: string
          chain_name: string | null
          created_at: string
          current_holder: string
          expires_at: string
          is_queued: boolean | null
          links_count: number
          share_count: number | null
          started_by: string
          status: string
          tier: string | null
        }
        Insert: {
          broken_at?: string | null
          broken_by?: string | null
          chain_id?: string
          chain_name?: string | null
          created_at?: string
          current_holder: string
          expires_at: string
          is_queued?: boolean | null
          links_count?: number
          share_count?: number | null
          started_by: string
          status?: string
          tier?: string | null
        }
        Update: {
          broken_at?: string | null
          broken_by?: string | null
          chain_id?: string
          chain_name?: string | null
          created_at?: string
          current_holder?: string
          expires_at?: string
          is_queued?: boolean | null
          links_count?: number
          share_count?: number | null
          started_by?: string
          status?: string
          tier?: string | null
        }
        Relationships: []
      }
      pending_ments: {
        Row: {
          category: string
          compliment_text: string
          created_at: string | null
          expires_at: string
          id: string
          recipient_type: string
          recipient_value: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          category: string
          compliment_text: string
          created_at?: string | null
          expires_at: string
          id?: string
          recipient_type: string
          recipient_value?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          category?: string
          compliment_text?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          recipient_type?: string
          recipient_value?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sent_ments: {
        Row: {
          category: string
          compliment_text: string
          id: string
          recipient_type: string
          sender_id: string
          sent_at: string | null
        }
        Insert: {
          category: string
          compliment_text: string
          id?: string
          recipient_type: string
          sender_id: string
          sent_at?: string | null
        }
        Update: {
          category?: string
          compliment_text?: string
          id?: string
          recipient_type?: string
          sender_id?: string
          sent_at?: string | null
        }
        Relationships: []
      }
      used_chain_names: {
        Row: {
          chain_id: string | null
          chain_name: string
          claimed_at: string | null
          id: string
        }
        Insert: {
          chain_id?: string | null
          chain_name: string
          claimed_at?: string | null
          id?: string
        }
        Update: {
          chain_id?: string | null
          chain_name?: string
          claimed_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "used_chain_names_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "ment_chains"
            referencedColumns: ["chain_id"]
          },
        ]
      }
      user_game_state: {
        Row: {
          broken_chains_today: number | null
          chains_started_today: number
          created_at: string | null
          current_level: number
          id: string
          jar_count: number
          last_chain_start_date: string | null
          last_free_token_date: string
          legendary_chains_created: number | null
          pause_tokens: number
          total_sent: number
          total_tokens_used: number
          updated_at: string | null
          user_id: string
          your_turn_chains_count: number
        }
        Insert: {
          broken_chains_today?: number | null
          chains_started_today?: number
          created_at?: string | null
          current_level?: number
          id?: string
          jar_count?: number
          last_chain_start_date?: string | null
          last_free_token_date?: string
          legendary_chains_created?: number | null
          pause_tokens?: number
          total_sent?: number
          total_tokens_used?: number
          updated_at?: string | null
          user_id: string
          your_turn_chains_count?: number
        }
        Update: {
          broken_chains_today?: number | null
          chains_started_today?: number
          created_at?: string | null
          current_level?: number
          id?: string
          jar_count?: number
          last_chain_start_date?: string | null
          last_free_token_date?: string
          legendary_chains_created?: number | null
          pause_tokens?: number
          total_sent?: number
          total_tokens_used?: number
          updated_at?: string | null
          user_id?: string
          your_turn_chains_count?: number
        }
        Relationships: []
      }
      world_kindness_counter: {
        Row: {
          count: number
          id: number
          updated_at: string | null
        }
        Insert: {
          count?: number
          id?: number
          updated_at?: string | null
        }
        Update: {
          count?: number
          id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_world_counter: { Args: never; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
