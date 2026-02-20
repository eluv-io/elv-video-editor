import FrameAccurateVideo from "@/utils/FrameAccurateVideo.js";
import {rootStore} from "@/stores/index.js";
import {Unproxy} from "@/utils/Utils.js";
import IntervalTree from "node-interval-tree";
import Fraction from "fraction.js";

export const LoadVideo = async ({
  libraryId,
  objectId,
  writeToken,
  preferredOfferingKey="default",
  channel=false
}) => {
  try {
    if(!libraryId) {
      libraryId = await rootStore.LibraryId({objectId});
    }

    const versionHash = await rootStore.client.LatestVersionHash({objectId});

    const metadata = (await rootStore.client.ContentObjectMetadata({
      libraryId,
      objectId,
      writeToken,
      resolveLinks: true,
      resolveIgnoreErrors: true,
      linkDepthLimit: 1,
      select: [
        "public/name",
        "public/description",
        "offerings/*/entry_point_rat",
        "offerings/*/exit_point_rat",
        "offerings/*/media_struct/duration_rat",
        "offerings/*/media_struct/streams/*/rate",
        "offerings/*/media_struct/streams/*/duration/rat",
        "offerings/*/media_struct/streams/*/codec_type",
        //"offerings/*/media_struct/streams/*/sources",
        "offerings/*/media_struct/streams/*/label",
        "offerings/*/media_struct/streams/*/default_for_media_type",
        "offerings/*/media_struct/streams/*/tags/timecode",
        "offerings/*/playout/streams/*/representations",
        "offerings/*/playout/playout_formats",
        "channel",
        "clips",
        "video_tags",
        "mime_types",
        "assets",
        "live_recording_info"
      ]
    })) || { public: {}};

    const videoObject = {
      libraryId,
      objectId,
      versionHash,
      writeToken,
      name: metadata.public && metadata.public.name || metadata.name || versionHash,
      description: metadata.public && metadata.public.description || metadata.description,
      metadata,
      isVideo: !!metadata.offerings || !!metadata.channel,
      isChannel: !!metadata.channel,
      isLiveToVod: !!metadata.live_recording_info,
      liveStreamInfo: metadata.live_recording_info
    };

    if(videoObject.isVideo) {
      videoObject.availableOfferings = await rootStore.client.AvailableOfferings({
        versionHash: videoObject.versionHash
      });

      if(videoObject.availableOfferings?.default) {
        videoObject.availableOfferings.default.display_name = "Default Offering";
      }

      if(channel) {
        videoObject.duration = metadata.channel?.offerings?.[preferredOfferingKey]?.items
          ?.map(({slice_start_rat, slice_end_rat}) => Fraction(FrameAccurateVideo.ParseRat(slice_end_rat)).sub(FrameAccurateVideo.ParseRat(slice_start_rat)))
          ?.reduce((total, itemDuration) => itemDuration.add(total), 0)
          ?.valueOf();

        videoObject.offeringKey = preferredOfferingKey;

        return videoObject;
      }

      Object.keys(metadata?.offerings || {}).map(offeringKey => {
        const tagPointRat = metadata.offerings[offeringKey].entry_point_rat;
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
        try {
          videoObject.availableOfferings[offering].playoutMethods = await rootStore.client.PlayoutOptions({
            versionHash,
            handler: channel ? "channel" : "playout",
            drms: browserSupportedDrms,
            hlsjsProfile: false,
            offering
          });

          const hlsPlayoutMethods = videoObject.availableOfferings[offering].playoutMethods.hls?.playoutMethods || {};

          if(!(hlsPlayoutMethods["aes-128"] || hlsPlayoutMethods["clear"])) {
            videoObject.availableOfferings[offering].disabled = true;
          } else {
            if(
              !offeringKey ||
              offering === preferredOfferingKey ||
              (offering.includes("default") && !offeringKey?.includes("default"))
            ) {
              offeringKey = offering;
            }
          }
        } catch(error) {
          // eslint-disable-next-line no-console
          console.warn(`Unable to load offering details for ${offering}`);
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

      videoObject.timecode = metadata.offerings[videoObject.offeringKey].media_struct.streams[videoObject.streamKey].tags?.timecode;

      // Specify playout for full, untrimmed content
      const playoutMethods = videoObject.availableOfferings[offeringKey].playoutMethods["hls"].playoutMethods;

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
    console.error("Failed to load:");
    console.error(error);

    if(error.status === 403) {
      window.location.pathname = "/";

      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    rootStore.SetError(error.toString());
  }
};

export const FormatTags = ({tagData}) => {
  let metadataTags = {};
  tagData.forEach(({tags, linkKey}) => {
    if(!tags) { return; }

    // Record file, group and index of tags so that they can be individually modified
    if(tags.metadata_tags) {
      Object.keys(tags.metadata_tags).forEach(trackKey => {
        const trackTags = ((tags.metadata_tags[trackKey].tags) || [])
          .map((tag, tagIndex) => ({...tag, lk: linkKey, tk: trackKey, ti: tagIndex}));

        if(metadataTags[trackKey]) {
          metadataTags[trackKey].tags = metadataTags[trackKey].tags
            .concat(trackTags)
            .sort((a, b) => a.startTime < b.startTime ? -1 : 1);
        } else {
          metadataTags[trackKey] = {
            ...tags.metadata_tags[trackKey],
            tags: trackTags
          };
        }
      });
    }
  });

  return metadataTags;
};

export const Cue = ({store, tagType, tagId, label, startTime, endTime, text, tag, ...extra}) => {
  store = store || rootStore.videoStore;

  const isSMPTE = typeof startTime === "string" && startTime.split(":").length > 1;

  if(isSMPTE) {
    startTime = store.SMPTEToTime(startTime);
    endTime = store.SMPTEToTime(endTime);
  }

  let content;
  if(Array.isArray(text)) {
    text = text.join(", ");
  } else if(typeof text === "object") {
    content = text;

    try {
      text = JSON.stringify(text, null, 2);
    } catch(error) {
      text = "";
    }
  }

  return {
    tagId: tagId || rootStore.NextId(),
    tagType,
    label,
    startTime,
    endTime,
    text,
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

export const CreateTrackIntervalTree = (tags, label, offset=0) => {
  const intervalTree = new IntervalTree();

  Object.values(tags).forEach(tag => {
    try {
      intervalTree.insert(tag.startTime + offset, tag.endTime + offset, tag.tagId);
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
