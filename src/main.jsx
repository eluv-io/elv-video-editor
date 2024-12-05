import "@/assets/stylesheets/reset.scss";

import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@/assets/stylesheets/base.scss";
import "@/assets/stylesheets/modules/common.module.scss";

import MantineTheme from "@/assets/MantineTheme";

import React from "react";
import { createRoot } from "react-dom/client";
import {MantineProvider} from "@mantine/core";
import App from "./App.jsx";


const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <MantineProvider theme={MantineTheme} defaultColorScheme="dark">
      <App />
    </MantineProvider>
  </React.StrictMode>
);
