import FrameAccurateVideo from "@/utils/FrameAccurateVideo.js";
import {rootStore} from "@/stores/index.js";
import {Unproxy} from "@/utils/Utils.js";
import IntervalTree from "node-interval-tree";

export const LoadVideo = async ({libraryId, objectId, preferredOfferingKey="default", channel=false}) => {
  try {
    if(!libraryId) {
      libraryId = await rootStore.LibraryId({objectId});
    }

    const versionHash = await rootStore.client.LatestVersionHash({objectId});

    const metadata = (await rootStore.client.ContentObjectMetadata({
      versionHash,
      resolveLinks: true,
      resolveIgnoreErrors: true,
      linkDepthLimit: 1,
      select: [
        "public/name",
        "public/description",
        "offerings/*/tag_point_rat",
        "offerings/*/exit_point_rat",
        "offerings/*/media_struct/duration_rat",
        "offerings/*/media_struct/streams/*/rate",
        "offerings/*/media_struct/streams/*/duration/rat",
        "offerings/*/media_struct/streams/*/codec_type",
        //"offerings/*/media_struct/streams/*/sources",
        "offerings/*/media_struct/streams/*/label",
        "offerings/*/media_struct/streams/*/default_for_media_type",
        "offerings/*/playout/streams/*/representations",
        "channel",
        "video_tags",
        "mime_types",
        "assets"
      ]
    })) || { public: {}};

    const videoObject = {
      libraryId,
      objectId,
      versionHash,
      name: metadata.public && metadata.public.name || metadata.name || versionHash,
      description: metadata.public && metadata.public.description || metadata.description,
      metadata,
      isVideo: !!metadata.offerings || !!metadata.channel,
      isChannel: !!metadata.channel
    };

    if(videoObject.isVideo) {
      videoObject.availableOfferings = await rootStore.client.AvailableOfferings({
        versionHash: videoObject.versionHash
      });

      if(videoObject.availableOfferings?.default) {
        videoObject.availableOfferings.default.display_name = "Default Offering";
      }

      if(channel) {
        return videoObject;
      }

      Object.keys(metadata?.offerings || {}).map(offeringKey => {
        const tagPointRat = metadata.offerings[offeringKey].tag_point_rat;
        const exitPointRat = metadata.offerings[offeringKey].exit_point_rat;
        let tagPoint = null, exitPoint = null;

        if(tagPointRat) {
          tagPoint = FrameAccurateVideo.ParseRat(tagPointRat);
        }

        if(exitPointRat) {
          exitPoint = FrameAccurateVideo.ParseRat(exitPointRat);
        }

        videoObject.availableOfferings[offeringKey].tag = tagPoint;
        videoObject.availableOfferings[offeringKey].exit = exitPoint;
        videoObject.availableOfferings[offeringKey].durationTrimmed =
          (tagPoint === null || exitPoint === null) ? null :
            (exitPoint - tagPoint);
      });

      const browserSupportedDrms = (await rootStore.client.AvailableDRMs() || []).filter(drm => ["clear", "aes-128"].includes(drm));

      const offeringPlayoutOptions = {};
      const offeringKeys = Object.keys(videoObject.availableOfferings)
        .sort((a, b) => {
          // Prefer 'default', then anything including 'default', then alphabetically
          if(a === "default") {
            return -1;
          } else if(b === "default") {
            return 1;
          } else if(a.includes("default")) {
            return b.includes("default") ? 0 : -1;
          } else if(b.includes("default")) {
            return 1;
          }

          return a < b ? -1 : 1;
        });

      let offeringKey;
      for(let offering of offeringKeys) {
        offeringPlayoutOptions[offering] = await rootStore.client.PlayoutOptions({
          versionHash,
          handler: channel ? "channel" : "playout",
          protocols: ["hls"],
          drms: browserSupportedDrms,
          hlsjsProfile: false,
          offering
        });

        const playoutMethods = offeringPlayoutOptions?.[offering]?.hls?.playoutMethods || {};

        if(!(playoutMethods["aes-128"] || playoutMethods["clear"])) {
          videoObject.availableOfferings[offering].disabled = true;
        } else {
          if(!offeringKey || offering === preferredOfferingKey) {
            offeringKey = offering;
          }
        }
      }

      const hasHlsOfferings = Object.values(videoObject.availableOfferings).some(offering => !offering.disabled);

      if(!hasHlsOfferings) { throw Error("No offerings with HLS Clear or AES-128 playout found."); }

      videoObject.offeringKey = offeringKey;


      // Determine duration and framerate
      videoObject.streamKey = Object.keys(metadata.offerings[videoObject.offeringKey].media_struct.streams)
        .find(streamKey =>
          metadata.offerings[videoObject.offeringKey].media_struct.streams[streamKey].codec_type === "video"
        );

      videoObject.duration = FrameAccurateVideo.ParseRat(
        metadata.offerings[videoObject.offeringKey].media_struct.streams[videoObject.streamKey].duration.rat
      );

      // Specify playout for full, untrimmed content
      const playoutMethods = offeringPlayoutOptions[offeringKey]["hls"].playoutMethods;

      videoObject.drm = playoutMethods.clear ? "clear" : "aes-128";

      const playoutUrl = new URL((playoutMethods.clear || playoutMethods["aes-128"]).playoutUrl);
      playoutUrl.searchParams.set("ignore_trimming", true);
      playoutUrl.searchParams.set("player_profile", "hls-js-2441");

      const thumbnailTrackUrl = (playoutMethods.clear || playoutMethods["aes-128"]).thumbnailTrack;

      videoObject.playoutUrl = playoutUrl.toString();
      videoObject.thumbnailTrackUrl = thumbnailTrackUrl;
    }

    return videoObject;
  } catch(error) {
    // eslint-disable-next-line no-console
    console.error("Failed to load:");
    // eslint-disable-next-line no-console
    console.log(error);

    rootStore.SetError(error.toString());
  }
};

