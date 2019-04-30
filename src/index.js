import "./static/stylesheets/app.scss";

import React from "react";
import { render } from "react-dom";
import { Provider } from "mobx-react";
import * as Stores from "./stores";
import Header from "./components/Header";
import Video from "./components/Video";

render(
  <Provider {...Stores}>
    <div className="app">
      <Header />
      <div className="video-level">
        <div className="side-panel" />
        <Video />
      </div>
    </div>
  </Provider>,
  document.getElementById("app")
);
