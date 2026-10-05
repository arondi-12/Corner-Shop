-- Server-side cart, shared by the website and the mobile app.
create table cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  qty int not null check (qty > 0),
  unique (user_id, product_id)
);
alter table cart_items enable row level security;
create policy "own cart" on cart_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table cart_items; -- instant updates on every device
