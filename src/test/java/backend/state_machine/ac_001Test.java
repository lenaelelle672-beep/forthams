package backend.state_machine;

import backend.state_machine.workorder_state_machine.InvalidStateTransitionException;
import backend.state_machine.workorder_state_machine.WorkOrderState;
import backend.state_machine.workorder_state_machine.WorkOrderStateMachine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * TDD tests for WorkOrderStateMachine — AC-001 & AC-004.
 *
 * AC-001: State machine with transitions
 *   DRAFT → PENDING_APPROVAL → APPROVED → IN_PROGRESS → COMPLETED → CLOSED
 *   plus REJECTED as a branch from PENDING_APPROVAL.
 *
 * AC-004: All types can be imported without error.
 */
class WorkOrderStateMachineTest {

    // =======================================================================
    // AC-004: Module import verification
    // =======================================================================

    @Nested
    @DisplayName("AC-004: Module importability")
    class Ac004ModuleImportTests {

        @Test
        @DisplayName("WorkOrderState enum can be referenced without error")
        void workOrderStateEnumIsImportable() {
            assertNotNull(WorkOrderState.DRAFT);
            assertNotNull(WorkOrderState.PENDING_APPROVAL);
            assertNotNull(WorkOrderState.APPROVED);
            assertNotNull(WorkOrderState.IN_PROGRESS);
            assertNotNull(WorkOrderState.COMPLETED);
            assertNotNull(WorkOrderState.CLOSED);
            assertNotNull(WorkOrderState.REJECTED);
        }

        @Test
        @DisplayName("WorkOrderStateMachine class can be instantiated without error")
        void workOrderStateMachineIsImportable() {
            WorkOrderStateMachine sm = new WorkOrderStateMachine(WorkOrderState.DRAFT);
            assertNotNull(sm);
        }

        @Test
        @DisplayName("InvalidStateTransitionException class can be referenced without error")
        void exceptionClassIsImportable() {
            InvalidStateTransitionException ex =
                    new InvalidStateTransitionException("test");
            assertNotNull(ex);
            assertEquals("test", ex.getMessage());
        }
    }

    // =======================================================================
    // AC-001: State machine transitions
    // =======================================================================

    @Nested
    @DisplayName("AC-001: Valid forward transitions — happy path")
    class Ac001HappyPathTests {

        private WorkOrderStateMachine machine;

        @BeforeEach
        void setUp() {
            machine = new WorkOrderStateMachine(WorkOrderState.DRAFT);
        }

        @Test
        @DisplayName("Initial state is DRAFT")
        void initialStateIsDraft() {
            assertEquals(WorkOrderState.DRAFT, machine.getCurrentState());
        }

        @Test
        @DisplayName("DRAFT → PENDING_APPROVAL via submit event")
        void draftToPendingApproval() {
            machine.fire("SUBMIT");
            assertEquals(WorkOrderState.PENDING_APPROVAL, machine.getCurrentState());
        }

        @Test
        @DisplayName("DRAFT → PENDING_APPROVAL → APPROVED via submit then approve")
        void draftToPendingToApproved() {
            machine.fire("SUBMIT");
            machine.fire("APPROVE");
            assertEquals(WorkOrderState.APPROVED, machine.getCurrentState());
        }

        @Test
        @DisplayName("DRAFT → PENDING_APPROVAL → APPROVED → IN_PROGRESS full forward path")
        void draftThroughInProgress() {
            machine.fire("SUBMIT");
            machine.fire("APPROVE");
            machine.fire("START");
            assertEquals(WorkOrderState.IN_PROGRESS, machine.getCurrentState());
        }

        @Test
        @DisplayName("DRAFT → … → COMPLETED full forward path")
        void draftThroughCompleted() {
            machine.fire("SUBMIT");
            machine.fire("APPROVE");
            machine.fire("START");
            machine.fire("COMPLETE");
            assertEquals(WorkOrderState.COMPLETED, machine.getCurrentState());
        }

        @Test
        @DisplayName("DRAFT → … → CLOSED full forward path to terminal")
        void draftThroughClosed() {
            machine.fire("SUBMIT");
            machine.fire("APPROVE");
            machine.fire("START");
            machine.fire("COMPLETE");
            machine.fire("CLOSE");
            assertEquals(WorkOrderState.CLOSED, machine.getCurrentState());
        }
    }

    @Nested
    @DisplayName("AC-001: REJECTED branch from PENDING_APPROVAL")
    class Ac001RejectionTests {

