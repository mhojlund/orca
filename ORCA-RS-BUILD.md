# Building Orca RS

Orca RS is the side-by-side macOS flavor of this fork (`ORCA_APP_FLAVOR=rs`).

## Required order

1. Put a complete server template in `out/orcad-template` (see below).
2. `pnpm build:mac:rs` — it sets `ORCA_REQUIRE_ORCAD_TEMPLATE=1`, so it fails if step 1 was skipped.

Without the template the app ships without the server and every SSH connect fails with
"This host isn’t supported by this version of Orca (this Orca RS build doesn’t include the server)".

## Getting the template

Packaging requires the targets in `ORCAD_TEMPLATE_TARGETS` (`src/shared/node-runtime/node-runtime-pin.ts`):
darwin-arm64, darwin-x64, linux-x64-glibc and win32-x64. Linux arm64/musl and Windows arm64 hosts are not
served by this fork. Restore the full list there to ship the other four.

Native prebuilds must be built on their own platform, except macOS, which cross-compiles either arch.

1. **Mac** (`pnpm run build:orcad-prebuilds -- --slot=<slot>`, once per slot):
   - `darwin-arm64` and `darwin-x64` (the x64 slot is cross-compiled).
2. **Linux x64 host** (`pnpm install --frozen-lockfile && pnpm run build:orcad-prebuilds`):
   - produces `linux-x64-glibc`. Needs gcc, make, python3.
3. **Windows x64 host** (same commands; needs Visual Studio 2022 C++ tools and Rust via rustup, on PATH):
   - produces `win32-x64`, then also build the three Windows-only artifacts:
     - `node config/scripts/native-build/windows/build-windows-process-tree-addon.mjs --arch=x64`
       → `.build/windows-process-tree/x64/windows-process-tree.node`
     - `node config/scripts/native-build/windows/build-windows-cli-launcher.mjs --arch x64 --output <repo>\.build\windows-cli-launcher\x64\orca.exe`
     - `node config/scripts/native-build/windows/build-windows-security-addon.mjs --arch=x64`
       → `.build/windows-security/x64/windows-security.node`
4. **Back on the Mac**, copy each host's `out/orcad-prebuilds/<slot>` directory into `out/orcad-prebuilds`,
   merge each host's `manifest.json` `slots` entries into the Mac's, and copy the three `.build/...` files to
   the same paths. Check with
   `node config/scripts/orcad-distribution/prebuilds/build-orcad-prebuilds.mjs --require-slots=darwin-arm64,darwin-x64,linux-x64-glibc,win32-x64`.
5. `pnpm run build:orcad-template`, then `pnpm build:mac:rs`.

Alternatives: run `.github/workflows/qualified-orcad-template.yml` in CI, or point `ORCA_ORCAD_TEMPLATE_PATH` at
an existing template directory.
