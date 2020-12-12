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
import ClipView from "./components/clips/ClipView";

@inject("rootStore")
@inject("videoStore")
@inject("menuStore")
@inject("keyboardControlsStore")
@observer
class App extends React.Component {
  MainView() {
    return (
      <>
        <div className="video-level" key={`video-${this.props.rootStore.videoStore.source}`}>
          { this.props.menuStore.error ? <div className="error-message">Error: { this.props.menuStore.error }</div> : null }
          <SidePanel/>
          <Video key={`video-${this.props.videoStore.videoKey}`}/>
        </div>
        <Timeline key={`timeline-${this.props.videoStore.versionHash}`}/>
      </>
    );
  }

  render() {
    if(window.self === window.top) {
      // Not in Core frame - Redirect
      window.location = UrlJoin(EluvioConfiguration.coreUrl, "/", window.location.hash);
      return;
    }

    if(!this.props.rootStore.client) { return null; }

    return (
      <div
        tabIndex={0}
        onKeyDown={this.props.keyboardControlsStore.HandleModifiers}
        onKeyUp={this.props.keyboardControlsStore.HandleModifiers}
        onKeyPress={this.props.keyboardControlsStore.HandleInput}
        className="video-editor"
      >
        <Header/>
        <Menu/>
        { this.props.rootStore.view === "main" ? this.MainView() : <ClipView /> }
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
