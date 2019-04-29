import "./static/stylesheets/app.scss";

import React from "react";
import { render } from "react-dom";
import Header from "./components/Header";
import Video from "./components/Video";

render(
  <div className="app">
    <Header />
    <div className="video-level">
      <div className="pusher"></div>
      <Video />
    </div>
  </div>,
  document.getElementById("app")
);
