// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Sessionist

// Preloaded with --import to raise one ordinary warning, delivered after the CLI's warning filter is installed.

process.emitWarning("probe warning from a test", "ProbeWarning");