export const Cue = ({store, tagType, label, startTime, endTime, text, tag, ...extra}) => {
  store = store || rootStore.videoStore;

  const isSMPTE = typeof startTime === "string" && startTime.split(":").length > 1;

  if(isSMPTE) {
    startTime = store.videoHandler.SMPTEToTime(startTime);
    endTime = store.videoHandler.SMPTEToTime(endTime);
  }

  let textList, content;
  if(Array.isArray(text)) {
    textList = text;
  } else if(typeof text === "object") {
    content = text;
    textList = [];
  } else {
    textList = [text];
  }

  return {
    tagId: rootStore.NextId(),
    tagType,
    label,
    startTime,
    endTime,
    textList: Unproxy(textList),
    content: Unproxy(content),
    tag,
    ...extra
  };
};

const FormatVTTCue = ({label, cue, store}) => {
  // VTT Cues are weird about being inspected and copied
  // Manually copy all relevant values
  const cueAttributes = [
    "align",
    "endTime",
    "id",
    "line",
    "lineAlign",
    "position",
    "positionAlign",
    "region",
    "size",
    "snapToLines",
    "startTime",
    "text",
    "vertical"
  ];

  const cueCopy = {};
  cueAttributes.forEach(attr => cueCopy[attr] = cue[attr]);

  return Cue({
    store,
    tagType: "vtt",
    label,
    startTime: cue.startTime,
    endTime: cue.endTime,
    text: cue.text,
    textList: [cue.text],
    tag: cueCopy
  });
};

export const ParseVTTTrack = async ({track, store}) => {
  const videoElement = document.createElement("video");
  const trackElement = document.createElement("track");

  const dataURL = "data:text/plain;base64," + rootStore.client.utils.B64(track.vttData);

  const textTrack = trackElement.track;

  videoElement.append(trackElement);
  trackElement.src = dataURL;

  textTrack.mode = "hidden";

  await new Promise(resolve => setTimeout(resolve, 500));

  let cues = {};
  Array.from(textTrack.cues)
    .forEach(cue => {
      const parsedCue = FormatVTTCue({label: track.label, cue, store});
      cues[parsedCue.tagId] = parsedCue;
    });

  return cues;
};

export const CreateTrackIntervalTree = (tags, label) => {
  const intervalTree = new IntervalTree();

  Object.values(tags).forEach(tag => {
    try {
      intervalTree.insert(tag.startTime, tag.endTime, tag.tagId);
    } catch(error) {
      // eslint-disable-next-line no-console
      console.warn(`Invalid tag in track '${label}'`);
      // eslint-disable-next-line no-console
      console.warn(JSON.stringify(tag, null, 2));
      // eslint-disable-next-line no-console
      console.warn(error);
    }
  });

  return intervalTree;
};

export const ExtractHashFromLink = link => {
  if(link?.["."]?.source) {
    return link["."]?.source;
  } else if(link?.["/"]) {
    return link["/"]?.split("/").find(token => token.startsWith("hq__"));
  }
};
