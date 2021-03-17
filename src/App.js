import React, { Component } from "react";
import Editor from "react-simple-code-editor";
import DisplayEval from "./DisplayEval";
import "./index.css";
const { ipcRenderer, clipboard, remote } = window.require("electron");

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
      unsavedChanges: false
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
