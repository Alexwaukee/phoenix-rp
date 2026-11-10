# Leveling history

The site reads the commit history of `roster.csv` from the public GitHub API when it opens, and when someone clicks **Refresh history**. Each version is matched by normalized character name. It starts with the bundled `leveling-history.json` so existing history is available even if GitHub is temporarily unavailable or limits requests. No GitHub token is needed. A failed refresh keeps the bundled data and displays its status.

**Gained** is the latest observed level minus the first observed level for that character. **Levels/day** divides that gain by the elapsed time between those uploads, in 24-hour days. The character's **Leveling** tab also shows the most recent interval and links to each source commit. The downloadable CSV contains all characters matching the current filters, including those without a calculable rate.

These are observed rates over calendar time. GitHub commit times approximate roster capture times; delayed uploads affect the result. Rates include offline time and cannot measure XP per hour, time played, or partial progress within a level. Characters start at their first appearance, not an assumed level 1 or creation date. Less than one day of observations is marked with an asterisk. One observation produces no rate. Missing snapshots do not imply a level change, and renames are not inferred. A decrease in level or a change in class suppresses the rate for review. Local imports have no GitHub upload time, so their rates are left blank.

The level chart adapts to the available width, keeps every level through the highest roster level, and uses fewer numbered ticks on small screens. Each column still has its own tooltip and filter action.

Run `node --test data.test.mjs` to check rate calculations, missing observations, CSV output, future history updates and the existing roster parser.
