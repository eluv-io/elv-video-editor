import {flow, makeAutoObservable} from "mobx";
import {HashString, Unproxy} from "@/utils/Utils.js";
import UrlJoin from "url-join";
import {LoadVideo} from "@/stores/Helpers.js";

class TitleStore {
  DEFAULT_SEARCH_SETTINGS = {
    query: "",
    genres: [],
    yearMin: 0,
    yearMax: 9999,
    key: 0
  };

  clipTypeKeys = [
    "full",
    "clips",
    "shorts",
    "trailers"
  ];

  selectedSearchIndexId;
  mediaTags = {};
  searchSettings = this.DEFAULT_SEARCH_SETTINGS;
  searchResults = {};
  searchImageFrame;
  searchImageFrameUrl;

  titles = {};

  player = undefined;

  constructor(rootStore) {
    this.rootStore = rootStore;

    makeAutoObservable(this);
  }

  get client() {
    return this.rootStore.client;
  }

  get customSearchSettingsActive() {
    return (
      HashString(JSON.stringify({...this.searchSettings, key: 0})) !==
      HashString(JSON.stringify({...this.rootStore?.aiStore?.DEFAULT_SEARCH_SETTINGS, key: 0}))
    );
  }

  SetPlayer(player) {
    this.player = player;
  }

  SetSelectedSearchIndex(id) {
    this.searchSettings = this.rootStore.aiStore.DEFAULT_SEARCH_SETTINGS;
    this.selectedSearchIndexId = id;
  }

  SetSearchSettings(options) {
    const searchIndexId = options.searchIndexId || this.selectedSearchIndexId;

    delete options.key;
    delete options.searchIndexId;

    this.SetSelectedSearchIndex(searchIndexId);

    this.searchSettings = {
      ...options,
      key: HashString(JSON.stringify(options))
    };
  }

  LoadTitle = flow(function * ({titleId}) {
    return yield this.rootStore.LoadResource({
      id: "titles",
      key: titleId,
      bind: this,
      Load: flow(function * () {
        const versionHash = yield this.client.LatestVersionHash({objectId: titleId});
        const libraryId = yield this.client.ContentObjectLibraryId({objectId: titleId});
        const metadata = yield this.client.ContentObjectMetadata({
          versionHash,
          metadataSubtree: "/public/",
          produceLinkUrls: true,
          select: [
            "name",
            "asset_metadata"
          ]
        });

        const videoDetails = yield LoadVideo({libraryId, objectId: titleId, versionHash});
        const baseFrameUrl = yield this.client.Rep({
          versionHash,
          rep: "frame/default/video",
          channelAuth: true,
          queryParams: {
            ignore_trimming: true
          }
        });

        this.titles[titleId] = {
          libraryId,
          objectId: titleId,
          versionHash,
          name: metadata?.name,
          title: metadata?.asset_metadata?.display_title || metadata?.asset_metadata?.title || metadata?.name,
          metadata: metadata?.asset_metadata,
          videoDetails,
          baseFrameUrl
        };

        return this.titles[titleId];
      })
    });
  });

