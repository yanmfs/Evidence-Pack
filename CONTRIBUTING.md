# Contributing

Bug reports and pull requests are welcome.

1. Install Node.js (LTS), pnpm, Rust (stable) and, on macOS, the Xcode Command Line Tools.
2. `pnpm install`
3. `pnpm check` runs typecheck, lint and tests. In `src-tauri/`, run `cargo fmt --check`, `cargo clippy -- -D warnings` and `cargo test`.
4. `pnpm tauri dev` starts the app.

File-name date patterns live in `src/core/dates.ts`; a new pattern needs a case in `tests/project.test.ts`. The PDF layout is in `src/core/pdf/` and is tested by reading the generated PDF back.

Keep commits small, with a short message in English in the imperative (`Fix date parsing for WhatsApp names`). Use made-up data in tests and fixtures; never real documents.
