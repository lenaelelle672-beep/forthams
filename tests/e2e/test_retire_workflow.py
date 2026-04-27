"""
资产报废退役流程端到端测试
SWARM-002 验收测试基准 - 层级 4：E2E 用户流程测试

测试覆盖：
- 完整退役申请流程：发起申请 → 逐级审批 → 最终退役
- 多级审批链验证
- 历史记录可追溯性
"""

from playwright.sync_api import Page


def test_complete_retire_flow_from_submission_to_completion(page: Page) -> None:
    """
    用户完整流程：发起申请 → 逐级审批 → 最终退役
    
    验收标准：
    - 完整流程端到端测试通过率 = 100%
    - 页面加载时间 ≤ 3s
    - 无 console error / API 500
    """
    # Step 1: 发起报废申请
    page.goto("/assets/A005")
    page.click("[data-testid='retire-btn']")
    page.fill("[data-testid='retire-reason']", "设备老化，维修成本过高")
    page.attach_file("[data-testid='attachment']", "tests/fixtures/valuation_report.pdf")
    page.click("[data-testid='submit-btn']")
    
    assert page.locator("[data-testid='status-badge']").text_content() == "审批中"
    
    # Step 2: 一级审批通过
    page.goto("/approval/pending")
    page.click("[data-testid='approve-A005-btn']")
    page.fill("[data-testid='comment']", "同意报废")
    page.click("[data-testid='confirm-approval']")
    
    assert page.locator("[data-testid='current-level']").text_content() == "2/5"
    
    # Step 3: 逐级审批通过（第2-4级）
    for level in range(2, 5):
        _approve_at_level(page, level)
    
    # Step 4: 最终审批完成（第5级）
    _approve_at_level(page, 5)
    
    # 验证资产状态变为已退役
    page.goto("/assets/A005")
    assert page.locator("[data-testid='status-badge']").text_content() == "已退役"
    
    # 验证历史记录可查看
    page.click("[data-testid='view-history']")
    assert page.locator("[data-testid='history-timeline']").is_visible()


def _approve_at_level(page: Page, level: int) -> None:
    """
    审批辅助函数：执行指定级别的审批操作
    
    Args:
        page: Playwright Page 对象
        level: 审批级别 (1-5)
    """
    page.goto("/approval/pending")
    page.click(f"[data-testid='approve-A005-level-{level}-btn']")
    page.click("[data-testid='confirm-approval']")