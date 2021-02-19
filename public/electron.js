const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const isDev = require("electron-is-dev")
const child_process = require("child_process")

ipcMain.on("update", (_, source) => {
    try {
        let evals = child_process.execFileSync(
            "./public/calc-notebook",
            ["execute"],
            {
                env: { ATOM_SHELL_INTERNAL_RUN_AS_NODE: "1" },
                cwd: app.getAppPath(),
                input: source,
            }
        )

        let parsedEvals = evals.toString().split("\n")
        parsedEvals = parsedEvals.slice(0, parsedEvals.length - 1)
        mainWindow.webContents.send("evaluations", parsedEvals)
    } catch (e) {
        let emptyEvals = []

        for (let i = 0; i < source.split("\n").length; i++) {
            emptyEvals.push("X")
        }
        mainWindow.webContents.send("evaluations", emptyEvals)
    }
})
ipcMain.on("colorize", (e, source) => {
    try {
        colorize = child_process.execFileSync(
            "./public/calc-notebook",
            ["colorize"],
            {
                env: { ATOM_SHELL_INTERNAL_RUN_AS_NODE: "1" },
                cwd: app.getAppPath(),
                input: source,
            }
        )

        e.returnValue = colorize.toString()
    } catch (e) {
        e.returnValue = colorize.toString()
    }
})

let mainWindow

function createWindow() {
    mainWindow = new BrowserWindow({ width: 900, height: 680 })
    mainWindow.loadURL(
        isDev
            ? "http://localhost:3000"
            : `file://${path.join(__dirname, "../build/index.html")}`
    ) // load the react app
    mainWindow.on("closed", () => (mainWindow = null))

    const { app, Menu } = require("electron")

    const isMac = process.platform === "darwin"

    const template = [
        ...(isMac
            ? [
                  {
                      label: "Calc",
                      submenu: [
                          { role: "about" },
                          { type: "separator" },
                          { role: "services" },
                          { type: "separator" },
                          { role: "hide" },
                          { role: "hideothers" },
                          { role: "unhide" },
                          { type: "separator" },
                          { role: "quit" },
                      ],
                  },
              ]
            : []),
        {
            label: "File",
            submenu: [
                {
                    label: "New file",
                    click: async () => {},
                },
                {
                    label: "Open",
                    click: async () => {},
                },
                {
                    label: "Save",
                    click: async () => {},
                },
                {
                    label: "Save as",
                    click: async () => {},
                },
            ],
        },
        {
            label: "Edit",
            submenu: [
                {
                    label: "Undo",
                    accelerator: "CmdOrCtrl+Z",
                    selector: "undo:",
                },
                {
                    label: "Redo",
                    accelerator: "Shift+CmdOrCtrl+Z",
                    selector: "redo:",
                },
                { type: "separator" },
                { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
                {
                    label: "Copy",
                    accelerator: "CmdOrCtrl+C",
                    selector: "copy:",
                },
                {
                    label: "Paste",
                    accelerator: "CmdOrCtrl+V",
                    selector: "paste:",
                },
                {
                    label: "Select All",
                    accelerator: "CmdOrCtrl+A",
                    selector: "selectAll:",
                },
            ],
        },
        {
            label: "View",
            submenu: [
                { role: "reload" },
                {
                    label: "Toggle Dev Tools",
                    click: () => {
                        mainWindow.webContents.toggleDevTools()
                    },
                },
                { role: "togglefullscreen" },
            ],
        },
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
}

app.on("ready", createWindow)

// on MacOS leave process running also with no windows
app.on("window-all-closed", () => {
    app.quit()
})

// if there are no windows create one
app.on("activate", () => {
    if (mainWindow === null) {
        createWindow()
    }
})
