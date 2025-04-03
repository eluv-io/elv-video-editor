import {flow, makeAutoObservable} from "mobx";

class BrowserStore {
  libraries = undefined;
  selectedObject;

  constructor(rootStore) {
    makeAutoObservable(this);

    this.rootStore = rootStore;
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

  ObjectDetails = flow(function * ({objectId, versionHash, publicMetadata}) {
    if(!versionHash) {
      versionHash = yield this.rootStore.client.LatestVersionHash({objectId});
    }

    objectId = this.rootStore.client.utils.DecodeVersionHash(versionHash).objectId;

    const libraryId = yield this.rootStore.client.ContentObjectLibraryId({objectId});

    // Try and retrieve video duration
    let metadata, duration, lastModified, forbidden, isVideo, hasChannels, channels, hasAssets;
    try {
      metadata = yield this.rootStore.client.ContentObjectMetadata({
        versionHash: versionHash,
        select: [
          "public/name",
          "public/display_image",
          "commit/timestamp",
          "channel/offerings/*/display_name",
          "assets",
          "offerings/*/media_struct/duration_rat"
        ]
      });

      const savedChannels = this.rootStore.compositionStore.myCompositions[objectId];

      hasChannels = !!metadata?.channel || savedChannels;
      hasAssets = !!metadata?.assets;

      if(hasChannels) {
        channels = [];

        if(metadata?.channel) {
          channels = Object.keys(metadata?.channel?.offerings || {}).map(channelKey => ({
            key: channelKey,
            label: metadata.channel.offerings[channelKey].display_name || channelKey,
          }));
        }

        if(savedChannels) {
          channels = [
            ...Object.values(savedChannels)
              .filter(channel => channel.writeTokenInfo),
            ...channels.filter(({key}) => !Object.values(savedChannels).find(channel => channel.key === key))
          ];
        }

        channels = channels.sort((a, b) => a.label?.toLowerCase() < b.label?.toLowerCase() ? -1 : 1);
      }

      lastModified = metadata?.commit?.timestamp;
      if(lastModified) {
        lastModified = new Date(lastModified).toLocaleDateString(navigator.language, {month: "short", day: "numeric", year: "numeric"});
      }

      const offering = metadata?.offerings?.default ?
        "default" :
        Object.keys(metadata?.offerings || {})[0];

      duration = metadata?.offerings?.[offering]?.media_struct?.duration_rat;

      if(duration) {
        isVideo = true;
        duration = parseInt(duration.split("/")[0]) / parseInt(duration.split("/")[1]);

        let hours = Math.floor(Math.max(0, duration) / 60 / 60) % 24;
        let minutes = Math.floor(Math.max(0, duration) / 60 % 60);
        let seconds = Math.ceil(Math.max(duration, 0) % 60);

        duration = [hours, minutes, seconds]
          .map(t => (!t || isNaN(t) ? "" : t.toString()).padStart(2, "0"))
          .join(":");
      }
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
