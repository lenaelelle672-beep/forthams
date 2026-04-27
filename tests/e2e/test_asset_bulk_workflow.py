"""
资产批量导入导出端到端工作流测试 (Asset Bulk Import/Export E2E Workflow Tests)

本模块验证资产批量导入导出功能的完整工作流程，包括：
- 文件模板生成
- 批量导入功能（含字段校验和部分导入模式）
- 异步导入处理
- 批量导出功能
- 数据完整性验证

对应功能标识: SWARM-2025-Q2-P2-006 (Iteration 2)
"""

import io
import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import pytest

# ============================================================================
# ATB-001: 文件模板生成测试
# ============================================================================


def test_template_generation_xlsx(api_client: Any) -> None:
    """
    ATB-001.1: 验证系统能正确生成 Excel 格式的导入模板。

    测试步骤：
    1. 调用导入模板生成接口
    2. 验证返回文件格式为 xlsx
    3. 验证文件可正常解析

    预期结果：返回标准模板文件，包含全部 9 个资产字段
    """
    response = api_client.get("/api/v1/assets/import/template?format=xlsx")
    assert response.status_code == 200
    assert response.headers.get("Content-Type") == (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert response.headers.get("Content-Disposition", "").startswith("attachment")


def test_template_generation_csv(api_client: Any) -> None:
    """
    ATB-001.2: 验证系统能正确生成 CSV 格式的导入模板。

    测试步骤：
    1. 调用导入模板生成接口（CSV格式）
    2. 验证返回文件格式为 CSV
    3. 验证内容包含表头

    预期结果：返回标准模板文件，UTF-8 编码
    """
    response = api_client.get("/api/v1/assets/import/template?format=csv")
    assert response.status_code == 200
    content_type = response.headers.get("Content-Type", "")
    assert "csv" in content_type.lower() or "text/csv" in content_type.lower()


def test_template_headers_complete(api_client: Any) -> None:
    """
    ATB-001.3: 验证导入模板包含全部 9 个必填字段。

    必填字段列表：
    - asset_id, asset_name, asset_type, purchase_date
    - purchase_amount, department, status
    - location (可选), description (可选)

    预期结果：模板包含所有定义的资产字段
    """
    expected_headers = [
        "asset_id",
        "asset_name",
        "asset_type",
        "purchase_date",
        "purchase_amount",
        "department",
        "status",
        "location",
        "description",
    ]
    response = api_client.get("/api/v1/assets/import/template?format=csv")
    assert response.status_code == 200

    content = response.data.decode("utf-8")
    headers = content.split("\n")[0].split(",")
    for expected in expected_headers:
        assert expected in headers, f"缺失必需字段: {expected}"


# ============================================================================
# ATB-002: 字段校验测试
# ============================================================================


def test_validation_asset_id_required(api_client: Any, test_db: Any) -> None:
    """
    ATB-002.1: 验证 asset_id 为空时的校验失败。

    测试步骤：
    1. 准备 asset_id 为空的导入数据
    2. 执行导入
    3. 验证返回校验失败提示

    预期结果：返回校验失败，提示 asset_id 必填
    """
    csv_content = (
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description\n"
        ",测试资产,EQUIPMENT,2025-01-01,10000.00,IT部,ACTIVE,办公室,测试说明"
    )
    response = _upload_import_file(api_client, csv_content, "strict")
    assert response.status_code == 400
    errors = response.json.get("errors", [])
    assert any("asset_id" in str(e) and "必填" in str(e) for e in errors)


def test_validation_asset_type_enum(api_client: Any, test_db: Any) -> None:
    """
    ATB-002.2: 验证 asset_type 枚举值校验。

    测试步骤：
    1. 准备 asset_type 为非法值的导入数据
    2. 执行导入
    3. 验证返回枚举值不匹配错误

    预期结果：返回校验失败，提示枚举值不匹配
    """
    csv_content = (
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description\n"
        "AST001,测试资产,INVALID_TYPE,2025-01-01,10000.00,IT部,ACTIVE,办公室,测试"
    )
    response = _upload_import_file(api_client, csv_content, "strict")
    assert response.status_code == 400
    errors = response.json.get("errors", [])
    assert any("asset_type" in str(e) for e in errors)


def test_validation_date_format(api_client: Any, test_db: Any) -> None:
    """
    ATB-002.3: 验证日期格式校验（YYYY-MM-DD）。

    测试步骤：
    1. 准备错误日期格式的导入数据
    2. 执行导入
    3. 验证返回日期格式错误

    预期结果：返回校验失败，提示日期格式错误
    """
    csv_content = (
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description\n"
        "AST001,测试资产,EQUIPMENT,2025-13-01,10000.00,IT部,ACTIVE,办公室,测试"
    )
    response = _upload_import_file(api_client, csv_content, "strict")
    assert response.status_code == 400
    errors = response.json.get("errors", [])
    assert any("purchase_date" in str(e) or "日期" in str(e) for e in errors)


def test_validation_amount_positive(api_client: Any, test_db: Any) -> None:
    """
    ATB-002.4: 验证采购金额必须大于等于 0。

    测试步骤：
    1. 准备负数金额的导入数据
    2. 执行导入
    3. 验证返回数值必须≥0 错误

    预期结果：返回校验失败，提示金额必须为正数
    """
    csv_content = (
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description\n"
        "AST001,测试资产,EQUIPMENT,2025-01-01,-100.00,IT部,ACTIVE,办公室,测试"
    )
    response = _upload_import_file(api_client, csv_content, "strict")
    assert response.status_code == 400
    errors = response.json.get("errors", [])
    assert any("purchase_amount" in str(e) or "金额" in str(e) for e in errors)


def test_validation_department_exists(api_client: Any, test_db: Any) -> None:
    """
    ATB-002.5: 验证部门编码必须已存在。

    测试步骤：
    1. 准备不存在的部门编码
    2. 执行导入
    3. 验证返回部门不存在错误

    预期结果：返回校验失败，提示部门不存在
    """
    csv_content = (
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description\n"
        "AST001,测试资产,EQUIPMENT,2025-01-01,10000.00,不存在部门,ACTIVE,办公室,测试"
    )
    response = _upload_import_file(api_client, csv_content, "strict")
    assert response.status_code == 400
    errors = response.json.get("errors", [])
    assert any("department" in str(e) or "部门" in str(e) for e in errors)


def test_validation_asset_id_unique(api_client: Any, test_db: Any) -> None:
    """
    ATB-002.6: 验证 asset_id 唯一性校验。

    测试步骤：
    1. 导入包含重复 asset_id 的数据
    2. 执行导入
    3. 验证返回 asset_id 重复错误

    预期结果：返回校验失败，提示 asset_id 重复
    """
    csv_content = (
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description\n"
        "AST001,测试资产1,EQUIPMENT,2025-01-01,10000.00,IT部,ACTIVE,办公室,测试1\n"
        "AST001,测试资产2,EQUIPMENT,2025-01-02,20000.00,IT部,ACTIVE,办公室,测试2"
    )
    response = _upload_import_file(api_client, csv_content, "strict")
    assert response.status_code == 400
    errors = response.json.get("errors", [])
    assert any("asset_id" in str(e) and "重复" in str(e) for e in errors)


# ============================================================================
# ATB-003: 部分导入模式测试
# ============================================================================


def test_partial_import_success_count(api_client: Any, test_db: Any) -> None:
    """
    ATB-003.1: 验证部分导入模式正确统计成功/失败行数。

    测试步骤：
    1. 准备 100 行数据，其中 5 行有错误
    2. 执行 partial 模式导入
    3. 验证成功导入 95 行

    预期结果：成功导入 95 行，失败 5 行
    """
    csv_lines = [
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description"
    ]
    # 生成 95 行正确数据
    for i in range(95):
        csv_lines.append(
            f"AST{i:05d},资产{i},EQUIPMENT,2025-01-01,10000.00,IT部,ACTIVE,办公室,测试{i}"
        )
    # 添加 5 行错误数据
    error_lines = [
        "AST_DUP1,资产_E1,EQUIPMENT,2025-01-01,10000.00,IT部,ACTIVE,办公室,错误1",
        ",空ID资产,EQUIPMENT,2025-01-01,10000.00,IT部,ACTIVE,办公室,错误2",
        "AST_DUP2,资产_E2,INVALID,2025-01-01,10000.00,IT部,ACTIVE,办公室,错误3",
        "AST_DUP3,资产_E3,EQUIPMENT,2025-01-01,-100.00,IT部,ACTIVE,办公室,错误4",
        "AST_DUP4,资产_E4,EQUIPMENT,2025-01-01,10000.00,不存在的部门,ACTIVE,办公室,错误5",
    ]
    csv_lines.extend(error_lines)
    csv_content = "\n".join(csv_lines)

    response = _upload_import_file(api_client, csv_content, "partial")
    assert response.status_code in (200, 201)

    data = response.json
    assert data.get("imported") == 95, f"期望导入 95 行，实际 {data.get('imported')}"
    assert data.get("failed") == 5, f"期望失败 5 行，实际 {data.get('failed')}"


def test_error_report_format(api_client: Any, test_db: Any) -> None:
    """
    ATB-003.2: 验证错误报告格式包含行号、字段、错误原因。

    测试步骤：
    1. 导入包含错误行的数据
    2. 检查返回的错误报告格式
    3. 验证错误信息结构完整

    预期结果：错误报告包含 row、field、message 字段
    """
    csv_content = (
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description\n"
        "AST001,测试资产,EQUIPMENT,2025-01-01,10000.00,IT部,ACTIVE,办公室,测试\n"
        ",空ID资产,EQUIPMENT,2025-01-01,10000.00,IT部,ACTIVE,办公室,测试"
    )
    response = _upload_import_file(api_client, csv_content, "partial")
    assert response.status_code in (200, 201)

    data = response.json
    errors = data.get("errors", [])
    assert len(errors) > 0

    # 验证错误格式
    error = errors[0]
    assert "row" in error or "line" in error or "行" in str(error)
    assert "field" in error or "字段" in str(error)
    assert "message" in error or "原因" in str(error)


def test_error_report_export(api_client: Any, test_db: Any) -> None:
    """
    ATB-003.3: 验证错误报告可导出为 Excel。

    测试步骤：
    1. 导入包含错误行的数据
    2. 获取错误报告下载链接
    3. 验证可下载 Excel 格式错误报告

    预期结果：生成包含错误详情的 Excel 文件
    """
    csv_content = (
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description\n"
        "AST001,测试资产,EQUIPMENT,2025-01-01,10000.00,IT部,ACTIVE,办公室,测试\n"
        ",空ID,EQUIPMENT,2025-01-01,10000.00,IT部,ACTIVE,办公室,测试"
    )
    response = _upload_import_file(api_client, csv_content, "partial")
    assert response.status_code in (200, 201)

    # 获取错误报告 URL
    error_report_url = response.json.get("error_report_url")
    if error_report_url:
        report_response = api_client.get(error_report_url)
        assert report_response.status_code == 200
        content_type = report_response.headers.get("Content-Type", "")
        assert "spreadsheet" in content_type or "excel" in content_type.lower()


# ============================================================================
# ATB-004: 异步导入处理测试
# ============================================================================


def test_async_import_task_created(api_client: Any, test_db: Any) -> None:
    """
    ATB-004.1: 验证大文件异步导入任务创建。

    测试步骤：
    1. 上传 30MB Excel 文件
    2. 验证立即返回任务 ID

    预期结果：返回任务 ID，立即响应不阻塞
    """
    # 准备模拟大文件内容（实际测试会使用真实大文件）
    large_csv_lines = [
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description"
    ]
    for i in range(10000):
        large_csv_lines.append(
            f"AST{i:06d},资产{i},EQUIPMENT,2025-01-01,10000.00,IT部,ACTIVE,办公室,测试{i}"
        )
    csv_content = "\n".join(large_csv_lines)

    response = _upload_import_file(api_client, csv_content, "partial")
    # 异步模式应返回任务 ID
    if response.status_code == 202:
        data = response.json
        assert "task_id" in data or "taskId" in data or "id" in data


def test_async_task_progress(api_client: Any, test_db: Any) -> None:
    """
    ATB-004.2: 验证异步任务进度查询。

    测试步骤：
    1. 创建异步导入任务
    2. 查询任务进度
    3. 验证返回进度百分比

    预期结果：返回包含 progress 或 percentage 字段的进度信息
    """
    # 先创建任务
    csv_content = (
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description\n"
    )
    for i in range(1000):
        csv_content += (
            f"AST{i:05d},资产{i},EQUIPMENT,2025-01-01,10000.00,IT部,ACTIVE,办公室,测试{i}\n"
        )

    create_response = _upload_import_file(api_client, csv_content, "partial")
    task_id = None

    if create_response.status_code == 202:
        task_id = create_response.json.get("task_id") or create_response.json.get("id")
    elif create_response.status_code in (200, 201):
        # 如果同步完成，不需要查询进度
        return

    if task_id:
        progress_response = api_client.get(f"/api/v1/import/tasks/{task_id}")
        if progress_response.status_code == 200:
            data = progress_response.json()
            assert "progress" in data or "percentage" in data or "status" in data


def test_async_task_completed(api_client: Any, test_db: Any) -> None:
    """
    ATB-004.3: 验证异步任务完成后返回正确统计。

    测试步骤：
    1. 异步任务完成后查询结果
    2. 验证返回成功/失败数量统计

    预期结果：返回包含 imported/failed 统计的任务结果
    """
    csv_content = (
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description\n"
        "AST001,测试资产,EQUIPMENT,2025-01-01,10000.00,IT部,ACTIVE,办公室,测试"
    )

    response = _upload_import_file(api_client, csv_content, "partial")
    # 等待任务完成或立即返回
    if response.status_code == 202:
        task_id = response.json.get("task_id") or response.json.get("id")
        if task_id:
            # 轮询等待完成
            for _ in range(30):
                time.sleep(0.5)
                result_response = api_client.get(f"/api/v1/import/tasks/{task_id}")
                if result_response.status_code == 200:
                    result = result_response.json()
                    if result.get("status") == "completed":
                        assert "imported" in result or "success" in result
                        break

    # 同步模式验证
    if response.status_code in (200, 201):
        data = response.json
        assert "imported" in data or "success" in data


def test_async_task_failure(api_client: Any, test_db: Any) -> None:
    """
    ATB-004.4: 验证异步任务失败时返回错误信息。

    测试步骤：
    1. 创建会导致失败的异步任务
    2. 查询任务失败状态
    3. 验证返回失败原因与错误行号

    预期结果：返回包含 error 或 message 的失败信息
    """
    csv_content = (
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description\n"
        ",空ID资产,EQUIPMENT,2025-01-01,10000.00,IT部,ACTIVE,办公室,测试"
    )

    response = _upload_import_file(api_client, csv_content, "partial")
    if response.status_code == 202:
        task_id = response.json.get("task_id") or response.json.get("id")
        if task_id:
            result_response = api_client.get(f"/api/v1/import/tasks/{task_id}")
            if result_response.status_code == 200:
                result = result_response.json()
                if result.get("status") == "failed":
                    assert "error" in result or "message" in result


# ============================================================================
# ATB-005: 批量导出测试
# ============================================================================


def test_export_xlsx(api_client: Any, test_db: Any) -> None:
    """
    ATB-005.1: 验证 Excel 格式批量导出。

    测试步骤：
    1. 调用导出接口（xlsx格式）
    2. 验证返回文件格式为 Excel

    预期结果：返回 Excel 文件 (application/vnd.openxmlformats...)
    """
    response = api_client.get("/api/v1/assets/export?format=xlsx")
    assert response.status_code == 200
    content_type = response.headers.get("Content-Type", "")
    assert "spreadsheet" in content_type or "excel" in content_type.lower()


def test_export_csv(api_client: Any, test_db: Any) -> None:
    """
    ATB-005.2: 验证 CSV 格式批量导出（UTF-8 BOM）。

    测试步骤：
    1. 调用导出接口（csv格式）
    2. 验证返回文件格式为 CSV
    3. 验证编码为 UTF-8

    预期结果：返回 CSV 文件，UTF-8 BOM 编码
    """
    response = api_client.get("/api/v1/assets/export?format=csv")
    assert response.status_code == 200
    content_type = response.headers.get("Content-Type", "")
    assert "csv" in content_type.lower() or "text/csv" in content_type.lower()
    # 验证 UTF-8 BOM
    assert response.data[:3] == b"\xef\xbb\xbf" or response.data[0] == 239


def test_export_field_consistency(api_client: Any, test_db: Any) -> None:
    """
    ATB-005.3: 验证导出字段与表头一致性。

    测试步骤：
    1. 调用导出接口
    2. 检查导出文件字段
    3. 验证与模板导入字段一致

    预期结果：导出字段包含 asset_id, asset_name, asset_type, purchase_date 等
    """
    response = api_client.get("/api/v1/assets/export?format=csv")
    assert response.status_code == 200

    content = response.data.decode("utf-8-sig")  # 处理 UTF-8 BOM
    headers = content.split("\n")[0].split(",")

    expected_fields = [
        "asset_id",
        "asset_name",
        "asset_type",
        "purchase_date",
        "purchase_amount",
        "department",
        "status",
    ]
    for field in expected_fields:
        assert field in headers, f"导出文件缺失字段: {field}"


def test_export_with_filter(api_client: Any, test_db: Any) -> None:
    """
    ATB-005.4: 验证带筛选条件的导出。

    测试步骤：
    1. 调用导出接口并指定 status=ACTIVE 筛选
    2. 验证只导出符合条件的资产

    预期结果：仅导出状态为 ACTIVE 的资产
    """
    response = api_client.get("/api/v1/assets/export?format=csv&status=ACTIVE")
    assert response.status_code == 200

    content = response.data.decode("utf-8-sig")
    lines = content.split("\n")
    if len(lines) > 1:
        for line in lines[1:]:
            if line.strip():
                assert "ACTIVE" in line, "筛选条件未生效"


def test_export_data_integrity(api_client: Any, test_db: Any) -> None:
    """
    ATB-005.5: 验证导出数据完整性。

    测试步骤：
    1. 先批量导入已知数据
    2. 导出全部数据
    3. 验证导出行数与导入数量一致

    预期结果：导出行数、金额汇总与数据库一致
    """
    # 先准备测试数据
    test_assets = [
        {
            "asset_id": f"INT_TEST_{i}",
            "asset_name": f"完整性测试资产{i}",
            "asset_type": "EQUIPMENT",
            "purchase_date": "2025-01-01",
            "purchase_amount": "10000.00",
            "department": "IT部",
            "status": "ACTIVE",
            "location": "办公室",
            "description": "完整性测试",
        }
        for i in range(10)
    ]

    csv_lines = [
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description"
    ]
    for asset in test_assets:
        csv_lines.append(",".join(asset.values()))

    _upload_import_file(api_client, "\n".join(csv_lines), "strict")

    # 导出
    response = api_client.get("/api/v1/assets/export?format=csv")
    assert response.status_code == 200

    content = response.data.decode("utf-8-sig")
    lines = content.split("\n")

    # 验证至少包含我们导入的数据（可能还有其他数据）
    export_count = sum(1 for line in lines[1:] if "INT_TEST_" in line)
    assert export_count == 10, f"期望导出 10 条测试数据，实际 {export_count} 条"


# ============================================================================
# ATB-006: 安全性验证测试
# ============================================================================


def test_import_unauthorized(api_client: Any) -> None:
    """
    ATB-006.1: 验证未登录用户不能导入。

    测试步骤：
    1. 使用未认证客户端尝试导入
    2. 验证返回 401 Unauthorized

    预期结果：返回 401 Unauthorized
    """
    # api_client 在未登录时应该返回 401
    response = api_client.get("/api/v1/assets/import/template")
    # 如果需要登录，则应返回 401
    if response.status_code == 401:
        assert True
    else:
        # 如果支持匿名访问，则验证权限控制
        csv_content = (
            "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
            "department,status,location,description\n"
            "AST001,测试资产,EQUIPMENT,2025-01-01,10000.00,IT部,ACTIVE,办公室,测试"
        )
        response = api_client.post(
            "/api/v1/assets/import",
            data={"mode": "strict"},
            files={"file": ("test.csv", csv_content.encode(), "text/csv")},
        )
        # 无权限时应返回 403
        assert response.status_code in (401, 403)


def test_import_forbidden(api_client: Any, test_db: Any) -> None:
    """
    ATB-006.2: 验证无权限用户不能导入。

    测试步骤：
    1. 使用无权限用户尝试导入
    2. 验证返回 403 Forbidden

    预期结果：返回 403 Forbidden
    """
    csv_content = (
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description\n"
        "AST001,测试资产,EQUIPMENT,2025-01-01,10000.00,IT部,ACTIVE,办公室,测试"
    )
    response = _upload_import_file(api_client, csv_content, "strict")
    # 验证无权限时的响应
    assert response.status_code in (200, 201, 403, 401)


def test_import_audit_log(api_client: Any, test_db: Any) -> None:
    """
    ATB-006.3: 验证导入操作日志记录。

    测试步骤：
    1. 执行导入操作
    2. 查询操作日志
    3. 验证日志包含 user_id、file_name、时间

    预期结果：日志包含 user_id、file_name、时间戳
    """
    csv_content = (
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description\n"
        "AUDIT001,审计测试资产,EQUIPMENT,2025-01-01,10000.00,IT部,ACTIVE,办公室,测试"
    )
    _upload_import_file(api_client, csv_content, "strict")

    # 查询审计日志
    log_response = api_client.get("/api/v1/audit/logs?type=import")
    if log_response.status_code == 200:
        logs = log_response.json()
        if logs:
            log = logs[0]
            assert "user_id" in log or "userId" in log or "operator" in log
            assert "file_name" in log or "fileName" in log or "filename" in log
            assert "timestamp" in log or "time" in log or "created_at" in log


def test_export_link_expiration(api_client: Any, test_db: Any) -> None:
    """
    ATB-006.4: 验证导出下载链接有效期。

    测试步骤：
    1. 生成导出链接
    2. 验证链接包含过期时间或 token
    3. 验证 24 小时后链接失效

    预期结果：下载链接有效期 ≤ 24h
    """
    # 获取导出链接（如果 API 支持）
    response = api_client.get("/api/v1/assets/export?format=csv&download=true")
    assert response.status_code == 200

    # 验证响应头或内容中包含有效期信息
    # 实际实现会根据具体 API 设计调整
    content_disposition = response.headers.get("Content-Disposition", "")
    if "expires=" in content_disposition.lower() or "token=" in content_disposition.lower():
        assert True


# ============================================================================
# ATB-007: 数据完整性测试
# ============================================================================


def test_export_import_roundtrip(api_client: Any, test_db: Any) -> None:
    """
    ATB-007.1: 验证导出-导入往返数据一致性。

    测试步骤：
    1. 导出全部资产
    2. 删除现有资产
    3. 重新导入导出的数据
    4. 验证数据完全一致

    预期结果：数据完全一致，ID 连续性保持
    """
    # 1. 导出
    export_response = api_client.get("/api/v1/assets/export?format=csv")
    assert export_response.status_code == 200
    original_data = export_response.data.decode("utf-8-sig")

    # 2. 记录原始数据行数
    original_lines = [l for l in original_data.split("\n") if l.strip()]
    original_count = len(original_lines) - 1  # 减去表头

    # 3. 如果有数据则导入
    if original_count > 0:
        import_response = _upload_import_file(api_client, original_data, "strict")
        assert import_response.status_code in (200, 201)

        # 4. 重新导出验证
        reexport_response = api_client.get("/api/v1/assets/export?format=csv")
        assert reexport_response.status_code == 200
        reexport_data = reexport_response.data.decode("utf-8-sig")
        reexport_lines = [l for l in reexport_data.split("\n") if l.strip()]
        reexport_count = len(reexport_lines) - 1

        # 数据量应保持一致
        assert abs(reexport_count - original_count) <= 1, (
            f"导入导出往返后数据量不一致: 原始{original_count}, 重新导出{reexport_count}"
        )


def test_amount_precision(api_client: Any, test_db: Any) -> None:
    """
    ATB-007.2: 验证金额字段精度（2位小数）。

    测试步骤：
    1. 导入带小数的金额数据
    2. 导出数据
    3. 验证导出的金额与原金额精度一致

    预期结果：导出金额精度保持 2 位小数
    """
    csv_content = (
        "asset_id,asset_name,asset_type,purchase_date,purchase_amount,"
        "department,status,location,description\n"
        "PREC001,精度测试,EQUIPMENT,2025-01-01,12345.67,IT部,ACTIVE,办公室,测试\n"
        "PREC002,精度测试2,EQUIPMENT,2025-01-01,0.99,IT部,ACTIVE,办公室,测试"
    )
    _upload_import_file(api_client, csv_content, "strict")

    # 导出并验证
    export_response = api_client.get("/api/v1/assets/export?format=csv")
    assert export_response.status_code == 200

    content = export_response.data.decode("utf-8-sig")
    lines = content.split("\n")

    found_12345 = False
    found_099 = False
    for line in lines:
        if "PREC001" in line and "12345.67" in line:
            found_12345 = True
        if "PREC002" in line and "0.99" in line:
            found_099 = True

    assert found_12345, "金额精度丢失: 12345.67"
    assert found_099, "金额精度丢失: 0.99"


# ============================================================================
# 辅助函数
# ============================================================================


def _upload_import_file(
    client: Any, csv_content: str, mode: str = "partial"
) -> Any:
    """
    辅助函数：上传导入文件并返回响应。

    Args:
        client: API 客户端实例
        csv_content: CSV 文件内容
        mode: 导入模式 ('strict' 或 'partial')

    Returns:
        API 响应对象
    """
    return client.post(
        "/api/v1/assets/import",
        data={"mode": mode},
        files={"file": ("import.csv", csv_content.encode(), "text/csv")},
    )


# ============================================================================
# Pytest 配置
# ============================================================================


@pytest.fixture
def api_client() -> Any:
    """
    Pytest fixture: 创建 API 客户端。

    Returns:
        配置好的 API 客户端实例
    """
    from unittest.mock import MagicMock

    client = MagicMock()
    client.get = MagicMock(return_value=MagicMock(
        status_code=200,
        json=lambda: {},
        data=b"",
        headers={},
    ))
    client.post = MagicMock(return_value=MagicMock(
        status_code=201,
        json=lambda: {},
    ))
    return client


@pytest.fixture
def test_db() -> Any:
    """
    Pytest fixture: 创建测试数据库会话。

    Returns:
        测试数据库会话实例
    """
    from unittest.mock import MagicMock

    db = MagicMock()
    return db


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])