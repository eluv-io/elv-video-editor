import {flow, makeAutoObservable} from "mobx";
import {HashString} from "@/utils/Utils.js";
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
    // TODO: REMOVE
    yield this.client.SetNodes({
      fabricURIs: [ "https://host-76-74-91-2.contentfabric.io"]
    });

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
                clip_start: clipStart,
                clip_end: clipEnd
              },
              format: "JSON"
            })
          ).tags || []
        ))
          .filter(tags => tags)
          .flat()
          .map(tag => ({
            ...tag,
            start_time: tag.start_time / 1000,
            end_time: tag.end_time / 1000
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
              clip_start: clipStart,
              clip_end: clipEnd
            },
            format: "JSON"
          })).tags
            ?.sort((a, b) => a.start_time < b.start_time ? -1 : 1)
            ?.map(tag => ({
              ...tag,
              start_time: tag.start_time / 1000,
              end_time: tag.end_time / 1000
            })) || [];
        }

        let chapterTags = [];
        if(tracks.find(track => track.name === "chapter")) {
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
              clip_start: clipStart,
              clip_end: clipEnd
            },
            format: "JSON"
          })).tags
            ?.sort((a, b) => a.start_time < b.start_time ? -1 : 1)
            ?.map(tag => ({
              ...tag,
              start_time: tag.start_time / 1000,
              end_time: tag.end_time / 1000
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
          hasTags: transcriptionTags.length > 0 || transcriptionTags.length > 0,
          hasTranscription: transcriptionTags.length > 0,
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
}

export default TitleStore;
