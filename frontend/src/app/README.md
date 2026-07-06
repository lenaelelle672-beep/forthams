# Legacy app tree

`src/app` is retained as a legacy compatibility tree while the active desktop
routes live under `src/pages`, `src/components`, `src/api`, and `src/context`.

Do not import `@/app/*` from desktop code. The only current compatibility
exception is mobile, which still imports `@/app/context/AuthContext` while
mobile work is frozen.
