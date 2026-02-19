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
      ai_studio_presets: {
        Row: {
          created_at: string | null
          id: string
          preset_name: string
          system_prompt: string
          target_market: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          preset_name: string
          system_prompt: string
          target_market: string
        }
        Update: {
          created_at?: string | null
          id?: string
          preset_name?: string
          system_prompt?: string
          target_market?: string
        }
        Relationships: []
      }
      shipment_documents: {
        Row: {
          created_at: string
          document_label: string
          document_type: string
          file_path: string | null
          generated_at: string | null
          id: string
          metadata: Json | null
          shipment_id: string | null
          status: Database["public"]["Enums"]["document_status"]
          target_market: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_label: string
          document_type: string
          file_path?: string | null
          generated_at?: string | null
          id?: string
          metadata?: Json | null
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          target_market?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_label?: string
          document_type?: string
          file_path?: string | null
          generated_at?: string | null
          id?: string
          metadata?: Json | null
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          target_market?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_documents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          created_at: string
          duty: number
          e_factor_multiplier: number
          freight: number
          hs_code_assigned: string | null
          id: string
          insurance: number
          notes: string | null
          port_congestion_level: string | null
          product_name: string
          raw_cost_v: number
          status: Database["public"]["Enums"]["shipment_status"]
          taxes: number
          updated_at: string
          user_id: string
          weather_risk_level: string | null
        }
        Insert: {
          created_at?: string
          duty?: number
          e_factor_multiplier?: number
          freight?: number
          hs_code_assigned?: string | null
          id?: string
          insurance?: number
          notes?: string | null
          port_congestion_level?: string | null
          product_name: string
          raw_cost_v?: number
          status?: Database["public"]["Enums"]["shipment_status"]
          taxes?: number
          updated_at?: string
          user_id: string
          weather_risk_level?: string | null
        }
        Update: {
          created_at?: string
          duty?: number
          e_factor_multiplier?: number
          freight?: number
          hs_code_assigned?: string | null
          id?: string
          insurance?: number
          notes?: string | null
          port_congestion_level?: string | null
          product_name?: string
          raw_cost_v?: number
          status?: Database["public"]["Enums"]["shipment_status"]
          taxes?: number
          updated_at?: string
          user_id?: string
          weather_risk_level?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_shipment_owner: { Args: { shipment_id: string }; Returns: boolean }
    }
    Enums: {
      document_status: "Missing" | "Draft" | "Ready" | "Filed"
      shipment_status:
        | "Draft"
        | "Calculated"
        | "Filed"
        | "Port-Transit"
        | "Delivered"
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
    Enums: {
      document_status: ["Missing", "Draft", "Ready", "Filed"],
      shipment_status: [
        "Draft",
        "Calculated",
        "Filed",
        "Port-Transit",
        "Delivered",
      ],
    },
  },
} as const
