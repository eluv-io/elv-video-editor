import {flow, makeAutoObservable} from "mobx";
import UrlJoin from "url-join";

class BrowserStore {
  libraryId = "";
  objectId = "";
  error = "";

  libraries = undefined;

  selectedObject;

  constructor(rootStore) {
    makeAutoObservable(this);

    this.rootStore = rootStore;
  }

  UpdateVersionHash(versionHash) {
    this.selectedObject.versionHash = versionHash;
  }

  SetErrorMessage(error) {
    this.error = error;
  }

  ClearErrorMessage() {
    this.error = "";
  }

  SelectVideo = flow(function * ({libraryId, objectId, versionHash}) {
    try {
      this.SetLibraryId(libraryId);
      this.SetObjectId(objectId);

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
        resolveLinks: true,
        resolveIgnoreErrors: true,
        linkDepthLimit: 1,
        select: [
          "public/name",
          "public/description",
          "offerings",
          "video_tags",
          "files",
          "mime_types",
          "assets"
        ]
      });

      this.selectedObject = {
        libraryId,
        objectId: object.id,
        versionHash,
        name: metadata.public && metadata.public.name || metadata.name || versionHash,
        description: metadata.public && metadata.public.description || metadata.description,
        metadata,
        //isVideo: metadata.offerings && metadata.offerings[this.rootStore.videoStore.offeringKey]?.ready
        isVideo: true
      };

      this.rootStore.videoStore.SetVideo(this.selectedObject);

      this.rootStore.SetView("tags");
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load object:");
      // eslint-disable-next-line no-console
      console.error(error);

      this.SetObjectId("");
      this.SetErrorMessage(error.message || error);

      throw error;
    }
  });

  ListLibraries = flow(function * ({page, perPage, filter=""}) {
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
      .filter(({name}) => !filter || name.toLowerCase().includes(filter.toLowerCase()));

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

  ListObjects = flow(function * ({libraryId, page=1, perPage=25, filter="", cacheId=""}) {
    libraryId = libraryId || this.libraryId;

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

    contents = yield Promise.all(
      contents.map(async object => {
        const latestVersion = object.versions[0];

        // Try and retrieve video duration
        let duration, lastModified, forbidden;
        try {
          const metadata = await this.rootStore.client.ContentObjectMetadata({
            versionHash: latestVersion.hash,
            select: [
              "commit/timestamp",
              "offerings/*/media_struct/duration_rat"
            ]
          });

          lastModified = metadata?.commit?.timestamp;
          if(lastModified) {
            lastModified = new Date(lastModified).toLocaleDateString(navigator.language, {month: "short", day: "numeric", year: "numeric"});
          }

          const offering = metadata?.offerings?.default ?
            "default" :
            Object.keys(metadata?.offerings || {})[0];

          duration = metadata?.offerings?.[offering]?.media_struct?.duration_rat;

          if(duration) {
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

        return {
          id: latestVersion.id,
          objectId: latestVersion.id,
          versionHash: latestVersion.hash,
          forbidden,
          lastModified,
          duration,
          name: latestVersion?.meta?.public?.name || latestVersion.id,
          image: !latestVersion?.meta?.public?.display_image ? undefined :
            await this.rootStore.client.LinkUrl({
              versionHash: latestVersion.hash,
              linkPath: "/public/display_image"
            }),
          metadata: latestVersion?.meta || {}
        };
      })
    );

    return {
      content: contents,
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

    if(!contentId) { return; }

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
          this.SetLibraryId(libraryId);
          return true;
        case "object":
          yield this.SelectVideo({libraryId, objectId, versionHash});
          return true;
        default:
          // eslint-disable-next-line no-console
          console.error("Invalid content:", contentId, accessType);
      }
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Failed to look up ID:");
      // eslint-disable-next-line no-console
      console.error(error);

      return false;
    }
  });

  SetLibraryId(libraryId) {
    this.libraryId = libraryId;
  }

  SetObjectId(objectId) {
    this.objectId = objectId;
  }
}

export default BrowserStore;
