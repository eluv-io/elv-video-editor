import { configure } from "mobx";
import VideoStore from "./Video";
import EntryStore from "./Entry";
import MenuStore from "./Menu";

import {FrameClient} from "elv-client-js/src/FrameClient";
import {ElvClient} from "elv-client-js/src/ElvClient";
import Configuration from "../../configuration";

let client;

if(window.self === window.top) {
  const privateKey = "0x0000000000000000000000000000000000000000000000000000000000000000";
  client = ElvClient.FromConfiguration({configuration: Configuration});
  client.SetSigner({signer: client.GenerateWallet().AddAccount({privateKey})});
} else {
  // Contained in IFrame
  client = new FrameClient({
    target: window.parent,
    timeout: 30
  });
}

// Force strict mode so mutations are only allowed within actions.
configure({
  enforceActions: "always"
});

export const video = new VideoStore(client);
export const entry = new EntryStore();
export const menu = new MenuStore(client);
