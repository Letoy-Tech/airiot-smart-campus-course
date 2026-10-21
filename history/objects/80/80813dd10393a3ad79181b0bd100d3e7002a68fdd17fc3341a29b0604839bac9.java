package cn.campus.course;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class CaseRulesTest {
    private final User admin = new User("admin", "ADMIN");
    private final User manager = new User("manager", "MANAGER");

    private CaseRecord fresh() {
        CaseRecord item = new CaseRecord();
        item.id = "test-case";
        item.state = "NEW";
        item.sourceState = "ACTIVE";
        item.note = "";
        item.conclusion = "";
        item.version = 1;
        return item;
    }

    private void apply(CaseRecord item, User user, String action, String note) {
        CaseRules.apply(item, user, action, item.version, note, "manager");
    }

    @Test
    void fullWorkflowRequiresSeparateRecoveryVerificationAndConclusion() {
        CaseRecord item = fresh();
        apply(item, admin, "assign", "请进行课堂巡查");
        apply(item, manager, "start", null);
        apply(item, manager, "note", "检查练习数据并记录处理");
        assertEquals(409, assertThrows(ApiException.class, () -> apply(item, manager, "close", "已完成")).status());
        apply(item, admin, "recover", null);
        assertFalse(item.verified);
        assertEquals(409, assertThrows(ApiException.class, () -> apply(item, manager, "close", "已完成")).status());
        apply(item, manager, "verify", null);
        assertEquals(400, assertThrows(ApiException.class, () -> apply(item, manager, "close", " ")).status());
        apply(item, manager, "close", "练习数据已核验");
        assertEquals("CLOSED", item.state);
        assertEquals("练习数据已核验", item.conclusion);
        assertEquals(7, item.version);
        assertEquals(6, item.timeline.size());
    }

    @Test
    void viewerCannotWriteEvenWithCurrentVersion() {
        CaseRecord item = fresh();
        assertEquals(403, assertThrows(ApiException.class,
                () -> apply(item, new User("viewer", "VIEWER"), "start", null)).status());
        assertEquals("NEW", item.state);
        assertEquals(1, item.version);
    }

    @Test
    void managerCannotHandleUnassignedOrOthersCases() {
        CaseRecord item = fresh();
        assertEquals(403, assertThrows(ApiException.class, () -> apply(item, manager, "start", null)).status());
        item.assignee = "another-manager";
        item.state = "ASSIGNED";
        assertEquals(403, assertThrows(ApiException.class, () -> apply(item, manager, "start", null)).status());
    }

    @Test
    void managerCannotRecoverSource() {
        CaseRecord item = fresh();
        apply(item, admin, "assign", "请进行课堂巡查");
        apply(item, manager, "start", null);
        assertEquals(403, assertThrows(ApiException.class, () -> apply(item, manager, "recover", null)).status());
        assertEquals("ACTIVE", item.sourceState);
    }

    @Test
    void staleVersionDoesNotMutateStateOrHistory() {
        CaseRecord item = fresh();
        apply(item, admin, "assign", "请进行课堂巡查");
        assertEquals(409, assertThrows(ApiException.class,
                () -> CaseRules.apply(item, manager, "start", 1, null, null)).status());
        assertEquals("ASSIGNED", item.state);
        assertEquals(2, item.version);
        assertEquals(1, item.timeline.size());
    }

    @Test
    void modifyingNoteInvalidatesPreviousVerification() {
        CaseRecord item = fresh();
        apply(item, admin, "assign", "请进行课堂巡查");
        apply(item, manager, "start", null);
        apply(item, manager, "note", "初始记录");
        apply(item, admin, "recover", null);
        apply(item, manager, "verify", null);
        apply(item, manager, "note", "补充记录");
        assertFalse(item.verified);
        assertEquals(409, assertThrows(ApiException.class, () -> apply(item, manager, "close", "完成")).status());
    }

    @Test
    void closedCaseRejectsFurtherChanges() {
        CaseRecord item = fresh();
        item.state = "CLOSED";
        item.assignee = "manager";
        assertEquals(409, assertThrows(ApiException.class, () -> apply(item, manager, "note", "补写")).status());
        assertEquals("", item.note);
    }

    @Test
    void cannotAssignAfterProcessingHasStarted() {
        CaseRecord item = fresh();
        apply(item, admin, "assign", "请进行课堂巡查");
        apply(item, manager, "start", null);
        assertEquals(409, assertThrows(ApiException.class, () -> apply(item, admin, "assign", "请进行课堂巡查")).status());
    }

    @Test
    void assignmentRequiresNonblankExplanationWithoutPartiallyChangingCase() {
        for (String note : new String[]{null, "", " \t "}) {
            CaseRecord item = fresh();
            assertEquals(400, assertThrows(ApiException.class, () -> apply(item, admin, "assign", note)).status());
            assertEquals("NEW", item.state);
            assertNull(item.assignee);
            assertEquals(1, item.version);
            assertTrue(item.timeline.isEmpty());
        }
    }
}
