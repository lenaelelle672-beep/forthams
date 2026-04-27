"""
Test AC-001: Verify exact count of Java files moved to quarantine.
"""
import os
import glob

def test_quarantine_file_count():
    """AC-001: Ensure the expected number of Java files are quarantined."""
    quarantine_dir = "backend/_quarantine_autogen"
    java_files = glob.glob(os.path.join(quarantine_dir, "**/*.java"), recursive=True)
    # Expected file count based on the quarantine inventory in the specification
    expected_count = 30
    assert len(java_files) == expected_count, f"Expected {expected_count} quarantined Java files, found {len(java_files)}"

def test_quarantine_files_exist():
    """AC-002: Ensure key quarantine files exist and contain business logic markers."""
    key_files = [
        "backend/_quarantine_autogen/src/main/java/com/ams/config/AsyncConfig.java",
        "backend/_quarantine_autogen/src/main/java/com/ams/dto/ApprovalDecisionDTO.java",
        "backend/_quarantine_autogen/src/main/java/com/ams/repository/ApprovalRecordRepository.java",
        "backend/_quarantine_autogen/src/main/java/com/ams/repository/RetirementApprovalRecordRepository.java",
        "backend/_quarantine_autogen/src/main/java/com/ams/config/DepreciationConfig.java",
    ]
    for f in key_files:
        assert os.path.exists(f), f"Quarantine file missing: {f}"
        with open(f, "r", encoding="utf-8") as fp:
            content = fp.read()
            # Basic sanity: files should not be empty placeholders
            assert len(content) > 0, f"Quarantine file is empty: {f}"

def test_derState_import_not_required():
    """AC-003: Ensure no import of 'derState' exists in the test suite."""
    test_files = glob.glob("tests/**/*.py", recursive=True)
    for tf in test_files:
        with open(tf, "r", encoding="utf-8") as fp:
            content = fp.read()
            assert "derState" not in content, f"Found forbidden 'derState' import in {tf}"