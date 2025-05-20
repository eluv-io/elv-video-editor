import {flow, makeAutoObservable} from "mobx";
import FrameAccurateVideo from "@/utils/FrameAccurateVideo.js";

class BrowserStore {
  libraries = undefined;
  selectedObject;
  myLibraryItems;

  liveToVodFormFields = {};

  constructor(rootStore) {
    makeAutoObservable(this);

    this.ClearLiveToVodFormFields();

    this.rootStore = rootStore;
  }

  get client() {
    return this.rootStore.client;
  }

  SetLiveToVodFormFields(fields={}) {
    this.liveToVodFormFields = {
      ...this.liveToVodFormFields,
      ...fields
    };
  }

  ClearLiveToVodFormFields() {
    this.liveToVodFormFields = {
      liveStreamLibraryId: "",
      liveStreamId: "",
      libraryId: "",
      title: ""
    };
  }

  UpdateVersionHash(versionHash) {
    this.selectedObject.versionHash = versionHash;
  }

  ListLibraries = flow(function * ({page, perPage, filter=""}) {
    if(filter.startsWith("iq__") || filter.startsWith("hq__")) {
      filter = "";
    }

    if(!this.libraries) {
      const libraryIds = yield this.rootStore.client.ContentLibraries();

      const libraries = {};

      (yield Promise.all(
        libraryIds.map(async libraryId => {
          try {
            const metadata = (await this.rootStore.client.ContentObjectMetadata({
              libraryId,
              objectId: libraryId.replace("ilib", "iq__"),
              metadataSubtree: "/public",
              select: ["name", "display_image"]
            })) || {};

            libraries[libraryId] = {
              libraryId,
              name: metadata.name || libraryId,
              image: !metadata.display_image ? undefined :
                await this.rootStore.client.LinkUrl({
                  libraryId,
                  objectId: libraryId.replace("ilib", "iq__"),
                  linkPath: "/public/display_image"
                }),
            };
          } catch(error) {
            return undefined;
          }
        })
      ));

      this.libraries = libraries;
    }

    const content = Object.keys(this.libraries)
      .map(libraryId => ({
        id: libraryId,
        name: this.libraries[libraryId].name,
        image: this.libraries[libraryId].image
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(({id, name}) =>
        !filter ||
        name.toLowerCase().includes(filter.toLowerCase()) ||
        id.includes(filter.toLowerCase())
      );

    return ({
      content: content.slice((page - 1) * perPage, page * perPage),
      paging: {
        page,
        perPage,
        pages: Math.ceil(content.length / perPage),
        total: content.length
      }
    });
  });

  FormatDuration(duration) {
    if(!duration) { return; }

    duration = duration.toString();
    if(duration.includes("/")) {
      duration = parseInt(duration.split("/")[0]) / parseInt(duration.split("/")[1]);
    }

    let hours = Math.floor(Math.max(0, duration) / 60 / 60) % 24;
    let minutes = Math.floor(Math.max(0, duration) / 60 % 60);
    let seconds = Math.ceil(Math.max(duration, 0) % 60);

    return [hours, minutes, seconds]
      .map(t => (!t || isNaN(t) ? "" : t.toString()).padStart(2, "0"))
      .join(":");
  }

  FormatDate(date) {
    if(!date) { return; }

    try {
      return new Date(date)
        .toLocaleDateString(navigator.language, {month: "short", day: "numeric", year: "numeric"});
    } catch(error) {
      return undefined;
    }
  }

  ObjectDetails = flow(function * ({objectId, versionHash, publicMetadata}) {
    if(!versionHash) {
      versionHash = yield this.rootStore.client.LatestVersionHash({objectId});
    }

    objectId = this.rootStore.client.utils.DecodeVersionHash(versionHash).objectId;

    const libraryId = yield this.rootStore.client.ContentObjectLibraryId({objectId});

    // Try and retrieve video duration
    let metadata, duration, lastModified, forbidden, isVideo, hasChannels, channels, hasAssets, isLiveStream, isLive, vods;
    try {
      metadata = yield this.rootStore.client.ContentObjectMetadata({
        versionHash: versionHash,
        select: [
          "public/name",
          "public/display_image",
          "commit/timestamp",
          "channel/offerings/*/display_name",
          "channel/offerings/*/updated_at",
          "channel/offerings/*/items",
          "assets",
          "offerings/*/media_struct/duration_rat",
          "live_recording/status",
          "live_recording_copies"
        ]
      });

      const savedChannels = Object.values(this.rootStore.compositionStore.myCompositions[objectId] || {})
        .filter(channel => channel.writeTokenInfo)
        .map(composition => ({
          ...composition,
          objectId,
          duration: this.FormatDuration(composition.duration),
          lastModifiedISO: composition.lastModified,
          lastModified: this.FormatDate(composition.lastModified),
          compositionKey: composition.compositionKey || composition.key
        }));

      hasChannels = !!metadata?.channel || savedChannels.length > 0;
      hasAssets = !!metadata?.assets;

      if(hasChannels) {
        channels = [];

        if(metadata?.channel) {
          channels = Object.keys(metadata?.channel?.offerings || {}).map(channelKey => {
            const channel = metadata.channel.offerings[channelKey];

            let lastModified = channel.updated_at;
            if(lastModified) {
              lastModified = this.FormatDate(lastModified);
            }

            let duration;
            if(channel.items) {
              try {
                duration = this.FormatDuration(
                  channel.items.reduce((acc, item) =>
                      acc + (FrameAccurateVideo.ParseRat(item.slice_end_rat) - FrameAccurateVideo.ParseRat(item.slice_start_rat)),
                    0
                  )
                );
              } catch(error) {
                // eslint-disable-next-line no-console
                console.error("Error parsing channel duration:");
                // eslint-disable-next-line no-console
                console.error(error);
              }
            }

            return {
              objectId,
              compositionKey: channelKey,
              label: channel.display_name || channelKey,
              duration,
              lastModifiedISO: channel.updated_at,
              lastModified: lastModified
            };
          });
        }

        if(savedChannels.length > 0) {
          channels = [
            ...savedChannels,
            ...channels.filter(({key}) => !savedChannels.find(channel => channel.key === key))
          ];
        }

        channels = channels
          .sort((a, b) => {
            if(a.lastModifiedISO && b.lastModifiedISO) {
              return a.lastModifiedISO > b.lastModifiedISO ? -1 : 1;
            } else if(a.lastModifiedISO) {
              return -1;
            } else if(b.lastModifiedISO) {
              return 1;
            }

            return a.label?.toLowerCase() < b.label?.toLowerCase() ? -1 : 1;
          });
      }

      lastModified = metadata?.commit?.timestamp;
      if(lastModified) {
        lastModified = this.FormatDate(lastModified);
      }

      const offering = metadata?.offerings?.default ?
        "default" :
        Object.keys(metadata?.offerings || {})[0];

      duration = metadata?.offerings?.[offering]?.media_struct?.duration_rat;

      if(duration) {
        isVideo = true;
        duration = this.FormatDuration(duration);
      }

      isLiveStream = !!metadata?.live_recording;
      isLive = isLiveStream && metadata.live_recording?.status?.state === "active";
      vods = metadata.live_recording_copies;
    } catch(error) {
      if(error.status === 403) {
        forbidden = true;
      }
    }

    metadata = metadata || { public: publicMetadata };

    return {
      libraryId,
      id: objectId,
      objectId: objectId,
      versionHash: versionHash,
      forbidden,
      lastModified,
      duration,
      isVideo,
      hasChannels,
      hasAssets,
      channels,
      isLiveStream,
      isLive,
      vods,
      name: metadata?.public?.name || objectId,
      image: !metadata?.public?.display_image ? undefined :
        yield this.rootStore.client.LinkUrl({
          versionHash: versionHash,
          linkPath: "/public/display_image"
        }),
      metadata
    };
  });

  ListObjects = flow(function * ({libraryId, page=1, perPage=25, filter="", cacheId=""}) {
    if(filter.startsWith("iq__") || filter.startsWith("hq__")) {
      filter = "";
    }

    let filters = [];
    if(filter) {
      filters.push({key: "/public/name", type: "cnt", filter});
    }

    let { contents, paging } = yield this.rootStore.client.ContentObjects({
      libraryId,
      filterOptions: {
        select: [
          "public/name",
          "public/display_image"
        ],
        filter: filters,
        start: (page-1) * perPage,
        limit: perPage,
        sort: "public/name",
        cacheId
      }
    });

    return {
      content: yield Promise.all(
        contents.map(async object => {
          const latestVersion = object.versions[0];

          return this.ObjectDetails({
            publicMetadata: latestVersion.meta?.public,
            versionHash: latestVersion.hash
          });
        })
      ),
      paging: {
        page,
        pages: paging.pages,
        perPage,
        total: paging.items
      }
    };
  });

  // My library
  LoadMyLibrary = flow(function * () {
    if(this.myLibraryItems) { return; }

    const myLibraryItems = yield this.client.walletClient.ProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: `my-library${this.rootStore.localhost ? "-dev" : ""}`
    });

    if(myLibraryItems) {
      this.myLibraryItems = JSON.parse(this.client.utils.FromB64(myLibraryItems));
    } else {
      this.myLibraryItems = [];
    }
  });

  ListMyLibrary = flow(function * ({page, perPage, filter=""}) {
    yield this.LoadMyLibrary();

    filter = filter.toLowerCase();
    let content = this.myLibraryItems
      .sort((a, b) => a.accessedAt < b.accessedAt ? 1 : -1)
      .filter(item =>
        !filter ||
        item.name?.toLowerCase()?.includes(filter) ||
        item.compositionKey?.toLowerCase()?.includes(filter) ||
        item.objectId?.toLowerCase()?.includes(filter)
      );

    const contentLength = content.length;
    content = content.slice((page - 1) * perPage, page * perPage);

    let itemsDeleted = false;
    content = (yield Promise.all(
      content.map(async item => {
        try {
          if(item.compositionKey) {
            return {
              ...item,
              duration: this.FormatDuration(item.duration),
              lastModified: this.FormatDate(item.accessedAt)
            };
          }

          return {
            ...(await this.ObjectDetails({objectId: item.objectId})),
            lastModified: this.FormatDate(item.accessedAt)
          };
        } catch(error) {
          // eslint-disable-next-line no-console
          console.error("Error retrieving my library item:");
          // eslint-disable-next-line no-console
          console.error(error);

          if(typeof error === "string" && error.includes("deleted")) {
            // eslint-disable-next-line no-console
            console.warn("Removing library item");

            itemsDeleted = true;
            await this.RemoveMyLibraryItem(item);
          }

          return item;
        }
      })
    ));

    if(itemsDeleted) {
      // Items were deleted - redo listing
      return yield this.ListMyLibrary({page, perPage, filter});
    }

    return {
      content,
      paging: {
        page,
        perPage,
        pages: Math.ceil(contentLength / perPage),
        total: contentLength
      }
    };
  });

  AddMyLibraryItem = flow(function * ({objectId, name, compositionKey, duration, isVideo, status}) {
    yield this.LoadMyLibrary();

    let item = { objectId, name, status, duration, isVideo, accessedAt: Date.now() };
    if(compositionKey) {
      item.id = `${objectId}-${compositionKey}`;
      item.compositionKey = compositionKey;
    } else {
      item.id = objectId;
    }

    this.myLibraryItems = [
      item,
      ...this.myLibraryItems,
    ]
      // Ensure sorted by access time
      .sort((a, b) => a.accessedAt < b.accessedAt ? 1 : -1)
      // Filter unique
      .filter((item, index, array) =>
        array.findIndex(otherItem => item.id === otherItem.id) === index
      )
      // Max 100 records
      .slice(0, 100);

    yield this.SaveMyLibrary();
  });

  RemoveMyLibraryItem = flow(function * ({objectId, compositionKey}) {
    yield this.LoadMyLibrary();

    const id = compositionKey ? `${objectId}-${compositionKey}` : objectId;
    this.myLibraryItems = this.myLibraryItems
      .filter(item => item.id !== id);

    yield this.SaveMyLibrary();
  });

  SaveMyLibrary = flow(function * () {
    yield this.client.walletClient.SetProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: `my-library${this.rootStore.localhost ? "-dev" : ""}`,
      value: this.rootStore.client.utils.B64(JSON.stringify(this.myLibraryItems))
    });
  });

  LookupContent = flow(function * (contentId) {
    contentId = contentId.replace(/ /g, "");

    if(!contentId) { return {}; }

    try {
      const client = this.rootStore.client;

      let libraryId, objectId, accessType, versionHash;
      if(contentId.startsWith("ilib")) {
        libraryId = contentId;
        accessType = "library";
      } else if(contentId.startsWith("hq__")) {
        versionHash = contentId;
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
          return { libraryId };
        case "object":
          return yield this.ObjectDetails({objectId, versionHash});
        default:
          // eslint-disable-next-line no-console
          console.error("Invalid content:", contentId, accessType);
      }
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Failed to look up ID:");
      // eslint-disable-next-line no-console
      console.error(error);
    }

    return {};
  });
}

export default BrowserStore;
