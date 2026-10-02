-- CERQUITA: pega TODO esto en Supabase > SQL Editor > Run
create table profiles (id uuid primary key references auth.users on delete cascade, role text not null check (role in ('cliente','comercio','repartidor')), name text);
create table stores (id uuid primary key default gen_random_uuid(), owner_id uuid not null references profiles(id), name text not null, address text, lat double precision, lng double precision);
create table products (id uuid primary key default gen_random_uuid(), store_id uuid not null references stores(id) on delete cascade, name text not null, price integer not null);
create table orders (
  id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
  store_id uuid not null references stores(id), customer_id uuid not null references profiles(id), courier_id uuid references profiles(id),
  items jsonb not null, total integer not null, address text, dest_lat double precision, dest_lng double precision,
  status text not null default 'pending' check (status in ('pending','preparing','ready','on_way','delivered')),
  courier_lat double precision, courier_lng double precision);

create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into profiles(id, role, name) values (new.id, coalesce(new.raw_user_meta_data->>'role','cliente'), new.raw_user_meta_data->>'name'); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

alter table profiles enable row level security; alter table stores enable row level security;
alter table products enable row level security; alter table orders enable row level security;

create policy p_prof on profiles for select using (id = auth.uid());
create policy p_store_r on stores for select using (true);
create policy p_store_w on stores for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy p_prod_r on products for select using (true);
create policy p_prod_w on products for all using (exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy o_ins on orders for insert with check (customer_id = auth.uid());
create policy o_sel on orders for select using (customer_id = auth.uid() or courier_id = auth.uid()
  or (status = 'ready' and courier_id is null) or exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy o_upd on orders for update using (courier_id = auth.uid() or (status = 'ready' and courier_id is null)
  or exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid()));

alter table orders replica identity full;
alter publication supabase_realtime add table orders;
