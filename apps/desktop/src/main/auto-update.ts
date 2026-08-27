import { app, dialog, shell, type BrowserWindow } from "electron"

/** zh or en strings for the update prompt, keyed off the system locale. */
function updateStrings(version: string): {
  title: string
  message: string
  detail: string
  open: string
  later: string
} {
  const isZh = app.getLocale().toLowerCase().startsWith("zh")
  return isZh
    ? {
        title: "发现新版本",
        message: `Pindou ${version} 已可用。`,
        detail: "更新不会自动安装，是否打开 GitHub Releases 页面下载？",
        open: "打开 Releases",
        later: "稍后",
      }
    : {
        title: "Update available",
        message: `Pindou ${version} is available.`,
        detail: "The update is not installed automatically. Open the GitHub Release page to download it?",
        open: "Open Releases",
        later: "Later",
      }
}

/**
 * Ask-before-download auto-update flow.
 *
 * The unsigned beta build cannot use Electron's autoUpdater on macOS —
 * Squirrel.Mac rejects the adhoc code signature with "did not pass
 * validation". So we query update.electronjs.org's JSON feed on launch (it
 * only reports whether a newer release exists, without downloading), prompt
 * the user, and on accept open the GitHub Release page in the browser for a
 * manual download.
 *
 * Only call in packaged builds (app.isPackaged); the feed is meaningless in dev.
 */
export function setupAutoUpdate(win: BrowserWindow): void {
  const repo = "xingxingmofashu/pindou"
  const feedUrl = `https://update.electronjs.org/${repo}/${process.platform}-${process.arch}/${app.getVersion()}`
  const releaseUrl = `https://github.com/${repo}/releases/latest`

  void fetch(feedUrl)
    .then((res) => (res.ok ? (res.json() as Promise<{ name: string }>) : null))
    .then((update) => {
      if (!update) return
      const strings = updateStrings(update.name)
      void dialog
        .showMessageBox(win, {
          type: "info",
          title: strings.title,
          message: strings.message,
          detail: strings.detail,
          buttons: [strings.open, strings.later],
          defaultId: 0,
          cancelId: 1,
        })
        .then(({ response }) => {
          if (response === 0) void shell.openExternal(releaseUrl)
        })
    })
    .catch(() => {
      /* update check must never break the app */
    })
}
