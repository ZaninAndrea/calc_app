const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");
const child_process = require("child_process");
const fs = require("fs");
const fetch = require("isomorphic-fetch");

// Run server in the background
child_process
  .spawn("./public/calc-notebook", ["server"], {
    env: { ATOM_SHELL_INTERNAL_RUN_AS_NODE: "1" },
    cwd: app.getAppPath(),
    windowsHide: true
  })
  .stdout.pipe(process.stdout);

const isServerUp = () =>
  new Promise((resolve, reject) =>
    fetch("http://localhost:7894/colorize", {
      body: "",
      method: "POST"
    })
      .then(() => resolve(true))
      .catch(() => resolve(false))
  );
const wait = ms => new Promise(resolve => setTimeout(() => resolve(), ms));

let lastPath = "";
let sourceCode = "";

let updateLocked = false;
let queuedUpdate = null;
async function updateEvaluations(source) {
  if (updateLocked) {
    queuedUpdate = source;
    return;
  }

  updateLocked = true;

  await fetch(
    "http://localhost:7894/execute?bearer=" + process.env.IGLOO_BEARER,
    {
      body: source,
      method: "POST"
    }
  )
    .then(res => res.text())
    .then(evals =>
      mainWindow.webContents.send("evaluations", evals.split("\n"), source)
    )
    .catch(err => {
      console.log(err);
      let emptyEvals = [];

      for (let i = 0; i < source.split("\n").length; i++) {
        emptyEvals.push("X");
      }
      mainWindow.webContents.send("evaluations", emptyEvals, source);
    });

  updateLocked = false;
  if (queuedUpdate !== null) {
    source = queuedUpdate;
    queuedUpdate = null;
    updateEvaluations(source);
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

let colorizeCache = new Map();
ipcMain.on("colorize", async (e, source) => {
  try {
    const lines = source.split("\n");

    const evaluationPromises = lines.map(line => {
      if (colorizeCache.has(line)) {
        return colorizeCache.get(line);
      }

      return fetch("http://localhost:7894/colorize", {
        body: line,
        method: "POST"
      }).then(res => res.text());
    });

    const evaluations = await Promise.all(evaluationPromises);
    const colorized = evaluations.join("\n");

    e.returnValue = colorized;

    colorizeCache = new Map();
    for (let i = 0; i < lines.length; i++) {
      colorizeCache.set(lines[i], evaluations[i]);
    }
  } catch (err) {
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

async function createWindow() {
  while (!(await isServerUp())) {
    console.log("Waiting for server to boot up");
    await wait(100);
  }

  console.log("Server is up");
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

  fetch("https://api.exchangeratesapi.io/latest")
    .then(res => res.json())
    .then(currenciesConversions =>
      fetch("http://localhost:7894/currencies", {
        method: "POST",
        body: JSON.stringify(currenciesConversions.rates)
      })
    );
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  app.quit();
});

// if there are no windows create one
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