  LoadMediaTags = flow(function * ({objectId, versionHash, compositionKey, offering, clipStart, clipEnd}) {
    if(versionHash) {
      objectId = this.client.utils.DecodeVersionHash(versionHash).objectId;
    }

    const key = `${objectId}-${compositionKey}-${offering}-${clipStart}-${clipEnd}`;
    if(this.mediaTags?.key !== key) {
      this.mediaTags = {};
    }

    this.mediaTags = yield this.rootStore.LoadResource({
      key: "MediaTags",
      ttl: 60,
      id: key,
      bind: this,
      Load: flow(function * () {
        const {tracks} = yield this.rootStore.aiStore.QueryAIAPI({
          objectId,
          path: UrlJoin("/tagstore", objectId, "tracks"),
          format: "JSON"
        });

        const clippingParams = !clipStart && !clipEnd ? {} :
          {
            end_time_gte: Math.floor((clipStart || 0) * 1000),
            start_time_lte: Math.ceil(clipEnd * 1000)
          };

        const formattedTrack = tracks.find(track => track.name === "game_events_all_events_beautified") ;
        const singleTrack = tracks.find(track => track.name.startsWith("game_events_all") && track.name.includes("single_track"));
        const playByPlayTracks =
          formattedTrack ? [formattedTrack] :
            singleTrack ? [singleTrack] :
              tracks.filter(track => track.name.startsWith("game_events_all"));

        let playByPlayTags = (yield this.client.utils.LimitedMap(
          5,
          playByPlayTracks,
          async ({name}) => (
            await this.rootStore.aiStore.QueryAIAPI({
              objectId,
              path: offering || compositionKey ?
                UrlJoin("/tagstore", objectId, "compositions", "tags") :
                UrlJoin("/tagstore", objectId, "tags"),
              queryParams: {
                channel_key: compositionKey,
                offering_key: offering,
                limit: 1000000,
                track: name,
                ...clippingParams
              },
              format: "JSON"
            })
          ).tags || []
        ))
          .filter(tags => tags)
          .flat()
          .map(tag => ({
            ...tag,
            start_time: Math.max(0, (tag.start_time / 1000) - (clipStart || 0)),
            end_time: (tag.end_time / 1000) - (clipStart || 0)
          }))
          .sort((a, b) => a.start_time < b.start_time ? -1 : 1);

        if(formattedTrack) {
          // CSV
          playByPlayTags = playByPlayTags
            .map(tag => {
              try {
                const [action1, action2, player, team] = tag?.tag?.split(",").map(token => token.trim()) || [];

                return {
                  ...tag,
                  tag: [`${action1} ${action2}`.trim(), player, team]
                    .filter(item => item)
                    .join(" - ").toUpperCase()
                };
              } catch(error) {
                this.Log(`Error parsing tag ${JSON.stringify(tag)}`, true);
                this.Log(error, true);
              }
            });
        }

        const transcriptionTrackKey =
          tracks.find(track => track.name === "transcription") ? "transcription" :
            tracks.find(track => track.name === "auto_captions")
              ? "auto_captions" : null;

        let transcriptionTags = [];
        if(transcriptionTrackKey) {
          transcriptionTags = (yield this.rootStore.aiStore.QueryAIAPI({
            objectId,
            path: offering || compositionKey ?
              UrlJoin("/tagstore", objectId, "compositions", "tags") :
              UrlJoin("/tagstore", objectId, "tags"),
            queryParams: {
              channel_key: compositionKey,
              offering_key: offering,
              limit: 1000000,
              track: transcriptionTrackKey,
              ...clippingParams
            },
            format: "JSON"
          })).tags
            ?.sort((a, b) => a.start_time < b.start_time ? -1 : 1)
            ?.map(tag => ({
              ...tag,
              start_time: Math.max(0, (tag.start_time / 1000) - (clipStart || 0)),
              end_time: (tag.end_time / 1000) - (clipStart || 0)
            })) || [];
        }

        let chapterTags = [];
        if(!compositionKey && !clipStart && !clipEnd && tracks.find(track => track.name === "chapter")) {
          chapterTags = (yield this.rootStore.aiStore.QueryAIAPI({
            objectId,
            path: offering || compositionKey ?
              UrlJoin("/tagstore", objectId, "compositions", "tags") :
              UrlJoin("/tagstore", objectId, "tags"),
            queryParams: {
              channel_key: compositionKey,
              offering_key: offering,
              limit: 1000000,
              track: "chapter",
              ...clippingParams
            },
            format: "JSON"
          })).tags
            ?.sort((a, b) => a.start_time < b.start_time ? -1 : 1)
            ?.map(tag => ({
              ...tag,
              start_time: Math.max(0, (tag.start_time / 1000) - (clipStart || 0)),
              end_time: (tag.end_time / 1000) - (clipStart || 0)
            }))
            ?.map((chapter, index, chapters) => ({
              ...chapter,
              // Ensure chapter tags are contiguous
              end_time: (chapters[index + 1] || {}).start_time || chapter.end_time
            })) || [];
        }

        let tracksMap = {};
        tracks.forEach(track =>
          tracksMap[track.name] = track
        );

        return {
          key,
          loaded: true,
          hasTags: !!transcriptionTrackKey > 0 || chapterTags.length > 0 || playByPlayTags.length > 0,
          hasTranscription: !!transcriptionTrackKey,
          hasPlayByPlay: playByPlayTags.length > 0,
          hasChapters: chapterTags.length > 0,
          tracks: tracksMap,
          transcriptionTags,
          playByPlayTags,
          chapterTags,
          transcriptionTrackKey
        };
      })
    });
  });

