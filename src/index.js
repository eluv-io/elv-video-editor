import "./static/stylesheets/app.scss";

import React from "react";
import { render } from "react-dom";
import {inject, observer, Provider} from "mobx-react";
import UrlJoin from "url-join";

import * as Stores from "./stores";
import Header from "./components/Header";
import Video from "./components/Video";
import Timeline from "./components/Timeline";
import Menu from "./components/Menu";
import SidePanel from "./components/SidePanel";

@inject("root")
@inject("video")
@inject("keyboardControls")
@observer
class App extends React.Component {
  render() {
    if(window.self === window.top) {
      // Not in Core frame - Redirect
      window.location = UrlJoin(EluvioConfiguration.coreUrl, "/", window.location.hash);
      return;
    }

    if (!this.props.root.client) { return null; }

    return (
      <div
        tabIndex={0}
        onKeyDown={this.props.keyboardControls.HandleModifiers}
        onKeyUp={this.props.keyboardControls.HandleModifiers}
        onKeyPress={this.props.keyboardControls.HandleInput}
        className="video-editor"
      >
        <Header/>
        <Menu/>
        <div className="video-level" key={`video-${this.props.root.videoStore.source}`}>
          <SidePanel/>
          <Video key={`video-${this.props.video.videoKey}`}/>
        </div>
        <Timeline key={`timeline-${this.props.video.versionHash}`}/>
      </div>
    );
  }
}

render(
  <React.Fragment>
    <Provider {...Stores}>
      <App />
    </Provider>
    <div className="app-version">{EluvioConfiguration.version}</div>
  </React.Fragment>,
  document.getElementById("app")
);
