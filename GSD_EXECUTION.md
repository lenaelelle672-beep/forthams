# GSD 执行说明

forthAMS 当前唯一有效技术栈是 Java Spring Boot 后端和 React/Vite 前端。

## 有效工作区

- 后端：`backend/`
- 前端：`frontend/`
- 数据库初始化：`backend/src/main/resources/schema.sql`
- 真实后端 E2E：`frontend/src/e2e/real-backend-smoke.spec.ts`

## 禁止路径

- 不要创建或恢复 Python/FastAPI/Django/pytest 代码。
- 不要使用 sandbox 项目替代 `project_registry` 注册的真实路径。
- 不要修改 `.env` 或提交密钥文件。

## 推荐命令

```bash
cd backend && mvn test
cd backend && mvn -q -DskipTests compile
cd frontend && npm test -- --run
cd frontend && npm run build
cd frontend && npm run e2e -- --reporter=line
cd frontend && npm run e2e:real -- --reporter=line
```

## 当前交付判断

- P3 交付验证主路径应围绕 Java/React 命令执行。
- 折旧和审计模块存在生产实现缺口，应作为后续 Java 后端切片处理。
