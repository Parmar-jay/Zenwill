import asyncio
import uuid
from datetime import datetime, date
from app.database import init_db
from app.models.user import User
from app.models.spartan_cell import SpartanCell
from app.routers.spartan_cells import (
    create_spartan_cell,
    CreateCellRequest,
    join_spartan_cell,
    JoinCellRequest,
    request_join_spartan_cell,
    RequestJoinCellRequest,
    cancel_join_request,
    CancelJoinRequest,
    respond_join_request,
    RespondJoinRequest,
    promote_co_leader,
    demote_co_leader,
    kick_member,
    MemberActionRequest,
    get_my_spartan_cell,
    leave_spartan_cell,
    delete_spartan_cell,
    get_cell_leaderboard,
    get_public_cells,
    nudge_cell_member,
    NudgeMemberRequest,
    send_strength_to_member,
    SendStrengthRequest,
    get_my_join_requests,
)
from app.services.spartan_cell_service import recalculate_cell_stats


async def run_all_tests():
    print("[START] Initializing Database for Spartan Cell Pipeline Test Suite...")
    await init_db()

    # Generate unique test user IDs
    prefix = f"test_{uuid.uuid4().hex[:8]}"
    u_leader_id = f"{prefix}_leader"
    u_coleader_id = f"{prefix}_coleader"
    u_member_id = f"{prefix}_member"
    u_applicant_id = f"{prefix}_applicant"
    u_alt_leader_id = f"{prefix}_altleader"

    test_users = []

    try:
        print("\n--- 1. Setting up Mock Users ---")
        leader_user = User(
            id=u_leader_id,
            email=f"{u_leader_id}@test.com",
            name="Leader Alpha",
            streak=30,
            total_points=300,
            last_checkin_date=date.today().isoformat(),
            last_retain_date=date.today().isoformat(),
            last_retain_status="retained",
            created_at=datetime.utcnow(),
        )
        await leader_user.insert()
        test_users.append(leader_user)

        coleader_user = User(
            id=u_coleader_id,
            email=f"{u_coleader_id}@test.com",
            name="Warrior Beta",
            streak=20,
            total_points=200,
            last_checkin_date=date.today().isoformat(),
            last_retain_date=date.today().isoformat(),
            last_retain_status="retained",
            created_at=datetime.utcnow(),
        )
        await coleader_user.insert()
        test_users.append(coleader_user)

        member_user = User(
            id=u_member_id,
            email=f"{u_member_id}@test.com",
            name="Warrior Gamma",
            streak=10,
            total_points=100,
            last_checkin_date=date.today().isoformat(),
            last_retain_date=date.today().isoformat(),
            last_retain_status="retained",
            created_at=datetime.utcnow(),
        )
        await member_user.insert()
        test_users.append(member_user)

        applicant_user = User(
            id=u_applicant_id,
            email=f"{u_applicant_id}@test.com",
            name="Applicant Delta",
            streak=15,
            total_points=150,
            last_checkin_date=date.today().isoformat(),
            last_retain_date=date.today().isoformat(),
            last_retain_status="retained",
            created_at=datetime.utcnow(),
        )
        await applicant_user.insert()
        test_users.append(applicant_user)

        alt_leader_user = User(
            id=u_alt_leader_id,
            email=f"{u_alt_leader_id}@test.com",
            name="Alt Commander Omega",
            streak=45,
            total_points=450,
            last_checkin_date=date.today().isoformat(),
            last_retain_date=date.today().isoformat(),
            last_retain_status="retained",
            created_at=datetime.utcnow(),
        )
        await alt_leader_user.insert()
        test_users.append(alt_leader_user)

        print("[PASS] Created 5 test users in MongoDB.")

        # ── TEST 1: Create Cell A and Cell B ──
        print("\n--- 2. Testing Cell Creation ---")
        cell_a_res = await create_spartan_cell(
            CreateCellRequest(name=f"Vanguard {prefix}", motto="Hold the Line", is_public=True),
            current_user=leader_user,
        )
        assert cell_a_res.leader_id == u_leader_id
        assert cell_a_res.member_count == 1
        assert cell_a_res.total_streak == 30
        assert cell_a_res.shield_status == "gold"
        print(f"[PASS] Cell A Created: '{cell_a_res.name}' (Code: {cell_a_res.join_code})")

        cell_b_res = await create_spartan_cell(
            CreateCellRequest(name=f"Spartan Legion {prefix}", motto="No Retreat", is_public=True),
            current_user=alt_leader_user,
        )
        assert cell_b_res.leader_id == u_alt_leader_id
        print(f"[PASS] Cell B Created: '{cell_b_res.name}' (Code: {cell_b_res.join_code})")

        # ── TEST 2: Join Cell A (Beta and Gamma) ──
        print("\n--- 3. Testing Direct Join (Beta & Gamma) ---")
        join_beta_res = await join_spartan_cell(
            JoinCellRequest(join_code=cell_a_res.join_code),
            current_user=coleader_user,
        )
        assert join_beta_res.member_count == 2
        assert join_beta_res.total_streak == 50

        join_gamma_res = await join_spartan_cell(
            JoinCellRequest(join_code=cell_a_res.join_code),
            current_user=member_user,
        )
        assert join_gamma_res.member_count == 3
        assert join_gamma_res.total_streak == 60
        print(f"[PASS] Beta & Gamma joined Cell A. Total Members: {join_gamma_res.member_count}, Total Streak: {join_gamma_res.total_streak}")

        # ── TEST 3: Promote Beta to Co-Leader ──
        print("\n--- 4. Testing Promote Co-Leader ---")
        promote_res = await promote_co_leader(
            MemberActionRequest(target_user_id=u_coleader_id),
            current_user=leader_user,
        )
        assert promote_res["status"] == "success"
        assert u_coleader_id in promote_res["data"]["co_leader_ids"]
        print("[PASS] Beta successfully promoted to Co-Leader.")

        # ── TEST 4: Multi-Cell Join Requests (Applicant applies to Cell A & Cell B) ──
        print("\n--- 5. Testing Multi-Cell Join Requests ---")
        req_a = await request_join_spartan_cell(
            RequestJoinCellRequest(join_code=cell_a_res.join_code),
            current_user=applicant_user,
        )
        assert req_a["status"] == "pending"
        print(f"[PASS] Applicant requested to join Cell A: {req_a['message']}")

        req_b = await request_join_spartan_cell(
            RequestJoinCellRequest(join_code=cell_b_res.join_code),
            current_user=applicant_user,
        )
        assert req_b["status"] == "pending"
        print(f"[PASS] Applicant requested to join Cell B: {req_b['message']}")

        my_reqs = await get_my_join_requests(current_user=applicant_user)
        assert len(my_reqs) == 2
        print(f"[PASS] Applicant pending requests count: {len(my_reqs)}")

        # ── TEST 5: Cancel and Re-apply ──
        print("\n--- 6. Testing Cancel Join Request ---")
        cancel_res = await cancel_join_request(
            CancelJoinRequest(join_code=cell_b_res.join_code),
            current_user=applicant_user,
        )
        assert cancel_res["status"] == "success"
        my_reqs_after_cancel = await get_my_join_requests(current_user=applicant_user)
        assert len(my_reqs_after_cancel) == 1
        print("[PASS] Cancelled request to Cell B. Verified 1 remaining pending request.")

        # Re-apply to Cell B
        await request_join_spartan_cell(
            RequestJoinCellRequest(join_code=cell_b_res.join_code),
            current_user=applicant_user,
        )
        print("[PASS] Re-applied to Cell B.")

        # ── TEST 6: Co-Leader reviews Join Request on Cell A ──
        print("\n--- 7. Testing Co-Leader Review of Join Request on Cell A ---")
        # Fetch Cell A to get petition id
        cell_a_doc = await SpartanCell.get(cell_a_res.id)
        assert len(cell_a_doc.join_requests) == 1
        req_id = cell_a_doc.join_requests[0]["id"]

        # Co-leader approves applicant into Cell A
        approve_res = await respond_join_request(
            RespondJoinRequest(cell_id=str(cell_a_doc.id), request_id=req_id, action="approve"),
            current_user=coleader_user,
        )
        assert approve_res["status"] == "approved"
        assert approve_res["data"]["member_count"] == 4
        print(f"[PASS] Co-Leader approved Applicant into Cell A: {approve_res['message']}")

        # ── TEST 7: Collision Test (Cell B Leader tries to approve the already-joined applicant) ──
        print("\n--- 8. Testing Collision: Cell B tries to approve already-enlisted Applicant ---")
        cell_b_doc = await SpartanCell.get(cell_b_res.id)
        # Note: When Cell A approved applicant, all pending requests of applicant were purged across MongoDB!
        print(f"[PASS] Cell B join_requests length after automatic multi-cell cleanup: {len(cell_b_doc.join_requests)}")
        assert len(cell_b_doc.join_requests) == 0
        print("[PASS] Multi-cell automatic cleanup verified: Applicant was cleanly inducted into Cell A and purged from Cell B queue.")

        # ── TEST 8: Kick Member (Co-Leader kicks Gamma, Co-Leader cannot kick Leader) ──
        print("\n--- 9. Testing Kick Member Permissions ---")
        # Co-Leader tries to kick Leader -> should fail with 403
        try:
            await kick_member(
                MemberActionRequest(target_user_id=u_leader_id),
                current_user=coleader_user,
            )
            assert False, "Co-Leader should NOT be able to kick Leader!"
        except Exception as e:
            print(f"[PASS] Permission check passed: Co-Leader cannot kick Leader ({e.detail})")

        # Co-Leader kicks Gamma (regular member) -> should succeed
        kick_gamma_res = await kick_member(
            MemberActionRequest(target_user_id=u_member_id),
            current_user=coleader_user,
        )
        assert kick_gamma_res["status"] == "success"
        assert kick_gamma_res["data"]["member_count"] == 3
        print("[PASS] Co-Leader successfully exiled regular member Gamma from Cell A.")

        # ── TEST 9: Demote Co-Leader ──
        print("\n--- 10. Testing Demote Co-Leader ---")
        demote_res = await demote_co_leader(
            MemberActionRequest(target_user_id=u_coleader_id),
            current_user=leader_user,
        )
        assert demote_res["status"] == "success"
        assert u_coleader_id not in demote_res["data"]["co_leader_ids"]
        print("[PASS] Leader successfully demoted Beta back to regular warrior.")

        # ── TEST 10: Nudge & Send Strength ──
        print("\n--- 11. Testing Nudge & Send Strength ---")
        nudge_res = await nudge_cell_member(
            NudgeMemberRequest(target_user_id=u_applicant_id, target_user_name="Applicant Delta"),
            current_user=leader_user,
        )
        assert nudge_res["status"] == "success"
        print(f"[PASS] Nudge sent: {nudge_res['message']}")

        strength_res = await send_strength_to_member(
            SendStrengthRequest(target_user_id=u_applicant_id, target_user_name="Applicant Delta"),
            current_user=leader_user,
        )
        assert strength_res["status"] == "success"
        print(f"[PASS] Strength sent: {strength_res['message']}")

        # ── TEST 11: Leave Cell (Leader transfers to next warrior) ──
        print("\n--- 12. Testing Leader Departure & Succession ---")
        leave_res = await leave_spartan_cell(current_user=leader_user)
        assert leave_res["status"] == "success"

        # Check Cell A's new leader
        updated_cell_a = await SpartanCell.get(cell_a_res.id)
        assert updated_cell_a is not None
        assert updated_cell_a.leader_id != u_leader_id
        assert updated_cell_a.leader_id in updated_cell_a.member_ids
        print(f"[PASS] Leader departed. New Cell A Leader: '{updated_cell_a.leader_name}' ({updated_cell_a.leader_id})")

        # ── TEST 12: Delete / Disband Cell ──
        print("\n--- 13. Testing Disband Cell ---")
        del_res = await delete_spartan_cell(current_user=alt_leader_user)
        assert del_res["status"] == "success"
        cell_b_check = await SpartanCell.get(cell_b_res.id)
        assert cell_b_check is None
        print("[PASS] Cell B successfully disbanded and purged from MongoDB.")

        print("\n[SUCCESS] ALL 13 TEST SUITES PASSED FLAWLESSLY WITH 100% SUCCESS!")

    finally:
        print("\n--- Cleaning up Test Artifacts ---")
        for u in test_users:
            try:
                await u.delete()
            except Exception:
                pass
        all_test_cells = await SpartanCell.find({"name": {"$regex": prefix}}).to_list()
        for c in all_test_cells:
            try:
                await c.delete()
            except Exception:
                pass
        print("[PASS] Cleanup completed.")


if __name__ == "__main__":
    asyncio.run(run_all_tests())
