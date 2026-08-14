## 0.1.2

 - updated settings model for v0.6.4
 - added authenticated live sync notifications for connected clients
 - added reset all flag
 - reworked sync conflict resolution: conditional pipeline upserts (no reliance on duplicate-key errors), tombstones so deletions no longer resurrect from stale devices, resetAll without data-wipe window
 - sync write failures now return 500 instead of a stale 200; startup fails fast if unique indexes can't be created

## 0.1.1

 - added sync for settings
 - adjusted some properties

## 0.1.0

 - first release of Sync Server for Mangayomi
