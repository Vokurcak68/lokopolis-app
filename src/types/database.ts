export type UserRole = "user" | "author" | "moderator" | "admin";
export type ArticleStatus = "draft" | "pending" | "published" | "rejected";
export type CommentStatus = "published" | "hidden";
export type DownloadAccess = "public" | "authenticated";
export type DownloadCategory = "kolejovy-plan" | "stl-model" | "3d-tisk" | "navod" | "software" | "ostatni";
export type EventAccess = "public" | "authenticated";

export interface Profile {
  id: string;
  username: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: UserRole;
  loyalty_points: number;
  loyalty_level_id: string | null;
  phone: string | null;
  billing_name: string | null;
  billing_street: string | null;
  billing_city: string | null;
  billing_zip: string | null;
  billing_country: string | null;
  billing_ico: string | null;
  billing_dic: string | null;
  billing_company: string | null;
  permanent_discount_percent: number;
  volume_discount_percent: number;
  volume_discount_threshold: number;
  volume_discount_period_days: number;
  admin_note: string | null;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAddress {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  company: string | null;
  street: string;
  city: string;
  zip: string;
  country: string;
  phone: string | null;
  is_default: boolean;
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

// Competition types
export type CompetitionStatus = 'upcoming' | 'active' | 'voting' | 'finished';

export interface Competition {
  id: string;
  title: string;
  description: string | null;
  month: string;
  starts_at: string;
  ends_at: string;
  status: CompetitionStatus;
  prize: string | null;
  winner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompetitionEntry {
  id: string;
  competition_id: string;
  user_id: string;
  title: string;
  description: string | null;
  images: string[];
  scale: string | null;
  dimensions: string | null;
  landscape: string | null;
  vote_count: number;
  created_at: string;
  updated_at: string;
}

export interface CompetitionVote {
  id: string;
  entry_id: string;
  competition_id: string;
  user_id: string;
  created_at: string;
}

export interface CompetitionEntryWithAuthor extends CompetitionEntry {
  author: Profile | null;
}

export interface CompetitionWithWinner extends Competition {
  winner: CompetitionEntryWithAuthor | null;
}

// Bazar types
export type ListingCondition = 'new' | 'opened' | 'used' | 'parts';
export type ListingScale = 'TT' | 'H0' | 'N' | 'Z' | 'G' | '0' | '1' | 'other';
export type ListingCategory = 'lokomotivy' | 'vagony' | 'koleje' | 'prislusenstvi' | 'budovy' | 'elektronika' | 'literatura' | 'kolejiste' | 'ostatni';
export type ListingStatus = 'active' | 'reserved' | 'sold' | 'removed';

export interface Listing {
  id: string;
  title: string;
  description: string | null;
  price: number;
  condition: ListingCondition;
  scale: ListingScale | null;
  brand: string | null;
  category: ListingCategory;
  images: string[];
  seller_id: string;
  status: ListingStatus;
  location: string | null;
  shipping: boolean;
  personal_pickup: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface ListingWithSeller extends Listing {
  seller: Profile | null;
}

export interface BazarMessage {
  id: string;
  listing_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface SellerReview {
  id: string;
  seller_id: string;
  reviewer_id: string;
  listing_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

// Shop types
export type ShopProductStatus = 'active' | 'draft' | 'archived';
export type ShopOrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type StockMode = 'unlimited' | 'tracked' | 'preorder';
export type StockMovementType = 'reserve' | 'release' | 'sale' | 'restock' | 'adjustment' | 'return';

export interface ShopProduct {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  long_description: string | null;
  price: number;
  original_price: number | null;
  category: string;
  scale: string | null;
  cover_image_url: string | null;
  preview_images: string[];
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  tags: string[];
  featured: boolean;
  status: ShopProductStatus;
  download_count: number;
  is_digital: boolean;
  avg_rating: number;
  review_count: number;
  stock_mode: StockMode;
  stock_quantity: number | null;
  stock_reserved: number | null;
  stock_alert_threshold: number | null;
  max_per_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProductAttachment {
  id: string;
  product_id: string;
  title: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  sort_order: number;
  created_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  order_id: string | null;
  movement_type: StockMovementType;
  quantity: number;
  quantity_before: number | null;
  quantity_after: number | null;
  reserved_before: number | null;
  reserved_after: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  free_from: number | null;
  delivery_days: string | null;
  digital_only: boolean;
  physical_only: boolean;
  active: boolean;
  sort_order: number;
  shipping_type: "standard" | "pickup_point";
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  surcharge: number;
  instructions: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  product?: ShopProduct | null;
}

export interface ShopOrder {
  id: string;
  order_number: string;
  user_id: string | null;
  product_id: string | null;
  price: number;
  status: ShopOrderStatus;
  payment_method: string | null;
  shipping_method_id: string | null;
  payment_method_id: string | null;
  shipping_price: number;
  payment_surcharge: number;
  total_price: number | null;
  billing_name: string | null;
  billing_email: string | null;
  billing_phone: string | null;
  billing_street: string | null;
  billing_city: string | null;
  billing_zip: string | null;
  billing_country: string | null;
  billing_company: string | null;
  billing_ico: string | null;
  billing_dic: string | null;
  shipping_name: string | null;
  shipping_company: string | null;
  shipping_street: string | null;
  shipping_city: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  pickup_point_id: string | null;
  pickup_point_name: string | null;
  pickup_point_address: string | null;
  pickup_point_carrier: "balikovna" | "zasilkovna" | null;
  tracking_number: string | null;
  tracking_url: string | null;
  admin_order_note: string | null;
  coupon_id: string | null;
  coupon_code: string | null;
  coupon_discount: number;
  loyalty_points_earned: number;
  loyalty_points_used: number;
  loyalty_discount: number;
  notes: string | null;
  admin_notes: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface UserPurchase {
  id: string;
  user_id: string;
  product_id: string;
  order_id: string | null;
  granted_at: string;
}

export interface ShopOrderWithDetails extends ShopOrder {
  items: OrderItem[];
  product: ShopProduct | null;
  shipping: ShippingMethod | null;
  payment: PaymentMethod | null;
}

export interface UserPurchaseWithProduct extends UserPurchase {
  product: ShopProduct | null;
}

// === Coupons ===
export type CouponDiscountType = "percent" | "fixed";

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  min_order_amount: number | null;
  max_discount: number | null;
  max_uses: number | null;
  max_uses_per_user: number;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  product_ids: string[] | null;
  category_slugs: string[] | null;
  first_order_only: boolean;
  active: boolean;
  created_at: string;
}

export interface CouponUsage {
  id: string;
  coupon_id: string;
  order_id: string;
  user_id: string | null;
  discount_amount: number;
  used_at: string;
}

// === Loyalty Program ===
export interface LoyaltyLevel {
  id: string;
  name: string;
  slug: string;
  min_points: number;
  discount_percent: number;
  points_multiplier: number;
  color: string;
  icon: string;
  perks: string[] | null;
  sort_order: number;
  created_at: string;
}

export interface LoyaltyPointEntry {
  id: string;
  user_id: string;
  points: number;
  reason: string;
  order_id: string | null;
  description: string | null;
  created_at: string;
}

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  is_verified_purchase: boolean;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
  // joined
  profiles?: { username: string; display_name: string | null; avatar_url: string | null };
}

export interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

export interface CartItemData {
  product: ShopProduct;
  quantity: number;
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