        @Test
        @DisplayName("PENDING_APPROVAL → REJECTED via reject event")
        void pendingApprovalToRejected() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.PENDING_APPROVAL);
            machine.fire("REJECT");
            assertEquals(WorkOrderState.REJECTED, machine.getCurrentState());
        }

        @Test
        @DisplayName("REJECTED is reachable from DRAFT via submit then reject")
        void rejectedFromDraftFull() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.DRAFT);
            machine.fire("SUBMIT");
            machine.fire("REJECT");
            assertEquals(WorkOrderState.REJECTED, machine.getCurrentState());
        }

        @Test
        @DisplayName("REJECTED can transition to CLOSED")
        void rejectedToClosed() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.REJECTED);
            machine.fire("CLOSE");
            assertEquals(WorkOrderState.CLOSED, machine.getCurrentState());
        }
    }

    @Nested
    @DisplayName("AC-001: Terminal state enforcement — CLOSED is terminal")
    class Ac001TerminalStateTests {

        @Test
        @DisplayName("CLOSED cannot fire SUBMIT")
        void closedCannotSubmit() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.CLOSED);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("SUBMIT")
            );
            assertEquals(WorkOrderState.CLOSED, machine.getCurrentState());
        }

        @Test
        @DisplayName("CLOSED cannot fire APPROVE")
        void closedCannotApprove() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.CLOSED);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("APPROVE")
            );
        }

        @Test
        @DisplayName("CLOSED cannot fire REJECT")
        void closedCannotReject() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.CLOSED);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("REJECT")
            );
        }

        @Test
        @DisplayName("CLOSED cannot fire START")
        void closedCannotStart() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.CLOSED);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("START")
            );
        }

        @Test
        @DisplayName("CLOSED cannot fire COMPLETE")
        void closedCannotComplete() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.CLOSED);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("COMPLETE")
            );
        }

        @Test
        @DisplayName("CLOSED cannot fire CLOSE again")
        void closedCannotCloseAgain() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.CLOSED);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("CLOSE")
            );
        }
    }

    @Nested
    @DisplayName("AC-001: Invalid backward / cross-branch transitions")
    class Ac001InvalidTransitionTests {

        @Test
        @DisplayName("DRAFT cannot fire APPROVE — must submit first")
        void draftCannotApprove() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.DRAFT);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("APPROVE")
            );
            assertEquals(WorkOrderState.DRAFT, machine.getCurrentState());
        }

        @Test
        @DisplayName("DRAFT cannot fire REJECT")
        void draftCannotReject() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.DRAFT);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("REJECT")
            );
        }

        @Test
        @DisplayName("DRAFT cannot fire START")
        void draftCannotStart() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.DRAFT);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("START")
            );
        }

        @Test
        @DisplayName("DRAFT cannot fire COMPLETE")
        void draftCannotComplete() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.DRAFT);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("COMPLETE")
            );
        }

        @Test
        @DisplayName("DRAFT cannot fire CLOSE")
        void draftCannotClose() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.DRAFT);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("CLOSE")
            );
        }

        @Test
        @DisplayName("APPROVED cannot go back to DRAFT")
        void approvedCannotGoToDraft() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.APPROVED);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("SUBMIT")
            );
        }

        @Test
        @DisplayName("APPROVED cannot fire COMPLETE — must start first")
        void approvedCannotComplete() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.APPROVED);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("COMPLETE")
            );
        }

        @Test
        @DisplayName("IN_PROGRESS cannot fire APPROVE again")
        void inProgressCannotApprove() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.IN_PROGRESS);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("APPROVE")
            );
        }

        @Test
        @DisplayName("COMPLETED cannot fire START — already past that stage")
        void completedCannotStart() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.COMPLETED);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("START")
            );
        }

        @Test
        @DisplayName("COMPLETED cannot fire COMPLETE again")
        void completedCannotCompleteAgain() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.COMPLETED);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("COMPLETE")
            );
        }

        @Test
        @DisplayName("REJECTED cannot fire APPROVE — already rejected")
        void rejectedCannotApprove() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.REJECTED);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("APPROVE")
            );
        }

        @Test
        @DisplayName("REJECTED cannot fire SUBMIT")
        void rejectedCannotSubmit() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.REJECTED);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("SUBMIT")
            );
        }

        @Test
        @DisplayName("REJECTED cannot fire START")
        void rejectedCannotStart() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.REJECTED);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("START")
            );
        }
    }

    @Nested
    @DisplayName("AC-001: WorkOrderState enum completeness")
    class Ac001EnumCompletenessTests {

        @Test
        @DisplayName("Enum has exactly 7 states")
        void enumHasSevenStates() {
            WorkOrderState[] states = WorkOrderState.values();
            assertEquals(7, states.length);
        }

        @Test
        @DisplayName("All required state names exist")
        void allRequiredStateNamesExist() {
            assertDoesNotThrow(() -> {
                WorkOrderState.valueOf("DRAFT");
                WorkOrderState.valueOf("PENDING_APPROVAL");
                WorkOrderState.valueOf("APPROVED");
                WorkOrderState.valueOf("IN_PROGRESS");
                WorkOrderState.valueOf("COMPLETED");
                WorkOrderState.valueOf("CLOSED");
                WorkOrderState.valueOf("REJECTED");
            });
        }
    }

    @Nested
    @DisplayName("AC-001: State machine canTransition / query helpers")
    class Ac001QueryHelperTests {

        @Test
        @DisplayName("canTransition returns true for valid DRAFT→SUBMIT")
        void canTransitionValidFromDraft() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.DRAFT);
            assertTrue(machine.canFire("SUBMIT"));
        }

        @Test
        @DisplayName("canTransition returns false for invalid DRAFT→APPROVE")
        void canTransitionInvalidFromDraft() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.DRAFT);
            assertFalse(machine.canFire("APPROVE"));
        }

        @Test
        @DisplayName("canTransition returns false from CLOSED for any event")
        void canTransitionFalseFromClosed() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.CLOSED);
            assertFalse(machine.canFire("SUBMIT"));
            assertFalse(machine.canFire("APPROVE"));
            assertFalse(machine.canFire("REJECT"));
            assertFalse(machine.canFire("START"));
            assertFalse(machine.canFire("COMPLETE"));
            assertFalse(machine.canFire("CLOSE"));
        }

        @Test
        @DisplayName("isTerminal returns true only for CLOSED")
        void isTerminalState() {
            WorkOrderStateMachine closedMachine =
                    new WorkOrderStateMachine(WorkOrderState.CLOSED);
            assertTrue(closedMachine.isTerminal());

            WorkOrderStateMachine draftMachine =
                    new WorkOrderStateMachine(WorkOrderState.DRAFT);
            assertFalse(draftMachine.isTerminal());

            WorkOrderStateMachine approvedMachine =
                    new WorkOrderStateMachine(WorkOrderState.APPROVED);
            assertFalse(approvedMachine.isTerminal());

            WorkOrderStateMachine rejectedMachine =
                    new WorkOrderStateMachine(WorkOrderState.REJECTED);
            assertFalse(rejectedMachine.isTerminal());
        }
    }

    @Nested
    @DisplayName("AC-001: State machine audit trail / transition history")
    class Ac001AuditTrailTests {

        @Test
        @DisplayName("Transition history is recorded after each fire")
        void transitionHistoryRecorded() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.DRAFT);
            machine.fire("SUBMIT");
            assertEquals(1, machine.getHistory().size());
            assertEquals(WorkOrderState.DRAFT, machine.getHistory().get(0).getFromState());
            assertEquals(WorkOrderState.PENDING_APPROVAL, machine.getHistory().get(0).getToState());
            assertEquals("SUBMIT", machine.getHistory().get(0).getEvent());
        }

        @Test
        @DisplayName("Multiple transitions accumulate in history")
        void multipleTransitionsAccumulate() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.DRAFT);
            machine.fire("SUBMIT");
            machine.fire("APPROVE");
            machine.fire("START");
            assertEquals(3, machine.getHistory().size());
        }

        @Test
        @DisplayName("Failed transition does not add to history")
        void failedTransitionNotRecorded() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.DRAFT);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("APPROVE")
            );
            assertEquals(0, machine.getHistory().size());
        }
    }

    @Nested
    @DisplayName("AC-001: State machine idempotency — state unchanged after failed fire")
    class Ac001StateIntegrityTests {

        @Test
        @DisplayName("State remains unchanged after invalid transition attempt")
        void stateUnchangedAfterInvalidTransition() {
            WorkOrderStateMachine machine =
                    new WorkOrderStateMachine(WorkOrderState.APPROVED);
            assertThrows(
                    InvalidStateTransitionException.class,
                    () -> machine.fire("REJECT")
            );
            assertEquals(WorkOrderState.APPROVED, machine.getCurrentState());
        }

        @Test
        @DisplayName("State machine constructed with each enum value holds that state")
        void constructorSetsInitialState() {
            for (WorkOrderState state : WorkOrderState.values()) {
                WorkOrderStateMachine machine = new WorkOrderStateMachine(state);
                assertEquals(state, machine.getCurrentState(),
                        "Expected state " + state + " but got " + machine.getCurrentState());
            }
        }
    }
}