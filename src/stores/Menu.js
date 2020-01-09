import {observable, action, flow} from "mobx";
import UrlJoin from "url-join";

class MenuStore {
  @observable libraryId = "";
  @observable objectId = "";

  @observable showMenu = true;

  @observable libraries = {};
  @observable objects = {};

  @observable selectedObject;

  constructor(rootStore) {
    this.rootStore = rootStore;
  }

  @action.bound
  ToggleMenu(open) {
    this.showMenu = open;
  }

  @action.bound
  UpdateVersionHash(versionHash) {
    this.selectedObject.versionHash = versionHash;
  }

  @action.bound
  SelectVideo = flow(function * ({libraryId, objectId, versionHash}) {
    this.rootStore.Reset();
    this.selectedObject = undefined;

    if(versionHash) {
      objectId = this.rootStore.client.utils.DecodeVersionHash(versionHash).objectId;
    }

    if(!libraryId) {
      libraryId = yield this.rootStore.client.ContentObjectLibraryId({objectId});
    }

    if(window.self !== window.top) {
      this.rootStore.client.SendMessage({
        options: {
          operation: "SetFramePath",
          path: UrlJoin("#", versionHash ? versionHash : UrlJoin(libraryId, objectId))
        },
        noResponse: true
      });
    }

    const object = yield this.rootStore.client.ContentObject({libraryId, objectId, versionHash});

    if(!versionHash) {
      versionHash = object.hash;
    }

    const metadata = yield this.rootStore.client.ContentObjectMetadata({objectId, versionHash});

    this.selectedObject = {
      libraryId,
      objectId: object.id,
      versionHash,
      name: metadata.public && metadata.public.name || metadata.name || versionHash,
      metadata
    };

    this.rootStore.videoStore.SetVideo(this.selectedObject);
  });

  @action.bound
  ListLibraries = flow(function * () {
    const libraryIds = yield this.rootStore.client.ContentLibraries();

    this.libraries = {};

    (yield Promise.all(
      libraryIds.map(async libraryId => {
        try {
          const metadata = await this.rootStore.client.ContentObjectMetadata({
            libraryId,
            objectId: libraryId.replace("ilib", "iq__")
          });

          this.libraries[libraryId] = {
            libraryId,
            name: metadata.public && metadata.public.name || metadata.name || libraryId,
            metadata
          };
        } catch(error) {
          return undefined;
        }
      })
    ));
  });

  @action.bound
  ListObjects = flow(function * ({libraryId, page=1, perPage=25, filter="", cacheId=""}) {
    const metadata = yield this.rootStore.client.ContentObjectMetadata({
      libraryId,
      objectId: libraryId.replace("ilib", "iq__")
    });

    this.libraries[libraryId] = {
      libraryId,
      name: metadata.public && metadata.public.name || metadata.name || libraryId,
      metadata,
    };

    const videoFilter = {key: "/offerings/default/ready", type: "cnt", filter: true};

    let { contents, paging } = yield this.rootStore.client.ContentObjects({
      libraryId,
      filterOptions: {
        select: [
          "description",
          "image",
          "name",
          "player_background",
          "public"
        ],
        filter: filter ? [videoFilter, {key: "/public/name", type: "cnt", filter}] : videoFilter,
        start: (page-1) * perPage,
        limit: perPage,
        sort: "public/name",
        cacheId
      }
    });

    this.objects[libraryId] = (yield Promise.all(
      contents.map(async object => {
        const latestVersion = object.versions[0];

        return {
          objectId: latestVersion.id,
          versionHash: latestVersion.hash,
          name: latestVersion.meta.public && latestVersion.meta.public.name || latestVersion.meta.name || latestVersion.id,
          metadata: latestVersion.meta
        };
      })
    ));

    return paging;
  });

  @action.bound
  SetLibraryId(libraryId) {
    this.libraryId = libraryId;
  }

  @action.bound
  ClearLibraryId() {
    this.libraryId = "";
  }

  @action.bound
  SetObjectId(objectId) {
    this.objectId = objectId;
  }

  @action.bound
  ClearObjectId() {
    this.objectId = "";
  }
}

export default MenuStore;
