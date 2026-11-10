# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Changed
- `export_workout_erg` now emits one `[COURSE DATA]` line per block using the cumulative start time (a line at minute 0 for the first block, then the running total of block durations). Consecutive blocks that share a watt are no longer merged — each block gets its own line.

### Fixed
- Fix `get-all-activities` filtering by `activityTypes` by preserving `type` and `sport_type` fields from the Strava `athlete/activities` response schema.

### Added
- Add regression tests for the `export_workout_erg` tool (course data layout, header, Downloads output, and FTP default).
- Add Vitest test runner and regression tests for `get-all-activities` filtering and schema preservation.
- Add a stdio-based MCP smoke test script to validate tool behavior against the built `dist/server.js`.
- Add `perceived_exertion` data in activity detailed model.
