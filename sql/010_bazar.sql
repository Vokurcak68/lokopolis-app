-- Bazar listings
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL, -- cena v CZK (celé koruny)
  condition TEXT NOT NULL CHECK (condition IN ('new', 'opened', 'used', 'parts')),
  scale TEXT CHECK (scale IN ('TT', 'H0', 'N', 'Z', 'G', '0', '1', 'other')),
  brand TEXT, -- Tillig, Roco, Piko, Fleischmann, atd.
  category TEXT NOT NULL CHECK (category IN (
    'lokomotivy', 'vagony', 'koleje', 'prislusenstvi', 'budovy', 
    'elektronika', 'literatura', 'kolejiste', 'ostatni'
  )),
  images TEXT[] DEFAULT '{}', -- array URL fotek z Supabase Storage
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reserved', 'sold', 'removed')),
  location TEXT, -- město/oblast
  shipping BOOLEAN DEFAULT true, -- nabízí zaslání
  personal_pickup BOOLEAN DEFAULT true, -- nabízí osobní předání
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bazar messages (interní zprávy)
CREATE TABLE bazar_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seller reviews
CREATE TABLE seller_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reviewer_id, listing_id) -- 1 hodnocení na transakci
);

-- Watchdogs (hlídací pes)
CREATE TABLE watchdogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  query TEXT, -- textový dotaz
  scale TEXT,
  brand TEXT,
  category TEXT,
  max_price INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_category ON listings(category);
CREATE INDEX idx_listings_scale ON listings(scale);
CREATE INDEX idx_listings_seller ON listings(seller_id);
CREATE INDEX idx_listings_created ON listings(created_at DESC);
CREATE INDEX idx_bazar_messages_recipient ON bazar_messages(recipient_id, read);
CREATE INDEX idx_bazar_messages_listing ON bazar_messages(listing_id);
CREATE INDEX idx_seller_reviews_seller ON seller_reviews(seller_id);

-- RLS
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bazar_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchdogs ENABLE ROW LEVEL SECURITY;

-- Listings: anyone can read active, owner can CRUD own
CREATE POLICY "listings_read" ON listings FOR SELECT USING (status = 'active' OR seller_id = auth.uid() OR EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "listings_insert" ON listings FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "listings_update" ON listings FOR UPDATE USING (auth.uid() = seller_id OR EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "listings_delete" ON listings FOR DELETE USING (auth.uid() = seller_id OR EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Messages: only sender or recipient can see
CREATE POLICY "messages_read" ON bazar_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "messages_insert" ON bazar_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "messages_update" ON bazar_messages FOR UPDATE USING (auth.uid() = recipient_id); -- mark as read

-- Reviews: anyone can read, authenticated can write
CREATE POLICY "reviews_read" ON seller_reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert" ON seller_reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id AND auth.uid() != seller_id);

-- Watchdogs: only owner
CREATE POLICY "watchdogs_all" ON watchdogs FOR ALL USING (auth.uid() = user_id);

-- Helper: average seller rating
CREATE OR REPLACE FUNCTION get_seller_rating(p_seller_id UUID)
RETURNS TABLE(avg_rating NUMERIC, review_count BIGINT) AS $$
  SELECT COALESCE(AVG(rating), 0)::NUMERIC(2,1), COUNT(*) FROM seller_reviews WHERE seller_id = p_seller_id;
$$ LANGUAGE sql STABLE;

-- Storage bucket for listing images
INSERT INTO storage.buckets (id, name, public) VALUES ('bazar', 'bazar', true) ON CONFLICT DO NOTHING;
CREATE POLICY "bazar_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'bazar' AND auth.uid() IS NOT NULL);
CREATE POLICY "bazar_read" ON storage.objects FOR SELECT USING (bucket_id = 'bazar');
CREATE POLICY "bazar_delete" ON storage.objects FOR DELETE USING (bucket_id = 'bazar' AND auth.uid() IS NOT NULL);
