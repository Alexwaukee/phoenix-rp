# Phoenix RP

A basic guild roster website. Plain HTML, CSS and JavaScript, hosted on GitHub Pages.

## Website

https://Alexwaukee.github.io/phoenix-rp/

The chart shows every level from 1 through the roster's highest level, stacked by class. The x axis recalculates whenever roster data loads or is imported, and expands or shrinks to match that roster. Filters keep the full roster's level range. Click a class to toggle it or a column to filter by level. The roster supports search, sorting, rank/activity filters, and CSV downloads.

## Update the roster

1. Run `/grexport csv` in WoW with Simple Guild Roster Exporter.
2. Copy its output, click **Update data** on the website, and paste it.
3. Import to preview the changes in your browser.
4. Use **Download current data**, then replace `roster.csv` in this repository and commit it.

GitHub Pages updates after the commit. Browser imports are local until you update the repository. Online status describes the export snapshot, not current activity.

The required columns are `Name,Level,Class,Rank,Last Online`. You can include an optional `Race` column in any position. Class totals appear in the chart legend; when race data is available, race subcounts appear below each class. Missing races are counted as "Not provided", and no races are inferred from class or RP profiles. Class counts follow the search, rank, activity, profile and level filters. Hidden classes keep their counts visible so you can re-enable them.

New roster sizes and higher character levels are supported. The chart total and roster table recalculate from the same CSV. Reload the page after GitHub Pages finishes deploying a repository update.

## Optional file watching

**Watch local file** rereads a file you choose every 20 seconds while the page stays open, in supported desktop browsers such as Chrome or Edge. This changes your browser only. Simple Guild Exporter still requires you to copy and save the new CSV; it does not continuously create a CSV on disk.

To update the public site automatically whenever you save your CSV, clone this repository, install Node.js, and authenticate Git. From the cloned repository:

```powershell
node watch.mjs --csv "C:\path\roster.csv" --push
```

Omit `--push` to update local files only. The watcher waits for two matching reads, validates each update, and commits only the roster/profile data files. It stops with Ctrl+C. It does not install a background service. Only enable automatic publishing for files you intend to make public.

## Character profiles

This site publishes the roster only. `profiles.json` and `gear.json` are empty.

The character dialog has **Story**, **Roster details** and **Gear** tabs. Use **Update data → TRP3 / RP profiles** to locally import `totalRP3_Data.lua` from your WoW account's SavedVariables folder. The file is read in the browser, without executing Lua. Only matching guild characters' public characteristics, About/history and first-glance text are imported. Private notes, relationships, account details and unrelated characters are excluded.

The TRP3 cache only contains profiles your client has received. WoW saves it on UI reload/logout. Missing data does not mean the character has no profile. Native encoded TRP3 export strings are not supported. Rich text is shown as plain text, without external images or music.

These imports stay local unless you choose to publish the downloaded `profiles.json`. The optional watcher also accepts `--trp3 "C:\path\totalRP3_Data.lua"`; pairing this with `--push` would publish the extracted profiles, so leave it out for roster-only publishing.

## Gear data format

The roster CSV has no equipment. The website supports a separate JSON import; an adapter for an actual gear addon or an authenticated game API is still needed to collect it automatically.

```json
{
  "characters": [{
    "name": "Exact In-game Name",
    "updatedAt": "2026-11-06T18:00:00Z",
    "equipment": [{"slot": "Head", "name": "Actual item name", "itemId": 123, "quality": "Rare", "itemLevel": 20}]
  }]
}
```

Import **Gear JSON** to preview it locally. Replace `gear.json` only if you intend to publish it. No API credentials belong in this public repository.

## Develop locally

```text
node serve.mjs
node --test data.test.mjs
```

Open http://127.0.0.1:4173. No build or dependencies are required. GitHub Pages uses the `main` branch and root folder.

Source roster counts were independently checked: 192 characters, 26 online at export, average level 11.90625, median level 11, and 166 seen less than 24 hours ago.

References: [Simple exporter](https://github.com/sahammer/SimpleWowExporters), [TRP3](https://github.com/Total-RP/Total-RP-3), [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [browser file access](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access).

