# Vendored dependencies

`circle-tools/` and `kit-core/` are vendored verbatim from the official Circle Agent
Stack ecosystem starter kits:

  https://github.com/akelani-circle/agent-stack-ecosystem-kits

They are the recommended starting point for building on the Circle Agent Stack and are
included here unmodified (source only). Resolved via `tsconfig.json` `paths`, so imports
of `@agent-stack-ecosystem-kits/circle-tools` and `.../kit-core/*` point at these copies.

All credit to the original authors. See the upstream repo for license terms.
