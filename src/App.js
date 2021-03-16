import React, { Component } from "react";
import Editor from "react-simple-code-editor";
import "./index.css";
const { ipcRenderer, clipboard, remote } = window.require("electron");

document.documentElement.setAttribute("data-platform", remote.process.platform);

if (remote.process.platform == "darwin") {
  const { systemPreferences } = remote;

  const setOSTheme = () => {
    let theme = systemPreferences.isDarkMode() ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);

    console.log(theme);
  };

  systemPreferences.subscribeNotification(
    "AppleInterfaceThemeChangedNotification",
    setOSTheme
  );

  setOSTheme();
}

function roundedNumber(val, decimals) {
  return parseFloat(val).toString();
}

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      source: "",
      colorization: "",
      evaluations: [],
      fileName: "New Notebook",
      unsavedChanges: false
    };

    ipcRenderer.on("colorization", (_, val) =>
      this.setState({ colorization: val })
    );
    ipcRenderer.on("evaluations", (_, val) => {
      this.setState({ evaluations: val });
    });
    ipcRenderer.on("updateSourceCode", (_, val) => {
      this.setState({ source: val });
    });
    ipcRenderer.on("saved", () => this.setState({ unsavedChanges: false }));
    ipcRenderer.on("fileName", (_, val) => this.setState({ fileName: val }));
  }

  render() {
    let title = this.state.fileName;

    if (this.state.unsavedChanges) {
      title += "*";
    }

    return (
      <>
        <div className="titleBar">
          <span>{title}</span>
        </div>
        <div className="main">
          <div className="evaluations">
            {this.state.evaluations.map(val =>
              val === "X" ? (
                <br />
              ) : val === "!" ? (
                <span className="error">ERR</span>
              ) : (
                <span
                  className="value"
                  onClick={() => {
                    clipboard.writeText(roundedNumber(val, 12).toString());
                  }}
                >
                  {roundedNumber(val, 12).toString()}
                </span>
              )
            )}
          </div>
          <Editor
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
