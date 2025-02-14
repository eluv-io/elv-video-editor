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
import AssetsList from "./components/assets/AssetsList";
import {videoStore} from "./stores";
import DownloadModal from "./components/DownloadModal";

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
          <Video key={`video-${this.props.videoStore.videoKey}`} overlay />
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

    let view;
    if(this.props.rootStore.view === "assets" || !this.props.videoStore.isVideo) {
      view = this.props.videoStore.loading ? null :
        <AssetsList />;
    } else {
      view = this.MainView();
    }

    return (
      <div
        tabIndex={0}
        onKeyDown={this.props.keyboardControlsStore.HandleInput}
        onKeyUp={this.props.keyboardControlsStore.HandleModifiers}
        className="video-editor"
      >
        <Header/>
        <Menu/>
        { view }
        {
          !videoStore.showDownloadModal ? null :
            <DownloadModal Close={() => videoStore.ToggleDownloadModal(false)} />
        }
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
