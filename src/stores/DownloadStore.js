// Downloads and Sharing

import {flow, makeAutoObservable} from "mobx";
import UrlJoin from "url-join";
import {Unproxy} from "@/utils/Utils.js";


class DownloadStore {
  shortUrls = {};

  downloadJobInfo = {};
  downloadJobStatus = {};
  downloadedJobs = {};

  shareDownloadJobStatus = {};

  constructor(rootStore) {
    makeAutoObservable(this);

    this.rootStore = rootStore;
  }

  get videoObjectId() {
    return this.rootStore.videoStore?.videoObject?.objectId ||
      this.rootStore.compositionStore?.videoStore?.videoObject?.objectId;
  }

  DownloadJobDefaultFilename({store, format="mp4", offering="default", clipInFrame, clipOutFrame, representationInfo, audioRepresentationInfo}) {
    clipInFrame = clipInFrame || 0;
    clipOutFrame = clipOutFrame || store.totalFrames - 1;

    let filename = store.channel ?
      this.rootStore.compositionStore.compositionObject?.name :
      this.rootStore.videoStore.name;

    if(offering && offering !== "default") {
      filename = `${filename || ""} (${offering})`;
    }

    if(clipInFrame || (clipOutFrame && clipOutFrame < store.totalFrames - 1)) {
      const startTime = store.videoHandler.FrameToString({frame: clipInFrame}).replaceAll(" ", "");
      const endTime = store.videoHandler.FrameToString({frame: clipOutFrame || store.totalFrames}).replaceAll(" ", "");
      filename = `${filename} (${startTime} - ${endTime})`;
    }

    if(representationInfo && !representationInfo.isTopResolution) {
      filename = `${filename} (${representationInfo.width}x${representationInfo.height})`;
    }

    if(audioRepresentationInfo && !audioRepresentationInfo.default) {
      filename = `${filename} (${audioRepresentationInfo.label})`;
    }

    return `${filename}.${format === "mp4" ? "mp4" : "mov"}`;
  }

