import "@/assets/stylesheets/reset.scss";

import "@mantine/core/styles.layer.css";
import "@mantine/core/styles.css";
import "@mantine/dropzone/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/dates/styles.layer.css";

import "mantine-datatable/styles.css";
import "mantine-datatable/styles.layer.css";

import "@/assets/stylesheets/variables.scss";
import "@/assets/stylesheets/base.scss";

import MantineTheme from "@/assets/MantineTheme";

import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";

dayjs.extend(advancedFormat);


import React from "react";
import { createRoot } from "react-dom/client";
import {MantineProvider} from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import App from "./App.jsx";


const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <MantineProvider theme={MantineTheme} defaultColorScheme="dark">
      <ModalsProvider>
        <App />
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>
);
