-- Atomic Cash Counter bill settlement.
--
-- Why this exists
-- ---------------
-- The Cash Counter "Mark Paid" flow performed its writes as a series of
-- client-side statements against `orders`, `table_sessions`, `tables`,
-- `table_requests` and `payments`. Two problems followed from that:
--
--   1. Fragility. `table_sessions` UPDATE is gated by
--      `staff_update_sessions`, which admits only an approved
--      cashier/serving row (or an admin) whose `staff.email` exactly
--      matches the JWT email. Any identity outside that set — a
--      kitchen account, an owner whose `staff` row is missing, an
--      account whose email case or value has drifted from the staff
--      row — is refused with:
--          42501 new row violates row-level security policy
--          for table "table_sessions"
--      A guard that is correct for exactly one role, and that produces
--      an opaque RLS error for everyone else, is the wrong place to
--      encode a business operation.
--
--   2. Non-atomicity. The client marked orders paid, then closed the
--      session, then freed the table, then wrote the payment row. A
--      failure at step 2 or 3 left the money taken but the table
--      occupied, or the session closed with no payment recorded.
--
-- This function performs the whole settlement in one transaction, so
-- the flow either lands completely or not at all.
--
-- Security model
-- --------------
-- SECURITY DEFINER is required, because RLS is the very thing being
-- routed around: the caller must not need direct UPDATE rights on
-- `table_sessions` to close a session. The authority is therefore
-- re-established *inside* the function, and the function is
-- deliberately no broader than the policies it replaces —
-- `is_approved_staff(array['cashier','serving']) OR is_admin()` is
-- exactly the `qual`/`with_check` of `staff_update_sessions` and
-- `staff_update_tables`. No table policy is loosened, disabled, or
-- added to. search_path is pinned. EXECUTE is granted to
-- `authenticated` only, never to `anon`.
--
-- The discount is read from `discounts` inside the function rather
-- than accepted from the caller, so the amount actually applied is
-- the amount the owner approved and cannot be inflated by a tampered
-- client payload.

