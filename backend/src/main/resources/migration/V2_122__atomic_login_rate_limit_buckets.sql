-- V2_122__atomic_login_rate_limit_buckets
-- V2_121 的 pair 状态不能约束轮换 IP 或同 IP 多账号。新 bucket/预占表仅保存 HMAC 指纹，
-- 以账号和 IP 两个独立维度原子预占密码校验额度；旧表仅在迁移时用于保守继承未过期失败状态。

CREATE TABLE IF NOT EXISTS login_attempt_bucket (
    bucket_type VARCHAR(16) NOT NULL,
    bucket_hash CHAR(64) NOT NULL,
    failure_count INT NOT NULL DEFAULT 0,
    reserved_count INT NOT NULL DEFAULT 0,
    next_allowed_at DATETIME NOT NULL,
    last_failure_at DATETIME NULL,
    expires_at DATETIME NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (bucket_type, bucket_hash),
    INDEX idx_login_attempt_bucket_expires (expires_at),
    INDEX idx_login_attempt_bucket_next_allowed (next_allowed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS login_attempt_reservation (
    reservation_id CHAR(36) NOT NULL,
    account_hash CHAR(64) NOT NULL,
    client_ip_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (reservation_id),
    INDEX idx_login_attempt_reservation_expires (expires_at),
    INDEX idx_login_attempt_reservation_account_ip (account_hash, client_ip_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS login_attempt_bucket_guard (
    id TINYINT NOT NULL PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO login_attempt_bucket_guard (id) VALUES (1);

-- 保留 V2_121 在窗口期内已经记录的最严格失败状态，避免升级瞬间放开既有退避。
INSERT INTO login_attempt_bucket
    (bucket_type, bucket_hash, failure_count, reserved_count, next_allowed_at, last_failure_at, expires_at)
SELECT 'ACCOUNT', account_hash, MAX(failure_count), 0, MAX(next_allowed_at), MAX(last_failure_at), MAX(expires_at)
FROM login_attempt_tracker
GROUP BY account_hash
ON DUPLICATE KEY UPDATE
    failure_count = GREATEST(login_attempt_bucket.failure_count, VALUES(failure_count)),
    next_allowed_at = GREATEST(login_attempt_bucket.next_allowed_at, VALUES(next_allowed_at)),
    last_failure_at = GREATEST(login_attempt_bucket.last_failure_at, VALUES(last_failure_at)),
    expires_at = GREATEST(login_attempt_bucket.expires_at, VALUES(expires_at));

INSERT INTO login_attempt_bucket
    (bucket_type, bucket_hash, failure_count, reserved_count, next_allowed_at, last_failure_at, expires_at)
SELECT 'IP', client_ip_hash, MAX(failure_count), 0, MAX(next_allowed_at), MAX(last_failure_at), MAX(expires_at)
FROM login_attempt_tracker
GROUP BY client_ip_hash
ON DUPLICATE KEY UPDATE
    failure_count = GREATEST(login_attempt_bucket.failure_count, VALUES(failure_count)),
    next_allowed_at = GREATEST(login_attempt_bucket.next_allowed_at, VALUES(next_allowed_at)),
    last_failure_at = GREATEST(login_attempt_bucket.last_failure_at, VALUES(last_failure_at)),
    expires_at = GREATEST(login_attempt_bucket.expires_at, VALUES(expires_at));
