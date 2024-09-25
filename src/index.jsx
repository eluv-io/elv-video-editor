import "Assets/stylesheets/reset.scss";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "Assets/stylesheets/base.scss";
import MantineTheme from "Assets/MantineTheme";

import React from "react";
import { createRoot } from "react-dom/client";
import {inject, observer, Provider} from "mobx-react";
import {MantineProvider} from "@mantine/core";
import UrlJoin from "url-join";
import {rootStore} from "Stores/index";
import {Loader} from "Components/common/Common";
import Sidebar from "Components/nav/Sidebar";

const App = observer(() => {
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
      <Sidebar />
      <Loader />
    </div>
  );
});

const root = createRoot(document.getElementById("app"));
root.render(
  <React.StrictMode>
    <MantineProvider theme={MantineTheme} defaultColorScheme="dark" withCssVariables>
      <App />
    </MantineProvider>
  </React.StrictMode>
);
