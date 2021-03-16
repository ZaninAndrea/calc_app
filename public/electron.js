const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");
const child_process = require("child_process");
const fs = require("fs");

let lastPath = "";
let sourceCode = "";

function updateEvaluations(source) {
  try {
    let evals = child_process.execFileSync(
      "./public/calc-notebook",
      ["execute"],
      {
        env: { ATOM_SHELL_INTERNAL_RUN_AS_NODE: "1" },
        cwd: app.getAppPath(),
        input: source
      }
    );

    let parsedEvals = evals.toString().split("\n");
    parsedEvals = parsedEvals.slice(0, parsedEvals.length - 1);
    mainWindow.webContents.send("evaluations", parsedEvals);
  } catch (e) {
    let emptyEvals = [];

    for (let i = 0; i < source.split("\n").length; i++) {
      emptyEvals.push("X");
    }
    mainWindow.webContents.send("evaluations", emptyEvals);
  }
}

let autosave = false;
let saveTimeout = null;
function delayedSave() {
  if (saveTimeout !== null) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    fs.writeFileSync(lastPath, sourceCode, "utf8");
    mainWindow.webContents.send("saved");
  }, 700);
}

ipcMain.on("update", (_, source) => {
  sourceCode = source;
  updateEvaluations(source);

  if (lastPath !== "" && autosave) {
    delayedSave();
  }
});
ipcMain.on("colorize", (e, source) => {
  try {
    colorize = child_process.execFileSync(
      "./public/calc-notebook",
      ["colorize"],
      {
        env: { ATOM_SHELL_INTERNAL_RUN_AS_NODE: "1" },
        cwd: app.getAppPath(),
        input: source
      }
    );

    e.returnValue = colorize.toString();
  } catch (e) {
    e.returnValue = colorize.toString();
  }
});

let mainWindow;

function createWindow() {
  const isMac = process.platform === "darwin";

  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    titleBarStyle: isMac ? "hiddenInset" : "default"
  });
  mainWindow.loadURL(
    isDev
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "../build/index.html")}`
  ); // load the react app
  mainWindow.on("closed", () => (mainWindow = null));

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
              { role: "quit" }
            ]
          }
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New file",
          accelerator: "CmdOrCtrl+N",
          click: async () => {
            lastPath = "";
            sourceCode = "";
            mainWindow.webContents.send("updateSourceCode", sourceCode);

            mainWindow.webContents.send("saved");
            mainWindow.webContents.send("fileName", "New Notebook");
            updateEvaluations(sourceCode);
          }
        },
        {
          label: "Open",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const filePath = dialog.showOpenDialog(mainWindow, {
              title: "Open calc file",
              filters: [{ name: "Calc file", extensions: ["calc"] }],
              properties: ["openFile"]
            });

            if (filePath.length > 0) {
              const content = fs.readFileSync(filePath[0], "utf8");
              sourceCode = content;
              mainWindow.webContents.send("updateSourceCode", content);
              mainWindow.webContents.send("saved");
              mainWindow.webContents.send(
                "fileName",
                path.basename(filePath[0], ".calc")
              );
              lastPath = filePath[0];
              updateEvaluations(content);
            }
          }
        },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: async () => {
            if (lastPath === "") {
              const filePath = dialog.showSaveDialog(mainWindow, {
                title: "Save calc file",
                filters: [{ name: "Calc file", extensions: ["calc"] }],
                properties: ["createDirectory"]
              });

              if (filePath.length > 0) {
                lastPath = filePath;
              }
            }

            if (lastPath !== "") {
              mainWindow.webContents.send("saved");
              fs.writeFileSync(lastPath, sourceCode, "utf8");
            }
          }
        },
        {
          label: "Save as",
          accelerator: "Shift+CmdOrCtrl+S",
          click: async () => {
            const filePath = dialog.showSaveDialog(mainWindow, {
              title: "Save calc file",
              filters: [{ name: "Calc file", extensions: ["calc"] }],
              properties: ["createDirectory"]
            });

            if (filePath.length > 0) {
              mainWindow.webContents.send("saved");
              lastPath = filePath;
              fs.writeFileSync(lastPath, sourceCode, "utf8");
            }
          }
        }
      ]
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          selector: "undo:"
        },
        {
          label: "Redo",
          accelerator: "Shift+CmdOrCtrl+Z",
          selector: "redo:"
        },
        { type: "separator" },
        { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
        {
          label: "Copy",
          accelerator: "CmdOrCtrl+C",
          selector: "copy:"
        },
        {
          label: "Paste",
          accelerator: "CmdOrCtrl+V",
          selector: "paste:"
        },
        {
          label: "Select All",
          accelerator: "CmdOrCtrl+A",
          selector: "selectAll:"
        }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        {
          label: "Toggle Dev Tools",
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        },
        { role: "togglefullscreen" }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.on("ready", createWindow);

// on MacOS leave process running also with no windows
app.on("window-all-closed", () => {
  app.quit();
});

// if there are no windows create one
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
