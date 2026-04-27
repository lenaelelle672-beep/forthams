"""
操作日志数据脱敏测试

本模块验证审计日志中的敏感字段（如密码、密钥等）在 API 响应中
已正确脱敏，防止敏感信息泄露。

@since SWARM-003
@iteration 1
"""

import pytest
from unittest.mock import MagicMock
from datetime import datetime
from typing import Any


# =============================================================================
# 测试目标函数定义（模拟待测试的脱敏逻辑）
# =============================================================================

def mask_sensitive_fields_in_detail(detail: dict[str, Any]) -> dict[str, Any]:
    """
    对操作日志详情中的敏感字段进行脱敏处理。

    敏感字段包括但不限于：
    - password
    - secret
    - token
    - api_key
    - private_key

    @param detail - 原始日志详情字典
    @returns 脱敏后的详情字典
    """
    SENSITIVE_KEYS = {
        'password', 'passwd', 'pwd',
        'secret', 'token', 'access_token', 'refresh_token',
        'api_key', 'apikey', 'private_key', 'privatekey',
        'credit_card', 'card_number', 'ssn', 'social_security'
    }

    if not isinstance(detail, dict):
        return detail

    masked = {}
    for key, value in detail.items():
        key_lower = key.lower()
        if key_lower in SENSITIVE_KEYS:
            # 敏感字段用星号遮蔽
            masked[key] = '********'
        elif isinstance(value, dict):
            # 递归处理嵌套字典
            masked[key] = mask_sensitive_fields_in_detail(value)
        elif isinstance(value, list):
            # 处理列表中的字典元素
            masked[key] = [
                mask_sensitive_fields_in_detail(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            masked[key] = value

    return masked


def extract_log_detail_for_response(log_entry: dict[str, Any]) -> dict[str, Any]:
    """
    从日志条目中提取用于 API 响应的详情字段，并对敏感信息脱敏。

    @param log_entry - 数据库日志条目
    @returns 脱敏后的响应详情
    """
    raw_detail = log_entry.get('detail', {})

    # 应用脱敏处理
    sanitized_detail = mask_sensitive_fields_in_detail(raw_detail)

    return sanitized_detail


# =============================================================================
# pytest fixtures
# =============================================================================

@pytest.fixture
def mock_db_session():
    """模拟数据库会话 fixture"""
    session = MagicMock()
    session.query.return_value.filter.return_value.first.return_value = None
    return session


@pytest.fixture
def password_change_log():
    """
    密码变更操作日志 fixture。

    模拟包含密码字段的日志条目。
    """
    return {
        'id': 1001,
        'user_id': 'user_001',
        'operation_type': 'PASSWORD_CHANGE',
        'resource_type': 'User',
        'resource_id': 'user_001',
        'risk_level': 'HIGH',
        'detail': {
            'target_user': 'user_001',
            'password': 'UserSecret123!',
            'changed_by': 'admin_001',
            'ip_address': '192.168.1.100',
            'timestamp': '2025-01-23T10:30:00Z'
        },
        'created_at': datetime(2025, 1, 23, 10, 30, 0)
    }


@pytest.fixture
def api_key_creation_log():
    """
    API Key 创建操作日志 fixture。

    模拟包含 API Key 的日志条目。
    """
    return {
        'id': 1002,
        'user_id': 'service_account_001',
        'operation_type': 'API_KEY_CREATE',
        'resource_type': 'ApiKey',
        'resource_id': 'key_abc123',
        'risk_level': 'HIGH',
        'detail': {
            'api_key': 'sk_live_51Hd8sJ9d2kFf4Gq5nL7mX9wE3rT6vB1cK0pS8dF4gH',
            'permissions': ['read:assets', 'write:assets'],
            'expires_at': '2026-01-23T10:30:00Z'
        },
        'created_at': datetime(2025, 1, 23, 10, 35, 0)
    }


@pytest.fixture
def nested_sensitive_log():
    """
    嵌套敏感字段日志 fixture。

    模拟详情中存在嵌套字典结构的敏感日志。
    """
    return {
        'id': 1003,
        'user_id': 'user_002',
        'operation_type': 'USER_PROVISION',
        'resource_type': 'User',
        'resource_id': 'user_002',
        'risk_level': 'MEDIUM',
        'detail': {
            'username': 'john_doe',
            'credentials': {
                'password': 'MyP@ssw0rd!',
                'temp_token': 'tmp_token_xyz789'
            },
            'profile': {
                'email': 'john@example.com',
                'phone': '+86-138-0000-1234'
            },
            'access_tokens': [
                {'name': 'access', 'value': 'acc_tok_123456'},
                {'name': 'refresh', 'value': 'ref_tok_789012'}
            ]
        },
        'created_at': datetime(2025, 1, 23, 11, 0, 0)
    }


@pytest.fixture
def normal_operation_log():
    """
    普通操作日志 fixture（无敏感字段）。

    用于验证非敏感日志不会被误脱敏。
    """
    return {
        'id': 1004,
        'user_id': 'user_003',
        'operation_type': 'ASSET_VIEW',
        'resource_type': 'Asset',
        'resource_id': 'asset_001',
        'risk_level': 'LOW',
        'detail': {
            'asset_name': 'Dell Laptop XPS 15',
            'asset_code': 'ASSET-2024-001',
            'viewed_at': '2025-01-23T14:00:00Z'
        },
        'created_at': datetime(2025, 1, 23, 14, 0, 0)
    }


@pytest.fixture
def multiple_sensitive_fields_log():
    """
    多敏感字段日志 fixture。

    包含多个需要脱敏的字段。
    """
    return {
        'id': 1005,
        'user_id': 'admin_001',
        'operation_type': 'OAUTH_TOKEN_CREATE',
        'resource_type': 'OAuthToken',
        'resource_id': 'token_xyz',
        'risk_level': 'CRITICAL',
        'detail': {
            'client_id': 'my_application',
            'client_secret': 'cs_abcdef123456789',
            'access_token': 'at_9876543210abcdef',
            'refresh_token': 'rt_1111111122222222',
            'private_key': '-----BEGIN RSA PRIVATE KEY-----\nMIIEpQIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----'
        },
        'created_at': datetime(2025, 1, 23, 15, 30, 0)
    }


# =============================================================================
# ATB-004: 敏感字段脱敏测试
# =============================================================================

class TestSensitiveDataMasking:
    """验证敏感操作详情中的密码及敏感字段已脱敏"""

    def test_password_field_is_masked(self, password_change_log):
        """
        ATB-004: 验证密码字段 'password' 在响应中已脱敏

        测试场景：用户变更密码操作
        预期结果：detail 中 password 字段被替换为 '********'
        """
        response_detail = extract_log_detail_for_response(password_change_log)

        # 验证密码字段存在且已脱敏
        assert 'password' in response_detail, "password 字段应存在于响应中"
        assert response_detail['password'] == '********', \
            f"密码应被脱敏为 '********'，实际为 '{response_detail['password']}'"

        # 验证原始密码不在响应中
        assert password_change_log['detail']['password'] not in str(response_detail), \
            "原始密码值不应出现在响应中"

    def test_password_variations_are_masked(self):
        """
        ATB-004: 验证不同命名的密码字段变体均被脱敏

        测试场景：不同系统可能使用 passwd、pwd 等字段名
        预期结果：所有密码相关字段变体均被脱敏
        """
        variations = [
            {'password': 'secret123'},
            {'passwd': 'secret123'},
            {'pwd': 'secret123'}
        ]

        for detail in variations:
            masked = mask_sensitive_fields_in_detail(detail)
            assert masked[list(detail.keys())[0]] == '********', \
                f"字段 {list(detail.keys())[0]} 应被脱敏"

    def test_api_key_is_masked(self, api_key_creation_log):
        """
        ATB-004: 验证 API Key 字段在响应中已脱敏

        测试场景：创建新的 API Key
        预期结果：api_key 字段被替换为 '********'
        """
        response_detail = extract_log_detail_for_response(api_key_creation_log)

        assert 'api_key' in response_detail, "api_key 字段应存在于响应中"
        assert response_detail['api_key'] == '********', \
            f"API Key 应被脱敏为 '********'，实际为 '{response_detail['api_key']}'"

    def test_token_fields_are_masked(self):
        """
        ATB-004: 验证各类 Token 字段均被脱敏

        测试场景：包含 access_token、refresh_token 等多种 token
        预期结果：所有 token 类型字段均被脱敏
        """
        detail = {
            'access_token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            'refresh_token': 'refresh_token_value_12345',
            'token': 'bearer_token_value'
        }

        masked = mask_sensitive_fields_in_detail(detail)

        assert masked['access_token'] == '********'
        assert masked['refresh_token'] == '********'
        assert masked['token'] == '********'

    def test_nested_sensitive_fields_are_masked(self, nested_sensitive_log):
        """
        ATB-004: 验证嵌套结构中的敏感字段也被正确脱敏

        测试场景：用户创建时包含嵌套的 credentials 对象
        预期结果：嵌套层级中的 password 和 token 均被脱敏
        """
        response_detail = extract_log_detail_for_response(nested_sensitive_log)

        # 验证嵌套字典中的密码被脱敏
        assert response_detail['credentials']['password'] == '********', \
            "嵌套结构中的 password 应被脱敏"

        # 验证嵌套字典中的 token 被脱敏
        assert response_detail['credentials']['temp_token'] == '********', \
            "嵌套结构中的 token 应被脱敏"

        # 验证非敏感字段保持不变
        assert response_detail['profile']['email'] == 'john@example.com', \
            "非敏感字段 email 应保持原值"

        assert response_detail['profile']['phone'] == '+86-138-0000-1234', \
            "非敏感字段 phone 应保持原值"

    def test_list_of_sensitive_objects_are_masked(self, nested_sensitive_log):
        """
        ATB-004: 验证列表中包含的敏感字段对象也被脱敏

        测试场景：access_tokens 数组中的每个 token 对象
        预期结果：列表中每个对象的 token value 被脱敏
        """
        response_detail = extract_log_detail_for_response(nested_sensitive_log)

        for token_obj in response_detail['access_tokens']:
            if token_obj.get('name') in ('access', 'refresh'):
                assert token_obj.get('value') == '********', \
                    f"列表中 token 对象的 value 应被脱敏"

    def test_private_key_is_masked(self, multiple_sensitive_fields_log):
        """
        ATB-004: 验证私钥字段被正确脱敏

        测试场景：OAuth 私钥配置
        预期结果：private_key 字段被替换为 '********'
        """
        response_detail = extract_log_detail_for_response(multiple_sensitive_fields_log)

        assert 'private_key' in response_detail
        assert response_detail['private_key'] == '********'

        # 验证原始私钥内容不在响应中
        original_key = multiple_sensitive_fields_log['detail']['private_key']
        assert original_key not in str(response_detail)

    def test_all_sensitive_fields_masked_in_single_log(self, multiple_sensitive_fields_log):
        """
        ATB-004: 验证单条日志中所有敏感字段均被脱敏

        测试场景：包含多个敏感字段的 OAuth Token 创建日志
        预期结果：client_secret、access_token、refresh_token、private_key 全部脱敏
        """
        response_detail = extract_log_detail_for_response(multiple_sensitive_fields_log)

        expected_masked = {
            'client_secret': 'client_secret',
            'access_token': 'access_token',
            'refresh_token': 'refresh_token',
            'private_key': 'private_key'
        }

        for field_name, _ in expected_masked.items():
            assert field_name in response_detail, f"{field_name} 应存在于响应中"
            assert response_detail[field_name] == '********', \
                f"{field_name} 应被脱敏为 '********'"

        # 验证非敏感字段保持原值
        assert response_detail['client_id'] == 'my_application'

    def test_non_sensitive_fields_preserved(self, normal_operation_log):
        """
        ATB-004: 验证非敏感字段不会被误脱敏

        测试场景：普通资产查看操作
        预期结果：asset_name、asset_code 等字段保持原值
        """
        response_detail = extract_log_detail_for_response(normal_operation_log)

        assert response_detail['asset_name'] == 'Dell Laptop XPS 15'
        assert response_detail['asset_code'] == 'ASSET-2024-001'
        assert response_detail['viewed_at'] == '2025-01-23T14:00:00Z'

    def test_empty_detail_handled(self):
        """
        ATB-004: 验证空详情对象的处理

        测试场景：detail 字段为空字典
        预期结果：返回空字典，不抛出异常
        """
        log = {
            'id': 999,
            'detail': {}
        }

        result = extract_log_detail_for_response(log)
        assert result == {}

    def test_null_detail_handled(self):
        """
        ATB-004: 验证 null 详情对象的处理

        测试场景：detail 字段为 None
        预期结果：返回空字典，不抛出异常
        """
        log = {
            'id': 998,
            'detail': None
        }

        result = extract_log_detail_for_response(log)
        assert result == {}

    def test_no_password_in_response_string(self, password_change_log):
        """
        ATB-004: 验证响应字符串中不包含原始密码

        测试场景：检查响应 JSON 序列化后的字符串
        预期结果：原始密码值不出现在序列化后的字符串中
        """
        import json

        response_detail = extract_log_detail_for_response(password_change_log)
        response_json = json.dumps(response_detail)

        original_password = password_change_log['detail']['password']

        # 确保原始密码不在 JSON 字符串中
        assert original_password not in response_json, \
            "原始密码不应出现在 JSON 响应字符串中"

    def test_masked_indicator_present(self, password_change_log):
        """
        ATB-004: 验证脱敏字段使用统一的遮蔽标记

        测试场景：检查脱敏后的值包含统一的掩码字符
        预期结果：脱敏值完全由 '*' 字符组成
        """
        response_detail = extract_log_detail_for_response(password_change_log)

        assert response_detail['password'] == '********', \
            "脱敏值应全部为星号字符"

        # 验证格式一致性
        assert all(c == '*' for c in response_detail['password']), \
            "脱敏值应全部由星号组成"

    def test_case_insensitive_sensitive_key_detection(self):
        """
        ATB-004: 验证敏感字段检测不区分大小写

        测试场景：使用不同大小写的敏感字段名
        预期结果：PASSWORD、Password、password 均被脱敏
        """
        cases = [
            {'PASSWORD': 'value1'},
            {'Password': 'value2'},
            {'PASSWORD': 'value3'},
            {'pAsSwOrD': 'value4'}
        ]

        for detail in cases:
            masked = mask_sensitive_fields_in_detail(detail)
            key = list(detail.keys())[0]
            assert masked[key] == '********', \
                f"大小写变体 '{key}' 应被脱敏"

    def test_deeply_nested_sensitive_fields(self):
        """
        ATB-004: 验证多层嵌套结构中的敏感字段

        测试场景：3层以上嵌套的敏感数据
        预期结果：各层级敏感字段均被脱敏
        """
        detail = {
            'level1': {
                'level2': {
                    'level3': {
                        'password': 'deep_secret',
                        'token': 'deep_token'
                    }
                }
            }
        }

        masked = mask_sensitive_fields_in_detail(detail)

        assert masked['level1']['level2']['level3']['password'] == '********'
        assert masked['level1']['level2']['level3']['token'] == '********'


# =============================================================================
# 集成测试：API 端点响应验证
# =============================================================================

class TestApiResponseMasking:
    """验证 API 端点返回的数据正确脱敏"""

    def test_api_response_format_for_password_change(self, password_change_log):
        """
        验证密码变更操作的 API 响应格式符合规范

        预期格式:
        {
            "success": true,
            "data": {
                "id": ...,
                "detail": { ... }  // 脱敏后
            }
        }
        """
        # 模拟 API 响应构建
        response = {
            'success': True,
            'data': {
                'id': password_change_log['id'],
                'operation_type': password_change_log['operation_type'],
                'detail': extract_log_detail_for_response(password_change_log)
            }
        }

        # 验证响应结构
        assert response['success'] is True
        assert 'detail' in response['data']

        # 验证敏感数据脱敏
        detail = response['data']['detail']
        assert detail['password'] == '********'
        assert detail['changed_by'] == 'admin_001'  # 非敏感字段保持原值

    def test_multiple_log_types_in_batch_response(self, api_key_creation_log, normal_operation_log):
        """
        验证批量日志查询时所有敏感数据均被脱敏

        测试场景：查询多条不同类型日志
        预期结果：所有包含敏感字段的日志均正确脱敏
        """
        logs = [api_key_creation_log, normal_operation_log]
        batch_response = {
            'success': True,
            'data': [
                extract_log_detail_for_response(log) for log in logs
            ]
        }

        # 验证第一条（API Key）已脱敏
        assert batch_response['data'][0]['api_key'] == '********'

        # 验证第二条（普通日志）无变化
        assert batch_response['data'][1]['asset_name'] == 'Dell Laptop XPS 15'


# =============================================================================
# 性能测试：脱敏处理效率
# =============================================================================

class TestMaskingPerformance:
    """验证脱敏处理的性能指标"""

    def test_large_detail_object_performance(self):
        """
        验证大对象脱敏的处理时间

        目标：1000 个字段的对象处理时间 < 100ms
        """
        import time

        # 构建大对象（1000 个字段）
        large_detail = {
            f'field_{i}': f'value_{i}' if i % 10 != 0 else 'secret_token'
            for i in range(1000)
        }

        start_time = time.perf_counter()
        result = mask_sensitive_fields_in_detail(large_detail)
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        assert elapsed_ms < 100, \
            f"大对象脱敏处理时间应 < 100ms，实际为 {elapsed_ms:.2f}ms"

        # 验证 token 字段被脱敏
        assert result['field_0'] == '********'

    def test_deep_nesting_performance(self):
        """
        验证深度嵌套对象脱敏的处理时间

        目标：50 层嵌套的对象处理时间 < 100ms
        """
        import time

        # 构建深度嵌套对象（50层）
        current = {}
        for i in range(50):
            current = {'nested': current, 'password': f'secret_{i}'}

        start_time = time.perf_counter()
        result = mask_sensitive_fields_in_detail({'level0': current})
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        assert elapsed_ms < 100, \
            f"深度嵌套对象脱敏处理时间应 < 100ms，实际为 {elapsed_ms:.2f}ms"


# =============================================================================
# pytest 配置钩子
# =============================================================================

def pytest_configure(config):
    """pytest 配置钩子：注册自定义标记"""
    config.addinivalue_line(
        "markers", "masking: 数据脱敏相关测试标记"
    )
    config.addinivalue_line(
        "markers", "security: 安全相关测试标记"
    )