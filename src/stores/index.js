import { configure } from "mobx";
import VideoStore from "./Video";

// Force strict mode so mutations are only allowed within actions.
configure({
  enforceActions: "always"
});

export const video = new VideoStore();
