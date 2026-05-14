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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      feedback: {
        Row: {
          created_at: string | null
          email: string | null
          feedback: string | null
          id: number
          interview_id: string | null
          satisfaction: number | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          feedback?: string | null
          id?: number
          interview_id?: string | null
          satisfaction?: number | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          feedback?: string | null
          id?: number
          interview_id?: string | null
          satisfaction?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interview"
            referencedColumns: ["id"]
          },
        ]
      }
      interview: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          insights: string[] | null
          interviewer_id: number | null
          is_active: boolean | null
          is_anonymous: boolean | null
          is_archived: boolean | null
          is_deleted: boolean
          logo_url: string | null
          name: string | null
          objective: string | null
          question_count: number | null
          questions: Json | null
          quotes: Json[] | null
          readable_slug: string | null
          respondents: string[] | null
          response_count: number | null
          theme_color: string | null
          time_duration: string | null
          updated_by: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id: string
          insights?: string[] | null
          interviewer_id?: number | null
          is_active?: boolean | null
          is_anonymous?: boolean | null
          is_archived?: boolean | null
          is_deleted?: boolean
          logo_url?: string | null
          name?: string | null
          objective?: string | null
          question_count?: number | null
          questions?: Json | null
          quotes?: Json[] | null
          readable_slug?: string | null
          respondents?: string[] | null
          response_count?: number | null
          theme_color?: string | null
          time_duration?: string | null
          updated_by?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          insights?: string[] | null
          interviewer_id?: number | null
          is_active?: boolean | null
          is_anonymous?: boolean | null
          is_archived?: boolean | null
          is_deleted?: boolean
          logo_url?: string | null
          name?: string | null
          objective?: string | null
          question_count?: number | null
          questions?: Json | null
          quotes?: Json[] | null
          readable_slug?: string | null
          respondents?: string[] | null
          response_count?: number | null
          theme_color?: string | null
          time_duration?: string | null
          updated_by?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "interviewer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_job: {
        Row: {
          dreamit_retry_count: number
          dreamit_synced: boolean
          interview_id: string
          job_id: number
          job_title: string | null
          pending_removal: boolean
        }
        Insert: {
          dreamit_retry_count?: number
          dreamit_synced?: boolean
          interview_id: string
          job_id: number
          job_title?: string | null
          pending_removal?: boolean
        }
        Update: {
          dreamit_retry_count?: number
          dreamit_synced?: boolean
          interview_id?: string
          job_id?: number
          job_title?: string | null
          pending_removal?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "interview_job_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interview"
            referencedColumns: ["id"]
          },
        ]
      }
      interviewer: {
        Row: {
          agent_id: string | null
          audio: string | null
          created_at: string | null
          description: string
          empathy: number
          exploration: number
          id: number
          image: string
          name: string
          rapport: number
          speed: number
        }
        Insert: {
          agent_id?: string | null
          audio?: string | null
          created_at?: string | null
          description: string
          empathy: number
          exploration: number
          id?: number
          image: string
          name: string
          rapport: number
          speed: number
        }
        Update: {
          agent_id?: string | null
          audio?: string | null
          created_at?: string | null
          description?: string
          empathy?: number
          exploration?: number
          id?: number
          image?: string
          name?: string
          rapport?: number
          speed?: number
        }
        Relationships: []
      }
      invitations: {
        Row: {
          application_id: string
          candidate_email: string
          candidate_name: string | null
          created_at: string
          expires_at: string
          id: string
          interview_id: string
          is_started: boolean
          is_submitted: boolean
          job_id: number | null
          updated_at: string
        }
        Insert: {
          application_id: string
          candidate_email: string
          candidate_name?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          interview_id: string
          is_started?: boolean
          is_submitted?: boolean
          job_id?: number | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          candidate_email?: string
          candidate_name?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          interview_id?: string
          is_started?: boolean
          is_submitted?: boolean
          job_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interview"
            referencedColumns: ["id"]
          },
        ]
      }
      response: {
        Row: {
          analytics: Json | null
          application_id: string | null
          call_id: string | null
          candidate_status: string | null
          created_at: string | null
          details: Json | null
          dreamit_notified: boolean | null
          duration: number | null
          email: string | null
          fullscreen_exit_count: number | null
          id: number
          interview_id: string | null
          is_analysed: boolean | null
          is_ended: boolean | null
          is_test_response: boolean | null
          is_viewed: boolean | null
          job_id: number | null
          multiple_faces_count: number | null
          name: string | null
          no_face_count: number | null
          proctoring_events: Json | null
          recording_url: string | null
          screen_recording_url: string | null
          tab_switch_count: number | null
        }
        Insert: {
          analytics?: Json | null
          application_id?: string | null
          call_id?: string | null
          candidate_status?: string | null
          created_at?: string | null
          details?: Json | null
          dreamit_notified?: boolean | null
          duration?: number | null
          email?: string | null
          fullscreen_exit_count?: number | null
          id?: number
          interview_id?: string | null
          is_analysed?: boolean | null
          is_ended?: boolean | null
          is_test_response?: boolean | null
          is_viewed?: boolean | null
          job_id?: number | null
          multiple_faces_count?: number | null
          name?: string | null
          no_face_count?: number | null
          proctoring_events?: Json | null
          recording_url?: string | null
          screen_recording_url?: string | null
          tab_switch_count?: number | null
        }
        Update: {
          analytics?: Json | null
          application_id?: string | null
          call_id?: string | null
          candidate_status?: string | null
          created_at?: string | null
          details?: Json | null
          dreamit_notified?: boolean | null
          duration?: number | null
          email?: string | null
          fullscreen_exit_count?: number | null
          id?: number
          interview_id?: string | null
          is_analysed?: boolean | null
          is_ended?: boolean | null
          is_test_response?: boolean | null
          is_viewed?: boolean | null
          job_id?: number | null
          multiple_faces_count?: number | null
          name?: string | null
          no_face_count?: number | null
          proctoring_events?: Json | null
          recording_url?: string | null
          screen_recording_url?: string | null
          tab_switch_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "response_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interview"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          bamboo_id: number | null
          created_at: string | null
          department: string
          email: string | null
          employee_photo: string | null
          employment_status: string
          id: string
          job_title: string | null
          name: string
          role: string
          updated_at: string | null
        }
        Insert: {
          bamboo_id?: number | null
          created_at?: string | null
          department?: string
          email?: string | null
          employee_photo?: string | null
          employment_status?: string
          id?: string
          job_title?: string | null
          name: string
          role?: string
          updated_at?: string | null
        }
        Update: {
          bamboo_id?: number | null
          created_at?: string | null
          department?: string
          email?: string | null
          employee_photo?: string | null
          employment_status?: string
          id?: string
          job_title?: string | null
          name?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
