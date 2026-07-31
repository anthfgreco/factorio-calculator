# Application

Calculator state orchestration and use-case policy. Application modules may use core and runtime compatibility models but must not import UI or visualization modules. `bootstrap.ts` is the only composition-root exception.

Prefer focused policy/query modules over adding methods directly to `FactorySpecification`.
