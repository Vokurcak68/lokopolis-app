export type UserRole = "user" | "author" | "moderator" | "admin";
export type ArticleStatus = "draft" | "pending" | "published" | "rejected";
export type CommentStatus = "published" | "hidden";
export type DownloadAccess = "public" | "authenticated";
export type DownloadCategory = "kolejovy-plan" | "stl-model" | "3d-tisk" | "navod" | "software" | "ostatni";
export type EventAccess = "public" | "authenticated";

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
  view_count: number;
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

// Gallery types
export type GalleryItemType = "image" | "video" | "youtube";
export type GalleryAccess = "public" | "authenticated";

export interface GalleryItem {
  id: string;
  title: string;
  description: string | null;
  type: GalleryItemType;
  media_url: string;
  thumbnail_url: string | null;
  access: GalleryAccess;
  uploaded_by: string | null;
  album_id: string | null;
  created_at: string;
  updated_at: string;
}

// Gallery Album types
export interface GalleryAlbum {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  access: GalleryAccess;
  created_by: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  author_username?: string;
}

// Event types
export interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  end_date: string | null;
  location: string | null;
  url: string | null;
  cover_image_url: string | null;
  access: EventAccess;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Tag types
export interface Tag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface ArticleTag {
  article_id: string;
  tag_id: string;
}

// Rozšířené typy s relacemi
export interface ArticleWithRelations extends Article {
  author: Profile | null;
  category: Category | null;
}

export interface CommentWithAuthor extends Comment {
  author: Profile | null;
}

// Forum types
export type ForumReportStatus = "pending" | "resolved" | "dismissed";

export interface ForumSection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

export interface ForumThread {
  id: string;
  section_id: string;
  author_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_locked: boolean;
  post_count: number;
  last_post_at: string;
  last_post_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForumPost {
  id: string;
  thread_id: string;
  author_id: string;
  content: string;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface ForumReaction {
  id: string;
  post_id: string | null;
  thread_id: string | null;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ForumReport {
  id: string;
  post_id: string | null;
  thread_id: string | null;
  reporter_id: string;
  reason: string;
  status: ForumReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface ForumBan {
  id: string;
  user_id: string;
  banned_by: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
}

// Rozšířené forum typy
export interface ForumThreadWithRelations extends ForumThread {
  author: Profile | null;
  section: ForumSection | null;
  last_poster: Profile | null;
}

export interface ForumPostWithRelations extends ForumPost {
  author: Profile | null;
}

export interface ForumSectionWithCounts extends ForumSection {
  thread_count: number;
  post_count: number;
  last_thread: { title: string; id: string; last_post_at: string } | null;
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
