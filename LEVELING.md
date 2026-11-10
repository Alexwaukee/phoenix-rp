# Leveling history

The site reads the commit history of `roster.csv` from the public GitHub API when it opens, and when someone clicks **Refresh history**. Each version is matched by normalized character name. It starts with the bundled `leveling-history.json` so existing history is available even if GitHub is temporarily unavailable or limits requests. No GitHub token is needed. A failed refresh keeps the bundled data and displays its status.

**Gained** is the latest observed level minus the first observed level for that character. **Est. XP/hour** converts both levels to their cumulative XP thresholds, subtracts the first threshold from the latest, then divides by calendar hours from the first saved roster (November 6, 2026 at 15:43:54 UTC) to the latest roster upload. Every character uses this same Day 1, including characters first seen later. Gains before a character's first appearance are unknown and are not invented. The character's **Leveling** tab separately shows the most recent interval and links to each source commit. The downloadable CSV contains all characters matching the current filters, including those without a calculable rate, and records both the shared start time and the character's first observation.

XP per level is the LevelExperience table from Forever build 1.60.1.70862, extracted by [Zephras](https://zephras.com/forever/enUS/experience/). The numeric costs are stored in `xp.mjs`, summed from level 1 (0 XP) through level 60 (4,084,700 XP). The calculation uses only recorded level milestones. Neither snapshot includes XP within its level, so the actual XP gained can be above or below this estimate. Staying at the same level produces an estimate of zero, not proof of zero XP earned. Rates for levels outside the supported table are left blank.

These are estimates over calendar time. GitHub commit times approximate roster capture times; delayed uploads affect the result. Rates include offline time and cannot measure XP per hour played. Day 1 is the first saved roster, not the game's launch or an assumed character creation date. One observation produces no rate. Missing snapshots do not imply a level change, and renames are not inferred. A decrease in level or a change in class suppresses the rate for review. Local imports have no GitHub upload time, so their rates are left blank.

## Race data

`races.json` is a separate snapshot of the [Phoenix RP US RP guild armory](https://armorywowforever.com/g/forever/us/rp/phoenix-rp). The site uses it only when the name and class match a roster entry. An explicit Race column in the CSV takes precedence. Armory levels never replace CSV levels or enter the leveling history. This keeps the usual five-column guild exports usable. New unmatched characters stay marked Not provided until race data is added. The displayed source date is the retrieval time, not a claim that the armory was freshly scanned then. Update `races.json` from the guild page to refresh the race snapshot.

The level chart adapts to the available width, keeps every level through the highest roster level, and uses fewer numbered ticks on small screens. Each column still has its own tooltip and filter action.

Run `node --test data.test.mjs` to check rate calculations, missing observations, CSV output, future history updates and the existing roster parser.
