// Run with HANDOVER_DB_TESTS=1 against the configured project database.
// Fixtures and all status/code changes are rolled back; no real booking is changed.
import { describe, it, expect } from "vitest";
import postgres from "postgres";

describe.skipIf(process.env.HANDOVER_DB_TESTS !== "1")("secure handover backend", () => {
  it("enforces opposite-dashboard verification, visibility, lockout, expiry, reuse and assignment binding", async () => {
    const db = postgres(process.env.SUPABASE_DB_URL ?? "", { ssl: "require", max: 1 });
    let complete = false;
    try {
      await db.begin(async tx => {
        const customer = crypto.randomUUID();
        const partnerUser = crypto.randomUUID();
        const stranger = crypto.randomUUID();
        const [{ id: partner }] = await tx`insert into public.delivery_partners(user_id,partner_code,full_name,mobile,vehicle_type,vehicle_number,account_status) values(${partnerUser},'','OTP test','9999999999','bike','TEST-OTP','active') returning id`;
        // The signup guard resets account status unless an admin is calling.
        await tx`select set_config('luggo.system','on',true)`;
        await tx`update public.delivery_partners set account_status='active' where id=${partner}`;
        const [{ id: booking }] = await tx`insert into public.bookings(user_id,pickup_location,drop_off_date,pickup_date,amount,status,assigned_partner_id) values(${customer},'OTP transaction test',current_date,current_date,100,'cod_pending',${partner}) returning id`;
        const identity = async (uid: string) => { await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: uid, role: "authenticated" })},true)`; };
        const action = async (stage: string, command: string, code: string | null = null) => (await tx`select public.booking_handover_action(${booking}::uuid,${stage},${command},${code}) as result`)[0].result;
        const view = async () => (await tx`select public.get_booking_handovers(${booking}::uuid) as result`)[0].result;
        const denied = async (fn: () => Promise<unknown>) => {
          await tx`savepoint rejected_action`;
          let rejected = false;
          try { await fn(); } catch { rejected = true; }
          await tx`rollback to savepoint rejected_action`;
          expect(rejected).toBe(true);
        };
        await identity(stranger);
        await denied(view);
        await denied(() => action('pickup','generate'));
        await denied(async () => { await tx`set local role authenticated`; await tx`select code from public.booking_handovers`; });
        await identity(customer);
        await denied(() => action('pickup','generate'));
        await identity(partnerUser);
        expect((await action('delivery','generate')).ok).toBe(false);
        expect((await action('pickup','generate')).ok).toBe(true);
        const pickup = (await view()).pickup.code;
        expect(pickup).toMatch(/^\d{6}$/);
        await denied(() => action('pickup','verify',pickup));
        await identity(customer);
        expect((await view()).pickup.code).toBeNull();
        await denied(async () => { await tx`update public.bookings set status='delivered' where id=${booking}`; });
        const wrong = pickup === '000000' ? '111111' : '000000';
        for (let count = 0; count < 5; count++) expect((await action('pickup','verify',wrong)).ok).toBe(false);
        expect((await view()).pickup.attempts).toBe(5);
        expect((await action('pickup','verify',pickup)).ok).toBe(false);
        await tx`update public.booking_handovers set locked_until=now()-interval '1 second',expires_at=now()-interval '1 second' where booking_id=${booking}`;
        expect((await action('pickup','verify',pickup)).ok).toBe(false);
        await identity(partnerUser);
        expect((await action('pickup','generate')).ok).toBe(true);
        const replacement = (await view()).pickup.code;
        await identity(customer);
        expect((await action('pickup','verify',replacement)).ok).toBe(true);
        expect((await view()).status).toBe('picked_up');
        expect((await view()).pickup.verified_at).toBeTruthy();
        expect((await action('pickup','verify',replacement)).ok).toBe(false);
        await identity(partnerUser);
        expect((await action('delivery','generate')).ok).toBe(true);
        expect((await view()).delivery.code).toBeNull();
        await identity(customer);
        const delivery = (await view()).delivery.code;
        expect(delivery).toMatch(/^\d{6}$/);
        expect(delivery).not.toBe(replacement);
        await denied(() => action('delivery','verify',delivery));
        await identity(partnerUser);
        expect((await action('delivery','verify',delivery)).ok).toBe(true);
        expect((await view()).status).toBe('delivered');
        expect((await view()).delivery.verified_at).toBeTruthy();
        expect((await action('delivery','verify',delivery)).ok).toBe(false);
        const [{ count }] = await tx`select count(*)::int as count from public.handover_audit where booking_id=${booking} and event='verified'`;
        expect(count).toBe(2);
        await denied(async () => { await tx`update public.bookings set assigned_partner_id=null where id=${booking}`; });
        complete = true;
        throw new Error('ROLLBACK_TEST_FIXTURES');
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'ROLLBACK_TEST_FIXTURES') throw error;
    } finally { await db.end(); }
    expect(complete).toBe(true);
  }, 30000);
});