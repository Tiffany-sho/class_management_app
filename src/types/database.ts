
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
    PostgrestVersion: "14.15"
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
      absence_reports: {
        Row: {
          created_at: string
          created_by: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          reason: string | null
          schedule_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: string | null
          schedule_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: string | null
          schedule_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_reports_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_reports_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "employee_work_slots"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "absence_reports_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedule_capacity"
            referencedColumns: ["schedule_id"]
          },
          {
            foreignKeyName: "absence_reports_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_needing_course_change"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "absence_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_with_grade"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string
          body: string
          business_id: string | null
          created_at: string
          id: string
          scheduled_at: string | null
          sent_at: string | null
          target_role: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          business_id?: string | null
          created_at?: string
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          target_role?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          business_id?: string | null
          created_at?: string
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          target_role?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_slots: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          end_time: string
          id: string
          slot_no: number
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          end_time: string
          id?: string
          slot_no: number
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          end_time?: string
          id?: string
          slot_no?: number
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_slots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          active: boolean
          color_key: string
          created_at: string
          id: string
          name: string
          sort_order: number
          students_per_employee: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          color_key: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          students_per_employee?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          color_key?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          students_per_employee?: number
          updated_at?: string
        }
        Relationships: []
      }
      commute_allowances: {
        Row: {
          created_at: string
          daily_amount: number
          effective_from: string
          employee_id: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_amount: number
          effective_from: string
          employee_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_amount?: number
          effective_from?: string
          employee_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commute_allowances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          grade_label: string
          grade_max: number
          grade_min: number
          id: string
          is_default: boolean
          monthly_fee: number
          sessions_per_month: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          grade_label: string
          grade_max: number
          grade_min: number
          id?: string
          is_default?: boolean
          monthly_fee: number
          sessions_per_month: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          grade_label?: string
          grade_max?: number
          grade_min?: number
          id?: string
          is_default?: boolean
          monthly_fee?: number
          sessions_per_month?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      deadline_rules: {
        Row: {
          active: boolean
          created_at: string
          day_of_month: number
          id: string
          time_of_day: string
          type: Database["public"]["Enums"]["deadline_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          day_of_month: number
          id?: string
          time_of_day?: string
          type: Database["public"]["Enums"]["deadline_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          day_of_month?: number
          id?: string
          time_of_day?: string
          type?: Database["public"]["Enums"]["deadline_type"]
          updated_at?: string
        }
        Relationships: []
      }
      deadlines: {
        Row: {
          active: boolean
          created_at: string
          deadline_at: string
          id: string
          type: Database["public"]["Enums"]["deadline_type"]
          updated_at: string
          year_month: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deadline_at: string
          id?: string
          type: Database["public"]["Enums"]["deadline_type"]
          updated_at?: string
          year_month: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deadline_at?: string
          id?: string
          type?: Database["public"]["Enums"]["deadline_type"]
          updated_at?: string
          year_month?: string
        }
        Relationships: []
      }
      employee_businesses: {
        Row: {
          business_id: string
          created_at: string
          employee_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          employee_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          employee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_businesses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_businesses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      fees: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          paid_date: string | null
          status: Database["public"]["Enums"]["fee_status"]
          student_id: string
          updated_at: string
          year_month: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["fee_status"]
          student_id: string
          updated_at?: string
          year_month: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["fee_status"]
          student_id?: string
          updated_at?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_needing_course_change"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_with_grade"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          subject_id: string | null
          subject_table: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          subject_id?: string | null
          subject_table?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          subject_id?: string | null
          subject_table?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_requests: {
        Row: {
          business_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          description: string
          employee_id: string
          hours: number
          id: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          work_date: string
        }
        Insert: {
          business_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          description: string
          employee_id: string
          hours: number
          id?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          work_date: string
        }
        Update: {
          business_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          description?: string
          employee_id?: string
          hours?: number
          id?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payrolls: {
        Row: {
          base_amount: number
          commute: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          employee_id: string
          id: string
          overtime: number
          status: Database["public"]["Enums"]["payroll_status"]
          total: number
          updated_at: string
          work_days: number
          work_hours: number
          year_month: string
        }
        Insert: {
          base_amount?: number
          commute?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          employee_id: string
          id?: string
          overtime?: number
          status?: Database["public"]["Enums"]["payroll_status"]
          total?: number
          updated_at?: string
          work_days?: number
          work_hours?: number
          year_month: string
        }
        Update: {
          base_amount?: number
          commute?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          overtime?: number
          status?: Database["public"]["Enums"]["payroll_status"]
          total?: number
          updated_at?: string
          work_days?: number
          work_hours?: number
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "payrolls_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payrolls_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          created_at: string
          id: string
          session_date: string
          slot_no: number
          student_id: string
          updated_at: string
          year_month: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_date: string
          slot_no: number
          student_id: string
          updated_at?: string
          year_month: string
        }
        Update: {
          created_at?: string
          id?: string
          session_date?: string
          slot_no?: number
          student_id?: string
          updated_at?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preferences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_needing_course_change"
            referencedColumns: ["student_id"]
          },
          {
            foreignKeyName: "preferences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_with_grade"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          expo_push_token: string
          id: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expo_push_token: string
          id?: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expo_push_token?: string
          id?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_employees: {
        Row: {
          business_id: string
          created_at: string
          employee_id: string
          schedule_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          employee_id: string
          schedule_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          employee_id?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_employees_employee_fk"
            columns: ["employee_id", "business_id"]
            isOneToOne: false
            referencedRelation: "employee_businesses"
            referencedColumns: ["employee_id", "business_id"]
          },
          {
            foreignKeyName: "schedule_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_employees_schedule_fk"
            columns: ["schedule_id", "business_id"]
            isOneToOne: false
            referencedRelation: "employee_work_slots"
            referencedColumns: ["schedule_id", "business_id"]
          },
          {
            foreignKeyName: "schedule_employees_schedule_fk"
            columns: ["schedule_id", "business_id"]
            isOneToOne: false
            referencedRelation: "schedule_capacity"
            referencedColumns: ["schedule_id", "business_id"]
          },
          {
            foreignKeyName: "schedule_employees_schedule_fk"
            columns: ["schedule_id", "business_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      schedule_students: {
        Row: {
          attendance_status:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          business_id: string
          created_at: string
          marked_at: string | null
          marked_by: string | null
          note: string | null
          noted_at: string | null
          noted_by: string | null
          schedule_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          attendance_status?:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          business_id: string
          created_at?: string
          marked_at?: string | null
          marked_by?: string | null
          note?: string | null
          noted_at?: string | null
          noted_by?: string | null
          schedule_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          attendance_status?:
            | Database["public"]["Enums"]["attendance_status"]
            | null
          business_id?: string
          created_at?: string
          marked_at?: string | null
          marked_by?: string | null
          note?: string | null
          noted_at?: string | null
          noted_by?: string | null
          schedule_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_students_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_students_noted_by_fkey"
            columns: ["noted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_students_schedule_fk"
            columns: ["schedule_id", "business_id"]
            isOneToOne: false
            referencedRelation: "employee_work_slots"
            referencedColumns: ["schedule_id", "business_id"]
          },
          {
            foreignKeyName: "schedule_students_schedule_fk"
            columns: ["schedule_id", "business_id"]
            isOneToOne: false
            referencedRelation: "schedule_capacity"
            referencedColumns: ["schedule_id", "business_id"]
          },
          {
            foreignKeyName: "schedule_students_schedule_fk"
            columns: ["schedule_id", "business_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "schedule_students_student_fk"
            columns: ["student_id", "business_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "schedule_students_student_fk"
            columns: ["student_id", "business_id"]
            isOneToOne: false
            referencedRelation: "students_needing_course_change"
            referencedColumns: ["student_id", "business_id"]
          },
          {
            foreignKeyName: "schedule_students_student_fk"
            columns: ["student_id", "business_id"]
            isOneToOne: false
            referencedRelation: "students_with_grade"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      schedules: {
        Row: {
          business_id: string
          created_at: string
          id: string
          session_date: string
          slot_no: number
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          session_date: string
          slot_no: number
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          session_date?: string
          slot_no?: number
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          active: boolean
          business_id: string
          course_id: string
          created_at: string
          enrollment_year: number
          id: string
          name: string
          parent_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          course_id: string
          created_at?: string
          enrollment_year: number
          id?: string
          name: string
          parent_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          course_id?: string
          created_at?: string
          enrollment_year?: number
          id?: string
          name?: string
          parent_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_course_business_fk"
            columns: ["course_id", "business_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      wage_rates: {
        Row: {
          business_id: string
          created_at: string
          effective_from: string
          employee_id: string
          hourly_rate: number
          id: string
          job_label: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          effective_from: string
          employee_id: string
          hourly_rate: number
          id?: string
          job_label: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          effective_from?: string
          employee_id?: string
          hourly_rate?: number
          id?: string
          job_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wage_rates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wage_rates_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      work_preferences: {
        Row: {
          business_id: string
          created_at: string
          employee_id: string
          id: string
          session_date: string
          slot_no: number
          updated_at: string
          year_month: string
        }
        Insert: {
          business_id: string
          created_at?: string
          employee_id: string
          id?: string
          session_date: string
          slot_no: number
          updated_at?: string
          year_month: string
        }
        Update: {
          business_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          session_date?: string
          slot_no?: number
          updated_at?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_preferences_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_preferences_employee_business_fk"
            columns: ["employee_id", "business_id"]
            isOneToOne: false
            referencedRelation: "employee_businesses"
            referencedColumns: ["employee_id", "business_id"]
          },
          {
            foreignKeyName: "work_preferences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      employee_monthly_pay: {
        Row: {
          base_amount: number | null
          commute: number | null
          confirmed_at: string | null
          employee_id: string | null
          overtime: number | null
          slots: number | null
          status: Database["public"]["Enums"]["payroll_status"] | null
          total: number | null
          work_days: number | null
          work_hours: number | null
          year_month: string | null
        }
        Relationships: []
      }
      employee_work_slots: {
        Row: {
          amount: number | null
          business_id: string | null
          employee_id: string | null
          hourly_rate: number | null
          hours: number | null
          schedule_id: string | null
          session_date: string | null
          slot_no: number | null
          year_month: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_capacity: {
        Row: {
          business_id: string | null
          capacity: number | null
          employee_count: number | null
          is_over_capacity: boolean | null
          schedule_id: string | null
          session_date: string | null
          slot_no: number | null
          status: Database["public"]["Enums"]["schedule_status"] | null
          student_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      students_needing_course_change: {
        Row: {
          business_id: string | null
          current_course_id: string | null
          current_fee: number | null
          current_grade_label: string | null
          fee_diff: number | null
          grade: number | null
          name: string | null
          sessions_per_month: number | null
          student_id: string | null
          suggested_course_id: string | null
          suggested_fee: number | null
          suggested_grade_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      students_with_grade: {
        Row: {
          active: boolean | null
          business_id: string | null
          course_id: string | null
          enrollment_year: number | null
          grade: number | null
          grade_label: string | null
          grade_max: number | null
          grade_min: number | null
          id: string | null
          monthly_fee: number | null
          name: string | null
          parent_id: string | null
          sessions_per_month: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_course_business_fk"
            columns: ["course_id", "business_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      academic_year: { Args: { at: string }; Returns: number }
      auth_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      generate_deadlines: { Args: { p_year_month?: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_assigned_to_schedule: {
        Args: { p_schedule_id: string }
        Returns: boolean
      }
      is_parent_of: { Args: { p_student_id: string }; Returns: boolean }
      is_related_to_business: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      is_submission_open: {
        Args: {
          p_type: Database["public"]["Enums"]["deadline_type"]
          p_year_month: string
        }
        Returns: boolean
      }
      send_due_announcements: { Args: never; Returns: number }
      student_grade: {
        Args: { at: string; p_enrollment_year: number }
        Returns: number
      }
      teaches_student: { Args: { p_student_id: string }; Returns: boolean }
    }
    Enums: {
      attendance_status: "present" | "absent" | "late"
      deadline_type: "parent" | "employee"
      fee_status: "unpaid" | "paid"
      payroll_status: "draft" | "confirmed"
      request_status: "pending" | "approved" | "rejected"
      schedule_status: "draft" | "confirmed"
      user_role: "admin" | "parent" | "employee"
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
      attendance_status: ["present", "absent", "late"],
      deadline_type: ["parent", "employee"],
      fee_status: ["unpaid", "paid"],
      payroll_status: ["draft", "confirmed"],
      request_status: ["pending", "approved", "rejected"],
      schedule_status: ["draft", "confirmed"],
      user_role: ["admin", "parent", "employee"],
    },
  },
} as const
