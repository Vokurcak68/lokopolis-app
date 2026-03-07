export type UserRole = "user" | "author" | "moderator" | "admin";
export type ArticleStatus = "draft" | "pending" | "published" | "rejected";
export type CommentStatus = "published" | "hidden";
export type DownloadAccess = "public" | "authenticated";
export type DownloadCategory = "kolejovy-plan" | "stl-model" | "3d-tisk" | "navod" | "software" | "ostatni";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  cover_image_url: string | null;
  category_id: string | null;
  author_id: string | null;
  status: ArticleStatus;
  verified: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  article_id: string;
  author_id: string | null;
  content: string;
  status: CommentStatus;
  created_at: string;
}

export interface Download {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  thumbnail_url: string | null;
  category: DownloadCategory;
  access: DownloadAccess;
  download_count: number;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

// Rozšířené typy s relacemi
export interface ArticleWithRelations extends Article {
  author: Profile | null;
  category: Category | null;
}

export interface CommentWithAuthor extends Comment {
  author: Profile | null;
}

// Supabase Database type pro type-safe klienta
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          role?: UserRole;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: Category;
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          icon?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          icon?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      articles: {
        Row: Article;
        Insert: {
          id?: string;
          title: string;
          slug: string;
          content?: string | null;
          excerpt?: string | null;
          cover_image_url?: string | null;
          category_id?: string | null;
          author_id?: string | null;
          status?: ArticleStatus;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          slug?: string;
          content?: string | null;
          excerpt?: string | null;
          cover_image_url?: string | null;
          category_id?: string | null;
          author_id?: string | null;
          status?: ArticleStatus;
          published_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "articles_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "articles_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: Comment;
        Insert: {
          id?: string;
          article_id: string;
          author_id?: string | null;
          content: string;
          status?: CommentStatus;
          created_at?: string;
        };
        Update: {
          article_id?: string;
          author_id?: string | null;
          content?: string;
          status?: CommentStatus;
        };
        Relationships: [
          {
            foreignKeyName: "comments_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
