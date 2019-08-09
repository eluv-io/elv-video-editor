import "./static/stylesheets/app.scss";

import React from "react";
import { render } from "react-dom";
import {inject, observer, Provider} from "mobx-react";

import * as Stores from "./stores";
import Header from "./components/Header";
import Video from "./components/Video";
import Timeline from "./components/Timeline";
import Entry from "./components/Entry";
import Menu from "./components/Menu";


@inject("root")
@observer
class App extends React.Component {
  render() {
    if (!this.props.root.client) { return null; }

    return (
      <div className="video-editor">
        <Header/>
        <Menu/>
        <div className="video-level">
          <Entry/>
          <Video/>
        </div>
        <Timeline/>
      </div>
    );
  }
}

render(
  <Provider {...Stores}>
    <App />
  </Provider>,
  document.getElementById("app")
);
