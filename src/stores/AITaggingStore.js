import {flow, makeAutoObservable} from "mobx";
import UrlJoin from "url-join";

class AITaggingStore {
  selectedContent = [];

  constructor(rootStore) {
    this.rootStore = rootStore;

    makeAutoObservable(this);
  }

  get client() {
    return this.rootStore.client;
  }

  AddSelectedContent({objectId, name}) {
    this.selectedContent.push({objectId, name});
  }

  RemoveSelectedContent({objectId}) {
    this.selectedContent = this.selectedContent
      .filter(item => item.objectId !== objectId);
  }

  ClearSelectedContent() {
    this.selectedContent = [];
  }

  Jobs = flow(function * ({objectId}) {
    return yield this.rootStore.aiStore.QueryAIAPI({
      objectId,
      path: UrlJoin("tagging-live", objectId, "status")
    });
  });
}

export default AITaggingStore;
