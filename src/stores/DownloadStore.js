// Downloads and Sharing

import {flow, makeAutoObservable} from "mobx";
import UrlJoin from "url-join";
import {DownloadFromUrl, Unproxy} from "@/utils/Utils.js";


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

  DownloadJobDefaultFilename({format="mp4", offering="default", clipInFrame, clipOutFrame, representationInfo, audioRepresentationInfo}) {
    clipInFrame = clipInFrame || 0;
    clipOutFrame = clipOutFrame || this.rootStore.videoStore.totalFrames - 1;

    let filename = this.rootStore.videoStore.name;

    if(offering && offering !== "default") {
      filename = `${filename} (${offering})`;
    }

    if(clipInFrame || (clipOutFrame && clipOutFrame < this.rootStore.videoStore.totalFrames - 1)) {
      const startTime = this.rootStore.videoStore.videoHandler.FrameToString({frame: clipInFrame}).replaceAll(" ", "");
      const endTime = this.rootStore.videoStore.videoHandler.FrameToString({frame: clipOutFrame || this.rootStore.videoStore.totalFrames}).replaceAll(" ", "");
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
      key: `download-jobs-${this.rootStore.videoStore.videoObject.objectId}`,
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
          key: `download-jobs-${this.rootStore.videoStore.videoObject.objectId}`,
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
      clipInFrame = clipInFrame || 0;
      clipOutFrame = clipOutFrame || this.rootStore.videoStore.totalFrames - 1;

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

      if(representation) {
        params.representation = representation;
      }

      if(audioRepresentation) {
        params.audio = audioRepresentation;
      }

      if(clipInFrame) {
        // Use more literal time for api as opposed to SMPTE
        params.start_ms = `${((1 / this.rootStore.videoStore.frameRate) * clipInFrame).toFixed(4)}s`;
      }

      if(clipOutFrame && clipOutFrame < this.rootStore.videoStore.videoHandler.TotalFrames() - 1) {
        params.end_ms = `${((1 / this.rootStore.videoStore.frameRate) * clipOutFrame).toFixed(4)}s`;
      }

      const response = yield this.rootStore.client.MakeFileServiceRequest({
        versionHash: this.rootStore.videoStore.videoObject.versionHash,
        path: "/call/media/files",
        method: "POST",
        body: params,
        encryption: encrypt ? "cgck" : undefined
      });

      const status = yield this.DownloadJobStatus({
        jobId: response.job_id,
        versionHash: this.rootStore.videoStore.videoObject.versionHash
      });

      // If created for a share, do not save to personal downloads or initiate automatic download
      if(isShareDownload) {
        this.shareDownloadJobStatus[response.job_id] = status;

        return { jobId: response.job_id, status };
      }

      this.downloadJobInfo[response.job_id] = {
        versionHash: this.rootStore.videoStore.videoObject.versionHash,
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
      this.downloadJobInfo[response.job_id].automaticDownloadInterval = setInterval(async () => {
        const status = await this.DownloadJobStatus({jobId: response.job_id}) || {};

        if(status?.status === "completed") {
          this.SaveDownloadJob({jobId: response.job_id});
        }

        if(status?.status !== "processing") {
          clearInterval(this.downloadJobInfo?.[response.job_id]?.automaticDownloadInterval);
        }
      }, 10000);

      return {
        jobId: response.job_id,
        status
      };
    } catch(error) {
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
      DownloadFromUrl(downloadUrl, jobInfo.filename);

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

  CreateEmbedUrl = flow(function * ({offeringKey, audioTrackLabel, clipInFrame, clipOutFrame, shareId, title}) {
    let options = {
      autoplay: true,
    };

    if(offeringKey !== "default") {
      options.offerings = [offeringKey];
    }


    if(clipInFrame > 0) {
      options.clipStart = this.rootStore.videoStore.FrameToTime(clipInFrame);
    }

    if(this.rootStore.videoStore.totalFrames > clipOutFrame + 1) {
      options.clipEnd = this.rootStore.videoStore.FrameToTime(clipOutFrame + 1);
    }

    const url = new URL(
      yield this.rootStore.client.EmbedUrl({
        objectId: this.rootStore.videoStore.videoObject.objectId,
        duration: 7 * 24 * 60 * 60 * 1000,
        options
      })
    );

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

  CreateShare = flow(function * ({shareOptions, downloadOptions}) {
    const objectId = this.rootStore.videoStore.videoObject.objectId;

    downloadOptions = Unproxy(downloadOptions);

    if(downloadOptions.noClip){
      delete downloadOptions.noClip;
      downloadOptions.clipInFrame = 0;
      downloadOptions.clipOutFrame = this.rootStore.videoStore.totalFrames - 1;
    }

    let attributes = {
      source: ["evie"],
      type: [shareOptions.type],
      title: [shareOptions.title || ""],
      note: [shareOptions.note || ""],
      permissions: [shareOptions.permissions],
      shareOptions: [JSON.stringify(shareOptions)],
      downloadOptions: [JSON.stringify(downloadOptions)],
    };

    if(["download", "both"].includes(shareOptions.permissions)) {
      attributes.downloadJobId = [
        (yield this.StartDownloadJob({
          ...downloadOptions,
          isShareDownload: true
        })).jobId
      ];

      attributes.versionHash = [this.rootStore.videoStore.videoObject.versionHash];
      attributes.filename = [downloadOptions.filename || downloadOptions.defaultFilename];
    }

    if(shareOptions.email) {
      attributes.recipient = [shareOptions.email];
    } else {
      attributes.label = [shareOptions.label];
    }

    let params = {};
    if(downloadOptions.clipInFrame > 0) {
      attributes.clipIn = [this.rootStore.videoStore.FrameToTime(downloadOptions.clipInFrame).toString(), downloadOptions.clipInFrame.toString()];
      params.clip_start = Math.floor(this.rootStore.videoStore.FrameToTime(downloadOptions.clipInFrame));
    }

    if(downloadOptions.clipOutFrame < this.rootStore.videoStore.totalFrames - 1) {
      attributes.clipOut = [this.rootStore.videoStore.FrameToTime(downloadOptions.clipOutFrame).toString(), downloadOptions.clipOutFrame.toString()];
      params.clip_end = Math.ceil(this.rootStore.videoStore.FrameToTime(downloadOptions.clipOutFrame));
    }

    return yield this.FormatShare(
      (yield this.rootStore.client.CreateShare({
        objectId,
        expiresAt: shareOptions.expiresAt,
        params: Unproxy({
          ...params,
          offering: downloadOptions.offering,
          sharing_type: "public",
          attributes
        })
      })).share
    );
  });

  CreateShortURL = flow(function * (url) {
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

  async FormatShare(share) {
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

    clipDetails.durationFrames = (clipDetails.clipOutFrame || this.rootStore.videoStore.totalFrames - 1) - (clipDetails.clipInFrame || 0);
    clipDetails.duration = this.rootStore.videoStore.FrameToTime(clipDetails.durationFrames);
    clipDetails.durationString = this.rootStore.videoStore.TimeToString(clipDetails.duration);

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
      clipDetails.string = `${this.rootStore.videoStore.FrameToSMPTE(clipDetails.clipInFrame || 0)} - ${this.rootStore.videoStore.FrameToSMPTE(clipDetails.clipOutFrame || this.rootStore.videoStore.totalFrames - 1)} (${this.rootStore.videoStore.TimeToString(clipDetails.duration)})`;
    }

    const embedUrl = new URL(
      await this.CreateEmbedUrl({
        offeringKey: share.downloadOptions?.offering,
        clipInFrame: clipDetails.clipInFrame ? clipDetails.clipInTime : undefined,
        clipOutFrame: share.clipOutFrame ? share.clipOutTime : undefined,
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

  Shares = flow(function * () {
    const objectId = this.rootStore.videoStore.videoObject.objectId;

    const {shares} = yield this.rootStore.client.Shares({objectId, limit: 10000});

    return yield Promise.all(
      (shares || [])
        .filter(share => share.attributes?.source?.[0] === "evie")
        .sort((a, b) => a.updated < b.updated ? 1 : -1)
        .map(async share => await this.FormatShare(share))
    );
  });

  UpdateShare = flow(function * ({shareId, expiresAt}) {
    return yield this.rootStore.client.UpdateShare({shareId, expiresAt: expiresAt});
  });

  RevokeShare = flow(function * ({shareId}) {
    return yield this.rootStore.client.RevokeShare({shareId});
  });
}

export default DownloadStore;
