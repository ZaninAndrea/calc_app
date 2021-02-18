import React, { Component } from "react"
import "./index.css"
const { ipcRenderer } = window.require("electron")

class App extends Component {
    constructor(props) {
        super(props)

        this.state = { source: "", colorization: "", evaluations: [] }

        ipcRenderer.on("colorization", (_, val) =>
            this.setState({ colorization: val })
        )
        ipcRenderer.on("evaluations", (_, val) => {
            this.setState({ evaluations: val })
        })
    }

    render() {
        return (
            <div className="main">
                <div className="code-edit-container">
                    <textarea
                        className="code-input"
                        value={this.state.source}
                        onChange={(e) => {
                            this.setState({ source: e.target.value })
                            ipcRenderer.send("update", e.target.value)
                        }}
                    />
                    <pre className="code-output">
                        <code
                            dangerouslySetInnerHTML={{
                                __html: this.state.colorization,
                            }}
                        />
                    </pre>
                </div>
                <div className="evaluations">
                    {this.state.evaluations.map((val) =>
                        val === "X" ? (
                            <br />
                        ) : (
                            <React.Fragment>
                                <span>{val}</span>
                                <br />
                            </React.Fragment>
                        )
                    )}
                </div>
            </div>
        )
    }
}

export default App
