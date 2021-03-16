import React, { Component } from "react";
import Editor from "react-simple-code-editor";
import "./index.css";
const { ipcRenderer, clipboard } = window.require("electron");

function roundedNumber(val, decimals) {
  return parseFloat(val).toString();
}

class App extends Component {
  constructor(props) {
    super(props);

    this.state = { source: "", colorization: "", evaluations: [] };

    ipcRenderer.on("colorization", (_, val) =>
      this.setState({ colorization: val })
    );
    ipcRenderer.on("evaluations", (_, val) => {
      this.setState({ evaluations: val });
    });
    ipcRenderer.on("updateSourceCode", (_, val) => {
      this.setState({ source: val });
    });
  }

  render() {
    return (
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
              source
            });
            ipcRenderer.send("update", source);
          }}
          highlight={source => ipcRenderer.sendSync("colorize", source)}
        />
      </div>
    );
  }
}

export default App;
