import {flow, makeAutoObservable} from "mobx";
import UrlJoin from "url-join";
import {CreateTrackIntervalTree, ParseVTTTrack} from "@/stores/Helpers.js";

class ThumbnailStore {
  thumbnailTrackUrl;
  thumbnails = false;
  thumbnailStatus = { loaded: false };
  thumbnailImages = {};
  intervalTree;
  generating = false;


  constructor(parentStore) {
    // Parent store is a video store
    this.parentStore = parentStore;

    makeAutoObservable(
      this,
      {
        intervalTree: false,
        thumbnails: false
      }
    );
  }

  ThumbnailImage(time) {
    if(!this.thumbnailStatus.available) { return; }

    let thumbnailIndex = this.intervalTree?.search(time, time + 10)[0];
    const tag = this.thumbnails?.[thumbnailIndex?.toString()];

    if(!tag) { return; }

    if(!tag.thumbnailUrl) {
      if(!this.thumbnailCanvas) {
        this.thumbnailCanvas = document.createElement("canvas");
      }

      const image = this.thumbnailImages[tag?.imageUrl];

      if(image) {
        const [x, y, w, h] = tag.thumbnailPosition;
        this.thumbnailCanvas.height = h;
        this.thumbnailCanvas.width = w;
        const context = this.thumbnailCanvas.getContext("2d");
        context.drawImage(image, x, y, w, h, 0, 0, w, h);
        tag.thumbnailUrl = this.thumbnailCanvas.toDataURL("image/png");
      }
    }

    return tag.thumbnailUrl;
  }

  LoadThumbnails = flow(function * (thumbnailTrackUrl) {
    this.generating = localStorage.getItem(`regenerate-thumbnails-${this.parentStore.videoObject?.objectId}`);

    if(!thumbnailTrackUrl) {
      this.thumbnailStatus = {
        loaded: true,
        available: false,
        status: (yield this.ThumbnailGenerationStatus()) || {}
      };

      return;
    }

    thumbnailTrackUrl = new URL(thumbnailTrackUrl);
    const authToken = thumbnailTrackUrl.searchParams.get("authorization");
    thumbnailTrackUrl.searchParams.delete("authorization");
    const vttData = yield (yield fetch(thumbnailTrackUrl, {headers: {Authorization: `Bearer ${authToken}`}})).text();

    let tags = yield ParseVTTTrack({track: {label: "Thumbnails", vttData}, store: this.parentStore});

    let imageUrls = {};
    Object.keys(tags).map(id => {
      const [path, rest] = tags[id].tag.text.split("\n")[0].split("?");
      const [query, hash] = rest.split("#");
      const positionParams = hash.split("=")[1].split(",").map(n => parseInt(n));
      const queryParams = new URLSearchParams(`?${query}`);
      const url = new URL(thumbnailTrackUrl);
      url.searchParams.set("authorization", authToken);
      url.pathname = UrlJoin(url.pathname.split("/").slice(0, -1).join("/"), path);
      queryParams.forEach((key, value) =>
        url.searchParams.set(key, value)
      );

      tags[id].imageUrl = url.toString();
      tags[id].thumbnailPosition = positionParams;

      imageUrls[url.toString()] = true;

      delete tags[id].tag.text;
      delete tags[id].text;
    });

    yield Promise.all(
      Object.keys(imageUrls).map(async url => {
        const image = new Image();

        await new Promise(resolve => {
          image.src = url;
          image.crossOrigin = "anonymous";
          image.onload = () => {
            resolve();
          };
        });

        imageUrls[url] = image;
      })
    );

    this.thumbnailImages = imageUrls;
    this.thumbnails = tags;
    this.intervalTree = CreateTrackIntervalTree(tags, "Thumbnails");
    this.thumbnailStatus = { loaded: true, available: true };

    if(this.generating) {
      this.ThumbnailGenerationStatus();
    }
  });


  /* Video thumbnails creation */

  GenerateVideoThumbnails = flow(function * ({options={}}={}) {
    const client = this.parentStore.rootStore.client;

    try {
      this.thumbnailStatus.status = { state: "started" };

      const {libraryId, objectId} = this.parentStore.videoObject;
      const {writeToken} = yield client.EditContentObject({
        libraryId,
        objectId
      });

      const {data} = yield client.CallBitcodeMethod({
        libraryId,
        objectId,
        writeToken,
        method: "/media/thumbnails/create",
        constant: false,
        body: {
          async: true,
          frame_interval: Math.ceil(this.parentStore.frameRate) * 6,
          add_thumb_track: true,
          generate_storyboards: true,
          ...options
        }
      });

      const nodeUrl = yield client.WriteTokenNodeUrl({writeToken});

      yield client.walletClient.SetProfileMetadata({
        type: "app",
        appId: "video-editor",
        mode: "private",
        key: `thumbnail-job-${objectId}`,
        value: JSON.stringify({writeToken, lroId: data, nodeUrl})
      });

      yield this.ThumbnailGenerationStatus();

      this.generating = true;
      localStorage.setItem(`regenerate-thumbnails-${this.parentStore.videoObject?.objectId}`, "true");
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error(error);
      this.thumbnailStatus.status = { state: "failed" };
    }
  });

  ThumbnailGenerationStatus = flow(function * ({finalize=false}={}) {
    const client = this.parentStore.rootStore.client;

    const { libraryId, objectId } = this.parentStore.videoObject;
    const info = yield client.walletClient.ProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: `thumbnail-job-${objectId}`
    });

    if(!info) { return; }

    try {
      const {writeToken, lroId, nodeUrl} = JSON.parse(info);

      if(nodeUrl) {
        yield client.RecordWriteToken({writeToken, fabricNodeUrl: nodeUrl});
      }

      const response = yield client.CallBitcodeMethod({
        libraryId,
        objectId,
        writeToken,
        method: UrlJoin("/media/thumbnails/status", lroId),
        constant: true
      });

      if(response.data.custom.run_state === "finished" && finalize) {
        yield client.FinalizeContentObject({
          libraryId,
          objectId,
          writeToken,
          commitMessage: "Eluvio Video Editor: Generate video thumbnails"
        });

        yield client.walletClient.RemoveProfileMetadata({
          type: "app",
          appId: "video-editor",
          mode: "private",
          key: `thumbnail-job-${objectId}`
        });

        this.generating = false;
        localStorage.removeItem(`regenerate-thumbnails-${this.parentStore.videoObject?.objectId}`);
      }

      this.thumbnailStatus.status = {
        state: response?.data?.custom?.run_state,
        progress: response?.data?.custom?.progress?.percentage || 0,
        ...response
      };

      return this.thumbnailStatus.status;
    } catch(error) {
      // eslint-disable-next-line no-console
      console.log(error);

      if(error?.toString()?.includes("item does not exist")) {
        // Thumbnail job ended
        this.generating = false;
        localStorage.removeItem(`regenerate-thumbnails-${this.parentStore.videoObject?.objectId}`);
      }
    }
  });
}

export default ThumbnailStore;
