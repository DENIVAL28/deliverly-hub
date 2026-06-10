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
      avaliacoes: {
        Row: {
          cliente_nome: string | null
          comentario: string | null
          created_at: string | null
          empresa_id: string
          id: string
          nota: number
          pedido_id: string
        }
        Insert: {
          cliente_nome?: string | null
          comentario?: string | null
          created_at?: string | null
          empresa_id: string
          id?: string
          nota: number
          pedido_id: string
        }
        Update: {
          cliente_nome?: string | null
          comentario?: string | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          nota?: number
          pedido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          created_at: string
          empresa_id: string
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string | null
          empresa_id: string
          id: string
          tipo: string
          usos_atual: number | null
          usos_max: number | null
          validade: string | null
          valor: number
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          empresa_id: string
          id?: string
          tipo: string
          usos_atual?: number | null
          usos_max?: number | null
          validade?: string | null
          valor: number
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          empresa_id?: string
          id?: string
          tipo?: string
          usos_atual?: number | null
          usos_max?: number | null
          validade?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cupons_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          aberto: boolean | null
          banner_url: string | null
          cep: string | null
          chave_pix: string | null
          cidade: string | null
          cidade_recebedor: string | null
          cnpj: string | null
          cor_primaria: string | null
          cor_secundaria: string | null
          cpf_cnpj: string | null
          created_at: string
          dias_semana: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          horario_abertura: string | null
          horario_fechamento: string | null
          id: string
          logo_url: string | null
          nome_fantasia: string
          nome_recebedor: string | null
          pedido_minimo: number | null
          plano: string
          plano_id: string | null
          razao_social: string | null
          segmento: string | null
          slug: string
          status: Database["public"]["Enums"]["empresa_status"]
          taxa_entrega: number | null
          telefone: string | null
          tempo_entrega: string | null
          tipo_chave_pix: string | null
          updated_at: string
          vencimento: string | null
          whatsapp: string | null
          zapi_client_token: string | null
          zapi_instance: string | null
          zapi_token: string | null
        }
        Insert: {
          aberto?: boolean | null
          banner_url?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          cidade_recebedor?: string | null
          cnpj?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          dias_semana?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          horario_abertura?: string | null
          horario_fechamento?: string | null
          id?: string
          logo_url?: string | null
          nome_fantasia: string
          nome_recebedor?: string | null
          pedido_minimo?: number | null
          plano?: string
          plano_id?: string | null
          razao_social?: string | null
          segmento?: string | null
          slug: string
          status?: Database["public"]["Enums"]["empresa_status"]
          taxa_entrega?: number | null
          telefone?: string | null
          tempo_entrega?: string | null
          tipo_chave_pix?: string | null
          updated_at?: string
          vencimento?: string | null
          whatsapp?: string | null
          zapi_client_token?: string | null
          zapi_instance?: string | null
          zapi_token?: string | null
        }
        Update: {
          aberto?: boolean | null
          banner_url?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          cidade_recebedor?: string | null
          cnpj?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          dias_semana?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          horario_abertura?: string | null
          horario_fechamento?: string | null
          id?: string
          logo_url?: string | null
          nome_fantasia?: string
          nome_recebedor?: string | null
          pedido_minimo?: number | null
          plano?: string
          plano_id?: string | null
          razao_social?: string | null
          segmento?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["empresa_status"]
          taxa_entrega?: number | null
          telefone?: string | null
          tempo_entrega?: string | null
          tipo_chave_pix?: string | null
          updated_at?: string
          vencimento?: string | null
          whatsapp?: string | null
          zapi_client_token?: string | null
          zapi_instance?: string | null
          zapi_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      entregadores: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          empresa_id: string
          id: string
          lat: number | null
          lng: number | null
          nome: string
          status: string | null
          telefone: string | null
          ultima_localizacao: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          empresa_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          nome: string
          status?: string | null
          telefone?: string | null
          ultima_localizacao?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          nome?: string
          status?: string | null
          telefone?: string | null
          ultima_localizacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entregadores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos_opcoes: {
        Row: {
          created_at: string | null
          id: string
          max_escolhas: number | null
          multiplo: boolean | null
          nome: string
          obrigatorio: boolean | null
          ordem: number | null
          produto_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_escolhas?: number | null
          multiplo?: boolean | null
          nome: string
          obrigatorio?: boolean | null
          ordem?: number | null
          produto_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          max_escolhas?: number | null
          multiplo?: boolean | null
          nome?: string
          obrigatorio?: boolean | null
          ordem?: number | null
          produto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupos_opcoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      opcoes: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          grupo_id: string
          id: string
          nome: string
          preco_adicional: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          grupo_id: string
          id?: string
          nome: string
          preco_adicional?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          grupo_id?: string
          id?: string
          nome?: string
          preco_adicional?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opcoes_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_opcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          id: string
          nome: string
          observacao: string | null
          pedido_id: string
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          subtotal: number
        }
        Insert: {
          id?: string
          nome: string
          observacao?: string | null
          pedido_id: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          subtotal?: number
        }
        Update: {
          id?: string
          nome?: string
          observacao?: string | null
          pedido_id?: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_endereco: string | null
          cliente_nome: string
          cliente_telefone: string | null
          created_at: string
          empresa_id: string
          entregador_id: string | null
          entregador_nome: string | null
          forma_pagamento: string | null
          id: string
          mesa: string | null
          numero: number
          observacao: string | null
          status: Database["public"]["Enums"]["pedido_status"]
          subtotal: number
          taxa_entrega: number
          tipo: string | null
          total: number
          updated_at: string
        }
        Insert: {
          cliente_endereco?: string | null
          cliente_nome: string
          cliente_telefone?: string | null
          created_at?: string
          empresa_id: string
          entregador_id?: string | null
          entregador_nome?: string | null
          forma_pagamento?: string | null
          id?: string
          mesa?: string | null
          numero?: number
          observacao?: string | null
          status?: Database["public"]["Enums"]["pedido_status"]
          subtotal?: number
          taxa_entrega?: number
          tipo?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          cliente_endereco?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          created_at?: string
          empresa_id?: string
          entregador_id?: string | null
          entregador_nome?: string | null
          forma_pagamento?: string | null
          id?: string
          mesa?: string | null
          numero?: number
          observacao?: string | null
          status?: Database["public"]["Enums"]["pedido_status"]
          subtotal?: number
          taxa_entrega?: number
          tipo?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_entregador_id_fkey"
            columns: ["entregador_id"]
            isOneToOne: false
            referencedRelation: "entregadores"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          limite_pedidos: number | null
          limite_produtos: number | null
          limite_usuarios: number | null
          nome: string
          recursos: Json
          slug: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          limite_pedidos?: number | null
          limite_produtos?: number | null
          limite_usuarios?: number | null
          nome: string
          recursos?: Json
          slug: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          limite_pedidos?: number | null
          limite_produtos?: number | null
          limite_usuarios?: number | null
          nome?: string
          recursos?: Json
          slug?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          controlar_estoque: boolean | null
          created_at: string
          descricao: string | null
          empresa_id: string
          estoque: number | null
          foto_url: string | null
          id: string
          nome: string
          preco: number
          preco_promocional: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          controlar_estoque?: boolean | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          estoque?: number | null
          foto_url?: string | null
          id?: string
          nome: string
          preco?: number
          preco_promocional?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          controlar_estoque?: boolean | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          estoque?: number | null
          foto_url?: string | null
          id?: string
          nome?: string
          preco?: number
          preco_promocional?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          empresa_id: string | null
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      criar_empresa_onboarding: {
        Args: {
          p_cidade?: string
          p_cnpj?: string
          p_cor_primaria: string
          p_nome_fantasia: string
          p_slug: string
          p_whatsapp?: string
        }
        Returns: string
      }
      excluir_empresa_completo: {
        Args: { p_empresa_id: string }
        Returns: undefined
      }
      finalizar_pedido: {
        Args: {
          p_cliente_endereco?: string
          p_cliente_nome: string
          p_cliente_telefone?: string
          p_cupom_id?: string
          p_empresa_id: string
          p_forma_pagamento?: string
          p_itens?: Json
          p_mesa?: string
          p_observacao?: string
          p_status?: string
          p_subtotal?: number
          p_taxa_entrega?: number
          p_tipo?: string
          p_total?: number
        }
        Returns: Json
      }
      get_user_empresa_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_master: { Args: { _user_id: string }; Returns: boolean }
      validar_cnpj: { Args: { p_cnpj: string }; Returns: boolean }
    }
    Enums: {
      app_role: "master" | "empresa_owner" | "empresa_staff"
      empresa_status: "ativa" | "vencida" | "bloqueada"
      pedido_status:
        | "novo"
        | "aceito"
        | "preparo"
        | "entrega"
        | "finalizado"
        | "cancelado"
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
      app_role: ["master", "empresa_owner", "empresa_staff"],
      empresa_status: ["ativa", "vencida", "bloqueada"],
      pedido_status: [
        "novo",
        "aceito",
        "preparo",
        "entrega",
        "finalizado",
        "cancelado",
      ],
    },
  },
} as const
