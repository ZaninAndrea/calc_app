import React, { Component } from "react";
import Editor from "react-simple-code-editor";
import DisplayEval from "./DisplayEval";
import "./index.css";
const { ipcRenderer, clipboard, remote } = window.require("electron");

const SyncIcon = ({ onClick }) => (
  <svg
    className="syncIcon"
    focusable="false"
    viewBox="0 0 24 24"
    onClick={onClick}
  >
    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"></path>
  </svg>
);

const SyncDisabledIcon = ({ onClick }) => (
  <svg
    className="syncDisabledIcon"
    focusable="false"
    viewBox="0 0 24 24"
    onClick={onClick}
  >
    <path d="M10 6.35V4.26c-.8.21-1.55.54-2.23.96l1.46 1.46c.25-.12.5-.24.77-.33zm-7.14-.94l2.36 2.36C4.45 8.99 4 10.44 4 12c0 2.21.91 4.2 2.36 5.64L4 20h6v-6l-2.24 2.24C6.68 15.15 6 13.66 6 12c0-1 .25-1.94.68-2.77l8.08 8.08c-.25.13-.5.25-.77.34v2.09c.8-.21 1.55-.54 2.23-.96l2.36 2.36 1.27-1.27L4.14 4.14 2.86 5.41zM20 4h-6v6l2.24-2.24C17.32 8.85 18 10.34 18 12c0 1-.25 1.94-.68 2.77l1.46 1.46C19.55 15.01 20 13.56 20 12c0-2.21-.91-4.2-2.36-5.64L20 4z"></path>
  </svg>
);

// Calculated manually, depends on font and font-size
const charWidth = 9.601585365853659;

document.documentElement.setAttribute("data-platform", remote.process.platform);

if (remote.process.platform == "darwin") {
  const { systemPreferences } = remote;

  const setOSTheme = () => {
    let theme = systemPreferences.isDarkMode() ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
  };

  systemPreferences.subscribeNotification(
    "AppleInterfaceThemeChangedNotification",
    setOSTheme
  );

  setOSTheme();
}

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      source: "",
      evalsSource: "",
      colorization: "",
      evaluations: [],
      fileName: "New Notebook",
      unsavedChanges: false,
      autosave: false
    };
    this.containerRef = null;

    ipcRenderer.on("colorization", (_, val) =>
      this.setState({ colorization: val })
    );
    ipcRenderer.on("evaluations", (_, evaluations, evalsSource) => {
      this.setState({ evaluations, evalsSource });
    });
    ipcRenderer.on("updateSourceCode", (_, val) => {
      this.setState({ source: val });
    });
    ipcRenderer.on("saved", () => this.setState({ unsavedChanges: false }));
    ipcRenderer.on("autosave", (_, val) => this.setState({ autosave: val }));
    ipcRenderer.on("fileName", (_, val) => this.setState({ fileName: val }));

    let resizeTimeout = null;
    window.addEventListener("resize", () => {
      if (resizeTimeout !== null) clearTimeout(resizeTimeout);

      resizeTimeout = setTimeout(() => {
        this.forceUpdate();

        resizeTimeout = null;
      }, 100);
    });
  }

  componentDidMount() {
    this.containerRef = document.getElementById("code-edit-container");
  }

  render() {
    let title = this.state.fileName;

    if (this.state.unsavedChanges) {
      title += "*";
    }

    const charsPerLine =
      this.containerRef !== null
        ? Math.floor(
            (this.containerRef.getBoundingClientRect().width - 32) / charWidth
          )
        : 50;

    const sourceLines = this.state.evalsSource.split("\n");

    return (
      <>
        <div className="titleBar">
          <span>{title}</span>
          <div>
            {this.state.autosave ? (
              <SyncIcon
                onClick={() => {
                  ipcRenderer.send("setAutosave", false);
                }}
              />
            ) : (
              <SyncDisabledIcon
                onClick={() => {
                  ipcRenderer.send("setAutosave", true);
                }}
              />
            )}
          </div>
        </div>
        <div className="main">
          <div className="evaluations">
            {this.state.evaluations.map((val, i) => (
              <DisplayEval
                evaluation={val}
                sourceLine={sourceLines[i]}
                charsPerLine={charsPerLine}
                lineIndex={i}
              />
            ))}
          </div>
          <Editor
            id="code-edit-container"
            className="code-edit-container"
            value={this.state.source}
            onValueChange={source => {
              this.setState({
                source,
                unsavedChanges: true
              });
              ipcRenderer.send("update", source);
            }}
            highlight={source => ipcRenderer.sendSync("colorize", source)}
          />
        </div>
      </>
    );
  }
}

export default App;
