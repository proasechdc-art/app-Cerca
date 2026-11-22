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

-- =====================================================================
-- ACTUALIZACION 2026-11-22: pedidos en EFECTIVO solo con saldo
-- ---------------------------------------------------------------------
-- NOTA: este bloque ya esta aplicado en el Supabase de Cerquita
-- (migracion "cash_orders_require_courier_balance"). Se guarda aqui como
-- registro y NO es para una base nueva y vacia: la base real tiene mas
-- tablas y funciones (ledger_entries, settlements, etc.) que este
-- archivo todavia no incluye.
--
-- REGLA: un pedido en efectivo solo puede pasar de 'ready' a 'on_way'
-- si el saldo disponible del repartidor (ganancias y ajustes sin
-- liquidar, menos el efectivo pendiente sin liquidar) es igual o mayor
-- al total del pedido. Los pedidos con pago electronico no se afectan.
-- El administrador y los procesos internos del sistema quedan exentos.
-- La app (src/Repartidor.tsx) aplica la misma cuenta para ocultar las
-- ofertas; esta funcion es la que la hace obligatoria en el servidor.
-- Para deshacer: restaurar la funcion sin el bloque "NUEVO".
-- =====================================================================
create or replace function public.orders_lock_finance()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare es_dueno boolean; saldo numeric;
begin
  if public.is_admin() or coalesce(auth.role(), '') = 'service_role' or coalesce(current_setting('cerquita.system', true), '') = 'on' then return new; end if;
  if (new.store_id, new.customer_id, new.payment_method, new.subtotal, new.delivery_fee, new.total, new.commission_pct, new.commission_amount, new.merchant_amount, new.courier_earnings, new.cerquita_revenue, new.cancelled_by, new.cancelled_at, new.dest_photo_path)
     is distinct from
     (old.store_id, old.customer_id, old.payment_method, old.subtotal, old.delivery_fee, old.total, old.commission_pct, old.commission_amount, old.merchant_amount, old.courier_earnings, old.cerquita_revenue, old.cancelled_by, old.cancelled_at, old.dest_photo_path) then
    raise exception 'Los valores financieros del pedido no se pueden modificar';
  end if;
  if new.status is distinct from old.status then
    es_dueno := exists (select 1 from public.stores s where s.id = new.store_id and s.owner_id = auth.uid());
    if not ((old.status = 'pending' and new.status = 'preparing' and es_dueno)
         or (old.status = 'preparing' and new.status = 'ready' and es_dueno)
         or (old.status = 'ready' and new.status = 'on_way' and new.courier_id = auth.uid())
         or (old.status = 'on_way' and new.status = 'delivered' and old.courier_id = auth.uid())) then
      raise exception 'Cambio de estado no permitido';
    end if;
    -- NUEVO: saldo del repartidor para pedidos en efectivo
    if old.status = 'ready' and new.status = 'on_way' and old.payment_method = 'cash' then
      select coalesce(sum(case when l.kind in ('courier_earning', 'adjustment') then l.amount
                               when l.kind = 'courier_cash_pending' then -l.amount
                               else 0 end), 0)
        into saldo
        from public.ledger_entries l
       where l.owner_id = new.courier_id
         and l.kind in ('courier_earning', 'adjustment', 'courier_cash_pending')
         and not exists (select 1 from public.settlement_entries se where se.entry_id = l.id);
      if saldo < old.total then
        raise exception 'Saldo insuficiente: este pedido en efectivo es de % y tu saldo disponible es de %', old.total, greatest(saldo, 0);
      end if;
    end if;
  end if;
  return new;
end $function$;
