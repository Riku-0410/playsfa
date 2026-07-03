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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          content: string
          created_at: string
          customer_id: string
          deal_id: string | null
          done: boolean
          id: string
          next_action: string | null
          next_action_date: string | null
          occurred_at: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          content: string
          created_at?: string
          customer_id: string
          deal_id?: string | null
          done?: boolean
          id?: string
          next_action?: string | null
          next_action_date?: string | null
          occurred_at?: string
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          content?: string
          created_at?: string
          customer_id?: string
          deal_id?: string | null
          done?: boolean
          id?: string
          next_action?: string | null
          next_action_date?: string | null
          occurred_at?: string
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          bank_account: string | null
          company_name: string | null
          id: number
          invoice_note: string | null
          invoice_registration_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          company_name?: string | null
          id?: number
          invoice_note?: string | null
          invoice_registration_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          company_name?: string | null
          id?: number
          invoice_note?: string | null
          invoice_registration_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contract_fees: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          description: string
          id: string
          recurring: boolean
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          description: string
          id?: string
          recurring?: boolean
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          description?: string
          id?: string
          recurring?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contract_fees_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          agreement_date: string
          amount_per_billing: number
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          billing_start_date: string
          churned_at: string | null
          created_at: string
          customer_id: string
          deal_id: string | null
          id: string
          note: string | null
          plan_name: string | null
          service: Database["public"]["Enums"]["service_tag"]
          status: Database["public"]["Enums"]["contract_status"]
          tax_rate: number
          term_months: number
          updated_at: string
        }
        Insert: {
          agreement_date: string
          amount_per_billing: number
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          billing_start_date: string
          churned_at?: string | null
          created_at?: string
          customer_id: string
          deal_id?: string | null
          id?: string
          note?: string | null
          plan_name?: string | null
          service: Database["public"]["Enums"]["service_tag"]
          status?: Database["public"]["Enums"]["contract_status"]
          tax_rate?: number
          term_months?: number
          updated_at?: string
        }
        Update: {
          agreement_date?: string
          amount_per_billing?: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          billing_start_date?: string
          churned_at?: string | null
          created_at?: string
          customer_id?: string
          deal_id?: string | null
          id?: string
          note?: string | null
          plan_name?: string | null
          service?: Database["public"]["Enums"]["service_tag"]
          status?: Database["public"]["Enums"]["contract_status"]
          tax_rate?: number
          term_months?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          billing_address: string | null
          billing_email: string | null
          billing_name: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          name_kana: string | null
          note: string | null
          org_type: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          billing_email?: string | null
          billing_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          name_kana?: string | null
          note?: string | null
          org_type?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          billing_email?: string | null
          billing_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          name_kana?: string | null
          note?: string | null
          org_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          amount_expected: number | null
          closed_at: string | null
          competitor: string | null
          competitor_expiry: string | null
          created_at: string
          customer_id: string
          expected_billing_start: string | null
          id: string
          lost_reason: string | null
          note: string | null
          service: Database["public"]["Enums"]["service_tag"]
          stage: Database["public"]["Enums"]["deal_stage"]
          title: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string
        }
        Insert: {
          amount_expected?: number | null
          closed_at?: string | null
          competitor?: string | null
          competitor_expiry?: string | null
          created_at?: string
          customer_id: string
          expected_billing_start?: string | null
          id?: string
          lost_reason?: string | null
          note?: string | null
          service: Database["public"]["Enums"]["service_tag"]
          stage?: Database["public"]["Enums"]["deal_stage"]
          title?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
        }
        Update: {
          amount_expected?: number | null
          closed_at?: string | null
          competitor?: string | null
          competitor_expiry?: string | null
          created_at?: string
          customer_id?: string
          expected_billing_start?: string | null
          id?: string
          lost_reason?: string | null
          note?: string | null
          service?: Database["public"]["Enums"]["service_tag"]
          stage?: Database["public"]["Enums"]["deal_stage"]
          title?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          sort_order: number
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          sort_order?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          contract_id: string
          created_at: string
          customer_id: string
          due_date: string
          id: string
          invoice_number: string | null
          issue_date: string
          note: string | null
          paid_at: string | null
          pdf_path: string | null
          period_end: string
          period_start: string
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          customer_id: string
          due_date: string
          id?: string
          invoice_number?: string | null
          issue_date: string
          note?: string | null
          paid_at?: string | null
          pdf_path?: string | null
          period_end: string
          period_start: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          total: number
          updated_at?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          customer_id?: string
          due_date?: string
          id?: string
          invoice_number?: string | null
          issue_date?: string
          note?: string | null
          paid_at?: string | null
          pdf_path?: string | null
          period_end?: string
          period_start?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          memo: string | null
          method: string
          paid_on: string
          payer_name: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          memo?: string | null
          method?: string
          paid_on: string
          payer_name?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          memo?: string | null
          method?: string
          paid_on?: string
          payer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      activity_type: "call" | "email" | "meeting" | "memo" | "task"
      billing_cycle: "semiannual" | "annual"
      contract_status: "pending" | "active" | "ended" | "churned"
      deal_stage:
        | "lead"
        | "contacted"
        | "trial"
        | "negotiation"
        | "won"
        | "lost"
      invoice_status:
        | "scheduled"
        | "issued"
        | "sent"
        | "paid"
        | "overdue"
        | "void"
      service_tag: "playcut" | "baskestats"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_type: ["call", "email", "meeting", "memo", "task"],
      billing_cycle: ["semiannual", "annual"],
      contract_status: ["pending", "active", "ended", "churned"],
      deal_stage: ["lead", "contacted", "trial", "negotiation", "won", "lost"],
      invoice_status: [
        "scheduled",
        "issued",
        "sent",
        "paid",
        "overdue",
        "void",
      ],
      service_tag: ["playcut", "baskestats"],
    },
  },
} as const
