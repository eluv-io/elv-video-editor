import {flow, makeAutoObservable, runInAction} from "mobx";
import UrlJoin from "url-join";
import {HashString, ParseSearchQuery, Slugify, Unproxy} from "@/utils/Utils.js";
import FrameAccurateVideo from "@/utils/FrameAccurateVideo.js";

const GLOBAL_PROFILE_OBJECT_ID = "iq__3MVS3kjshtnAodRv4qLebBvH3oXb";

class AIStore {
  searchIndexes = [];
  searchCollectionIndexes = [];
  customSearchIndexIds = [];
  selectedSearchIndexId;
  selectedCollectionSearchIndexId;
  searchIndexUpdateProgress = {};
  tagAggregationProgress = 0;
  highlightProfiles;
  defaultHighlightProfileKey;

  DEFAULT_SEARCH_SETTINGS = {
    objectIds: [],
    clipDuration: 0,
    minConfidence: 0,
    fields: [],
    key: 0
  };

  searchSettings = this.DEFAULT_SEARCH_SETTINGS;

  searchResults = {};
  searchImageFrame;
  searchImageFrameUrl;

  _authTokens = {};

  constructor(rootStore) {
    makeAutoObservable(
      this,
      { searchImageFrame: false }
    );
    this.rootStore = rootStore;
  }

  get client() {
    return this.rootStore.client;
  }

  get searchIndex() {
    return this.searchIndexes.find(index => index.id === this.selectedSearchIndexId);
  }

  get highlightsAvailable() {
    return this.searchIndexes.length > 0 && Object.keys(this.highlightProfiles || {}).length > 0;
  }

  get highlightProfileInfo() {
    if(!this.highlightProfiles) {
      return {};
    }

    let profiles = {};
    Object.keys(this.highlightProfiles || {})
      .filter(key => !this.highlightProfiles[key].hidden)
      .forEach(key => {
        const type = this.highlightProfiles[key].type;
        if(!profiles[type]) {
          profiles[type] = {};
        }

        const subtype = this.highlightProfiles[key].subtype;
        if(!profiles[type][subtype]) {
          profiles[type][subtype] = [];
        }

        profiles[type][subtype]
          .push({
            ...this.highlightProfiles[key],
            key
          });

        profiles[type][subtype].sort((a, b) =>
          a?.name?.toLowerCase()?.includes("default") ?
            b?.name?.toLowerCase()?.includes("default") ? 0 : -1 :
            b?.name?.toLowerCase()?.includes("default") ? 1 : 0
        );
      });

    return profiles;
  }

