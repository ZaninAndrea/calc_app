const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");
const child_process = require("child_process");
const fs = require("fs");

let lastPath = "";
let sourceCode = "";

let updateLocked = false;
let queuedUpdate = null;
function updateEvaluations(source) {
  return new Promise(resolve => {
    if (updateLocked) {
      queuedUpdate = source;
      return;
    }

    updateLocked = true;
    const process = child_process.execFile(
      "./public/calc-notebook",
      ["execute"],
      {
        env: { ATOM_SHELL_INTERNAL_RUN_AS_NODE: "1" },
        cwd: app.getAppPath()
      },
      async (err, stdout, stderr) => {
        if (err) {
          let emptyEvals = [];

          for (let i = 0; i < source.split("\n").length; i++) {
            emptyEvals.push("X");
          }
          mainWindow.webContents.send("evaluations", emptyEvals, source);
        } else {
          let parsedEvals = stdout.toString().split("\n");
          parsedEvals = parsedEvals.slice(0, parsedEvals.length - 1);
          mainWindow.webContents.send("evaluations", parsedEvals, source);
        }

        updateLocked = false;
        if (queuedUpdate !== null) {
          source = queuedUpdate;
          queuedUpdate = null;
          updateEvaluations(source);
        }

        resolve();
      }
    );
    process.stdin.write(source);
    process.stdin.end();
  });
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
    let colorize = child_process.execFileSync(
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
    e.returnValue = source;
  }
});

let mainWindow;

ipcMain.on("setAutosave", (_, val) => {
  if (!val || lastPath != "") {
    autosave = val;
    mainWindow.webContents.send("autosave", val);
  } else {
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
      autosave = val;
      mainWindow.webContents.send("autosave", val);
      mainWindow.webContents.send("saved");
      mainWindow.webContents.send("fileName", path.basename(lastPath, ".calc"));
      fs.writeFileSync(lastPath, sourceCode, "utf8");
    }
  }
});

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
            autosave = false;
            mainWindow.webContents.send("autosave", false);
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
              autosave = true;
              mainWindow.webContents.send("autosave", true);
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

              mainWindow.webContents.send(
                "fileName",
                path.basename(lastPath, ".calc")
              );
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

              mainWindow.webContents.send(
                "fileName",
                path.basename(lastPath, ".calc")
              );
            }
          }
        },
        { type: "separator" },
        {
          label: "Print",
          accelerator: "CmdOrCtrl+P",
          click: async () => {
            mainWindow.webContents.print();
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

  mainWindow.webContents.send("autosave", autosave);
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
