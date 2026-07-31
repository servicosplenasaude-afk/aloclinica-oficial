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
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          consent_reference: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          consent_reference?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          consent_reference?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      activity_logs_archive: {
        Row: {
          action: string
          consent_reference: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          consent_reference?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          consent_reference?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      affiliate_profiles: {
        Row: {
          commission_percent: number | null
          created_at: string | null
          id: string
          is_approved: boolean | null
          pix_key: string | null
          user_id: string | null
        }
        Insert: {
          commission_percent?: number | null
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          pix_key?: string | null
          user_id?: string | null
        }
        Update: {
          commission_percent?: number | null
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          pix_key?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string | null
          id: string
          messages: Json | null
          role_context: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          messages?: Json | null
          role_context?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          messages?: Json | null
          role_context?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      aloc_exames: {
        Row: {
          clinic_id: string | null
          created_at: string
          doctor_id: string | null
          exam_type: string | null
          file_url: string | null
          id: string
          notes: string | null
          orthanc_study_id: string | null
          patient_id: string | null
          priority: string | null
          status: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string | null
          exam_type?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          orthanc_study_id?: string | null
          patient_id?: string | null
          priority?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string | null
          exam_type?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          orthanc_study_id?: string | null
          patient_id?: string | null
          priority?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aloc_exames_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinic_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aloc_exames_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aloc_exames_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aloc_exames_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "aloc_exames_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      aloc_laudos: {
        Row: {
          content: string | null
          created_at: string
          doctor_id: string | null
          exam_id: string | null
          html_content: string | null
          id: string
          laudista_id: string | null
          pdf_url: string | null
          priority: string | null
          signature_hash: string | null
          signed_at: string | null
          sla_deadline: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          doctor_id?: string | null
          exam_id?: string | null
          html_content?: string | null
          id?: string
          laudista_id?: string | null
          pdf_url?: string | null
          priority?: string | null
          signature_hash?: string | null
          signed_at?: string | null
          sla_deadline?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          doctor_id?: string | null
          exam_id?: string | null
          html_content?: string | null
          id?: string
          laudista_id?: string | null
          pdf_url?: string | null
          priority?: string | null
          signature_hash?: string | null
          signed_at?: string | null
          sla_deadline?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aloc_laudos_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aloc_laudos_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aloc_laudos_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "aloc_laudos_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aloc_laudos_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "aloc_exames"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          last_used_at: string | null
          owner_user_id: string | null
          prefix: string
          rate_limit_per_min: number
          revoked_at: string | null
          scopes: string[]
          secret_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          last_used_at?: string | null
          owner_user_id?: string | null
          prefix: string
          rate_limit_per_min?: number
          revoked_at?: string | null
          scopes?: string[]
          secret_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          last_used_at?: string | null
          owner_user_id?: string | null
          prefix?: string
          rate_limit_per_min?: number
          revoked_at?: string | null
          scopes?: string[]
          secret_hash?: string
        }
        Relationships: []
      }
      api_request_log: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          id: number
          ip: string | null
          status_code: number | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          id?: number
          ip?: string | null
          status_code?: number | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          id?: number
          ip?: string | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: []
      }
      appointment_notes: {
        Row: {
          appointment_id: string | null
          content: Json | null
          created_at: string | null
          id: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          content?: Json | null
          created_at?: string | null
          id?: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          content?: Json | null
          created_at?: string | null
          id?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      appointment_reminder_log: {
        Row: {
          appointment_id: string
          channel: string
          id: string
          sent_at: string
          window_label: string
        }
        Insert: {
          appointment_id: string
          channel?: string
          id?: string
          sent_at?: string
          window_label: string
        }
        Update: {
          appointment_id?: string
          channel?: string
          id?: string
          sent_at?: string
          window_label?: string
        }
        Relationships: []
      }
      appointment_reminders_sent: {
        Row: {
          appointment_id: string
          id: string
          reminder_type: string
          sent_at: string
        }
        Insert: {
          appointment_id: string
          id?: string
          reminder_type: string
          sent_at?: string
        }
        Update: {
          appointment_id?: string
          id?: string
          reminder_type?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_sent_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_waitlist: {
        Row: {
          created_at: string
          desired_date: string | null
          doctor_id: string | null
          id: string
          notes: string | null
          notified: boolean | null
          patient_id: string
          specialty_id: string | null
        }
        Insert: {
          created_at?: string
          desired_date?: string | null
          doctor_id?: string | null
          id?: string
          notes?: string | null
          notified?: boolean | null
          patient_id: string
          specialty_id?: string | null
        }
        Update: {
          created_at?: string
          desired_date?: string | null
          doctor_id?: string | null
          id?: string
          notes?: string | null
          notified?: boolean | null
          patient_id?: string
          specialty_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_waitlist_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_waitlist_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_waitlist_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "appointment_waitlist_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_waitlist_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          ai_clinical_summary: string | null
          ai_summary_generated_at: string | null
          appointment_type:
            | Database["public"]["Enums"]["appointment_type"]
            | null
          cancel_reason: string | null
          cancellation_reason: string | null
          cancelled_by: string | null
          clinic_id: string | null
          created_at: string
          doctor_id: string
          duration_minutes: number | null
          ended_at: string | null
          id: string
          jitsi_link: string | null
          jitsi_room_id: string | null
          lembrete_enviado: boolean | null
          notes: string | null
          original_appointment_id: string | null
          patient_id: string | null
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_id: string | null
          payment_status: string | null
          price: number | null
          price_at_booking: number | null
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          video_room_secret: string
          video_room_url: string | null
        }
        Insert: {
          ai_clinical_summary?: string | null
          ai_summary_generated_at?: string | null
          appointment_type?:
            | Database["public"]["Enums"]["appointment_type"]
            | null
          cancel_reason?: string | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          clinic_id?: string | null
          created_at?: string
          doctor_id: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          jitsi_link?: string | null
          jitsi_room_id?: string | null
          lembrete_enviado?: boolean | null
          notes?: string | null
          original_appointment_id?: string | null
          patient_id?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_id?: string | null
          payment_status?: string | null
          price?: number | null
          price_at_booking?: number | null
          scheduled_at: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          video_room_secret?: string
          video_room_url?: string | null
        }
        Update: {
          ai_clinical_summary?: string | null
          ai_summary_generated_at?: string | null
          appointment_type?:
            | Database["public"]["Enums"]["appointment_type"]
            | null
          cancel_reason?: string | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          clinic_id?: string | null
          created_at?: string
          doctor_id?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          jitsi_link?: string | null
          jitsi_room_id?: string | null
          lembrete_enviado?: boolean | null
          notes?: string | null
          original_appointment_id?: string | null
          patient_id?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_id?: string | null
          payment_status?: string | null
          price?: number | null
          price_at_booking?: number | null
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          video_room_secret?: string
          video_room_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinic_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_original_appointment_id_fkey"
            columns: ["original_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_slots: {
        Row: {
          created_at: string
          day_of_week: number
          doctor_id: string
          end_time: string
          id: string
          is_active: boolean | null
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          doctor_id: string
          end_time: string
          id?: string
          is_active?: boolean | null
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          doctor_id?: string
          end_time?: string
          id?: string
          is_active?: boolean | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_slots_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_slots_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "availability_slots_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      b2b_leads: {
        Row: {
          company_name: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          message: string | null
          phone: string | null
          status: string | null
        }
        Insert: {
          company_name: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          phone?: string | null
          status?: string | null
        }
        Update: {
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          phone?: string | null
          status?: string | null
        }
        Relationships: []
      }
      care_plans: {
        Row: {
          appointment_id: string | null
          created_at: string | null
          description: string | null
          doctor_id: string | null
          follow_up_date: string | null
          follow_up_notes: string | null
          id: string
          lifestyle: Json | null
          medications: Json | null
          objectives: Json | null
          patient_id: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string | null
          description?: string | null
          doctor_id?: string | null
          follow_up_date?: string | null
          follow_up_notes?: string | null
          id?: string
          lifestyle?: Json | null
          medications?: Json | null
          objectives?: Json | null
          patient_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string | null
          description?: string | null
          doctor_id?: string | null
          follow_up_date?: string | null
          follow_up_notes?: string | null
          id?: string
          lifestyle?: Json | null
          medications?: Json | null
          objectives?: Json | null
          patient_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      clinic_affiliations: {
        Row: {
          clinic_id: string
          created_at: string
          doctor_id: string
          id: string
          is_active: boolean | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          doctor_id: string
          id?: string
          is_active?: boolean | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          doctor_id?: string
          id?: string
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_affiliations_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinic_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_affiliations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_affiliations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_affiliations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "clinic_affiliations_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_profiles: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          id: string
          is_approved: boolean | null
          logo_url: string | null
          name: string | null
          phone: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean | null
          logo_url?: string | null
          name?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean | null
          logo_url?: string | null
          name?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clinical_anamnesis: {
        Row: {
          appointment_id: string | null
          blood_pressure_dia: number | null
          blood_pressure_sys: number | null
          chief_complaint: string | null
          cid_codes: string[] | null
          created_at: string | null
          diagnostic_hypothesis: string | null
          doctor_id: string | null
          family_history: string | null
          gender: string | null
          heart_rate: number | null
          height: number | null
          history_present_illness: string | null
          id: string
          lifestyle_habits: string | null
          past_medical_history: string | null
          patient_id: string | null
          physical_exam_notes: string | null
          respiratory_rate: number | null
          review_of_systems: string | null
          social_name: string | null
          spo2: number | null
          temperature: number | null
          treatment_plan: string | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          appointment_id?: string | null
          blood_pressure_dia?: number | null
          blood_pressure_sys?: number | null
          chief_complaint?: string | null
          cid_codes?: string[] | null
          created_at?: string | null
          diagnostic_hypothesis?: string | null
          doctor_id?: string | null
          family_history?: string | null
          gender?: string | null
          heart_rate?: number | null
          height?: number | null
          history_present_illness?: string | null
          id?: string
          lifestyle_habits?: string | null
          past_medical_history?: string | null
          patient_id?: string | null
          physical_exam_notes?: string | null
          respiratory_rate?: number | null
          review_of_systems?: string | null
          social_name?: string | null
          spo2?: number | null
          temperature?: number | null
          treatment_plan?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          appointment_id?: string | null
          blood_pressure_dia?: number | null
          blood_pressure_sys?: number | null
          chief_complaint?: string | null
          cid_codes?: string[] | null
          created_at?: string | null
          diagnostic_hypothesis?: string | null
          doctor_id?: string | null
          family_history?: string | null
          gender?: string | null
          heart_rate?: number | null
          height?: number | null
          history_present_illness?: string | null
          id?: string
          lifestyle_habits?: string | null
          past_medical_history?: string | null
          patient_id?: string | null
          physical_exam_notes?: string | null
          respiratory_rate?: number | null
          review_of_systems?: string | null
          social_name?: string | null
          spo2?: number | null
          temperature?: number | null
          treatment_plan?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      clinical_evolution_audit: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          created_at: string | null
          field_name: string | null
          id: string
          ip_address: string | null
          new_value: string | null
          old_value: string | null
          record_id: string | null
          record_table: string | null
          user_agent: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          field_name?: string | null
          id?: string
          ip_address?: string | null
          new_value?: string | null
          old_value?: string | null
          record_id?: string | null
          record_table?: string | null
          user_agent?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          field_name?: string | null
          id?: string
          ip_address?: string | null
          new_value?: string | null
          old_value?: string | null
          record_id?: string | null
          record_table?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      clinical_protocols: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      clinical_referrals: {
        Row: {
          appointment_id: string | null
          clinical_summary: string | null
          created_at: string
          doctor_id: string
          id: string
          patient_cpf: string | null
          patient_id: string | null
          patient_name: string
          pdf_url: string | null
          reason: string
          specialty: string
          status: string
          storage_path: string | null
          urgency: string
          verification_code: string | null
        }
        Insert: {
          appointment_id?: string | null
          clinical_summary?: string | null
          created_at?: string
          doctor_id: string
          id?: string
          patient_cpf?: string | null
          patient_id?: string | null
          patient_name: string
          pdf_url?: string | null
          reason: string
          specialty: string
          status?: string
          storage_path?: string | null
          urgency?: string
          verification_code?: string | null
        }
        Update: {
          appointment_id?: string | null
          clinical_summary?: string | null
          created_at?: string
          doctor_id?: string
          id?: string
          patient_cpf?: string | null
          patient_id?: string | null
          patient_name?: string
          pdf_url?: string | null
          reason?: string
          specialty?: string
          status?: string
          storage_path?: string | null
          urgency?: string
          verification_code?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: Json | null
          cnpj: string
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string | null
          id: string
          legal_name: string
          managed_by_user_id: string | null
          status: string | null
          trade_name: string | null
          updated_at: string | null
        }
        Insert: {
          address?: Json | null
          cnpj: string
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          legal_name: string
          managed_by_user_id?: string | null
          status?: string | null
          trade_name?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: Json | null
          cnpj?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          legal_name?: string
          managed_by_user_id?: string | null
          status?: string | null
          trade_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_card_orders: {
        Row: {
          asaas_subscription_id: string | null
          billing_cycle: string | null
          company_id: string
          created_at: string | null
          id: string
          next_billing_date: string | null
          num_seats: number
          pingo_card_plan_id: string
          price_per_seat: number
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          asaas_subscription_id?: string | null
          billing_cycle?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          next_billing_date?: string | null
          num_seats: number
          pingo_card_plan_id: string
          price_per_seat: number
          status?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          asaas_subscription_id?: string | null
          billing_cycle?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          next_billing_date?: string | null
          num_seats?: number
          pingo_card_plan_id?: string
          price_per_seat?: number
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_card_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_card_orders_pingo_card_plan_id_fkey"
            columns: ["pingo_card_plan_id"]
            isOneToOne: false
            referencedRelation: "pingo_card_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_logs: {
        Row: {
          accepted: boolean
          consent_type: string
          created_at: string
          document_url: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
          version: string
        }
        Insert: {
          accepted?: boolean
          consent_type: string
          created_at?: string
          document_url?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
          version?: string
        }
        Update: {
          accepted?: boolean
          consent_type?: string
          created_at?: string
          document_url?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
          version?: string
        }
        Relationships: []
      }
      consulta_contrato: {
        Row: {
          appointment_id: string
          beneficiario_id: string | null
          contrato_id: string
          created_at: string
          id: string
          patient_user_id: string
          valor_repassado: number | null
          voucher_id: string | null
        }
        Insert: {
          appointment_id: string
          beneficiario_id?: string | null
          contrato_id: string
          created_at?: string
          id?: string
          patient_user_id: string
          valor_repassado?: number | null
          voucher_id?: string | null
        }
        Update: {
          appointment_id?: string
          beneficiario_id?: string | null
          contrato_id?: string
          created_at?: string
          id?: string
          patient_user_id?: string
          valor_repassado?: number | null
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consulta_contrato_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "contrato_beneficiarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consulta_contrato_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consulta_contrato_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_consents: {
        Row: {
          accepted_at: string
          appointment_id: string | null
          body_sha256: string
          body_snapshot: string
          document_id: string
          document_version: number
          id: string
          ip: string | null
          kind: Database["public"]["Enums"]["legal_doc_kind"]
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          appointment_id?: string | null
          body_sha256: string
          body_snapshot: string
          document_id: string
          document_version: number
          id?: string
          ip?: string | null
          kind: Database["public"]["Enums"]["legal_doc_kind"]
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          appointment_id?: string | null
          body_sha256?: string
          body_snapshot?: string
          document_id?: string
          document_version?: number
          id?: string
          ip?: string | null
          kind?: Database["public"]["Enums"]["legal_doc_kind"]
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_consents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_consents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_notes: {
        Row: {
          appointment_id: string
          content: string | null
          created_at: string
          doctor_id: string
          id: string
          note_type: string | null
          patient_id: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          content?: string | null
          created_at?: string
          doctor_id: string
          id?: string
          note_type?: string | null
          patient_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          content?: string | null
          created_at?: string
          doctor_id?: string
          id?: string
          note_type?: string | null
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_notes_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_notes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_notes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_notes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "consultation_notes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_leads: {
        Row: {
          cnpj: string | null
          contact_email: string
          contact_name: string
          contact_phone: string | null
          contact_role: string | null
          contacted_at: string | null
          contacted_by: string | null
          created_at: string
          expected_beneficiaries: number | null
          id: string
          message: string | null
          org_name: string
          org_type: string
          status: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          contact_role?: string | null
          contacted_at?: string | null
          contacted_by?: string | null
          created_at?: string
          expected_beneficiaries?: number | null
          id?: string
          message?: string | null
          org_name: string
          org_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          contact_role?: string | null
          contacted_at?: string | null
          contacted_by?: string | null
          created_at?: string
          expected_beneficiaries?: number | null
          id?: string
          message?: string | null
          org_name?: string
          org_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_manager_invites: {
        Row: {
          contrato_id: string
          created_at: string
          created_by_user_id: string | null
          email: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          used_by_user_id: string | null
        }
        Insert: {
          contrato_id: string
          created_at?: string
          created_by_user_id?: string | null
          email: string
          expires_at?: string
          id?: string
          token: string
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Update: {
          contrato_id?: string
          created_at?: string
          created_by_user_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_manager_invites_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_beneficiarios: {
        Row: {
          ativo: boolean
          consultas_utilizadas: number
          contrato_id: string
          cpf: string | null
          created_at: string
          departamento_id: string | null
          email: string | null
          id: string
          limite_individual: number | null
          nome: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          consultas_utilizadas?: number
          contrato_id: string
          cpf?: string | null
          created_at?: string
          departamento_id?: string | null
          email?: string | null
          id?: string
          limite_individual?: number | null
          nome?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          consultas_utilizadas?: number
          contrato_id?: string
          cpf?: string | null
          created_at?: string
          departamento_id?: string | null
          email?: string | null
          id?: string
          limite_individual?: number | null
          nome?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contrato_beneficiarios_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_beneficiarios_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "contrato_departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_departamentos: {
        Row: {
          ativo: boolean
          contrato_id: string
          cota_total: number | null
          cota_utilizada: number
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          contrato_id: string
          cota_total?: number | null
          cota_utilizada?: number
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          contrato_id?: string
          cota_total?: number | null
          cota_utilizada?: number
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_departamentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_documentos: {
        Row: {
          contrato_id: string
          created_at: string
          id: string
          nome: string
          storage_path: string
          tamanho_bytes: number | null
          tipo: string
          uploaded_by: string | null
        }
        Insert: {
          contrato_id: string
          created_at?: string
          id?: string
          nome: string
          storage_path: string
          tamanho_bytes?: number | null
          tipo: string
          uploaded_by?: string | null
        }
        Update: {
          contrato_id?: string
          created_at?: string
          id?: string
          nome?: string
          storage_path?: string
          tamanho_bytes?: number | null
          tipo?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contrato_documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          branding: Json | null
          cnpj: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          cota_total: number | null
          cota_utilizada: number
          created_at: string
          dominio_proprio: string | null
          especialidades_permitidas: string[] | null
          id: string
          modalidade_licitacao: string | null
          modelo_cobranca: Database["public"]["Enums"]["contrato_cobranca"]
          nome: string
          numero_empenho: string | null
          numero_processo: string | null
          observacoes: string | null
          status: Database["public"]["Enums"]["contrato_status"]
          subdominio: string | null
          tipo: Database["public"]["Enums"]["contrato_tipo"]
          updated_at: string
          valor_consulta: number | null
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          branding?: Json | null
          cnpj?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          cota_total?: number | null
          cota_utilizada?: number
          created_at?: string
          dominio_proprio?: string | null
          especialidades_permitidas?: string[] | null
          id?: string
          modalidade_licitacao?: string | null
          modelo_cobranca?: Database["public"]["Enums"]["contrato_cobranca"]
          nome: string
          numero_empenho?: string | null
          numero_processo?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["contrato_status"]
          subdominio?: string | null
          tipo: Database["public"]["Enums"]["contrato_tipo"]
          updated_at?: string
          valor_consulta?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Update: {
          branding?: Json | null
          cnpj?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          cota_total?: number | null
          cota_utilizada?: number
          created_at?: string
          dominio_proprio?: string | null
          especialidades_permitidas?: string[] | null
          id?: string
          modalidade_licitacao?: string | null
          modelo_cobranca?: Database["public"]["Enums"]["contrato_cobranca"]
          nome?: string
          numero_empenho?: string | null
          numero_processo?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["contrato_status"]
          subdominio?: string | null
          tipo?: Database["public"]["Enums"]["contrato_tipo"]
          updated_at?: string
          valor_consulta?: number | null
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: []
      }
      coupon_usages: {
        Row: {
          coupon_code: string
          created_at: string
          id: string
          reference_id: string
          user_id: string | null
        }
        Insert: {
          coupon_code: string
          created_at?: string
          id?: string
          reference_id: string
          user_id?: string | null
        }
        Update: {
          coupon_code?: string
          created_at?: string
          id?: string
          reference_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          current_uses: number | null
          discount_type: string | null
          discount_value: number
          id: string
          is_active: boolean | null
          max_uses: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number | null
          discount_type?: string | null
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number | null
          discount_type?: string | null
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      dependents: {
        Row: {
          cpf: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string
          guardian_id: string
          id: string
          last_name: string | null
          relationship: string | null
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name: string
          guardian_id: string
          id?: string
          last_name?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string
          guardian_id?: string
          id?: string
          last_name?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      digital_signatures: {
        Row: {
          certificate_alias: string | null
          created_at: string | null
          doctor_cpf: string | null
          doctor_crm: string | null
          doctor_name: string | null
          document_hash: string | null
          document_type: string | null
          id: string
          is_valid: boolean | null
          patient_name: string | null
          provider: string | null
          public_url: string | null
          related_record_id: string | null
          signature_data: string | null
          storage_path: string | null
          user_id: string | null
          verification_code: string | null
        }
        Insert: {
          certificate_alias?: string | null
          created_at?: string | null
          doctor_cpf?: string | null
          doctor_crm?: string | null
          doctor_name?: string | null
          document_hash?: string | null
          document_type?: string | null
          id?: string
          is_valid?: boolean | null
          patient_name?: string | null
          provider?: string | null
          public_url?: string | null
          related_record_id?: string | null
          signature_data?: string | null
          storage_path?: string | null
          user_id?: string | null
          verification_code?: string | null
        }
        Update: {
          certificate_alias?: string | null
          created_at?: string | null
          doctor_cpf?: string | null
          doctor_crm?: string | null
          doctor_name?: string | null
          document_hash?: string | null
          document_type?: string | null
          id?: string
          is_valid?: boolean | null
          patient_name?: string | null
          provider?: string | null
          public_url?: string | null
          related_record_id?: string | null
          signature_data?: string | null
          storage_path?: string | null
          user_id?: string | null
          verification_code?: string | null
        }
        Relationships: []
      }
      discount_cards: {
        Row: {
          created_at: string | null
          id: string
          status: string | null
          user_id: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          status?: string | null
          user_id?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          status?: string | null
          user_id?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      doctor_absences: {
        Row: {
          created_at: string
          doctor_id: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_absences_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_absences_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_absences_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "doctor_absences_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_applications: {
        Row: {
          admin_notes: string | null
          bio: string | null
          created_at: string | null
          crm: string | null
          crm_state: string | null
          email: string | null
          full_name: string | null
          id: string
          invite_code_id: string | null
          phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          specialty: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          bio?: string | null
          created_at?: string | null
          crm?: string | null
          crm_state?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          invite_code_id?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          specialty?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          bio?: string | null
          created_at?: string | null
          crm?: string | null
          crm_state?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          invite_code_id?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          specialty?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      doctor_availability: {
        Row: {
          created_at: string | null
          day_of_week: number | null
          doctor_id: string | null
          end_time: string | null
          id: string
          start_time: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week?: number | null
          doctor_id?: string | null
          end_time?: string | null
          id?: string
          start_time?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number | null
          doctor_id?: string | null
          end_time?: string | null
          id?: string
          start_time?: string | null
        }
        Relationships: []
      }
      doctor_care_areas: {
        Row: {
          area_name: string
          created_at: string
          doctor_id: string
          id: string
        }
        Insert: {
          area_name: string
          created_at?: string
          doctor_id: string
          id?: string
        }
        Update: {
          area_name?: string
          created_at?: string
          doctor_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_care_areas_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_care_areas_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_care_areas_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "doctor_care_areas_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_invite_codes: {
        Row: {
          code: string
          created_at: string
          current_uses: number | null
          doctor_id: string
          id: string
          is_active: boolean | null
          max_uses: number | null
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number | null
          doctor_id: string
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number | null
          doctor_id?: string
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_invite_codes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_invite_codes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_invite_codes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "doctor_invite_codes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_payouts: {
        Row: {
          appointment_id: string | null
          created_at: string
          doctor_id: string
          gross_amount: number
          id: string
          net_amount: number
          notes: string | null
          paid_at: string | null
          pix_key: string | null
          pix_tx_id: string | null
          platform_fee: number
          release_at: string
          status: string
          updated_at: string
          withdrawal_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          doctor_id: string
          gross_amount: number
          id?: string
          net_amount: number
          notes?: string | null
          paid_at?: string | null
          pix_key?: string | null
          pix_tx_id?: string | null
          platform_fee?: number
          release_at: string
          status?: string
          updated_at?: string
          withdrawal_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          doctor_id?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          pix_key?: string | null
          pix_tx_id?: string | null
          platform_fee?: number
          release_at?: string
          status?: string
          updated_at?: string
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_payouts_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_payouts_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_payouts_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_payouts_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "doctor_payouts_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_profiles: {
        Row: {
          areas_of_expertise: string[] | null
          auto_pause_reason: string | null
          auto_paused_at: string | null
          bio: string | null
          consultation_duration: number | null
          council_number: string | null
          council_state: string | null
          council_type: Database["public"]["Enums"]["council_type"] | null
          created_at: string
          crm: string | null
          crm_state: string | null
          crm_verified: boolean | null
          crm_verified_at: string | null
          crm_verified_by: string | null
          display_name: string | null
          doctor_type: string
          documents: Json
          ical_token: string | null
          id: string
          is_active: boolean | null
          is_approved: boolean | null
          is_on_duty: boolean | null
          kyc_face_match_score: number | null
          kyc_status: string | null
          kyc_verified_at: string | null
          mp_access_token: string | null
          mp_connected_at: string | null
          mp_refresh_token: string | null
          mp_token_expires_at: string | null
          mp_user_id: string | null
          payout_frequency: string | null
          pix_key: string | null
          price: number | null
          price_suggestion_sent_at: string | null
          professional_address: string | null
          professional_photo_url: string | null
          rating_avg: number | null
          rating_count: number | null
          return_price: number | null
          risk_score: number | null
          risk_score_updated_at: string | null
          slug: string | null
          social_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          areas_of_expertise?: string[] | null
          auto_pause_reason?: string | null
          auto_paused_at?: string | null
          bio?: string | null
          consultation_duration?: number | null
          council_number?: string | null
          council_state?: string | null
          council_type?: Database["public"]["Enums"]["council_type"] | null
          created_at?: string
          crm?: string | null
          crm_state?: string | null
          crm_verified?: boolean | null
          crm_verified_at?: string | null
          crm_verified_by?: string | null
          display_name?: string | null
          doctor_type?: string
          documents?: Json
          ical_token?: string | null
          id?: string
          is_active?: boolean | null
          is_approved?: boolean | null
          is_on_duty?: boolean | null
          kyc_face_match_score?: number | null
          kyc_status?: string | null
          kyc_verified_at?: string | null
          mp_access_token?: string | null
          mp_connected_at?: string | null
          mp_refresh_token?: string | null
          mp_token_expires_at?: string | null
          mp_user_id?: string | null
          payout_frequency?: string | null
          pix_key?: string | null
          price?: number | null
          price_suggestion_sent_at?: string | null
          professional_address?: string | null
          professional_photo_url?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          return_price?: number | null
          risk_score?: number | null
          risk_score_updated_at?: string | null
          slug?: string | null
          social_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          areas_of_expertise?: string[] | null
          auto_pause_reason?: string | null
          auto_paused_at?: string | null
          bio?: string | null
          consultation_duration?: number | null
          council_number?: string | null
          council_state?: string | null
          council_type?: Database["public"]["Enums"]["council_type"] | null
          created_at?: string
          crm?: string | null
          crm_state?: string | null
          crm_verified?: boolean | null
          crm_verified_at?: string | null
          crm_verified_by?: string | null
          display_name?: string | null
          doctor_type?: string
          documents?: Json
          ical_token?: string | null
          id?: string
          is_active?: boolean | null
          is_approved?: boolean | null
          is_on_duty?: boolean | null
          kyc_face_match_score?: number | null
          kyc_status?: string | null
          kyc_verified_at?: string | null
          mp_access_token?: string | null
          mp_connected_at?: string | null
          mp_refresh_token?: string | null
          mp_token_expires_at?: string | null
          mp_user_id?: string | null
          payout_frequency?: string | null
          pix_key?: string | null
          price?: number | null
          price_suggestion_sent_at?: string | null
          professional_address?: string | null
          professional_photo_url?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          return_price?: number | null
          risk_score?: number | null
          risk_score_updated_at?: string | null
          slug?: string | null
          social_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      doctor_signup_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string
          id: string
          notes: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          notes?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          notes?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      doctor_specialties: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          specialty_id: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          specialty_id: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          specialty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_specialties_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_specialties_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_specialties_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "doctor_specialties_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_specialties_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_text_templates: {
        Row: {
          body: string
          created_at: string
          doctor_user_id: string
          id: string
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          doctor_user_id: string
          id?: string
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          doctor_user_id?: string
          id?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      document_verifications: {
        Row: {
          created_at: string
          details: Json | null
          doctor_crm: string | null
          doctor_name: string | null
          document_hash: string
          document_type: string | null
          id: string
          is_valid: boolean | null
          patient_cpf: string | null
          patient_name: string | null
          signer_id: string | null
          verification_code: string | null
          verification_method: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          doctor_crm?: string | null
          doctor_name?: string | null
          document_hash: string
          document_type?: string | null
          id?: string
          is_valid?: boolean | null
          patient_cpf?: string | null
          patient_name?: string | null
          signer_id?: string | null
          verification_code?: string | null
          verification_method?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          doctor_crm?: string | null
          doctor_name?: string | null
          document_hash?: string
          document_type?: string | null
          id?: string
          is_valid?: boolean | null
          patient_cpf?: string | null
          patient_name?: string | null
          signer_id?: string | null
          verification_code?: string | null
          verification_method?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      employee_invites: {
        Row: {
          accepted_at: string | null
          company_card_order_id: string
          created_at: string | null
          employee_cpf: string | null
          employee_email: string
          employee_name: string | null
          expires_at: string | null
          id: string
          invite_token: string
          pingo_card_subscription_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          company_card_order_id: string
          created_at?: string | null
          employee_cpf?: string | null
          employee_email: string
          employee_name?: string | null
          expires_at?: string | null
          id?: string
          invite_token: string
          pingo_card_subscription_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          company_card_order_id?: string
          created_at?: string | null
          employee_cpf?: string | null
          employee_email?: string
          employee_name?: string | null
          expires_at?: string | null
          id?: string
          invite_token?: string
          pingo_card_subscription_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_invites_company_card_order_id_fkey"
            columns: ["company_card_order_id"]
            isOneToOne: false
            referencedRelation: "company_card_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_invites_pingo_card_subscription_id_fkey"
            columns: ["pingo_card_subscription_id"]
            isOneToOne: false
            referencedRelation: "pingo_card_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_labs: {
        Row: {
          city: string | null
          cnpj: string | null
          contact_email: string | null
          created_at: string
          description: string | null
          exam_types: string[]
          id: string
          is_active: boolean
          name: string
          phone: string | null
          state: string | null
        }
        Insert: {
          city?: string | null
          cnpj?: string | null
          contact_email?: string | null
          created_at?: string
          description?: string | null
          exam_types?: string[]
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          state?: string | null
        }
        Update: {
          city?: string | null
          cnpj?: string | null
          contact_email?: string | null
          created_at?: string
          description?: string | null
          exam_types?: string[]
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          state?: string | null
        }
        Relationships: []
      }
      exam_orders: {
        Row: {
          created_at: string
          exam_request_id: string | null
          id: string
          lab_id: string
          notes: string | null
          patient_id: string
          preferred_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_request_id?: string | null
          id?: string
          lab_id: string
          notes?: string | null
          patient_id: string
          preferred_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_request_id?: string | null
          id?: string
          lab_id?: string
          notes?: string | null
          patient_id?: string
          preferred_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_orders_exam_request_id_fkey"
            columns: ["exam_request_id"]
            isOneToOne: false
            referencedRelation: "exam_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_orders_lab_id_fkey"
            columns: ["lab_id"]
            isOneToOne: false
            referencedRelation: "exam_labs"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_reports: {
        Row: {
          created_at: string
          doctor_id: string | null
          exam_id: string | null
          id: string
          report_content: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          doctor_id?: string | null
          exam_id?: string | null
          id?: string
          report_content?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string | null
          exam_id?: string | null
          id?: string
          report_content?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_reports_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_reports_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_reports_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "exam_reports_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_reports_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "aloc_exames"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_requests: {
        Row: {
          appointment_id: string | null
          clinical_indication: string | null
          completed_at: string | null
          created_at: string
          doctor_id: string
          exam_types: string[] | null
          id: string
          notes: string | null
          orthanc_study_uid: string | null
          patient_id: string
          sla_deadline: string | null
          sla_hours: number | null
          source: string | null
          specialty_required: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          appointment_id?: string | null
          clinical_indication?: string | null
          completed_at?: string | null
          created_at?: string
          doctor_id: string
          exam_types?: string[] | null
          id?: string
          notes?: string | null
          orthanc_study_uid?: string | null
          patient_id: string
          sla_deadline?: string | null
          sla_hours?: number | null
          source?: string | null
          specialty_required?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          appointment_id?: string | null
          clinical_indication?: string | null
          completed_at?: string | null
          created_at?: string
          doctor_id?: string
          exam_types?: string[] | null
          id?: string
          notes?: string | null
          orthanc_study_uid?: string | null
          patient_id?: string
          sla_deadline?: string | null
          sla_hours?: number | null
          source?: string | null
          specialty_required?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "exam_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      exames: {
        Row: {
          arquivo_url: string | null
          assinado_em: string | null
          clinica_id: string | null
          created_at: string
          id: string
          laudista_id: string | null
          laudo_texto: string | null
          lembrete_enviado: boolean | null
          observacoes: string | null
          origem: string
          orthanc_study_uid: string | null
          paciente_id: string | null
          paciente_nome: string
          pdf_url: string | null
          status: string
          study_uid: string | null
          tipo_exame: string
          updated_at: string
        }
        Insert: {
          arquivo_url?: string | null
          assinado_em?: string | null
          clinica_id?: string | null
          created_at?: string
          id?: string
          laudista_id?: string | null
          laudo_texto?: string | null
          lembrete_enviado?: boolean | null
          observacoes?: string | null
          origem?: string
          orthanc_study_uid?: string | null
          paciente_id?: string | null
          paciente_nome: string
          pdf_url?: string | null
          status?: string
          study_uid?: string | null
          tipo_exame?: string
          updated_at?: string
        }
        Update: {
          arquivo_url?: string | null
          assinado_em?: string | null
          clinica_id?: string | null
          created_at?: string
          id?: string
          laudista_id?: string | null
          laudo_texto?: string | null
          lembrete_enviado?: boolean | null
          observacoes?: string | null
          origem?: string
          orthanc_study_uid?: string | null
          paciente_id?: string | null
          paciente_nome?: string
          pdf_url?: string | null
          status?: string
          study_uid?: string | null
          tipo_exame?: string
          updated_at?: string
        }
        Relationships: []
      }
      failed_login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      family_members: {
        Row: {
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          holder_user_id: string
          id: string
          phone: string | null
          relationship: string | null
          user_id: string | null
        }
        Insert: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          holder_user_id: string
          id?: string
          phone?: string | null
          relationship?: string | null
          user_id?: string | null
        }
        Update: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          holder_user_id?: string
          id?: string
          phone?: string | null
          relationship?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      faq_items: {
        Row: {
          answer: string
          category: string | null
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          order_index: number | null
          question: string
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          question: string
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          question?: string
        }
        Relationships: []
      }
      favorite_doctors: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          patient_id: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          patient_id: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_doctors_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_doctors_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_doctors_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "favorite_doctors_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      funeral_assistance_requests: {
        Row: {
          assigned_provider_id: string | null
          city: string
          contact_phone: string
          coverage_amount: number | null
          created_at: string | null
          death_certificate_url: string | null
          death_date: string
          deceased_cpf: string | null
          deceased_name: string
          id: string
          notes: string | null
          preferred_provider_id: string | null
          rejection_reason: string | null
          relationship: string
          state: string
          status: string | null
          subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_provider_id?: string | null
          city: string
          contact_phone: string
          coverage_amount?: number | null
          created_at?: string | null
          death_certificate_url?: string | null
          death_date: string
          deceased_cpf?: string | null
          deceased_name: string
          id?: string
          notes?: string | null
          preferred_provider_id?: string | null
          rejection_reason?: string | null
          relationship: string
          state: string
          status?: string | null
          subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_provider_id?: string | null
          city?: string
          contact_phone?: string
          coverage_amount?: number | null
          created_at?: string | null
          death_certificate_url?: string | null
          death_date?: string
          deceased_cpf?: string | null
          deceased_name?: string
          id?: string
          notes?: string | null
          preferred_provider_id?: string | null
          rejection_reason?: string | null
          relationship?: string
          state?: string
          status?: string | null
          subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funeral_assistance_requests_assigned_provider_id_fkey"
            columns: ["assigned_provider_id"]
            isOneToOne: false
            referencedRelation: "funeral_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funeral_assistance_requests_preferred_provider_id_fkey"
            columns: ["preferred_provider_id"]
            isOneToOne: false
            referencedRelation: "funeral_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funeral_assistance_requests_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "pingo_card_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      funeral_providers: {
        Row: {
          cnpj: string | null
          contact_email: string | null
          contact_phone: string | null
          coverage_areas: string[] | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          cnpj?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          coverage_areas?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          cnpj?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          coverage_areas?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      guest_patients: {
        Row: {
          cpf: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      health_cards: {
        Row: {
          allergies: string[] | null
          blood_type: string | null
          card_number: string | null
          chronic_conditions: string[] | null
          created_at: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          health_plan_name: string | null
          health_plan_number: string | null
          health_plan_valid_until: string | null
          id: string
          notes: string | null
          organ_donor: boolean | null
          qr_token: string | null
          sus_card_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          allergies?: string[] | null
          blood_type?: string | null
          card_number?: string | null
          chronic_conditions?: string[] | null
          created_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          health_plan_name?: string | null
          health_plan_number?: string | null
          health_plan_valid_until?: string | null
          id?: string
          notes?: string | null
          organ_donor?: boolean | null
          qr_token?: string | null
          sus_card_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          allergies?: string[] | null
          blood_type?: string | null
          card_number?: string | null
          chronic_conditions?: string[] | null
          created_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          health_plan_name?: string | null
          health_plan_number?: string | null
          health_plan_valid_until?: string | null
          id?: string
          notes?: string | null
          organ_donor?: boolean | null
          qr_token?: string | null
          sus_card_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      health_metrics: {
        Row: {
          created_at: string
          id: string
          measured_at: string | null
          metric_type: string
          notes: string | null
          patient_id: string
          unit: string | null
          value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          measured_at?: string | null
          metric_type: string
          notes?: string | null
          patient_id: string
          unit?: string | null
          value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          measured_at?: string | null
          metric_type?: string
          notes?: string | null
          patient_id?: string
          unit?: string | null
          value?: number | null
        }
        Relationships: []
      }
      health_tips: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      kyc_sessions: {
        Row: {
          created_at: string
          device_info: Json | null
          expires_at: string
          failure_reason: string | null
          id: string
          match_score: number | null
          role: string
          status: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          expires_at?: string
          failure_reason?: string | null
          id?: string
          match_score?: number | null
          role?: string
          status?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          expires_at?: string
          failure_reason?: string | null
          id?: string
          match_score?: number | null
          role?: string
          status?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kyc_verificacoes: {
        Row: {
          created_at: string
          document_type: string | null
          error_message: string | null
          id: string
          mismatch_reasons: Json | null
          similarity: number | null
          status: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type?: string | null
          error_message?: string | null
          id?: string
          mismatch_reasons?: Json | null
          similarity?: number | null
          status?: string
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string | null
          error_message?: string | null
          id?: string
          mismatch_reasons?: Json | null
          similarity?: number | null
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          body_md: string
          created_at: string
          created_by: string | null
          effective_at: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["legal_doc_kind"]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          body_md: string
          created_at?: string
          created_by?: string | null
          effective_at?: string
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["legal_doc_kind"]
          title: string
          updated_at?: string
          version: number
        }
        Update: {
          body_md?: string
          created_at?: string
          created_by?: string | null
          effective_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["legal_doc_kind"]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      lgpd_access_log: {
        Row: {
          accessor_id: string | null
          accessor_role: string | null
          action: string | null
          created_at: string | null
          data_owner_id: string | null
          id: string
          resource: string | null
        }
        Insert: {
          accessor_id?: string | null
          accessor_role?: string | null
          action?: string | null
          created_at?: string | null
          data_owner_id?: string | null
          id?: string
          resource?: string | null
        }
        Update: {
          accessor_id?: string | null
          accessor_role?: string | null
          action?: string | null
          created_at?: string | null
          data_owner_id?: string | null
          id?: string
          resource?: string | null
        }
        Relationships: []
      }
      lgpd_deletion_requests: {
        Row: {
          created_at: string | null
          id: string
          reason: string | null
          requested_at: string | null
          scheduled_deletion_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason?: string | null
          requested_at?: string | null
          scheduled_deletion_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string | null
          requested_at?: string | null
          scheduled_deletion_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      lgpd_export_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          download_url: string | null
          error: string | null
          expires_at: string | null
          id: string
          requested_by: string | null
          size_bytes: number | null
          status: string
          tables_exported: Json | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          download_url?: string | null
          error?: string | null
          expires_at?: string | null
          id?: string
          requested_by?: string | null
          size_bytes?: number | null
          status?: string
          tables_exported?: Json | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          download_url?: string | null
          error?: string | null
          expires_at?: string | null
          id?: string
          requested_by?: string | null
          size_bytes?: number | null
          status?: string
          tables_exported?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      medical_certificates: {
        Row: {
          appointment_id: string | null
          cid: string | null
          created_at: string
          days: number | null
          doctor_crm: string
          doctor_id: string
          doctor_name: string
          document_hash: string | null
          id: string
          issued_at: string
          patient_cpf: string | null
          patient_id: string | null
          patient_name: string
          pdf_url: string | null
          reason: string | null
          storage_path: string | null
          type: string
          verification_code: string
        }
        Insert: {
          appointment_id?: string | null
          cid?: string | null
          created_at?: string
          days?: number | null
          doctor_crm: string
          doctor_id: string
          doctor_name: string
          document_hash?: string | null
          id?: string
          issued_at?: string
          patient_cpf?: string | null
          patient_id?: string | null
          patient_name: string
          pdf_url?: string | null
          reason?: string | null
          storage_path?: string | null
          type: string
          verification_code: string
        }
        Update: {
          appointment_id?: string | null
          cid?: string | null
          created_at?: string
          days?: number | null
          doctor_crm?: string
          doctor_id?: string
          doctor_name?: string
          document_hash?: string | null
          id?: string
          issued_at?: string
          patient_cpf?: string | null
          patient_id?: string | null
          patient_name?: string
          pdf_url?: string | null
          reason?: string | null
          storage_path?: string | null
          type?: string
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_certificates_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_record_access_logs: {
        Row: {
          access_type: string | null
          accessed_by: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          patient_id: string | null
          record_id: string | null
          user_agent: string | null
        }
        Insert: {
          access_type?: string | null
          accessed_by?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          patient_id?: string | null
          record_id?: string | null
          user_agent?: string | null
        }
        Update: {
          access_type?: string | null
          accessed_by?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          patient_id?: string | null
          record_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      medical_records: {
        Row: {
          addendums: Json | null
          appointment_id: string | null
          assessment: string | null
          chief_complaint: string | null
          created_at: string
          doctor_id: string | null
          history_present_illness: string | null
          icd_codes: string[] | null
          id: string
          is_draft: boolean | null
          locked_at: string | null
          patient_id: string
          physical_exam: string | null
          plan: string | null
          record_type: string | null
          retention_until: string | null
          soap_assessment: string | null
          soap_objective: string | null
          soap_plan: string | null
          soap_subjective: string | null
          updated_at: string
          vitals: Json | null
        }
        Insert: {
          addendums?: Json | null
          appointment_id?: string | null
          assessment?: string | null
          chief_complaint?: string | null
          created_at?: string
          doctor_id?: string | null
          history_present_illness?: string | null
          icd_codes?: string[] | null
          id?: string
          is_draft?: boolean | null
          locked_at?: string | null
          patient_id: string
          physical_exam?: string | null
          plan?: string | null
          record_type?: string | null
          retention_until?: string | null
          soap_assessment?: string | null
          soap_objective?: string | null
          soap_plan?: string | null
          soap_subjective?: string | null
          updated_at?: string
          vitals?: Json | null
        }
        Update: {
          addendums?: Json | null
          appointment_id?: string | null
          assessment?: string | null
          chief_complaint?: string | null
          created_at?: string
          doctor_id?: string | null
          history_present_illness?: string | null
          icd_codes?: string[] | null
          id?: string
          is_draft?: boolean | null
          locked_at?: string | null
          patient_id?: string
          physical_exam?: string | null
          plan?: string | null
          record_type?: string | null
          retention_until?: string | null
          soap_assessment?: string | null
          soap_objective?: string | null
          soap_plan?: string | null
          soap_subjective?: string | null
          updated_at?: string
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_records_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "medical_records_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_reminders: {
        Row: {
          active: boolean
          created_at: string
          dosage: string | null
          id: string
          last_sent_slot: string | null
          medication_name: string
          patient_id: string
          times: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dosage?: string | null
          id?: string
          last_sent_slot?: string | null
          medication_name: string
          patient_id: string
          times?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dosage?: string | null
          id?: string
          last_sent_slot?: string | null
          medication_name?: string
          patient_id?: string
          times?: Json
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          appointment_id: string | null
          content: string | null
          created_at: string
          file_url: string | null
          id: string
          is_read: boolean | null
          message_type: string | null
          receiver_id: string | null
          sender_id: string
        }
        Insert: {
          appointment_id?: string | null
          content?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          receiver_id?: string | null
          sender_id: string
        }
        Update: {
          appointment_id?: string | null
          content?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          receiver_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      mp_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      nfse_invoices: {
        Row: {
          codigo_verificacao: string | null
          created_at: string
          error: string | null
          id: string
          numero: string | null
          patient_id: string | null
          pdf_url: string | null
          provider: string
          raw: Json | null
          ref: string
          resource_id: string | null
          resource_type: string
          sent_at: string | null
          status: string
          updated_at: string
          valor: number | null
          xml_url: string | null
        }
        Insert: {
          codigo_verificacao?: string | null
          created_at?: string
          error?: string | null
          id?: string
          numero?: string | null
          patient_id?: string | null
          pdf_url?: string | null
          provider?: string
          raw?: Json | null
          ref: string
          resource_id?: string | null
          resource_type: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          valor?: number | null
          xml_url?: string | null
        }
        Update: {
          codigo_verificacao?: string | null
          created_at?: string
          error?: string | null
          id?: string
          numero?: string | null
          patient_id?: string | null
          pdf_url?: string | null
          provider?: string
          raw?: Json | null
          ref?: string
          resource_id?: string | null
          resource_type?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          valor?: number | null
          xml_url?: string | null
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          payload: Json | null
          provider: string | null
          provider_message_id: string | null
          recipient: string
          status: string
          subject: string | null
          template_slug: string | null
          user_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json | null
          provider?: string | null
          provider_message_id?: string | null
          recipient: string
          status?: string
          subject?: string | null
          template_slug?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json | null
          provider?: string | null
          provider_message_id?: string | null
          recipient?: string
          status?: string
          subject?: string | null
          template_slug?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          canal: string | null
          created_at: string | null
          id: string
          mensagem: string | null
          status: string
          tipo: string
          user_id: string | null
        }
        Insert: {
          canal?: string | null
          created_at?: string | null
          id?: string
          mensagem?: string | null
          status: string
          tipo: string
          user_id?: string | null
        }
        Update: {
          canal?: string | null
          created_at?: string | null
          id?: string
          mensagem?: string | null
          status?: string
          tipo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          prefs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_templates: {
        Row: {
          body_html: string | null
          body_text: string | null
          channel: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          slug: string
          subject: string | null
          updated_at: string
          updated_by: string | null
          variables: Json | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          channel: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          slug: string
          subject?: string | null
          updated_at?: string
          updated_by?: string | null
          variables?: Json | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          channel?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          slug?: string
          subject?: string | null
          updated_at?: string
          updated_by?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          metadata: Json | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          metadata?: Json | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          metadata?: Json | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      on_demand_queue: {
        Row: {
          appointment_id: string | null
          assigned_doctor_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          paid_at: string | null
          patient_id: string
          payment_id: string | null
          position: number | null
          price: number
          priority: number | null
          shift: string | null
          specialty_id: string | null
          status: string | null
          symptoms: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          assigned_doctor_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          patient_id: string
          payment_id?: string | null
          position?: number | null
          price?: number
          priority?: number | null
          shift?: string | null
          specialty_id?: string | null
          status?: string | null
          symptoms?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          assigned_doctor_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          patient_id?: string
          payment_id?: string | null
          position?: number | null
          price?: number
          priority?: number | null
          shift?: string | null
          specialty_id?: string | null
          status?: string | null
          symptoms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "on_demand_queue_assigned_doctor_id_fkey"
            columns: ["assigned_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "on_demand_queue_assigned_doctor_id_fkey"
            columns: ["assigned_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "on_demand_queue_assigned_doctor_id_fkey"
            columns: ["assigned_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "on_demand_queue_assigned_doctor_id_fkey"
            columns: ["assigned_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "on_demand_queue_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      ophthalmology_exams: {
        Row: {
          anterior_segment: string | null
          created_at: string
          doctor_id: string | null
          exam_type: string | null
          eye: string | null
          id: string
          intraocular_pressure_od: number | null
          intraocular_pressure_os: number | null
          notes: string | null
          od_axis: number | null
          od_cylinder: number | null
          od_sphere: number | null
          os_axis: number | null
          os_cylinder: number | null
          os_sphere: number | null
          other_findings: string | null
          patient_id: string
          posterior_segment: string | null
          pupil_reaction: string | null
          results: Json | null
          status: string | null
          tonometry_method: string | null
          updated_at: string
          va_od: string | null
          va_os: string | null
          va_ou: string | null
          visual_acuity_od: string | null
          visual_acuity_os: string | null
        }
        Insert: {
          anterior_segment?: string | null
          created_at?: string
          doctor_id?: string | null
          exam_type?: string | null
          eye?: string | null
          id?: string
          intraocular_pressure_od?: number | null
          intraocular_pressure_os?: number | null
          notes?: string | null
          od_axis?: number | null
          od_cylinder?: number | null
          od_sphere?: number | null
          os_axis?: number | null
          os_cylinder?: number | null
          os_sphere?: number | null
          other_findings?: string | null
          patient_id: string
          posterior_segment?: string | null
          pupil_reaction?: string | null
          results?: Json | null
          status?: string | null
          tonometry_method?: string | null
          updated_at?: string
          va_od?: string | null
          va_os?: string | null
          va_ou?: string | null
          visual_acuity_od?: string | null
          visual_acuity_os?: string | null
        }
        Update: {
          anterior_segment?: string | null
          created_at?: string
          doctor_id?: string | null
          exam_type?: string | null
          eye?: string | null
          id?: string
          intraocular_pressure_od?: number | null
          intraocular_pressure_os?: number | null
          notes?: string | null
          od_axis?: number | null
          od_cylinder?: number | null
          od_sphere?: number | null
          os_axis?: number | null
          os_cylinder?: number | null
          os_sphere?: number | null
          other_findings?: string | null
          patient_id?: string
          posterior_segment?: string | null
          pupil_reaction?: string | null
          results?: Json | null
          status?: string | null
          tonometry_method?: string | null
          updated_at?: string
          va_od?: string | null
          va_os?: string | null
          va_ou?: string | null
          visual_acuity_od?: string | null
          visual_acuity_os?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ophthalmology_exams_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ophthalmology_exams_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ophthalmology_exams_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "ophthalmology_exams_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      ophthalmology_prescriptions: {
        Row: {
          created_at: string
          doctor_id: string
          exam_id: string | null
          expiry_date: string | null
          id: string
          notes: string | null
          od_add: number | null
          od_axis: number | null
          od_cylinder: number | null
          od_sphere: number | null
          os_add: number | null
          os_axis: number | null
          os_cylinder: number | null
          os_sphere: number | null
          patient_id: string
          pdf_url: string | null
          prescribed_at: string | null
          prescription_data: Json | null
          prescription_type: string | null
          pupillary_distance: number | null
          recommended_use: string | null
        }
        Insert: {
          created_at?: string
          doctor_id: string
          exam_id?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          od_add?: number | null
          od_axis?: number | null
          od_cylinder?: number | null
          od_sphere?: number | null
          os_add?: number | null
          os_axis?: number | null
          os_cylinder?: number | null
          os_sphere?: number | null
          patient_id: string
          pdf_url?: string | null
          prescribed_at?: string | null
          prescription_data?: Json | null
          prescription_type?: string | null
          pupillary_distance?: number | null
          recommended_use?: string | null
        }
        Update: {
          created_at?: string
          doctor_id?: string
          exam_id?: string | null
          expiry_date?: string | null
          id?: string
          notes?: string | null
          od_add?: number | null
          od_axis?: number | null
          od_cylinder?: number | null
          od_sphere?: number | null
          os_add?: number | null
          os_axis?: number | null
          os_cylinder?: number | null
          os_sphere?: number | null
          patient_id?: string
          pdf_url?: string | null
          prescribed_at?: string | null
          prescription_data?: Json | null
          prescription_type?: string | null
          pupillary_distance?: number | null
          recommended_use?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ophthalmology_prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ophthalmology_prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ophthalmology_prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "ophthalmology_prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ophthalmology_prescriptions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "ophthalmology_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      optical_frames: {
        Row: {
          brand: string
          bridge_size: number | null
          color: string
          created_at: string
          discount_price: number | null
          gender: string
          id: string
          image_urls: Json
          is_active: boolean
          lens_width: number | null
          material: string
          model: string
          name: string
          price: number
          shape: string
          stock_qty: number
          temple_length: number | null
          updated_at: string
        }
        Insert: {
          brand?: string
          bridge_size?: number | null
          color?: string
          created_at?: string
          discount_price?: number | null
          gender?: string
          id?: string
          image_urls?: Json
          is_active?: boolean
          lens_width?: number | null
          material?: string
          model?: string
          name: string
          price?: number
          shape?: string
          stock_qty?: number
          temple_length?: number | null
          updated_at?: string
        }
        Update: {
          brand?: string
          bridge_size?: number | null
          color?: string
          created_at?: string
          discount_price?: number | null
          gender?: string
          id?: string
          image_urls?: Json
          is_active?: boolean
          lens_width?: number | null
          material?: string
          model?: string
          name?: string
          price?: number
          shape?: string
          stock_qty?: number
          temple_length?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      optical_lens_types: {
        Row: {
          coatings: string[]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          lens_type: string
          material: string
          name: string
          price: number
        }
        Insert: {
          coatings?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          lens_type?: string
          material?: string
          name: string
          price?: number
        }
        Update: {
          coatings?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          lens_type?: string
          material?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      optical_orders: {
        Row: {
          cancelled_at: string | null
          created_at: string
          delivered_at: string | null
          discount_amount: number
          frame_id: string | null
          frame_price: number
          id: string
          internal_notes: string | null
          interpupillary_distance: number | null
          lens_price: number
          lens_type_id: string | null
          notes: string | null
          od_addition: number | null
          od_axis: number | null
          od_cylindrical: number | null
          od_spherical: number | null
          oe_addition: number | null
          oe_axis: number | null
          oe_cylindrical: number | null
          oe_spherical: number | null
          order_number: string
          paid_at: string | null
          patient_id: string
          payment_id: string | null
          payment_status: string
          prescription_id: string | null
          shipped_at: string | null
          shipping_address: Json | null
          status: string
          total_price: number
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          delivered_at?: string | null
          discount_amount?: number
          frame_id?: string | null
          frame_price?: number
          id?: string
          internal_notes?: string | null
          interpupillary_distance?: number | null
          lens_price?: number
          lens_type_id?: string | null
          notes?: string | null
          od_addition?: number | null
          od_axis?: number | null
          od_cylindrical?: number | null
          od_spherical?: number | null
          oe_addition?: number | null
          oe_axis?: number | null
          oe_cylindrical?: number | null
          oe_spherical?: number | null
          order_number?: string
          paid_at?: string | null
          patient_id: string
          payment_id?: string | null
          payment_status?: string
          prescription_id?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          status?: string
          total_price?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          delivered_at?: string | null
          discount_amount?: number
          frame_id?: string | null
          frame_price?: number
          id?: string
          internal_notes?: string | null
          interpupillary_distance?: number | null
          lens_price?: number
          lens_type_id?: string | null
          notes?: string | null
          od_addition?: number | null
          od_axis?: number | null
          od_cylindrical?: number | null
          od_spherical?: number | null
          oe_addition?: number | null
          oe_axis?: number | null
          oe_cylindrical?: number | null
          oe_spherical?: number | null
          order_number?: string
          paid_at?: string | null
          patient_id?: string
          payment_id?: string | null
          payment_status?: string
          prescription_id?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          status?: string
          total_price?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "optical_orders_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "optical_frames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optical_orders_lens_type_id_fkey"
            columns: ["lens_type_id"]
            isOneToOne: false
            referencedRelation: "optical_lens_types"
            referencedColumns: ["id"]
          },
        ]
      }
      optical_production: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string
          stage: string
          started_at: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          stage?: string
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          stage?: string
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "optical_production_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "optical_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      optical_stock_movements: {
        Row: {
          created_at: string
          frame_id: string
          id: string
          movement_type: string
          order_id: string | null
          performed_by: string | null
          quantity: number
          reason: string | null
        }
        Insert: {
          created_at?: string
          frame_id: string
          id?: string
          movement_type?: string
          order_id?: string | null
          performed_by?: string | null
          quantity: number
          reason?: string | null
        }
        Update: {
          created_at?: string
          frame_id?: string
          id?: string
          movement_type?: string
          order_id?: string | null
          performed_by?: string | null
          quantity?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "optical_stock_movements_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "optical_frames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "optical_stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "optical_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      optical_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          payment_method: string | null
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          payment_method?: string | null
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          payment_method?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "optical_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "optical_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_profiles: {
        Row: {
          commission_rate: number | null
          company_name: string | null
          created_at: string
          id: string
          is_approved: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_rate?: number | null
          company_name?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_rate?: number | null
          company_name?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_consents: {
        Row: {
          accepted: boolean | null
          accepted_at: string | null
          appointment_id: string | null
          consent_type: string
          created_at: string
          id: string
          ip_address: string | null
          patient_id: string
          user_agent: string | null
          version: string | null
        }
        Insert: {
          accepted?: boolean | null
          accepted_at?: string | null
          appointment_id?: string | null
          consent_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          patient_id: string
          user_agent?: string | null
          version?: string | null
        }
        Update: {
          accepted?: boolean | null
          accepted_at?: string | null
          appointment_id?: string | null
          consent_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          patient_id?: string
          user_agent?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_consents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_documents: {
        Row: {
          created_at: string
          doctor_id: string | null
          document_type: string
          file_name: string | null
          file_url: string | null
          id: string
          mime_type: string | null
          notes: string | null
          patient_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          doctor_id?: string | null
          document_type: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          patient_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          doctor_id?: string | null
          document_type?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          patient_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_documents_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_documents_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "patient_documents_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount_cents: number | null
          created_at: string | null
          currency: string | null
          gateway: string | null
          id: string
          mp_boleto_url: string | null
          mp_payment_id: string | null
          mp_preapproval_id: string | null
          mp_qr_code: string | null
          mp_qr_code_base64: string | null
          payment_method: string | null
          raw_response: Json | null
          resource_id: string | null
          resource_type: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string | null
          currency?: string | null
          gateway?: string | null
          id?: string
          mp_boleto_url?: string | null
          mp_payment_id?: string | null
          mp_preapproval_id?: string | null
          mp_qr_code?: string | null
          mp_qr_code_base64?: string | null
          payment_method?: string | null
          raw_response?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string | null
          currency?: string | null
          gateway?: string | null
          id?: string
          mp_boleto_url?: string | null
          mp_payment_id?: string | null
          mp_preapproval_id?: string | null
          mp_qr_code?: string | null
          mp_qr_code_base64?: string | null
          payment_method?: string | null
          raw_response?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pingo_card_benefit_usage: {
        Row: {
          benefit_type: string
          description: string | null
          discount_amount: number
          final_amount: number
          id: string
          original_amount: number
          reference_id: string | null
          subscription_id: string | null
          used_at: string
          user_id: string
        }
        Insert: {
          benefit_type: string
          description?: string | null
          discount_amount?: number
          final_amount?: number
          id?: string
          original_amount?: number
          reference_id?: string | null
          subscription_id?: string | null
          used_at?: string
          user_id: string
        }
        Update: {
          benefit_type?: string
          description?: string | null
          discount_amount?: number
          final_amount?: number
          id?: string
          original_amount?: number
          reference_id?: string | null
          subscription_id?: string | null
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pingo_card_benefit_usage_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "pingo_card_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      pingo_card_invoices: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          due_date: string
          id: string
          mp_payment_id: string | null
          paid_at: string | null
          pdf_url: string | null
          status: string
          subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          mp_payment_id?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          status?: string
          subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          mp_payment_id?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pingo_card_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "pingo_card_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      pingo_card_partners: {
        Row: {
          address: string | null
          category: string
          city: string | null
          created_at: string
          description: string | null
          discount_description: string | null
          discount_percent: number
          display_order: number
          id: string
          is_active: boolean
          is_featured: boolean
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          phone: string | null
          state: string | null
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          category?: string
          city?: string | null
          created_at?: string
          description?: string | null
          discount_description?: string | null
          discount_percent?: number
          display_order?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          category?: string
          city?: string | null
          created_at?: string
          description?: string | null
          discount_description?: string | null
          discount_percent?: number
          display_order?: number
          id?: string
          is_active?: boolean
          is_featured?: boolean
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      pingo_card_plans: {
        Row: {
          benefits: Json
          color: string | null
          consultation_discount_percent: number
          created_at: string
          cta_label: string
          description: string | null
          display_order: number
          exam_discount_percent: number
          features_included: Json
          id: string
          is_active: boolean
          is_highlighted: boolean
          max_dependents: number
          name: string
          partner_discount_percent: number
          pingo_ticket_monthly_credit: number
          price_monthly: number
          price_yearly: number
          slug: string
          tagline: string | null
          trial_days: number
          updated_at: string
        }
        Insert: {
          benefits?: Json
          color?: string | null
          consultation_discount_percent?: number
          created_at?: string
          cta_label?: string
          description?: string | null
          display_order?: number
          exam_discount_percent?: number
          features_included?: Json
          id?: string
          is_active?: boolean
          is_highlighted?: boolean
          max_dependents?: number
          name: string
          partner_discount_percent?: number
          pingo_ticket_monthly_credit?: number
          price_monthly?: number
          price_yearly?: number
          slug: string
          tagline?: string | null
          trial_days?: number
          updated_at?: string
        }
        Update: {
          benefits?: Json
          color?: string | null
          consultation_discount_percent?: number
          created_at?: string
          cta_label?: string
          description?: string | null
          display_order?: number
          exam_discount_percent?: number
          features_included?: Json
          id?: string
          is_active?: boolean
          is_highlighted?: boolean
          max_dependents?: number
          name?: string
          partner_discount_percent?: number
          pingo_ticket_monthly_credit?: number
          price_monthly?: number
          price_yearly?: number
          slug?: string
          tagline?: string | null
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      pingo_card_subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          billing_cycle: string
          canceled_at: string | null
          cancellation_reason: string | null
          card_holder_name: string | null
          card_number: string
          created_at: string
          current_period_end: string | null
          dependents_included: number
          gateway: string
          id: string
          mp_payer_id: string | null
          mp_preapproval_id: string | null
          mp_subscription_id: string | null
          next_charge_at: string | null
          plan_id: string
          started_at: string
          status: string
          total_savings: number
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string
          canceled_at?: string | null
          cancellation_reason?: string | null
          card_holder_name?: string | null
          card_number: string
          created_at?: string
          current_period_end?: string | null
          dependents_included?: number
          gateway?: string
          id?: string
          mp_payer_id?: string | null
          mp_preapproval_id?: string | null
          mp_subscription_id?: string | null
          next_charge_at?: string | null
          plan_id: string
          started_at?: string
          status?: string
          total_savings?: number
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          billing_cycle?: string
          canceled_at?: string | null
          cancellation_reason?: string | null
          card_holder_name?: string | null
          card_number?: string
          created_at?: string
          current_period_end?: string | null
          dependents_included?: number
          gateway?: string
          id?: string
          mp_payer_id?: string | null
          mp_preapproval_id?: string | null
          mp_subscription_id?: string | null
          next_charge_at?: string | null
          plan_id?: string
          started_at?: string
          status?: string
          total_savings?: number
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pingo_card_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pingo_card_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pingo_card_transactions: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          discount_amount: number
          final_amount: number
          id: string
          original_amount: number
          partner_id: string | null
          subscription_id: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          discount_amount?: number
          final_amount?: number
          id?: string
          original_amount?: number
          partner_id?: string | null
          subscription_id: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          discount_amount?: number
          final_amount?: number
          id?: string
          original_amount?: number
          partner_id?: string | null
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pingo_card_transactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "pingo_card_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pingo_card_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "pingo_card_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      pingo_ticket_accounts: {
        Row: {
          balance: number
          card_number: string
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          card_number?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          card_number?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pingo_ticket_transactions: {
        Row: {
          account_id: string
          amount: number
          balance_after: number
          category: string | null
          created_at: string
          description: string | null
          id: string
          merchant: string | null
          type: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          balance_after: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          merchant?: string | null
          type: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          balance_after?: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          merchant?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pingo_ticket_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "pingo_ticket_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          features: Json | null
          id: string
          interval: string | null
          is_active: boolean | null
          mp_plan_id: string | null
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          interval?: string | null
          is_active?: boolean | null
          mp_plan_id?: string | null
          name: string
          price: number
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          interval?: string | null
          is_active?: boolean | null
          mp_plan_id?: string | null
          name?: string
          price?: number
        }
        Relationships: []
      }
      pre_consultation_symptoms: {
        Row: {
          additional_notes: string | null
          appointment_id: string
          created_at: string
          duration: string | null
          id: string
          main_complaint: string | null
          patient_id: string
          severity: number | null
          symptoms: string[] | null
        }
        Insert: {
          additional_notes?: string | null
          appointment_id: string
          created_at?: string
          duration?: string | null
          id?: string
          main_complaint?: string | null
          patient_id: string
          severity?: number | null
          symptoms?: string[] | null
        }
        Update: {
          additional_notes?: string | null
          appointment_id?: string
          created_at?: string
          duration?: string | null
          id?: string
          main_complaint?: string | null
          patient_id?: string
          severity?: number | null
          symptoms?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "pre_consultation_symptoms_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_renewals: {
        Row: {
          assigned_doctor_id: string | null
          created_at: string
          doctor_id: string
          health_questionnaire: Json | null
          id: string
          notes: string | null
          original_prescription_url: string | null
          patient_id: string
          prescription_id: string
          price: number
          rejection_reason: string | null
          renewed_to_prescription_id: string | null
          reviewed_at: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          assigned_doctor_id?: string | null
          created_at?: string
          doctor_id: string
          health_questionnaire?: Json | null
          id?: string
          notes?: string | null
          original_prescription_url?: string | null
          patient_id: string
          prescription_id: string
          price?: number
          rejection_reason?: string | null
          renewed_to_prescription_id?: string | null
          reviewed_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          assigned_doctor_id?: string | null
          created_at?: string
          doctor_id?: string
          health_questionnaire?: Json | null
          id?: string
          notes?: string | null
          original_prescription_url?: string | null
          patient_id?: string
          prescription_id?: string
          price?: number
          rejection_reason?: string | null
          renewed_to_prescription_id?: string | null
          reviewed_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_renewals_assigned_doctor_id_fkey"
            columns: ["assigned_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_renewals_assigned_doctor_id_fkey"
            columns: ["assigned_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_renewals_assigned_doctor_id_fkey"
            columns: ["assigned_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "prescription_renewals_assigned_doctor_id_fkey"
            columns: ["assigned_doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_renewals_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_renewals_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_renewals_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "prescription_renewals_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_renewals_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_renewals_renewed_to_prescription_id_fkey"
            columns: ["renewed_to_prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_signatures: {
        Row: {
          certificate_chain: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          prescription_id: string | null
          signature_algorithm: string | null
          signed_at: string | null
          signed_by: string
          soluti_request_id: string | null
          status: string | null
          storage_path: string
        }
        Insert: {
          certificate_chain?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          prescription_id?: string | null
          signature_algorithm?: string | null
          signed_at?: string | null
          signed_by: string
          soluti_request_id?: string | null
          status?: string | null
          storage_path: string
        }
        Update: {
          certificate_chain?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          prescription_id?: string | null
          signature_algorithm?: string | null
          signed_at?: string | null
          signed_by?: string
          soluti_request_id?: string | null
          status?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_signatures_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_validations: {
        Row: {
          created_at: string
          id: string
          is_valid: boolean | null
          prescription_id: string | null
          validated_at: string | null
          validator_ip: string | null
          validator_user_agent: string | null
          verification_code: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_valid?: boolean | null
          prescription_id?: string | null
          validated_at?: string | null
          validator_ip?: string | null
          validator_user_agent?: string | null
          verification_code?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_valid?: boolean | null
          prescription_id?: string | null
          validated_at?: string | null
          validator_ip?: string | null
          validator_user_agent?: string | null
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_validations_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: true
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          appointment_id: string | null
          continuous_duration_days: number | null
          created_at: string
          diagnosis: string | null
          doctor_id: string
          id: string
          instructions: string | null
          is_continuous: boolean | null
          is_signed: boolean | null
          medications: Json | null
          memed_prescription_id: string | null
          observations: string | null
          patient_id: string
          pdf_url: string | null
          prescription_type: string | null
          renewal_alerted_at: string | null
          signature_hash: string | null
          signed_at: string | null
          status: string | null
          updated_at: string
          valid_until: string | null
          verification_code: string | null
        }
        Insert: {
          appointment_id?: string | null
          continuous_duration_days?: number | null
          created_at?: string
          diagnosis?: string | null
          doctor_id: string
          id?: string
          instructions?: string | null
          is_continuous?: boolean | null
          is_signed?: boolean | null
          medications?: Json | null
          memed_prescription_id?: string | null
          observations?: string | null
          patient_id: string
          pdf_url?: string | null
          prescription_type?: string | null
          renewal_alerted_at?: string | null
          signature_hash?: string | null
          signed_at?: string | null
          status?: string | null
          updated_at?: string
          valid_until?: string | null
          verification_code?: string | null
        }
        Update: {
          appointment_id?: string | null
          continuous_duration_days?: number | null
          created_at?: string
          diagnosis?: string | null
          doctor_id?: string
          id?: string
          instructions?: string | null
          is_continuous?: boolean | null
          is_signed?: boolean | null
          medications?: Json | null
          memed_prescription_id?: string | null
          observations?: string | null
          patient_id?: string
          pdf_url?: string | null
          prescription_type?: string | null
          renewal_alerted_at?: string | null
          signature_hash?: string | null
          signed_at?: string | null
          status?: string | null
          updated_at?: string
          valid_until?: string | null
          verification_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_blocked_reason: string | null
          account_status: string
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          allergies: string[] | null
          avatar_url: string | null
          blood_type: string | null
          chronic_conditions: string[] | null
          churn_flagged_at: string | null
          city: string | null
          cpf: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string | null
          gender: string | null
          id: string
          kyc_face_match_score: number | null
          kyc_status: string | null
          kyc_verified_at: string | null
          last_consultation_at: string | null
          last_name: string | null
          mp_customer_id: string | null
          phone: string | null
          reengagement_sent_at: string | null
          settings: Json | null
          social_name: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_blocked_reason?: string | null
          account_status?: string
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          allergies?: string[] | null
          avatar_url?: string | null
          blood_type?: string | null
          chronic_conditions?: string[] | null
          churn_flagged_at?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          kyc_face_match_score?: number | null
          kyc_status?: string | null
          kyc_verified_at?: string | null
          last_consultation_at?: string | null
          last_name?: string | null
          mp_customer_id?: string | null
          phone?: string | null
          reengagement_sent_at?: string | null
          settings?: Json | null
          social_name?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_blocked_reason?: string | null
          account_status?: string
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          allergies?: string[] | null
          avatar_url?: string | null
          blood_type?: string | null
          chronic_conditions?: string[] | null
          churn_flagged_at?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          kyc_face_match_score?: number | null
          kyc_status?: string | null
          kyc_verified_at?: string | null
          last_consultation_at?: string | null
          last_name?: string | null
          mp_customer_id?: string | null
          phone?: string | null
          reengagement_sent_at?: string | null
          settings?: Json | null
          social_name?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string | null
          created_at: string
          endpoint: string
          id: string
          p256dh: string | null
          user_id: string
        }
        Insert: {
          auth_key?: string | null
          created_at?: string
          endpoint: string
          id?: string
          p256dh?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      referral_uses: {
        Row: {
          created_at: string
          id: string
          referee_credit_brl: number
          referral_id: string
          referred_user_id: string
          referrer_credit_brl: number
          referrer_credit_unlocked: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          referee_credit_brl?: number
          referral_id: string
          referred_user_id: string
          referrer_credit_brl?: number
          referrer_credit_unlocked?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          referee_credit_brl?: number
          referral_id?: string
          referred_user_id?: string
          referrer_credit_brl?: number
          referrer_credit_unlocked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "referral_uses_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          id: string
          referrer_user_id: string
          usage_count: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          referrer_user_id: string
          usage_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          referrer_user_id?: string
          usage_count?: number
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          amount_cents: number | null
          appointment_id: string
          approved_at: string | null
          created_at: string
          id: string
          notes: string | null
          processed_by: string | null
          reason: string | null
          refunded_at: string | null
          rejected_at: string | null
          requested_at: string
          status: Database["public"]["Enums"]["refund_status"]
          tier: Database["public"]["Enums"]["refund_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          appointment_id: string
          approved_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          processed_by?: string | null
          reason?: string | null
          refunded_at?: string | null
          rejected_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["refund_status"]
          tier?: Database["public"]["Enums"]["refund_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          appointment_id?: string
          approved_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          processed_by?: string | null
          reason?: string | null
          refunded_at?: string | null
          rejected_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["refund_status"]
          tier?: Database["public"]["Enums"]["refund_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      satisfaction_surveys: {
        Row: {
          appointment_id: string | null
          comment: string | null
          created_at: string
          doctor_id: string | null
          id: string
          nps_score: number | null
          patient_id: string
          rating: number
          would_recommend: boolean | null
        }
        Insert: {
          appointment_id?: string | null
          comment?: string | null
          created_at?: string
          doctor_id?: string | null
          id?: string
          nps_score?: number | null
          patient_id: string
          rating: number
          would_recommend?: boolean | null
        }
        Update: {
          appointment_id?: string | null
          comment?: string | null
          created_at?: string
          doctor_id?: string | null
          id?: string
          nps_score?: number | null
          patient_id?: string
          rating?: number
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "satisfaction_surveys_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satisfaction_surveys_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satisfaction_surveys_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satisfaction_surveys_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor_sla_dashboard"
            referencedColumns: ["doctor_id"]
          },
          {
            foreignKeyName: "satisfaction_surveys_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_cards: {
        Row: {
          brand: string | null
          created_at: string | null
          expiry_month: number | null
          expiry_year: number | null
          holder_name: string | null
          id: string
          is_default: boolean | null
          last4: string | null
          mp_card_id: string | null
          mp_customer_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          holder_name?: string | null
          id?: string
          is_default?: boolean | null
          last4?: string | null
          mp_card_id?: string | null
          mp_customer_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          holder_name?: string | null
          id?: string
          is_default?: boolean | null
          last4?: string | null
          mp_card_id?: string | null
          mp_customer_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      site_block_versions: {
        Row: {
          block_id: string
          change_note: string | null
          id: string
          locale: string | null
          published_at: string
          published_by: string | null
          snapshot: Json
          version: number
        }
        Insert: {
          block_id: string
          change_note?: string | null
          id?: string
          locale?: string | null
          published_at?: string
          published_by?: string | null
          snapshot: Json
          version: number
        }
        Update: {
          block_id?: string
          change_note?: string | null
          id?: string
          locale?: string | null
          published_at?: string
          published_by?: string | null
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_block_versions_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "site_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      site_blocks: {
        Row: {
          block_key: string
          created_at: string
          display_name: string
          display_order: number
          draft: Json | null
          has_draft: boolean
          i18n: Json
          id: string
          is_enabled: boolean
          last_published_at: string | null
          last_published_by: string | null
          page_slug: string | null
          parent_id: string | null
          published: Json
          schema: Json
          scope: string
          updated_at: string
        }
        Insert: {
          block_key: string
          created_at?: string
          display_name: string
          display_order?: number
          draft?: Json | null
          has_draft?: boolean
          i18n?: Json
          id?: string
          is_enabled?: boolean
          last_published_at?: string | null
          last_published_by?: string | null
          page_slug?: string | null
          parent_id?: string | null
          published?: Json
          schema?: Json
          scope: string
          updated_at?: string
        }
        Update: {
          block_key?: string
          created_at?: string
          display_name?: string
          display_order?: number
          draft?: Json | null
          has_draft?: boolean
          i18n?: Json
          id?: string
          is_enabled?: boolean
          last_published_at?: string | null
          last_published_by?: string | null
          page_slug?: string | null
          parent_id?: string | null
          published?: Json
          schema?: Json
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_blocks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "site_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      site_config: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      site_media: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          mime_type: string | null
          name: string | null
          path: string | null
          size_bytes: number | null
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string | null
          path?: string | null
          size_bytes?: number | null
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string | null
          path?: string | null
          size_bytes?: number | null
          url?: string
        }
        Relationships: []
      }
      site_sections: {
        Row: {
          config: Json | null
          created_at: string
          display_name: string | null
          display_order: number | null
          draft_config: Json | null
          has_draft: boolean
          id: string
          is_enabled: boolean | null
          key: string
          language: string
          last_published_at: string | null
          schema: Json
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          display_name?: string | null
          display_order?: number | null
          draft_config?: Json | null
          has_draft?: boolean
          id?: string
          is_enabled?: boolean | null
          key: string
          language?: string
          last_published_at?: string | null
          schema?: Json
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          display_name?: string | null
          display_order?: number | null
          draft_config?: Json | null
          has_draft?: boolean
          id?: string
          is_enabled?: boolean | null
          key?: string
          language?: string
          last_published_at?: string | null
          schema?: Json
          updated_at?: string
        }
        Relationships: []
      }
      site_sections_history: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          saved_at: string | null
          section_key: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          saved_at?: string | null
          section_key?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          saved_at?: string | null
          section_key?: string | null
        }
        Relationships: []
      }
      site_themes: {
        Row: {
          created_at: string
          favicon_url: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          og_image_url: string | null
          tokens: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          favicon_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          og_image_url?: string | null
          tokens?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          favicon_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          og_image_url?: string | null
          tokens?: Json
          updated_at?: string
        }
        Relationships: []
      }
      specialties: {
        Row: {
          consultation_price: number | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          max_price: number | null
          min_price: number | null
          name: string
          price_max: number | null
          price_min: number | null
          slug: string | null
        }
        Insert: {
          consultation_price?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          max_price?: number | null
          min_price?: number | null
          name: string
          price_max?: number | null
          price_min?: number | null
          slug?: string | null
        }
        Update: {
          consultation_price?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          max_price?: number | null
          min_price?: number | null
          name?: string
          price_max?: number | null
          price_min?: number | null
          slug?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          expires_at: string | null
          gateway: string
          id: string
          last_retry_at: string | null
          mp_payer_id: string | null
          mp_preapproval_id: string | null
          payment_id: string | null
          pix_reminder_sent_at: string | null
          plan_id: string | null
          started_at: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          gateway?: string
          id?: string
          last_retry_at?: string | null
          mp_payer_id?: string | null
          mp_preapproval_id?: string | null
          payment_id?: string | null
          pix_reminder_sent_at?: string | null
          plan_id?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          gateway?: string
          id?: string
          last_retry_at?: string | null
          mp_payer_id?: string | null
          mp_preapproval_id?: string | null
          payment_id?: string | null
          pix_reminder_sent_at?: string | null
          plan_id?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_messages: {
        Row: {
          agent_id: string | null
          content: string
          created_at: string
          id: string
          is_from_agent: boolean | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_from_agent?: boolean | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_from_agent?: boolean | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_internal: boolean | null
          sender_id: string
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          sender_id: string
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          ai_category_suggested: string | null
          ai_priority_suggested: string | null
          ai_summary: string | null
          ai_triaged_at: string | null
          assigned_to: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_category_suggested?: string | null
          ai_priority_suggested?: string | null
          ai_summary?: string | null
          ai_triaged_at?: string | null
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_category_suggested?: string | null
          ai_priority_suggested?: string | null
          ai_summary?: string | null
          ai_triaged_at?: string | null
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"] | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"] | null
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sweepstake_tickets: {
        Row: {
          created_at: string | null
          id: string
          is_winner: boolean | null
          source: string | null
          subscription_id: string | null
          sweepstake_id: string
          ticket_number: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_winner?: boolean | null
          source?: string | null
          subscription_id?: string | null
          sweepstake_id: string
          ticket_number: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_winner?: boolean | null
          source?: string | null
          subscription_id?: string | null
          sweepstake_id?: string
          ticket_number?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sweepstake_tickets_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "pingo_card_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sweepstake_tickets_sweepstake_id_fkey"
            columns: ["sweepstake_id"]
            isOneToOne: false
            referencedRelation: "sweepstakes"
            referencedColumns: ["id"]
          },
        ]
      }
      sweepstake_winners: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_status: string | null
          prize_value: number
          sweepstake_id: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_status?: string | null
          prize_value: number
          sweepstake_id: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_status?: string | null
          prize_value?: number
          sweepstake_id?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sweepstake_winners_sweepstake_id_fkey"
            columns: ["sweepstake_id"]
            isOneToOne: false
            referencedRelation: "sweepstakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sweepstake_winners_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "sweepstake_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      sweepstakes: {
        Row: {
          authorization_code: string | null
          created_at: string | null
          description: string | null
          draw_date: string
          drawn_at: string | null
          drawn_ticket_number: string | null
          id: string
          prize_description: string | null
          prize_value: number
          regulation_url: string | null
          status: string | null
          ticket_generation_end: string
          ticket_generation_start: string
          title: string
          updated_at: string | null
        }
        Insert: {
          authorization_code?: string | null
          created_at?: string | null
          description?: string | null
          draw_date: string
          drawn_at?: string | null
          drawn_ticket_number?: string | null
          id?: string
          prize_description?: string | null
          prize_value: number
          regulation_url?: string | null
          status?: string | null
          ticket_generation_end: string
          ticket_generation_start: string
          title: string
          updated_at?: string | null
        }
        Update: {
          authorization_code?: string | null
          created_at?: string | null
          description?: string | null
          draw_date?: string
          drawn_at?: string | null
          drawn_ticket_number?: string | null
          id?: string
          prize_description?: string | null
          prize_value?: number
          regulation_url?: string | null
          status?: string | null
          ticket_generation_end?: string
          ticket_generation_start?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      symptom_diary: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          patient_id: string
          recorded_at: string | null
          severity: number | null
          symptom: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          patient_id: string
          recorded_at?: string | null
          severity?: number | null
          symptom: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          recorded_at?: string | null
          severity?: number | null
          symptom?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          avatar_url: string | null
          company: string | null
          content: string
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
          rating: number | null
          role: string | null
          text: string | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          content: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
          rating?: number | null
          role?: string | null
          text?: string | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          content?: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
          rating?: number | null
          role?: string | null
          text?: string | null
        }
        Relationships: []
      }
      user_consent_log: {
        Row: {
          accepted_at: string
          document_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          document_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          document_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          accepted: boolean | null
          accepted_at: string | null
          consent_type: string
          created_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
          version: string | null
        }
        Insert: {
          accepted?: boolean | null
          accepted_at?: string | null
          consent_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
          version?: string | null
        }
        Update: {
          accepted?: boolean | null
          accepted_at?: string | null
          consent_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
          version?: string | null
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          current_page: string | null
          id: string
          last_seen_at: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          current_page?: string | null
          id?: string
          last_seen_at?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          current_page?: string | null
          id?: string
          last_seen_at?: string | null
          status?: string | null
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
      vaccination_records: {
        Row: {
          created_at: string | null
          date_given: string | null
          doctor_id: string | null
          document_url: string | null
          dose: string | null
          id: string
          location: string | null
          lot_number: string | null
          next_dose_date: string | null
          patient_id: string | null
          vaccine_name: string | null
        }
        Insert: {
          created_at?: string | null
          date_given?: string | null
          doctor_id?: string | null
          document_url?: string | null
          dose?: string | null
          id?: string
          location?: string | null
          lot_number?: string | null
          next_dose_date?: string | null
          patient_id?: string | null
          vaccine_name?: string | null
        }
        Update: {
          created_at?: string | null
          date_given?: string | null
          doctor_id?: string | null
          document_url?: string | null
          dose?: string | null
          id?: string
          location?: string | null
          lot_number?: string | null
          next_dose_date?: string | null
          patient_id?: string | null
          vaccine_name?: string | null
        }
        Relationships: []
      }
      video_presence_logs: {
        Row: {
          appointment_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_presence_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_acuity_results: {
        Row: {
          amsler_grid_result: string | null
          appointment_id: string | null
          color_blind_test: string | null
          created_at: string | null
          doctor_id: string | null
          id: string
          iop_left: number | null
          iop_right: number | null
          left_add: number | null
          left_axis: number | null
          left_cylinder: number | null
          left_eye_distance: string | null
          left_eye_near: string | null
          left_sphere: number | null
          notes: string | null
          patient_id: string | null
          pd_binocular: number | null
          pd_left: number | null
          pd_right: number | null
          right_add: number | null
          right_axis: number | null
          right_cylinder: number | null
          right_eye_distance: string | null
          right_eye_near: string | null
          right_sphere: number | null
          tested_by_patient: boolean | null
        }
        Insert: {
          amsler_grid_result?: string | null
          appointment_id?: string | null
          color_blind_test?: string | null
          created_at?: string | null
          doctor_id?: string | null
          id?: string
          iop_left?: number | null
          iop_right?: number | null
          left_add?: number | null
          left_axis?: number | null
          left_cylinder?: number | null
          left_eye_distance?: string | null
          left_eye_near?: string | null
          left_sphere?: number | null
          notes?: string | null
          patient_id?: string | null
          pd_binocular?: number | null
          pd_left?: number | null
          pd_right?: number | null
          right_add?: number | null
          right_axis?: number | null
          right_cylinder?: number | null
          right_eye_distance?: string | null
          right_eye_near?: string | null
          right_sphere?: number | null
          tested_by_patient?: boolean | null
        }
        Update: {
          amsler_grid_result?: string | null
          appointment_id?: string | null
          color_blind_test?: string | null
          created_at?: string | null
          doctor_id?: string | null
          id?: string
          iop_left?: number | null
          iop_right?: number | null
          left_add?: number | null
          left_axis?: number | null
          left_cylinder?: number | null
          left_eye_distance?: string | null
          left_eye_near?: string | null
          left_sphere?: number | null
          notes?: string | null
          patient_id?: string | null
          pd_binocular?: number | null
          pd_left?: number | null
          pd_right?: number | null
          right_add?: number | null
          right_axis?: number | null
          right_cylinder?: number | null
          right_eye_distance?: string | null
          right_eye_near?: string | null
          right_sphere?: number | null
          tested_by_patient?: boolean | null
        }
        Relationships: []
      }
      vouchers: {
        Row: {
          ativo: boolean
          codigo: string
          contrato_id: string
          created_at: string
          descricao: string | null
          especialidades_permitidas: string[] | null
          id: string
          updated_at: string
          usos_atuais: number
          usos_maximos: number
          validade_fim: string | null
          validade_inicio: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          contrato_id: string
          created_at?: string
          descricao?: string | null
          especialidades_permitidas?: string[] | null
          id?: string
          updated_at?: string
          usos_atuais?: number
          usos_maximos?: number
          validade_fim?: string | null
          validade_inicio?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          contrato_id?: string
          created_at?: string
          descricao?: string | null
          especialidades_permitidas?: string[] | null
          id?: string
          updated_at?: string
          usos_atuais?: number
          usos_maximos?: number
          validade_fim?: string | null
          validade_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          mp_money_request_id: string | null
          mp_payout_id: string | null
          payout_gateway: string
          pix_key: string | null
          pix_key_type: string | null
          processed_at: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          id?: string
          mp_money_request_id?: string | null
          mp_payout_id?: string | null
          payout_gateway?: string
          pix_key?: string | null
          pix_key_type?: string | null
          processed_at?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          mp_money_request_id?: string | null
          mp_payout_id?: string | null
          payout_gateway?: string
          pix_key?: string | null
          pix_key_type?: string | null
          processed_at?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      doctor_profiles_public: {
        Row: {
          available_for_telemedicine: boolean | null
          available_now: boolean | null
          avatar_url: string | null
          bio: string | null
          consultation_duration_min: number | null
          consultation_price: number | null
          council_type: string | null
          crm: string | null
          crm_state: string | null
          crm_verified: boolean | null
          display_name: string | null
          doctor_type: string | null
          education: string | null
          experience_years: number | null
          full_name: string | null
          has_availability: boolean | null
          id: string | null
          rating: number | null
          short_description: string | null
          specialty_names: string[] | null
          sub_specialties: string[] | null
          total_reviews: number | null
        }
        Relationships: []
      }
      doctor_sla_dashboard: {
        Row: {
          atrasados: number | null
          avg_resolution_hours: number | null
          crm: string | null
          crm_state: string | null
          doctor_id: string | null
          doctor_name: string | null
          doctor_user_id: string | null
          pendentes: number | null
          proximo_sla: string | null
          proximos_24h: number | null
        }
        Relationships: []
      }
      doctors: {
        Row: {
          crm: string | null
          crm_state: string | null
          id: string | null
          user_id: string | null
        }
        Insert: {
          crm?: string | null
          crm_state?: string | null
          id?: string | null
          user_id?: string | null
        }
        Update: {
          crm?: string | null
          crm_state?: string | null
          id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fraud_signals: {
        Row: {
          appointments_total: number | null
          cpf: string | null
          cpf_compartilhado_por: number | null
          first_name: string | null
          kyc_attempts: number | null
          kyc_rejs: number | null
          last_name: string | null
          login_fails_24h: number | null
          no_show_rate: number | null
          phone: string | null
          user_id: string | null
        }
        Relationships: []
      }
      security_dashboard: {
        Row: {
          metric: string | null
          value: number | null
          window_label: string | null
        }
        Relationships: []
      }
      wallet_balances: {
        Row: {
          available_balance: number | null
          total_earned: number | null
          total_transactions: number | null
          total_withdrawn: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_create_doctor_signup_invite: {
        Args: { p_email?: string; p_expires_days?: number; p_notes?: string }
        Returns: Json
      }
      archive_old_activity_logs: {
        Args: never
        Returns: {
          archived_count: number
          deleted_count: number
        }[]
      }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      consume_doctor_signup_invite: { Args: { p_code: string }; Returns: Json }
      cpf_in_use: { Args: { _cpf: string }; Returns: boolean }
      expire_subscriptions_and_cards: { Args: never; Returns: undefined }
      fn_accept_manager_invite: { Args: { p_token: string }; Returns: Json }
      fn_admin_doctor_kyc_list: { Args: never; Returns: Json[] }
      fn_admin_set_doctor_kyc: {
        Args: { p_doctor_id: string; p_status: string }
        Returns: undefined
      }
      fn_alert_sla_breach: { Args: never; Returns: undefined }
      fn_anonymize_old_patients: { Args: never; Returns: undefined }
      fn_auto_cancel_unpaid: { Args: never; Returns: undefined }
      fn_auto_close_resolved_tickets: { Args: never; Returns: undefined }
      fn_auto_complete_stale_consultations: { Args: never; Returns: undefined }
      fn_auto_no_show: { Args: never; Returns: undefined }
      fn_auto_pause_doctor_no_shows: { Args: never; Returns: undefined }
      fn_calculate_doctor_risk_score: { Args: never; Returns: undefined }
      fn_claim_ready_payouts: {
        Args: { p_doctor_id: string; p_withdrawal_id?: string }
        Returns: number
      }
      fn_consumir_contrato: {
        Args: {
          p_appointment_id: string
          p_contrato_id: string
          p_cpf?: string
          p_patient_user_id: string
          p_voucher_codigo?: string
        }
        Returns: Json
      }
      fn_contrato_elegivel: {
        Args: { p_contrato_id: string; p_cpf?: string; p_user_id?: string }
        Returns: boolean
      }
      fn_detect_churn: { Args: never; Returns: undefined }
      fn_doctor_available_balance: {
        Args: { p_doctor_id: string }
        Returns: number
      }
      fn_doctor_onboarding_progress: {
        Args: { p_user_id: string }
        Returns: Json
      }
      fn_expire_available_now: { Args: never; Returns: undefined }
      fn_expire_discount_cards: { Args: never; Returns: undefined }
      fn_expire_invite_codes: { Args: never; Returns: undefined }
      fn_expire_queue_entries: { Args: never; Returns: undefined }
      fn_generate_referral_code: { Args: { p_len?: number }; Returns: string }
      fn_get_cartao_summary: { Args: { p_user_id?: string }; Returns: Json }
      fn_handle_doctor_no_show: { Args: never; Returns: undefined }
      fn_idle_slot_suggestion: { Args: never; Returns: undefined }
      fn_increment_coupon_usage_atomic: {
        Args: { p_code: string }
        Returns: boolean
      }
      fn_nps_whatsapp_followup: { Args: never; Returns: undefined }
      fn_pix_expiry_reminder: { Args: never; Returns: undefined }
      fn_prescription_renewal_alert: { Args: never; Returns: undefined }
      fn_reengagement_inactive: { Args: never; Returns: undefined }
      fn_release_doctor_payouts: { Args: never; Returns: undefined }
      fn_send_appointment_reminders: { Args: never; Returns: undefined }
      fn_spend_pingo_ticket: {
        Args: {
          p_amount: number
          p_category?: string
          p_description?: string
          p_merchant: string
        }
        Returns: Json
      }
      fn_subscription_retry: { Args: never; Returns: undefined }
      fn_suggest_price_increase: { Args: never; Returns: undefined }
      fn_trigger_edge_email: {
        Args: { p_data: Json; p_to: string; p_type: string }
        Returns: undefined
      }
      fn_unclaim_payouts: {
        Args: { p_doctor_id: string; p_withdrawal_id?: string }
        Returns: undefined
      }
      fn_whatsapp_allowed: {
        Args: { p_category?: string; p_user_id: string }
        Returns: boolean
      }
      get_active_theme: { Args: never; Returns: Json }
      get_contract_invite_by_token: { Args: { p_token: string }; Returns: Json }
      get_maintenance_status: { Args: never; Returns: Json }
      get_public_blocks: {
        Args: never
        Returns: {
          block_key: string
          i18n: Json
          is_enabled: boolean
          page_slug: string
          published: Json
        }[]
      }
      get_public_doctor_profile: {
        Args: { p_doctor_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoke_edge_function: {
        Args: { fn_name: string; payload?: Json }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      mark_no_shows: { Args: never; Returns: undefined }
      meu_contrato_ativo: {
        Args: never
        Returns: {
          branding: Json
          contrato_id: string
          especialidades_permitidas: string[]
          modelo_cobranca: Database["public"]["Enums"]["contrato_cobranca"]
          nome: string
          tipo: Database["public"]["Enums"]["contrato_tipo"]
        }[]
      }
      publish_site_block: {
        Args: { p_block_id: string; p_change_note?: string }
        Returns: {
          block_key: string
          created_at: string
          display_name: string
          display_order: number
          draft: Json | null
          has_draft: boolean
          i18n: Json
          id: string
          is_enabled: boolean
          last_published_at: string | null
          last_published_by: string | null
          page_slug: string | null
          parent_id: string | null
          published: Json
          schema: Json
          scope: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "site_blocks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_doctor_slug: { Args: { p_slug: string }; Returns: string }
      resolve_tenant: {
        Args: { p_host?: string; p_slug?: string }
        Returns: {
          branding: Json
          contrato_id: string
          especialidades_permitidas: string[]
          modelo_cobranca: Database["public"]["Enums"]["contrato_cobranca"]
          nome: string
          subdominio: string
          tipo: Database["public"]["Enums"]["contrato_tipo"]
        }[]
      }
      rollback_site_block: {
        Args: { p_version_id: string }
        Returns: {
          block_key: string
          created_at: string
          display_name: string
          display_order: number
          draft: Json | null
          has_draft: boolean
          i18n: Json
          id: string
          is_enabled: boolean
          last_published_at: string | null
          last_published_by: string | null
          page_slug: string | null
          parent_id: string | null
          published: Json
          schema: Json
          scope: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "site_blocks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_doctor_by_name: { Args: { p_query: string }; Returns: Json[] }
      validate_doctor_signup_invite: {
        Args: { p_code: string; p_email: string }
        Returns: Json
      }
      validate_signature_public: {
        Args: { p_document_id: string }
        Returns: {
          certificate_alias: string
          doctor_crm: string
          doctor_name: string
          document_hash: string
          document_id: string
          document_type: string
          is_valid: boolean
          patient_name: string
          revoke_reason: string
          revoked_at: string
          signed_at: string
        }[]
      }
      verify_document_by_code: {
        Args: { _code: string }
        Returns: {
          doctor_crm: string
          doctor_name: string
          document_type: string
          is_valid: boolean
          patient_name_masked: string
          verified_at: string
        }[]
      }
      verify_document_public: {
        Args: { p_code: string }
        Returns: {
          details: Json
          doctor_crm: string
          doctor_name: string
          document_type: string
          issued_at: string
          patient_name: string
          verification_code: string
        }[]
      }
      verify_prescription_code: {
        Args: { p_code: string }
        Returns: {
          is_valid: boolean
          validated_at: string
          verification_code: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "doctor"
        | "patient"
        | "clinic"
        | "reception"
        | "support"
        | "partner"
        | "laudista"
        | "ophthalmologist"
        | "receptionist"
        | "affiliate"
        | "optician"
        | "cartao_beneficios"
      appointment_status:
        | "scheduled"
        | "waiting"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
        | "payment_pending"
        | "confirmed"
      appointment_type: "first_visit" | "return" | "urgency"
      approval_status: "pending" | "approved" | "rejected"
      contrato_cobranca: "mensal" | "pacote_pre_pago" | "gratuito_patrocinado"
      contrato_status: "ativo" | "pausado" | "encerrado"
      contrato_tipo: "empresa" | "prefeitura" | "ong" | "plano_proprio"
      council_type:
        | "CRM"
        | "CRP"
        | "CRN"
        | "CRFa"
        | "CREFITO"
        | "COREN"
        | "CRO"
        | "CRBM"
        | "CRF"
        | "CREF"
        | "CRESS"
        | "CRTR"
        | "OUTRO"
      legal_doc_kind:
        | "platform_terms"
        | "telemed_scheduled"
        | "telemed_ondemand"
        | "telemed_contract"
      refund_status: "pending" | "approved" | "refunded" | "rejected"
      refund_tier: "full" | "partial" | "none"
      ticket_priority: "low" | "medium" | "high" | "critical"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
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
      app_role: [
        "admin",
        "doctor",
        "patient",
        "clinic",
        "reception",
        "support",
        "partner",
        "laudista",
        "ophthalmologist",
        "receptionist",
        "affiliate",
        "optician",
        "cartao_beneficios",
      ],
      appointment_status: [
        "scheduled",
        "waiting",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
        "payment_pending",
        "confirmed",
      ],
      appointment_type: ["first_visit", "return", "urgency"],
      approval_status: ["pending", "approved", "rejected"],
      contrato_cobranca: ["mensal", "pacote_pre_pago", "gratuito_patrocinado"],
      contrato_status: ["ativo", "pausado", "encerrado"],
      contrato_tipo: ["empresa", "prefeitura", "ong", "plano_proprio"],
      council_type: [
        "CRM",
        "CRP",
        "CRN",
        "CRFa",
        "CREFITO",
        "COREN",
        "CRO",
        "CRBM",
        "CRF",
        "CREF",
        "CRESS",
        "CRTR",
        "OUTRO",
      ],
      legal_doc_kind: [
        "platform_terms",
        "telemed_scheduled",
        "telemed_ondemand",
        "telemed_contract",
      ],
      refund_status: ["pending", "approved", "refunded", "rejected"],
      refund_tier: ["full", "partial", "none"],
      ticket_priority: ["low", "medium", "high", "critical"],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
    },
  },
} as const
