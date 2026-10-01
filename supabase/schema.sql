create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null, description text, category text not null,
  price_cents int not null check (price_cents >= 0),
  emoji text, image_url text, in_stock boolean not null default true
);
create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  email text, phone text not null, address text not null, note text,
  total_cents int not null default 0, status text not null default 'placed',
  created_at timestamptz not null default now()
);
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id), name text not null,
  unit_price_cents int not null, qty int not null check (qty > 0)
);
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
create policy "anyone reads products" on products for select using (true);
create policy "own orders" on orders for select using (auth.uid() = user_id);
create policy "own order items" on order_items for select
  using (exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));

-- Orders are created only through this function; prices come from the DB, never the browser.
create function place_order(p_items jsonb, p_phone text, p_address text, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_order uuid; v_total int := 0; it jsonb; p products; q int;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  insert into orders(user_id, email, phone, address, note)
    values (auth.uid(), auth.jwt()->>'email', p_phone, p_address, p_note) returning id into v_order;
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it->>'qty')::int;
    select * into p from products where id = (it->>'id')::uuid and in_stock;
    if not found or q < 1 then raise exception 'An item is unavailable'; end if;
    insert into order_items(order_id, product_id, name, unit_price_cents, qty)
      values (v_order, p.id, p.name, p.price_cents, q);
    v_total := v_total + p.price_cents * q;
  end loop;
  if v_total = 0 then raise exception 'Cart is empty'; end if;
  update orders set total_cents = v_total where id = v_order;
  return v_order;
end $$;
revoke all on function place_order from public, anon;
grant execute on function place_order to authenticated;

insert into products(name, description, category, price_cents, emoji) values
('Fresh milk 500ml','Local dairy, chilled daily','Dairy',6500,'🥛'),
('Brown bread','Baked this morning','Bakery',7000,'🍞'),
('Eggs, tray of 30','Farm fresh','Dairy',48000,'🥚'),
('Tomatoes 1kg','Ripe and firm','Produce',12000,'🍅'),
('Sukuma wiki bunch','Picked yesterday','Produce',3000,'🥬'),
('Bananas 1kg','Sweet ripe','Produce',10000,'🍌'),
('Maize flour 2kg','Sifted','Pantry',21000,'🌽'),
('Rice 1kg','Pishori','Pantry',24000,'🍚'),
('Cooking oil 1L','Sunflower','Pantry',35000,'🫙'),
('Tea leaves 250g','Kenyan black tea','Pantry',12500,'🍵');
