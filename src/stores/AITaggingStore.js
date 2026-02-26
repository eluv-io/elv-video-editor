import {flow, makeAutoObservable, runInAction} from "mobx";
import UrlJoin from "url-join";
import {Slugify, Unproxy} from "@/utils/Utils.js";
import FrameAccurateVideo from "@/utils/FrameAccurateVideo.js";

const GLOBAL_PROFILE_OBJECT_ID = "iq__3MVS3kjshtnAodRv4qLebBvH3oXb";

class AITaggingStore {
  constructor(rootStore) {
    this.rootStore = rootStore;

    makeAutoObservable(this);
  }

  get client() {
    return this.rootStore.client;
  }

  Jobs = flow(function * ({objectId}) {
    return yield this.rootStore.aiStore.QueryAIAPI({
      objectId,
      path: UrlJoin("tagging-live", objectId, "status")
    });
  });
}

export default AITaggingStore;
