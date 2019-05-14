import { configure } from "mobx";
import VideoStore from "./Video";
import EntryStore from "./Entry";
import MenuStore from "./Menu";

// Force strict mode so mutations are only allowed within actions.
configure({
  enforceActions: "always"
});

export const video = new VideoStore();
export const entry = new EntryStore();
export const menu = new MenuStore();