  async SaveDownloadJobInfo() {
    await this.rootStore.client.walletClient.SetProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: `download-jobs-${this.videoObjectId}`,
      value: this.rootStore.client.utils.B64(
        JSON.stringify(this.downloadJobInfo || {})
      )
    });
  }

  LoadDownloadJobInfo = flow(function * () {
    const response = JSON.parse(
      this.rootStore.client.utils.FromB64(
        (yield this.rootStore.client.walletClient.ProfileMetadata({
          type: "app",
          appId: "video-editor",
          mode: "private",
          key: `download-jobs-${this.videoObjectId}`,
        })) || ""
      ) || "{}"
    );

    let deleted = false;
    // Remove expired entries
    Object.keys(response).forEach(key => {
      if(Date.now() > response[key].expiresAt) {
        delete response[key];
        deleted = true;
      }
    });

    this.downloadJobInfo = response;

    if(deleted) {
      this.SaveDownloadJobInfo();
    }
  });

  StartDownloadJob = flow(function * ({
    composition,
    filename,
    format="mp4",
    offering="default",
    representation,
    audioRepresentation,
    clipInFrame,
    clipOutFrame,
    isShareDownload=false,
    encrypt=true
  }) {
    try {
      let totalFrames, frameRate, versionHash;
      if(composition) {
        totalFrames = this.rootStore.compositionStore.compositionDurationFrames;
        frameRate = this.rootStore.compositionStore.videoStore.frameRate;
        versionHash = this.rootStore.compositionStore.videoStore.videoObject.versionHash;
        offering = this.rootStore.compositionStore.compositionObject.compositionKey;
      } else {
        totalFrames = this.rootStore.videoStore.totalFrames;
        frameRate = this.rootStore.videoStore.frameRate;
        versionHash = this.rootStore.videoStore.videoObject.versionHash;
      }

      clipInFrame = clipInFrame || 0;
      clipOutFrame = clipOutFrame || totalFrames - 1;

      filename = filename || this.DownloadJobDefaultFilename({format, offering, clipInFrame, clipOutFrame});
      const expectedExtension = format === "mp4" ? ".mp4" : ".mov";
      if(!filename.endsWith(expectedExtension)) {
        filename = `${filename}${expectedExtension}`;
      }

      let params = {
        format,
        offering,
        filename
      };

      if(composition) {
        params.offering_type = "composition";
      }

      if(representation) {
        params.representation = representation;
      }

      if(audioRepresentation) {
        params.audio = audioRepresentation;
      }

      if(clipInFrame) {
        // Use more literal time for api as opposed to SMPTE
        params.start_ms = `${((1 / frameRate) * clipInFrame).toFixed(4)}s`;
      }

      if(clipOutFrame && clipOutFrame < totalFrames - 1) {
        params.end_ms = `${((1 / frameRate) * clipOutFrame).toFixed(4)}s`;
      }

      const response = yield this.rootStore.client.MakeFileServiceRequest({
        versionHash,
        path: "/call/media/files",
        method: "POST",
        body: params,
        encryption: encrypt ? "cgck" : undefined
      });

      const status = yield this.DownloadJobStatus({
        jobId: response.job_id,
        versionHash
      });

      // If created for a share, do not save to personal downloads or initiate automatic download
      if(isShareDownload) {
        this.shareDownloadJobStatus[response.job_id] = status;

        return { jobId: response.job_id, status };
      }

      this.downloadJobInfo[response.job_id] = {
        versionHash,
        composition,
        filename,
        format,
        offering,
        representation,
        audioRepresentation,
        clipInFrame,
        clipOutFrame,
        startedAt: Date.now(),
        expiresAt: Date.now() + 29 * 24 * 60 * 60 * 1000
      };

      this.SaveDownloadJobInfo();
      let interval = setInterval(async () => {
        const status = await this.DownloadJobStatus({jobId: response.job_id}) || {};

        if(status?.status === "completed") {
          clearInterval(interval);
          this.SaveDownloadJob({jobId: response.job_id});
        }

        if(status?.status !== "processing") {
          clearInterval(interval);
        }
      }, 10000);

      this.downloadJobInfo[response.job_id].automaticDownloadInterval = interval;

      return {
        jobId: response.job_id,
        status
      };
    } catch(error) {
      // eslint-disable-next-line no-console
      console.error("Error performing download:");
      // eslint-disable-next-line no-console
      console.error(error);
      if(encrypt) {
        return this.StartDownloadJob({...arguments[0], encrypt: false});
      }
    }
  });

  DownloadJobStatus = flow(function * ({jobId, versionHash}) {
    this.downloadJobStatus[jobId] = yield this.rootStore.client.MakeFileServiceRequest({
      versionHash: versionHash || this.downloadJobInfo[jobId].versionHash,
      path: UrlJoin("call", "media", "files", jobId)
    });

    return this.downloadJobStatus[jobId];
  });

  ShareDownloadJobStatus = flow(function * ({jobId, objectId}) {
    this.shareDownloadJobStatus[jobId] = yield this.rootStore.client.MakeFileServiceRequest({
      libraryId: yield this.rootStore.client.ContentObjectLibraryId({objectId}),
      objectId,
      path: UrlJoin("call", "media", "files", jobId)
    });

    return this.shareDownloadJobStatus[jobId];
  });

  SaveDownloadJob = flow(function * ({jobId}) {
    clearInterval(this.downloadJobInfo[jobId]?.automaticDownloadInterval);

    const jobInfo = this.downloadJobInfo[jobId];

    const downloadUrl = yield this.rootStore.client.FabricUrl({
      versionHash: jobInfo.versionHash,
      call: UrlJoin("media", "files", jobId, "download"),
      service: "files",
      queryParams: {
        "header-x_set_content_disposition": `attachment; filename="${jobInfo.filename}"`
      }
    });

    try {
      this.rootStore.OpenExternalLink(downloadUrl, jobInfo.filename);

      this.downloadedJobs[jobId] = true;
    } catch(error) {
      this.rootStore.SetError("Unable to download");
      // eslint-disable-next-line no-console
      console.error("Invalid URL or failed to download", error);
    }
  });

  RemoveDownloadJob({jobId}) {
    clearInterval(this.downloadJobInfo[jobId]?.automaticDownloadInterval);
    delete this.downloadJobInfo[jobId];
    this.SaveDownloadJobInfo();
  }

  CreateEmbedUrl = flow(function * ({
    store,
    offeringKey,
    compositionKey,
    audioTrackLabel,
    clipInFrame,
    clipOutFrame,
    shareId,
    title
  }) {
    let options = {
      autoplay: true,
    };

    if(offeringKey !== "default") {
      options.offerings = [offeringKey];
    }

    if(clipInFrame > 0 || clipOutFrame <= store.totalFrames - 1) {
      options.clipStart = store.FrameToTime(clipInFrame || 0);
      options.clipEnd = store.FrameToTime(clipOutFrame || store.totalFrames - 1);
    }

    const url = new URL(
      yield this.rootStore.client.EmbedUrl({
        objectId: store.videoObject.objectId,
        duration: 7 * 24 * 60 * 60 * 1000,
        options
      })
    );

    if(compositionKey && compositionKey !== "main") {
      url.searchParams.delete("off");
      url.searchParams.set("ch", compositionKey);
    }

    if(audioTrackLabel) {
      url.searchParams.set("aud", this.rootStore.client.utils.B64(audioTrackLabel));
    }

    url.searchParams.set("vc", "");

    if(shareId) {
      url.searchParams.delete("ath");
      url.searchParams.set("sid", shareId);
    }

    if(title) {
      url.searchParams.set("ttl", this.rootStore.client.utils.B64(title));
    }

    return url.toString();
  });

  CreateShare = flow(function * ({store, shareOptions, downloadOptions}) {
    const objectId = store.videoObject.objectId;

    downloadOptions = Unproxy(downloadOptions);

    if(downloadOptions.noClip){
      delete downloadOptions.noClip;
      downloadOptions.clipInFrame = 0;
      downloadOptions.clipOutFrame = store.totalFrames - 1;
    }

    let attributes = {
      source: ["evie"],
      type: [shareOptions.type],
      composition: [shareOptions.compositionKey || "main"],
      title: [shareOptions.title || ""],
      note: [shareOptions.note || ""],
      permissions: [shareOptions.permissions],
      shareOptions: [JSON.stringify(shareOptions)],
      downloadOptions: [JSON.stringify(downloadOptions)],
    };

    if(downloadOptions.audioRepresentations?.length > 1) {
      // Multiple audio tracks
      const selectedTrack = downloadOptions.audioRepresentations.find(rep =>
        rep.key === downloadOptions?.audioRepresentation
      );

      if(selectedTrack && !selectedTrack.default) {
        attributes.audioTrackLabel = [selectedTrack.label];
      }
    }

    if(["download", "both"].includes(shareOptions.permissions)) {
      attributes.downloadJobId = [
        (yield this.StartDownloadJob({
          ...downloadOptions,
          composition: store.channel,
          isShareDownload: true
        })).jobId
      ];

      attributes.versionHash = [store.videoObject.versionHash];
      attributes.filename = [downloadOptions.filename || downloadOptions.defaultFilename];
    }

    if(shareOptions.email) {
      attributes.recipient = [shareOptions.email];
    } else {
      attributes.label = [shareOptions.label];
    }

    let params = {};
    if(downloadOptions.clipInFrame > 0) {
      attributes.clipIn = [store.FrameToTime(downloadOptions.clipInFrame).toString(), downloadOptions.clipInFrame.toString()];
      params.clip_start = Math.floor(store.FrameToTime(downloadOptions.clipInFrame));
    }

    if(downloadOptions.clipOutFrame < store.totalFrames - 1) {
      attributes.clipOut = [store.FrameToTime(downloadOptions.clipOutFrame).toString(), downloadOptions.clipOutFrame.toString()];
      params.clip_end = Math.ceil(store.FrameToTime(downloadOptions.clipOutFrame));
    }

    let options = {
      ...params,
      sharing_type: "public",
      attributes
    };

    if(!shareOptions.compositionKey) {
      options.offering = downloadOptions.offering;
    }

    const share = (yield this.rootStore.client.CreateShare({
      objectId,
      expiresAt: shareOptions.expiresAt,
      params: Unproxy(options)
    })).share;

    const formattedShare = yield this.FormatShare({store, share});

    if(shareOptions.email) {
      this.SendShareEmail({share: formattedShare});
    }

    return formattedShare;
  });

  CreateShortUrl = flow(function * (url) {
    try {
      // Normalize URL
      url = new URL(url).toString();

      if(!this.shortUrls[url]) {
        const {url_mapping} = yield (yield fetch("https://elv.lv/tiny/create", {method: "POST", body: url})).json();

        this.shortUrls[url] = url_mapping.shortened_url;
      }

      return this.shortUrls[url];
    } catch(error) {
      this.Log(error, true);
    }
  });

  async FormatShare({store, share}) {
    let clipDetails = {};
    if(share.attributes?.clipIn) {
      const [clipInTime, clipInFrame] = share.attributes.clipIn;
      clipDetails.clipInTime = parseFloat(clipInTime);
      clipDetails.clipInFrame = parseFloat(clipInFrame);
      clipDetails.isClipped = true;
    }

    if(share.attributes?.clipOut) {
      const [clipOutTime, clipOutFrame] = share.attributes.clipOut;
      clipDetails.clipOutTime = parseFloat(clipOutTime);
      clipDetails.clipOutFrame = parseFloat(clipOutFrame);
      clipDetails.isClipped = true;
    }

    clipDetails.durationFrames = (clipDetails.clipOutFrame || store.totalFrames - 1) - (clipDetails.clipInFrame || 0);
    clipDetails.duration = store.FrameToTime(clipDetails.durationFrames);
    clipDetails.durationString = store.TimeToString(clipDetails.duration);

    if(share.attributes?.audioTrackLabel) {
      share.audioTrackLabel = share.attributes.audioTrackLabel[0];
    }

    if(share.attributes?.downloadJobId) {
      share.downloadJobId = share.attributes.downloadJobId[0];
    }

    if(share.attributes?.title) {
      share.title = share.attributes.title[0];
    }

    if(share.attributes?.shareOptions?.length > 0) {
      try {
        share.shareOptions = JSON.parse(share.attributes.shareOptions[0]);
      } catch(error) {
        // eslint-disable-next-line no-console
        console.error("Unable to parse share details", share);
        // eslint-disable-next-line no-console
        console.error(error);
      }
    }

    if(share.attributes?.downloadOptions?.length > 0) {
      try {
        share.downloadOptions = JSON.parse(share.attributes.downloadOptions[0]);
      } catch(error) {
        // eslint-disable-next-line no-console
        console.error("Unable to parse share details", share);
        // eslint-disable-next-line no-console
        console.error(error);
      }
    }

    if(clipDetails.isClipped) {
      clipDetails.string = `${store.FrameToSMPTE(clipDetails.clipInFrame || 0)} - ${store.FrameToSMPTE(clipDetails.clipOutFrame || store.totalFrames - 1)} (${store.TimeToString(clipDetails.duration)})`;
    }

    if(share.attributes?.composition) {
      share.compositionKey = share.attributes.composition[0];
    }

    const embedUrl = new URL(
      await this.CreateEmbedUrl({
        store,
        offeringKey: share.downloadOptions?.offering,
        audioTrackLabel: share.audioTrackLabel,
        compositionKey: share.compositionKey,
        clipInFrame: clipDetails.clipInFrame ? clipDetails.clipInFrame : undefined,
        clipOutFrame: clipDetails.clipOutFrame ? clipDetails.clipOutFrame : undefined,
        shareId: share.share_id,
        title: share.title
      })
    );

    if(share.downloadJobId) {
      const downloadUrl = new URL(embedUrl.origin);
      downloadUrl.searchParams.set("d", "");
      downloadUrl.searchParams.set("net", embedUrl.searchParams.get("net"));
      downloadUrl.searchParams.set("sid", share.share_id);

      share.downloadUrl = downloadUrl.toString();
    }

    return {
      ...share,
      type: share.attributes?.type?.[0] || "recipients",
      recipient: share.attributes?.recipient?.[0],
      label: share.attributes?.label?.[0],
      permissions: share.attributes?.permissions?.[0] || "stream",
      expiresAt: new Date(share.end_time),
      expired: Date.now() > new Date(share.end_time).getTime(),
      clipDetails,
      embedUrl: embedUrl.toString()
    };
  }

  Shares = flow(function * ({store, compositionKey="main"}) {
    const objectId = store.videoObject.objectId;

    const {shares} = yield this.rootStore.client.Shares({
      objectId,
      limit: 10000,
      params: {
        attributes: {
          composition: [ compositionKey ]
        }
      }
    });

    return yield Promise.all(
      (shares || [])
        .filter(share => share.attributes?.source?.[0] === "evie")
        .sort((a, b) => a.updated < b.updated ? 1 : -1)
        .map(async share => await this.FormatShare({store, share}))
    );
  });

  UpdateShare = flow(function * ({shareId, expiresAt}) {
    return yield this.rootStore.client.UpdateShare({shareId, expiresAt: expiresAt});
  });

  RevokeShare = flow(function * ({shareId}) {
    return yield this.rootStore.client.RevokeShare({shareId});
  });

  SendShareEmail = flow(function * ({share}) {
    const tenantId = yield this.rootStore.client.ContentObjectTenantId({objectId: share.object_id});

    let options = {
      tenant: tenantId,
      email: share.recipient,
      share_title: share.shareOptions.title || "",
      share_description: share.shareOptions.note || "",
    };

    if(["stream", "both"].includes(share.shareOptions.permissions)) {
      options.stream_button_link = yield this.CreateShortUrl(share.embedUrl);
    }

    if(["download", "both"].includes(share.shareOptions.permissions)) {
      options.download_button_link = yield this.CreateShortUrl(share.downloadUrl);
    }

    return yield this.rootStore.client.MakeAuthServiceRequest({
      format: "json",
      path: "/as/wlt/ory/send_share_email",
      method: "POST",
      body: options,
      headers: { Authorization: `Bearer ${this.rootStore.signedToken}` }
    });
  });
}

export default DownloadStore;
