import "Assets/stylesheets/reset.scss";

import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "Assets/stylesheets/base.scss";
import "Assets/stylesheets/modules/common.module.scss";

import MantineTheme from "Assets/MantineTheme";

import React, {useState} from "react";
import { createRoot } from "react-dom/client";
import {observer} from "mobx-react";
import {MantineProvider} from "@mantine/core";
import UrlJoin from "url-join";
import {rootStore} from "Stores/index";
import Nav from "Components/nav/Nav";
import Browser from "Components/nav/Browser";
import {Loader} from "Components/common/Common";
import VideoSection from "Components/video/VideoSection";
import Timeline from "Components/timeline/Timeline";
import SidePanel from "Components/side_panel/SidePanel";

const App = observer(() => {
  const [showSidePanel, setShowSidePanel] = useState(false);
  if(window.self === window.top) {
    // Not in Core frame - Redirect
    window.location = UrlJoin(EluvioConfiguration.coreUrl, "/", window.location.hash);
    return;
  }

  if(!rootStore.client) {
    return null;
  }

  return (
    <div className="page-container">
      <Nav />
      <div className="content">
        {
          !rootStore.initialized ?
            <Loader />:
            rootStore.view === "source" ?
              <Browser /> :
              <>
                <div className="top">
                  {
                    !showSidePanel ? null :
                      <SidePanel />
                  }
                  <VideoSection />
                </div>
                <div className="bottom">
                  <Timeline />
                  <button onClick={() => setShowSidePanel(!showSidePanel)}>
                    Toggle
                  </button>
                </div>
              </>
        }
      </div>
    </div>
  );
});

const root = createRoot(document.getElementById("app"));
root.render(
  <React.StrictMode>
    <MantineProvider theme={MantineTheme} defaultColorScheme="dark">
      <App />
    </MantineProvider>
  </React.StrictMode>
);