  get customSearchSettingsActive() {
    return (
      HashString(JSON.stringify({...this.searchSettings, key: 0})) !==
      HashString(JSON.stringify({...this.DEFAULT_SEARCH_SETTINGS, key: 0}))
    );
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

  // Load search indexes and highlight profiles
  Initialize = flow(function * () {
    yield this.LoadSearchIndexes();
    this.LoadHighlightProfiles();
  });

  QueryAIAPI = flow(function * ({
    server="ai",
    method="GET",
    path,
    objectId,
    channelAuth=false,
    update=false,
    queryParams={},
    body,
    stringifyBody=true,
    authTokenInBody=false,
    authTokenInHeader=false,
    headers={},
    format="json",
    allowStatus=[],
  }) {
    const url = new URL(`https://${server}.contentfabric.io/`);
    url.pathname = path;

    Object.keys(queryParams).forEach(key =>
      queryParams[key] && url.searchParams.set(key, queryParams[key])
    );

    if(!this._authTokens[objectId]) {
      this._authTokens[objectId] = {};
    }

    let authToken;
    if(update) {
      if(!this._authTokens[objectId].update) {
        this._authTokens[objectId].update = yield this.client.CreateAuthorizationToken({
          objectId,
          update: true
        });
      }

      authToken = this._authTokens[objectId].update;
    } else if(channelAuth) {
      if(!this._authTokens[objectId].channel) {
        this._authTokens[objectId].channel = new URL(yield this.client.FabricUrl({
          versionHash: yield this.client.LatestVersionHash({objectId: objectId}),
          channelAuth: true
        })).searchParams.get("authorization");
      }

      authToken = this._authTokens[objectId].channel;
    } else {
      if(!this._authTokens[objectId].signed) {
        this._authTokens[objectId].signed = yield this.rootStore.client.CreateAuthorizationToken({
          objectId,
          duration: 24 * 60 * 60 * 1000
        });
      }

      authToken = this._authTokens[objectId].signed;
    }

    if(authTokenInBody) {
      body.append ?
        body.append("authorization", authToken) :
        body.authorization = authToken;
    }

    if(authTokenInHeader) {
      headers.Authorization = authToken;
    } else {
      url.searchParams.set("authorization", authToken);
    }

    if(body && stringifyBody) {
      body = JSON.stringify(body);
    }

    const response = yield fetch(
      url,
      {
        method,
        headers,
        body
      }
    );

    if(response.status >= 400 && !allowStatus.includes(response.status)) {
      throw response;
    }

    if(response.status === 204) {
      return;
    }

    return !format ? response :
      yield this.client.utils.ResponseToFormat(format, response);
  });

  GenerateImageSummary = (function * ({objectId, filePath, regenerate=false, cacheOnly=false}) {
    return yield this.rootStore.LoadResource({
      key: "imageSummary",
      id: `${objectId}-${filePath}`,
      bind: this,
      force: !cacheOnly || regenerate,
      Load: flow(function * () {
        return yield this.rootStore.aiStore.QueryAIAPI({
          server: "ai",
          method: "GET",
          path: UrlJoin("mlcache", "summary", "q", objectId, "rep", "image_summarize"),
          objectId,
          channelAuth: true,
          queryParams: {
            path: filePath,
            engine: "summary",
            regenerate,
            cache: cacheOnly ? "only" : undefined
          }
        });
      })
    });
  });

  DeleteImageSummary = flow(function * ({objectId, filePath}) {
    yield this.rootStore.aiStore.QueryAIAPI({
      server: "ai",
      method: "DELETE",
      path: UrlJoin("mlcache", "summary", "q", objectId, "rep", "image_summarize"),
      objectId,
      channelAuth: true,
      queryParams: {
        path: filePath,
        engine: "summary"
      }
    });

    this.rootStore.ClearResource({key: "imageSummary", id: `${objectId}-${filePath}`});
  });

  GenerateClipSummary = flow(function * ({objectId, startTime, endTime, regenerate=false, cacheOnly=false}) {
    return yield this.rootStore.LoadResource({
      key: "clipSummary",
      id: `${objectId}-${startTime}-${endTime}`,
      bind: this,
      force: !cacheOnly || regenerate,
      Load: flow(function * () {
        return yield this.rootStore.aiStore.QueryAIAPI({
          server: "ai",
          method: "GET",
          path: UrlJoin("mlcache", "summary", "q", objectId, "rep", "summarize"),
          objectId,
          channelAuth: true,
          queryParams: {
            start_time: parseInt(startTime * 1000),
            end_time: parseInt(endTime * 1000),
            regenerate,
            cache: cacheOnly ? "only" : undefined,
            engine: "summary_v2"
          }
        });
      })
    });
  });

  DeleteClipSummary = flow(function * ({objectId, startTime, endTime}) {
    yield this.rootStore.aiStore.QueryAIAPI({
      server: "ai",
      method: "DELETE",
      path: UrlJoin("mlcache", "summary", "q", objectId, "rep", "summarize"),
      objectId,
      channelAuth: true,
      queryParams: {
        start_time: parseInt(startTime * 1000),
        end_time: parseInt(endTime * 1000),
        engine: "summary_v2"
      }
    });

    this.rootStore.ClearResource({key: "clipSummary", id: `${objectId}-${startTime}-${endTime}`});
  });


  GenerateAIHighlights = flow(function * ({
    objectId,
    prompt,
    maxDuration,
    profile,
    regenerate=false,
    wait=true,
    StatusCallback
  }) {
    if(!this.highlightsAvailable) { return; }

    let options = { iq: objectId };
    if(prompt) {
      options.customization = prompt;
    }

    if(maxDuration) {
      options.max_length = maxDuration * 1000;
    }

    if(profile) {
      options.profile = Unproxy(profile);
    }

    let initialStatus;
    if(!regenerate) {
      initialStatus = yield this.QueryAIAPI({
        method: "POST",
        path: UrlJoin("ml", "highlight_composition", "request"),
        objectId,
        allowStatus: [409],
        body: {
          cache: "only",
          job_details: options
        }
      });
    }

    if(!initialStatus || regenerate) {
      initialStatus = yield this.QueryAIAPI({
        method: "POST",
        path: UrlJoin("ml", "highlight_composition", "request"),
        objectId,
        allowStatus: [409],
        body: {
          cache: "refresh",
          job_details: options
        }
      });

      yield new Promise(resolve => setTimeout(resolve, 1000));
    }

    if(initialStatus?.status === "COMPLETE") {
      return initialStatus;
    }

    const jobId = initialStatus.job_id;

    let status;
    do {
      if(status) {
        StatusCallback?.(status);
        yield new Promise(resolve => setTimeout(resolve, 5000));
      }

      const response = yield this.QueryAIAPI({
        method: "GET",
        path: UrlJoin("ml", "highlight_composition", "request", jobId),
        objectId,
        format: ""
      });

      if(!response) {
        return;
      }

      if(response.status === 204 && !regenerate) {
        return this.GenerateAIHighlights({...arguments[0], regenerate: true});
      }

      status = yield response.json();

      if(!wait) {
        return status;
      }

      if(status?.status === "ERROR") {
        throw status;
      }
    } while(status?.status !== "COMPLETE");

    return status;
  });

  // Search indexes
  GetSearchFields = flow(function * ({id}) {
    if(!id) { return; }

    try {
      const versionHash = yield this.client.LatestVersionHash({objectId: id});

      const indexedTitleIds = (yield this.client.ContentObjectMetadata({
        versionHash,
        metadataSubtree: "indexer/permissions/sorted_ids"
      }));

      // TODO: Better way of getting title names
      let indexedTitles = [];
      if(indexedTitleIds.length < 20) {
        indexedTitles = (
          yield this.client.utils.LimitedMap(
            5,
            indexedTitleIds,
            async objectId => ({
              objectId,
              name: await this.rootStore.GetObjectName({objectId})
            })
          )
        )
          .sort((a, b) => a.name?.toLowerCase() < b.name?.toLowerCase() ? -1 : 1);
      } else {
        indexedTitles = indexedTitleIds.map(objectId => ({objectId, name: objectId}));
      }

      const indexerInfo = yield this.client.ContentObjectMetadata({
        versionHash,
        metadataSubtree: "indexer/config/indexer/arguments",
        select: [
          "fields",
          "document/prefix"
        ]
      });

      if(!indexerInfo) { return; }

      let musicSupported = false;
      const fuzzySearchFields = {};
      const eventTracks = [];
      const excludedFields = ["music", "action", "segment", "title_type", "asset_type"];
      Object.keys(indexerInfo.fields || {})
        .filter(field => {
          if(field === "music") {
            musicSupported = true;
          }

          const isTextType = indexerInfo.fields[field].type === "text";
          const isNotExcluded = !excludedFields.some(exclusion => field.includes(exclusion));
          return isTextType && isNotExcluded;
        })
        .forEach(field => {
          (indexerInfo.fields[field]?.paths || [])
            .forEach(path => {
              const fieldEvent = path.match(/metadata_tags.shot_tags.tags.text.([^.]*)/)?.[1];

              if(fieldEvent && !eventTracks.includes(fieldEvent)) {
                eventTracks.push(fieldEvent);
              }
            });

          fuzzySearchFields[`f_${field}`] = {
            label: field,
            value: true
          };
        });

      // Fields for all tenants that are not configured in the meta
      ["movie_characters"].forEach(field => {
        fuzzySearchFields[`f_${field}`] = {
          label: field,
          value: true
        };
      });

      return {
        fields: fuzzySearchFields,
        eventTracks,
        type: indexerInfo.document?.prefix,
        musicSupported,
        versionHash,
        indexedTitles
      };
    } catch(error) {
      console.error("Unable to load search fields", error);
    }

    return {};
  });

  LoadSearchIndexes = flow(function * () {
    const metadata = (yield this.client.ContentObjectMetadata({
      versionHash: yield this.client.LatestVersionHash({objectId: this.rootStore.tenantInfoObjectId}),
      metadataSubtree: "public/search",
      select: [
        "indexes",
        "collection_indexes"
      ]
    })) || {};

    this.searchCollectionIndexes = (metadata?.collection_indexes || []);
    this.selectedCollectionSearchIndexId = this.searchCollectionIndexes[0]?.id;

    let searchIndexes = (metadata.indexes || [])
      .filter((x, i, a) => a.findIndex(other => x.id === other.id) === i);

    searchIndexes = (yield Promise.all(
      searchIndexes.map(async searchIndex => ({
        ...searchIndex,
        ...(await this.GetSearchFields(searchIndex)),
        canEdit: await this.client.CallContractMethod({
          contractAddress: this.client.utils.HashToAddress(searchIndex.id),
          methodName: "canEdit"
        })
      }))
    ))
      .filter(searchIndexes => !!searchIndexes.fields);

    this.searchIndexes = searchIndexes;

    let customSearchIndexIds = yield this.client.walletClient.ProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: `custom-search-indexes${this.rootStore.localhost ? "-dev" : ""}`
    });

    if(customSearchIndexIds) {
      try {
        this.customSearchIndexIds = JSON.parse(customSearchIndexIds);

        yield Promise.all(
          this.customSearchIndexIds.map(async objectId =>
            await this.AddSearchIndex({objectId, add: false})
          )
        );
      } catch(error) {
        console.error("Error parsing custom search indexes");
      }
    }

    const savedIndexId = localStorage.getItem(`search-index-${this.rootStore.tenantContractId}`);
    this.SetSelectedSearchIndex(
      savedIndexId && this.searchIndexes?.find(index => index.id === savedIndexId) ?
        savedIndexId :
        this.searchIndexes[0]?.id
    );

    this.rootStore.compositionStore.selectedSearchIndexId = this.selectedSearchIndexId;
    this.rootStore.titleStore.selectedSearchIndexId = this.selectedSearchIndexId;
  });

  SetSelectedSearchIndex(id) {
    this.searchSettings = this.DEFAULT_SEARCH_SETTINGS;
    this.searchResults = {};
    this.selectedSearchIndexId = id;
    localStorage.setItem(`search-index-${this.rootStore.tenantContractId}`, id);
  }

  AddSearchIndex = flow(function * ({objectId, add=true}) {
    const name = yield this.client.ContentObjectMetadata({
      libraryId: yield this.client.ContentObjectLibraryId({objectId}),
      objectId: objectId,
      metadataSubtree: "public/name"
    });

    this.searchIndexes.unshift({
      id: objectId,
      name,
      custom: true,
      ...(yield this.GetSearchFields({id: objectId})),
      canEdit: yield this.client.CallContractMethod({
        contractAddress: this.client.utils.HashToAddress(objectId),
        methodName: "canEdit"
      })
    });

    if(add) {
      this.customSearchIndexIds.push(objectId);

      yield this.client.walletClient.SetProfileMetadata({
        type: "app",
        appId: "video-editor",
        mode: "private",
        key: `custom-search-indexes${this.rootStore.localhost ? "-dev" : ""}`,
        value: Unproxy(this.customSearchIndexIds)
      });
    }
  });

  RemoveSearchIndex = flow(function * ({objectId}) {
    this.searchIndexes = this.searchIndexes
      .filter(({id}) => id !== objectId);

    this.customSearchIndexIds = this.customSearchIndexIds
      .filter(id => id !== objectId);

    yield this.client.walletClient.SetProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: `custom-search-indexes${this.rootStore.localhost ? "-dev" : ""}`,
      value: Unproxy(this.customSearchIndexIds)
    });

    if(this.selectedSearchIndexId === objectId) {
      this.SetSelectedSearchIndex(this.searchIndexes[0]?.id);
    }

    if(this.rootStore.compositionStore.selectedSearchIndexId === objectId) {
      this.rootStore.compositionStore.SetSelectedSearchIndex(this.searchIndexes[0]?.id);
    }

    if(this.rootStore.titleStore.selectedSearchIndexId === objectId) {
      this.rootStore.titleStore.SetSelectedSearchIndex(this.searchIndexes[0]?.id);
    }
  });

  /* Search */

  SetSearchImageFrame(imageBlob) {
    this.searchImageFrame = imageBlob;
    this.searchImageFrameUrl = imageBlob ? URL.createObjectURL(imageBlob) : undefined;
  }

  Search = flow(function * ({query="", limit=10, initial, clipsContentLevel}) {
    return yield this.rootStore.LoadResource({
      key: "search",
      id: `${query}-${limit}-${initial}`,
      ttl: 5,
      bind: this,
      Load: flow(function * () {
        let start = 0;

        const parsedQuery = ParseSearchQuery({query});

        const mode = parsedQuery.mode;
        query = parsedQuery.query;

        const resultsKey = `${this.searchSettings.key}-${query}-${mode}-${this.searchImageFrameUrl || ""}`;

        if(this.searchResults.key === resultsKey) {
          if(initial) {
            while(this.searchResults.loading) {
              yield new Promise(resolve => setTimeout(resolve, 250));
            }

            return this.searchResults;
          }

          // Continuation of same query
          if(
            (this.searchResults.pagination.start + this.searchResults.pagination.limit) >= this.searchResults.pagination.total
          ) {
            // Exhausted results
            return this.searchResults;
          }

          // Set start + limit to fetch next batch
          start = this.searchResults.pagination.start + this.searchResults.pagination.limit;
        } else {
          // New query - reset
          this.ClearSearchResults();
        }

        this.searchResults.key = resultsKey;
        this.searchResults.loading = true;

        try {
          const {results, pagination} =
            mode.startsWith("frame") ?
              yield this.CollectionSearch({mode, query, start, limit}) :
              yield this.ClipSearch({mode, query, start, limit, clipsContentLevel});

          if(this.searchResults.key !== resultsKey) {
            // A different search has been performed while this query was made, throw away the result
            return;
          }

          const type = this.searchIndex.type?.includes("assets") ? "image" : "video";
          this.searchResults = {
            key: resultsKey,
            query: mode ? `${mode}:${query}` : query,
            indexHash: this.searchIndex.versionHash,
            pagination: pagination || {},
            mode,
            type,
            loading: false,
            results: [
              ...(this.searchResults.results || []),
              ...results
            ]
          };
        } catch(error) {
          this.searchResults.loading = false;
          throw error;
        }

        return this.searchResults;
      })
    });
  });

  GetTitles = flow(function * ({start=0, limit=10}) {
    return {
      pagination: {
        start,
        limit,
        total: this.searchIndex.indexedTitles.length
      },
      results: yield Promise.all(
        this.searchIndex.indexedTitles
          .sort((a, b) => a.name < b.name ? -1 : 1)
          .slice(start, start + limit)
          .map(async ({name, objectId}) => ({
            qlib_id: await this.client.ContentObjectLibraryId({objectId}),
            id: objectId,
            hash: await this.client.LatestVersionHash({objectId}),
            name: name || await this.rootStore.GetObjectName({objectId})
          }))
      )
    };
  });

  ClipSearch = flow(function * ({mode, query, start, limit, clipsContentLevel}) {
    const type = this.searchIndex.type?.includes("assets") ? "image" : "video";
    let {results, contents, pagination} =
      clipsContentLevel && !query ?
        // For no-query titles listing, just look at search index titles
        yield this.GetTitles({start, limit}) :
        (yield this.QueryAIAPI({
          //update: true,
          objectId: this.searchIndex.id,
          path: UrlJoin("search", "q", this.searchIndex.versionHash, "rep", "search"),
          queryParams: {
            terms: query,
            search_fields:
              mode === "music" ? "f_music" :
                this.searchSettings.fields.length > 0 ?
                  this.searchSettings.fields.join(",") :
                  Object.keys(this.searchIndex.fields).join(","),
            sort: mode === "music" ? "f_music" : null,
            start,
            limit,
            display_fields:
              mode === "music" ? "f_music" : "all",
            clips: type === "video",
            clip_include_source_tags: true,
            get_chunks: true,
            max_total: 100,
            min_score: this.searchSettings.minConfidence / 100,
            filters: this.searchSettings.objectIds.map(objectId => `(id:${objectId})`).join("OR"),
            clips_content_level: clipsContentLevel
          }
        })) || {};

    results = results || contents;

    const baseUrl = yield this.client.Rep({
      versionHash: this.searchIndex.versionHash,
      rep: "frame",
      channelAuth: true,
      queryParams: {
        ignore_trimming: true
      }
    });


    const baseTitleImageUrl = yield this.client.FabricUrl({});
    return {
      pagination,
      results: (results || []).map(result => {
        let imageUrl, titleImageUrl;
        if(result.image_url || result.prefix) {
          imageUrl = new URL(baseUrl);

          if(type === "image") {
            imageUrl.pathname = UrlJoin("q", result.hash, "files", result.prefix);
          } else {
            imageUrl.pathname = result.image_url.split("?")[0];

            const params = new URLSearchParams(result.image_url.split("?")[1]);
            params.keys().forEach((key, value) => imageUrl.searchParams.set(key, value));
          }
        }

        let startTime, endTime, subtitle, chunkStartTime;
        if(type === "video") {
          startTime = (result.start_time || 0) / 1000;
          endTime = result.end_time ? result.end_time / 1000 : undefined;

          chunkStartTime = result.sources?.[0]?.chunks?.[0]?.start_time;

          if(startTime || endTime) {
            subtitle = FrameAccurateVideo.TimeToString({
              time: startTime,
              format: "smpte",
              includeFractionalSeconds: true
            });

            if(endTime) {
              subtitle += " - " + FrameAccurateVideo.TimeToString({
                time: endTime,
                format: "smpte",
                includeFractionalSeconds: true
              });
              subtitle = `${subtitle} (${FrameAccurateVideo.TimeToString({time: endTime - startTime})})`;
            }

            imageUrl.searchParams.set("t", startTime.toFixed(2));
          }

          if(chunkStartTime) {
            imageUrl.searchParams.set("t", (chunkStartTime / 1000).toFixed(2));
          }
        }

        titleImageUrl = new URL(baseTitleImageUrl);
        titleImageUrl.pathname = UrlJoin("qlibs", result.qlib_id, "q", result.id, "meta/public/asset_metadata/images/poster_vertical/default");

        let score = result.score;
        // Score is provided as an array of scores
        if(!score) {
          score = Math.max(...(result?.sources?.map(source => source.score) || []));
        }

        return {
          libraryId: result.qlib_id,
          objectId: result.id,
          versionHash: result.hash,
          imageUrl: imageUrl?.toString(),
          titleImageUrl: titleImageUrl?.toString(),
          filePath: type === "image" ? result.prefix : undefined,
          startTime,
          endTime,
          firstChunkStartTime: chunkStartTime,
          sources: result.sources,
          name: (
            result.name ||
            result.sources?.[0]?.fields?.f_zz_ui_name_1?.[0] ||
            result.sources?.[0]?.fields?.f_zz_ui_name_2?.[0] ||
              result.sources?.[0]?.fields?.f_display_title?.[0]
          ),
          subtitle,
          score: score ? (score * 100).toFixed(1) : "",
          type,
          result
        };
      })
    };
  });

  CollectionSearch = flow(function * ({mode, query, start, limit}) {
    let response;
    if(mode === "frame-image") {
      const body = new FormData();
      body.append("file", this.searchImageFrame, "dummy.jpg");

      response = (yield this.QueryAIAPI({
        method: "POST",
        objectId: this.searchIndex.id,
        path: UrlJoin("search-ng", "collections", this.selectedCollectionSearchIndexId, "search", "image"),
        queryParams: { start, limit },
        body,
        authTokenInBody: true,
        stringifyBody: false,
      })) || {};
    } else {
      response = (yield this.QueryAIAPI({
        method: "POST",
        objectId: this.searchIndex.id,
        path: UrlJoin("search-ng", "collections", this.selectedCollectionSearchIndexId, "search", "text"),
        queryParams: {
          start,
          limit
        },
        body: {query},
        authTokenInHeader: true,
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
      })) || {};
    }

    let {meta, results} = response;

    const baseUrl = yield this.client.Rep({
      versionHash: this.searchIndex.versionHash,
      rep: "frame",
      channelAuth: true,
      queryParams: {
        ignore_trimming: true
      }
    });

    // TODO: Remove when server side filtering implemented
    results = results.filter(result =>
      (
        this.searchSettings.objectIds.length === 0 ||
        this.searchSettings.objectIds.includes(result.qid)
      ) &&
      (result.similarity || 0) * 100 > this.searchSettings.minConfidence
    );

    results = yield Promise.all(
      results.map(async result => {
        const objectId = result.qid;
        const libraryId = await this.client.ContentObjectLibraryId({objectId});
        const objectName = await this.rootStore.GetObjectName({objectId: result.qid});
        const versionHash = await this.client.LatestVersionHash({objectId});

        const frameRate = FrameAccurateVideo.ParseRat(result?.match_info?.fps || "24000/1001");
        const time = (result?.match_info?.frame_idx || 0) / frameRate;
        const imageUrl = new URL(baseUrl);
        imageUrl.searchParams.set("t", time);
        imageUrl.searchParams.set("exact", "true");
        imageUrl.pathname = UrlJoin("/q", versionHash, "rep", "frame_extract", result?.match_info?.offering || "default", "video");

        return {
          libraryId,
          objectId,
          imageUrl: imageUrl?.toString(),
          frame: result?.match_info?.frame_idx || 0,
          startTime: time,
          endTime: time,
          firstChunkStartTime: time,
          name: objectName,
          score: result.similarity ? (result.similarity * 100).toFixed(1) : "",
          type: "frame",
          result
        };
      })
    );

    return {
      pagination: meta,
      results
    };
  });

  ClearSearchResults() {
    this.searchResults = {};
  }

  /* Updates */

  AggregateUserTags = flow(function * ({objectId}) {
    this.searchIndexUpdateProgress = {};

    let progressInterval;
    try {
      this.tagAggregationProgress = 0;

      const libraryId = yield this.client.ContentObjectLibraryId({objectId: objectId});
      const {writeToken} = yield this.client.EditContentObject({libraryId, objectId});

      this.tagAggregationProgress = 15;

      progressInterval = setInterval(() =>
        runInAction(() =>
          this.tagAggregationProgress = Math.min(80, this.tagAggregationProgress + 10)
        ), 3000
      );

      yield this.QueryAIAPI({
        server: "ai",
        path: UrlJoin("/tagging", objectId, "aggregate"),
        queryParams: {
          write_token: writeToken
        },
        method: "POST",
        format: "none",
        objectId,
        update: true,
      });

      clearInterval(progressInterval);

      this.tagAggregationProgress = 90;

      yield this.client.FinalizeContentObject({libraryId, objectId, writeToken});
    } catch(error) {
      console.error("Tag aggregation failed:");
      console.error(error);
    } finally {
      clearInterval(progressInterval);
      this.tagAggregationProgress = 100;
    }
  });

  UpdateSearchIndex = flow(function * ({indexId, aggregate=false}) {
    try {
      const videoObjectId =
        this.rootStore.videoStore.videoObject?.objectId ||
        this.rootStore.compositionStore.primarySourceVideoStore?.videoObject?.objectId;

      if(videoObjectId && aggregate) {
        yield this.AggregateUserTags({objectId: videoObjectId});
      }

      this.searchIndexUpdateProgress[indexId] = 5;
      // Perform against a search node
      const searchURIs = (yield (
        yield fetch("https://main.net955305.contentfabric.io/config")
      ).json()).network.services.search_v2;

      yield this.client.SetNodes({fabricURIs: searchURIs});

      this.searchIndexUpdateProgress[indexId] = 12;

      const libraryId = yield this.client.ContentObjectLibraryId({objectId: indexId});
      const siteId = (yield this.client.ContentObjectMetadata({
        libraryId,
        objectId: indexId,
        metadataSubtree: "/indexer/config/fabric/root/content"
      })) || indexId;

      const siteLibraryId = yield this.client.ContentObjectLibraryId({objectId: siteId});

      const siteUpdateWriteToken = (yield this.client.EditContentObject({
        libraryId: siteLibraryId,
        objectId: siteId
      })).writeToken;

      yield this.QueryAIAPI({
        server: "ai",
        path: UrlJoin("/search", "q", siteUpdateWriteToken, "update_site"),
        method: "POST",
        format: "none",
        objectId: siteId,
        update: true,
      });

      this.searchIndexUpdateProgress[indexId] = 12;

      yield this.client.FinalizeContentObject({
        libraryId: siteLibraryId,
        objectId: siteId,
        writeToken: siteUpdateWriteToken,
        commitMessage: "EVIE - Update search index"
      });

      this.searchIndexUpdateProgress[indexId] = 20;
      yield new Promise(resolve => setTimeout(resolve, 2000));
      this.searchIndexUpdateProgress[indexId] = 25;

      const crawlWriteToken = (yield this.client.EditContentObject({libraryId, objectId: indexId})).writeToken;

      this.searchIndexUpdateProgress[indexId] = 30;

      yield this.QueryAIAPI({
        server: "ai",
        path: UrlJoin("/search", "q", crawlWriteToken, "crawl"),
        method: "POST",
        objectId: indexId,
        update: true
      });

      this.searchIndexUpdateProgress[indexId] = 35;

      let crawlStatus = {};
      do {
        yield new Promise(resolve => setTimeout(resolve, 5000));
        crawlStatus = yield this.QueryAIAPI({
          server: "ai",
          path: UrlJoin("/search", "q", crawlWriteToken, "crawl_status"),
          objectId: indexId,
          update: true
        });
      } while(crawlStatus.state !== "terminated");
      this.searchIndexUpdateProgress[indexId] = 40;

      yield this.client.FinalizeContentObject({
        libraryId,
        objectId: indexId,
        writeToken: crawlWriteToken,
        commitMessage: "EVIE - Recrawl search index"
      });

      this.searchIndexUpdateProgress[indexId] = 45;
      yield new Promise(resolve => setTimeout(resolve, 2000));
      this.searchIndexUpdateProgress[indexId] = 50;

      yield this.client.ResetRegion();

      let updateProgress = [0, 0];
      yield Promise.all(
        ["ai", "ai-02"].map(async (server, i) => {
          await this.QueryAIAPI({
            server,
            path: UrlJoin("/search", "q", indexId, "search_update"),
            method: "POST",
            objectId: indexId,
            update: true
          });

          let updateStatus;
          do {
            await new Promise(resolve => setTimeout(resolve, 5000));

            updateStatus = await this.QueryAIAPI({
              server,
              path: UrlJoin("/search", "q", indexId, "update_status"),
              objectId: indexId,
              update: true
            });

            updateProgress[i] = 25 * (updateStatus?.progress || 0);

            runInAction(() => this.searchIndexUpdateProgress[indexId] = 50 + updateProgress[0] + updateProgress[1]);
          } while(updateStatus?.status !== "finished");
        })
      );

      this.searchIndexUpdateProgress[indexId] = 100;
    } catch(error) {
      console.error("Failed to update search index", indexId);
      console.error(error);
    }
  });

  LoadPoseInfo = flow(function * () {
    return yield this.client.ContentObjectMetadata({
      libraryId: yield this.client.ContentObjectLibraryId({objectId: GLOBAL_PROFILE_OBJECT_ID}),
      objectId: GLOBAL_PROFILE_OBJECT_ID,
      metadataSubtree: "public/track_metadata/pose/point_connections"
    });
  });

  LoadHighlightProfiles = flow(function * () {
    let highlightProfileInfo = (yield this.client.ContentObjectMetadata({
      libraryId: yield this.client.ContentObjectLibraryId({objectId: this.rootStore.tenantInfoObjectId}),
      objectId: this.rootStore.tenantInfoObjectId,
      metadataSubtree: "public",
      select: [
        "default_domain",
        "default_profile/highlight_composition",
        "profiles/highlight_composition"
      ]
    })) || {};

    const highlightProfiles = highlightProfileInfo.profiles?.highlight_composition || {};

    if(this.rootStore.network === "main") {
      const defaults = yield this.client.ContentObjectMetadata({
        libraryId: yield this.client.ContentObjectLibraryId({objectId: GLOBAL_PROFILE_OBJECT_ID}),
        objectId: GLOBAL_PROFILE_OBJECT_ID,
        metadataSubtree: "public/profiles/highlight_composition"
      });

      Object.keys(defaults || {}).forEach(key =>
        // Ensure no index is set for default
        delete defaults[key].index
      );

      Object.keys(defaults || {}).forEach(key =>
        highlightProfiles[key] = {
          ...defaults[key],
          ...(highlightProfiles[key] || {})
        }
      );
    }

    Object.keys(highlightProfiles || {})
      .forEach(key =>
        highlightProfiles[key].key = key
      );

    this.highlightProfiles = highlightProfiles;

    const defaultProfileKey = highlightProfileInfo.default_profile?.highlight_composition || highlightProfileInfo.default_domain;

    if(highlightProfiles[defaultProfileKey]) {
      this.defaultHighlightProfileKey = defaultProfileKey;
    }
  });

  SaveHighlightProfile = flow(function * ({profile, originalProfileKey}) {
    let key = profile.key || originalProfileKey;
    if(!key.startsWith("user")) {
      // This is a new copy of an existing profile
      key = `user__${profile.type}__${profile.subtype}_${Slugify(profile.name)}`;
    }

    profile = Unproxy({...profile, key});

    profile.key = key;
    profile.original_profile_key = profile.original_profile_key || originalProfileKey;
    profile.created_at = profile.created_at || new Date().toISOString();
    profile.updated_at = new Date().toISOString();
    profile.author = yield this.client.CurrentAccountAddress();

    const libraryId = yield this.client.ContentObjectLibraryId({objectId: this.rootStore.tenantInfoObjectId});
    const objectId = this.rootStore.tenantInfoObjectId;
    const {writeToken} = yield this.client.EditContentObject({
      libraryId,
      objectId,
    });

    yield this.client.ReplaceMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: UrlJoin("/public", "profiles", "highlight_composition", key),
      metadata: profile
    });

    yield this.client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken,
      commitMessage: `EVIE - ${key !== originalProfileKey ? "Create" : "Update"} highlight profile ${key}`
    });

    yield this.LoadHighlightProfiles();

    return key;
  });

  DeleteHighlightProfile = flow(function * ({profileKey}) {
    const profile = this.highlightProfiles[profileKey];

    const libraryId = yield this.client.ContentObjectLibraryId({objectId: this.rootStore.tenantInfoObjectId});
    const objectId = this.rootStore.tenantInfoObjectId;
    const {writeToken} = yield this.client.EditContentObject({
      libraryId,
      objectId,
    });

    yield this.client.DeleteMetadata({
      libraryId,
      objectId,
      writeToken,
      metadataSubtree: UrlJoin("/public", "profiles", "highlight_composition", profileKey),
    });

    yield this.client.FinalizeContentObject({
      libraryId,
      objectId,
      writeToken,
      commitMessage: `EVIE - Remove highlight profile ${profileKey}`
    });

    yield this.LoadHighlightProfiles();

    return this.highlightProfileInfo[profile.type][profile.subtype][0]?.key;
  });
}

export default AIStore;