  GenerateTitleSynopsis = flow(function * ({objectId, style="extended"}) {
    const {synopsis} = yield this.rootStore.aiStore.QueryAIAPI({
      server: "ai",
      method: "GET",
      path: UrlJoin("summary_v3", "q", objectId, "rep", "synopsis_generation"),
      objectId,
      channelAuth: true,
      queryParams: {
        regenerate: true,
        style
      }
    });

    const originalSynopsis = this.titles[objectId]?.metadata?.ai_derived_media?.synopses?.[style] || "";
    this.rootStore.editStore.PerformAction({
      label: `Generate ${style} synopsis for ${yield this.rootStore.GetObjectName({objectId})}`,
      type: "titles",
      action: "generateSynopsis",
      modifiedItem: originalSynopsis,
      Action: () => {
        if(!this.titles[objectId].metadata.ai_derived_media) {
          this.titles[objectId].metadata.ai_derived_media = {};
        }

        if(!this.titles[objectId].metadata.ai_derived_media.synopses) {
          this.titles[objectId].metadata.ai_derived_media.synopses = {};
        }

        this.titles[objectId].metadata.ai_derived_media.synopses[style] = synopsis;
      },
      Undo: () => {
        if(!originalSynopsis) {
          delete this.titles[objectId].metadata.ai_derived_media.synopses[style];
        } else {
          this.titles[objectId].metadata.ai_derived_media.synopses[style] = originalSynopsis;
        }
      },
      Write: async writeParams => {
        await this.client.ReplaceMetadata({
          ...writeParams,
          metadataSubtree: UrlJoin("/public", "asset_metadata", "ai_derived_media", "synopsis", style),
          metadata: Unproxy(synopsis)
        });
      }
    });
  });

  GenerateClipSummary = flow(function * ({objectId, clipType="clips", clipSlug, prompt}) {
    const clip = this.titles[objectId]?.metadata?.ai_derived_media?.[clipType]?.[clipSlug];

    if(!clip) { return; }

    const result = yield this.rootStore.aiStore.GenerateClipSummary({
      objectId,
      startTime: clip.playout.start / 1000,
      endTime: clip.playout.end / 1000,
      prompt,
      regenerate: true
    });

    const summary = result.summary;
    const originalSummary = clip.summary;
    this.rootStore.editStore.PerformAction({
      label: `Regenerate clip summary for ${yield this.rootStore.GetObjectName({objectId})} clip with prompt ${prompt}`,
      type: "titles",
      action: "generateSummary",
      modifiedItem: originalSummary,
      Action: () => {
        this.titles[objectId].metadata.ai_derived_media[clipType][clipSlug].summary = summary;
      },
      Undo: () => {
        this.titles[objectId].metadata.ai_derived_media[clipType][clipSlug].summary = originalSummary || "";
      },
      Write: async writeParams => {
        await this.client.ReplaceMetadata({
          ...writeParams,
          metadataSubtree: UrlJoin("/public", "asset_metadata", "ai_derived_media", clipType, clipSlug, "summary"),
          metadata: Unproxy(summary)
        });
      }
    });
  });
}

export default TitleStore;
