import {observable, action, flow} from "mobx";
import UrlJoin from "url-join";

class MenuStore {
  @observable libraryId = "";
  @observable objectId = "";
  @observable error = "";

  @observable showMenu = true;
  @observable showVideoOnly = true;

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
  ToggleVideoFilter(showVideoOnly) {
    this.showVideoOnly = showVideoOnly;
  }

  @action.bound
  SetErrorMessage(error) {
    this.error = error;
  }

  @action.bound
  ClearErrorMessage() {
    this.error = "";
  }

  @action.bound
  SelectVideo = flow(function * ({libraryId, objectId, versionHash}) {
    try {
      this.rootStore.Reset();
      this.ClearErrorMessage();
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

      window.location.hash = `${UrlJoin("#", versionHash ? versionHash : UrlJoin(libraryId, objectId))}`;

      const object = yield this.rootStore.client.ContentObject({libraryId, objectId, versionHash});

      if(!versionHash) {
        versionHash = object.hash;
      }

      const metadata = yield this.rootStore.client.ContentObjectMetadata({
        objectId,
        versionHash,
        select: [
          "public/name",
          "public/description",
          "offerings",
          "video_tags",
          "files",
          "mime_types"
        ]
      });

      this.selectedObject = {
        libraryId,
        objectId: object.id,
        versionHash,
        name: metadata.public && metadata.public.name || metadata.name || versionHash,
        metadata,
        //isVideo: metadata.offerings && metadata.offerings.default && metadata.offerings.default.ready
        isVideo: true
      };

      this.rootStore.videoStore.SetVideo(this.selectedObject);
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load object:");
      // eslint-disable-next-line no-console
      console.error(error);

      this.ClearObjectId();
      this.SetErrorMessage(error.message || error);

      throw error;
    }
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
            objectId: libraryId.replace("ilib", "iq__"),
            select: ["name", "public/name"]
          });

          this.libraries[libraryId] = {
            libraryId,
            name: metadata.public && metadata.public.name || metadata.name || libraryId
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
      objectId: libraryId.replace("ilib", "iq__"),
      select: ["name", "public/name"]
    });

    this.libraries[libraryId] = {
      libraryId,
      name: metadata.public && metadata.public.name || metadata.name || libraryId
    };

    let filters = [];
    if(filter) {
      filters.push({key: "/public/name", type: "cnt", filter});
    }

    if(this.showVideoOnly) {
      // Filter no longer works
      // filters.push({key: "/offerings/default/ready", type: "eq", filter: true});
    }

    let { contents, paging } = yield this.rootStore.client.ContentObjects({
      libraryId,
      filterOptions: {
        select: [
          "public/name",
        ],
        filter: filters,
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

  LookupContent = flow(function * (contentId) {
    contentId = contentId.replace(/ /g, "");

    if(!contentId) { return; }

    try {
      const client = this.rootStore.client;

      let libraryId, objectId, accessType;
      if(contentId.startsWith("ilib")) {
        libraryId = contentId;
        accessType = "library";
      } else if(contentId.startsWith("hq__")) {
        objectId = client.utils.DecodeVersionHash(contentId).objectId;
      } else if(contentId.startsWith("iq__")) {
        objectId = contentId;
      } else if(contentId.startsWith("0x")) {
        const id = client.utils.AddressToObjectId(contentId);
        accessType = yield client.AccessType({id});

        if(accessType === "library") {
          libraryId = client.utils.AddressToLibraryId(contentId);
        } else {
          objectId = id;
        }
      } else {
        objectId = client.utils.AddressToObjectId(client.utils.HashToAddress(contentId));
      }

      if(objectId && !libraryId) {
        libraryId = yield client.ContentObjectLibraryId({objectId});
      }

      if(!accessType) {
        accessType = yield client.AccessType({id: objectId});
      }

      switch(accessType) {
        case "library":
          this.SetLibraryId(libraryId);
          break;
        case "object":
          this.SetLibraryId(libraryId);
          this.SetObjectId(objectId);

          this.ToggleMenu(false);

          yield this.SelectVideo({libraryId, objectId});
          break;
        default:
          // eslint-disable-next-line no-console
          console.error("Invalid content:", contentId, accessType);
      }
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Failed to look up ID:");
      // eslint-disable-next-line no-console
      console.error(error);

      return { error: "Invalid content ID" };
    }
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
