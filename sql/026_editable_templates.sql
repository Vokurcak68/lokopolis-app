-- Editable templates: email texts, invoice note, legal pages
INSERT INTO shop_settings (key, value) VALUES
  ('email_order_confirmation_intro', '"Děkujeme za Vaši objednávku na Lokopolis.cz!"'),
  ('email_order_shipped_intro', '"Vaše objednávka byla odeslána!"'),
  ('email_welcome_intro', '"Vítejte v komunitě Lokopolis!"'),
  ('email_signature', '"S pozdravem,\nTým Lokopolis.cz"'),
  ('invoice_supplier_note', '"Nejsme plátci DPH."'),
  ('page_gdpr', 'null'),
  ('page_vop', 'null')
ON CONFLICT (key) DO NOTHING;
