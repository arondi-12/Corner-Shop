alter table orders
  add column payment_method text not null default 'cod' check (payment_method in ('cod','mpesa')),
  add column payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','failed')),
  add column mpesa_checkout_id text,
  add column mpesa_receipt text;
