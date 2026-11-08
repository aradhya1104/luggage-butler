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
      admin_requests: {
        Row: {
          email: string
          full_name: string | null
          id: string
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          email: string
          full_name?: string | null
          id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          email?: string
          full_name?: string | null
          id?: string
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      booking_handovers: {
        Row: {
          attempts: number
          booking_id: string
          code: string
          expires_at: string
          generated_at: string
          locked_until: string | null
          partner_id: string
          stage: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          attempts?: number
          booking_id: string
          code: string
          expires_at: string
          generated_at?: string
          locked_until?: string | null
          partner_id: string
          stage: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          attempts?: number
          booking_id?: string
          code?: string
          expires_at?: string
          generated_at?: string
          locked_until?: string | null
          partner_id?: string
          stage?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_handovers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_handovers_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_status_logs: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          note: string | null
          status: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          note?: string | null
          status: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount: number
          assigned_partner_id: string | null
          created_at: string
          delivery_latitude: number | null
          delivery_location: string | null
          delivery_longitude: number | null
          delivery_time: string | null
          drop_off_date: string
          id: string
          idempotency_key: string | null
          number_of_bags: number
          pickup_date: string
          pickup_latitude: number | null
          pickup_location: string
          pickup_longitude: number | null
          pickup_time: string | null
          status: string
          tracking_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          assigned_partner_id?: string | null
          created_at?: string
          delivery_latitude?: number | null
          delivery_location?: string | null
          delivery_longitude?: number | null
          delivery_time?: string | null
          drop_off_date: string
          id?: string
          idempotency_key?: string | null
          number_of_bags?: number
          pickup_date: string
          pickup_latitude?: number | null
          pickup_location: string
          pickup_longitude?: number | null
          pickup_time?: string | null
          status?: string
          tracking_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          assigned_partner_id?: string | null
          created_at?: string
          delivery_latitude?: number | null
          delivery_location?: string | null
          delivery_longitude?: number | null
          delivery_time?: string | null
          drop_off_date?: string
          id?: string
          idempotency_key?: string | null
          number_of_bags?: number
          pickup_date?: string
          pickup_latitude?: number | null
          pickup_location?: string
          pickup_longitude?: number | null
          pickup_time?: string | null
          status?: string
          tracking_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_assigned_partner_id_fkey"
            columns: ["assigned_partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_partners: {
        Row: {
          account_status: string
          address: string | null
          availability_status: string
          completed_jobs: number
          created_at: string
          email: string | null
          full_name: string
          id: string
          joined_at: string
          mobile: string
          partner_code: string
          photo_path: string | null
          total_deliveries: number
          total_pickups: number
          updated_at: string
          user_id: string
          vehicle_number: string
          vehicle_type: string
          verification_status: string
        }
        Insert: {
          account_status?: string
          address?: string | null
          availability_status?: string
          completed_jobs?: number
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          joined_at?: string
          mobile: string
          partner_code: string
          photo_path?: string | null
          total_deliveries?: number
          total_pickups?: number
          updated_at?: string
          user_id: string
          vehicle_number: string
          vehicle_type: string
          verification_status?: string
        }
        Update: {
          account_status?: string
          address?: string | null
          availability_status?: string
          completed_jobs?: number
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          joined_at?: string
          mobile?: string
          partner_code?: string
          photo_path?: string | null
          total_deliveries?: number
          total_pickups?: number
          updated_at?: string
          user_id?: string
          vehicle_number?: string
          vehicle_type?: string
          verification_status?: string
        }
        Relationships: []
      }
      handover_audit: {
        Row: {
          actor_id: string | null
          booking_id: string
          created_at: string
          event: string
          id: string
          partner_id: string | null
          stage: string
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          created_at?: string
          event: string
          id?: string
          partner_id?: string | null
          stage: string
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          event?: string
          id?: string
          partner_id?: string | null
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "handover_audit_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      handover_notifications: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "handover_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      handover_settings: {
        Row: {
          expiry_seconds: number
          id: boolean
          lockout_seconds: number
          max_attempts: number
        }
        Insert: {
          expiry_seconds?: number
          id?: boolean
          lockout_seconds?: number
          max_attempts?: number
        }
        Update: {
          expiry_seconds?: number
          id?: boolean
          lockout_seconds?: number
          max_attempts?: number
        }
        Relationships: []
      }
      partner_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_path: string
          id: string
          partner_id: string
          review_status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_path: string
          id?: string
          partner_id: string
          review_status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_path?: string
          id?: string
          partner_id?: string
          review_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_documents_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          processed_at: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          processed_at?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          processed_at?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          id: string
          razorpay_order_id: string
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          id?: string
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          id?: string
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      booking_handover_action: {
        Args: {
          p_action: string
          p_booking_id: string
          p_code?: string
          p_stage: string
        }
        Returns: Json
      }
      get_booking_by_tracking_id: {
        Args: { p_tracking_id: string }
        Returns: {
          created_at: string
          drop_off_date: string
          number_of_bags: number
          pickup_date: string
          status: string
          tracking_id: string
        }[]
      }
      get_booking_handovers: { Args: { p_booking_id: string }; Returns: Json }
      get_booking_partner: {
        Args: { p_booking_id: string }
        Returns: {
          full_name: string
          mobile: string
          partner_code: string
          photo_path: string
          vehicle_number: string
          vehicle_type: string
        }[]
      }
      get_partner_job_customers: {
        Args: never
        Returns: {
          booking_id: string
          full_name: string
          phone: string
        }[]
      }
      get_user_emails: {
        Args: { _user_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      handover_notify: {
        Args: { p_booking: string; p_message: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user", "super_admin"],
    },
  },
} as const
