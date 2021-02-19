import React, { Component } from "react"
import "./index.css"
const { ipcRenderer, clipboard } = window.require("electron")

function roundedNumber(val) {
    return Math.round((parseFloat(val) + Number.EPSILON) * 1000) / 1000
}

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
                        ) : val === "!" ? (
                            <React.Fragment>
                                <span className="error">{val}</span>
                                <br />
                            </React.Fragment>
                        ) : (
                            <>
                                <span
                                    className="value"
                                    onClick={() =>
                                        clipboard.writeText(
                                            roundedNumber(val).toString()
                                        )
                                    }
                                >
                                    {roundedNumber(val)}
                                </span>
                                <br />
                            </>
                        )
                    )}
                </div>
            </div>
        )
    }
}

export default App