create or replace function public.settle_cashier_bill(
  p_order_id uuid default null,
  p_session_id uuid default null,
  p_tip numeric default 0,
  p_payment_mode text default 'CASH'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_now        timestamptz := now();
  v_session    public.table_sessions%rowtype;
  v_discount   numeric    := 0;
  v_dstatus    text;
  v_original   numeric    := 0;
  v_grand      numeric    := 0;
  v_alloc      numeric    := 0;
  v_remaining  numeric    := 0;
  v_order      record;
  v_order_ids  uuid[]     := '{}';
  v_last       uuid;
  v_ordered    int        := 0;
  v_grand_tip  numeric;
  v_payment_id uuid;
  v_freed      boolean    := false;
begin
  ------------------------------------------------------------------
  -- Authorisation. Mirrors the RLS policy this function supersedes.
  ------------------------------------------------------------------
  if not (is_approved_staff(array['cashier'::text, 'serving'::text]) or is_admin()) then
    raise exception 'Not authorised to settle bills'
      using errcode = '42501';
  end if;

  ------------------------------------------------------------------
  -- Argument validation.
  ------------------------------------------------------------------
  if p_order_id is null and p_session_id is null then
    raise exception 'Either an order or a session is required'
      using errcode = '22023';
  end if;

  if p_order_id is not null and p_session_id is not null then
    raise exception 'Specify either an order or a session, not both'
      using errcode = '22023';
  end if;

  if p_payment_mode is null or p_payment_mode not in ('CASH', 'UPI', 'CARD') then
    raise exception 'Invalid payment mode: %', coalesce(p_payment_mode, 'null')
      using errcode = '22023';
  end if;

  if p_tip is null or p_tip < 0 then
    raise exception 'Tip must be zero or greater'
      using errcode = '22023';
  end if;

  v_grand_tip := round(coalesce(p_tip, 0), 2);

  ------------------------------------------------------------------
  -- Lock the session for the duration of the transaction so a
  -- concurrent settle cannot double-pay the same meal.
  ------------------------------------------------------------------
  if p_session_id is not null then
    select * into v_session
      from public.table_sessions
     where id = p_session_id
       for update;

    if not found then
      raise exception 'Table session % does not exist', p_session_id
        using errcode = 'P0002';
    end if;

    if v_session.status = 'expired' then
      raise exception 'Table session % has expired', p_session_id
        using errcode = '22023';
    end if;
  end if;

  ------------------------------------------------------------------
  -- A bill can only be settled once. This is what makes a retry
  -- after a dropped connection safe.
  ------------------------------------------------------------------
  if exists (
    select 1
      from public.payments p
     where (p_order_id is not null and p.order_id = p_order_id)
        or (p_session_id is not null and p.session_id = p_session_id)
  ) then
    raise exception 'This bill has already been paid'
      using errcode = '23505';
  end if;

  ------------------------------------------------------------------
  -- Discount, read from the ledger rather than the request body.
  ------------------------------------------------------------------
  select d.discount_amount, d.status
    into v_discount, v_dstatus
    from public.discounts d
   where (p_order_id is not null and d.order_id = p_order_id)
      or (p_session_id is not null and d.session_id = p_session_id)
   order by (p_order_id is not null) desc,
            d.requested_at desc nulls last
   limit 1;

  if v_dstatus = 'PENDING' then
    raise exception 'Payment is locked while the discount is pending owner approval'
      using errcode = '22023';
  end if;

  if v_dstatus in ('APPROVED', 'AUTO_APPROVED') then
    v_discount := greatest(coalesce(v_discount, 0), 0);
  else
    v_discount := 0;
  end if;

  ------------------------------------------------------------------
  -- Orders in scope. `orders.session_id` is TEXT while
  -- `table_sessions.id` is UUID, hence the explicit ::text cast.
  ------------------------------------------------------------------
  if p_session_id is not null then
    select coalesce(array_agg(o.id), '{}'), coalesce(sum(o.subtotal), 0)
      into v_order_ids, v_original
      from public.orders o
     where o.session_id = p_session_id::text
       and o.status <> 'CANCELLED';
  else
    -- A single takeaway/delivery order: its own subtotal is the
    -- whole bill, so there is nothing to allocate a discount across.
    select coalesce(array_agg(o.id), '{}'), coalesce(sum(o.subtotal), 0)
      into v_order_ids, v_original
      from public.orders o
     where o.id = p_order_id;
  end if;

  if coalesce(array_length(v_order_ids, 1), 0) = 0 then
    raise exception 'There are no orders to bill'
      using errcode = '22023';
  end if;

  v_last := v_order_ids[array_length(v_order_ids, 1)];

  if v_discount > v_original then
    raise exception 'Discount cannot exceed the bill subtotal'
      using errcode = '22023';
  end if;

  ------------------------------------------------------------------
  -- Every order must have been served before money is taken, the
  -- same condition the cashier UI gates the button on.
  ------------------------------------------------------------------
  if exists (
    select 1
      from public.orders o
     where o.id = any (v_order_ids)
       and o.status <> 'COMPLETED'
  ) then
    raise exception 'Food must be served before payment'
      using errcode = '22023';
  end if;

  ------------------------------------------------------------------
  -- Apply the discount across the orders, pro-rata by subtotal, with
  -- the rounding remainder carried on the last order so the parts sum
  -- to the whole exactly. Identical to the arithmetic the client
  -- performed, so bills do not shift by a rupee on the move.
  ------------------------------------------------------------------
  v_remaining := v_discount;

  for v_order in
    select o.id, o.subtotal, o.delivery_charge
      from public.orders o
     where o.id = any (v_order_ids)
     order by o.created_at, o.id
  loop
    if v_order.id = v_last then
      v_alloc := round(v_remaining, 2);
    else
      v_alloc := round(
        (coalesce(v_order.subtotal, 0) / nullif(v_original, 0)) * v_discount,
        2
      );
      v_remaining := v_remaining - v_alloc;
    end if;

    v_grand := v_grand + greatest(
      0,
      round(coalesce(v_order.subtotal, 0) - v_alloc + coalesce(v_order.delivery_charge, 0), 2)
    );

    update public.orders
       set status     = 'COMPLETED',
           paid       = true,
           paid_at    = v_now,
           discount   = v_alloc,
           total      = greatest(0, round(coalesce(subtotal, 0) - v_alloc + coalesce(delivery_charge, 0), 2)),
           updated_at = v_now
     where id = v_order.id;

    v_ordered := v_ordered + 1;
  end loop;

  ------------------------------------------------------------------
  -- Close the session and hand the table back.
  ------------------------------------------------------------------
  if p_session_id is not null then
    update public.table_sessions
       set status            = 'completed',
           ended_at          = v_now,
           bill_requested    = false,
           bill_requested_at = null
     where id = p_session_id;

    -- Matched on the session being closed, so a table that has
    -- already been claimed by a new party is never handed a second
    -- "FREE" on the strength of this bill.
    update public.tables
       set status             = 'FREE',
           current_session_id = null
     where id = v_session.table_id
       and current_session_id = p_session_id;

    v_freed := found;

    update public.table_requests
       set status      = 'RESOLVED',
           resolved_at = v_now
     where session_id = p_session_id
       and status = 'PENDING';
  end if;

  ------------------------------------------------------------------
  -- Record the payment. Same transaction as everything above, so the
  -- ledger and the table can never disagree.
  ------------------------------------------------------------------
  insert into public.payments (order_id, session_id, amount, tip, payment_mode, paid_at)
  values (p_order_id, p_session_id, v_grand, v_grand_tip, p_payment_mode, v_now)
  returning id into v_payment_id;

  return jsonb_build_object(
    'payment_id',    v_payment_id,
    'grand_total',   v_grand,
    'tip',           v_grand_tip,
    'amount',        v_grand + v_grand_tip,
    'discount',      v_discount,
    'payment_mode',  p_payment_mode,
    'orders_updated', v_ordered,
    'session_closed', p_session_id is not null,
    'table_freed',    v_freed
  );
end;
$function$;

comment on function public.settle_cashier_bill(uuid, uuid, numeric, text) is
  'Settles a Cash Counter bill (orders paid, session closed, table freed, payment recorded) in one transaction. Callable by approved cashier/serving staff and admins.';

revoke all on function public.settle_cashier_bill(uuid, uuid, numeric, text) from public;
revoke all on function public.settle_cashier_bill(uuid, uuid, numeric, text) from anon;
grant execute on function public.settle_cashier_bill(uuid, uuid, numeric, text) to authenticated;
