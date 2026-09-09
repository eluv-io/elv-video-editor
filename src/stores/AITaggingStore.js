import {flow, makeAutoObservable} from "mobx";
import UrlJoin from "url-join";
import {aiTaggingStore} from "@/stores/index.js";

// Statuses: ("queued", "running", "cancelled", "failed", "succeeded")

class AITaggingStore {
  selectedContent = [];
  jobStatus = {};

  modelNames = {};
  trackKeyToModelMapping = {};
  modelToTrackKeyMapping = {};
  segmentModels = [];
  frameModels = [];
  processorModels = [];

  audioTracks = {};

  // TODO: Make model dependency map keep track of both deps and dep on
  // Note: this is further filled out by the model api
  modelDependencyMap = {
    "speaker": [
      "asr"
    ],
    "chapters": [
      "asr"
    ],
    "evidence": [
      "asr",
      "llava",
      "shot",
      "speaker"
    ],
    "character": [
      "celeb"
    ],
    "focus": [
      "shot"
    ],
    "vertical_video": [
      "shot"
    ],
    "pose": [
      "shot"
    ]
  };

  modelRelationMap = {};

  constructor(rootStore) {
    this.rootStore = rootStore;

    makeAutoObservable(this);
  }

  get client() {
    return this.rootStore.client;
  }

  get selectedContentCommonAudioTracks() {
    if(this.selectedContent.length <= 1) {
      return this.audioTracks[this.selectedContent[0]?.objectId] || [];
    }

    return (this.audioTracks[this.selectedContent[0]?.objectId] || [])
      .filter(track =>
        !this.selectedContent.slice(1)
          .find(({objectId}) =>
            !this.audioTracks[objectId].find(otherTrack => otherTrack.value === track.value)
          )
      );
  }

  Initialize() {
    this.GetTaggingModels();
  }

  GetModelNameFromTrackKey(key) {
    return this.trackKeyToModelMapping[key];
  }

  async AddSelectedContent({objectId, name}) {
    await this.rootStore.GetObjectName({objectId});

    if(this.selectedContent.find(item => item.objectId === objectId)) {
      return;
    }

    this.selectedContent = [
      {objectId, name},
      ...(this.selectedContent || [])
    ];

    // Preload audio track info
    this.GetAudioTracks({objectId});
  }

  RemoveSelectedContent({objectId}) {
    this.selectedContent = this.selectedContent
      .filter(item => item.objectId !== objectId);
  }

  ClearSelectedContent() {
    this.selectedContent = [];
  }

  GetRelatedModels({modelKey, trackKey}) {
    if(modelKey) {
      trackKey = this.modelToTrackKeyMapping[modelKey]?.[0];
    } else {
      modelKey = this.trackKeyToModelMapping[trackKey];
    }

    if(!modelKey || !trackKey) {
      return {
        models: {
          allRelatedModelKeys: [],
          dependencies: [],
          dependencyOf: [],
          siblings: []
        },
        tracks: {
          allRelatedTrackKeys: [],
          dependencies: [],
          dependencyOf: [],
          siblings: []
        }
      };
    }

    // All info retrieved as model keys, converted to track keys
    const dependencies = this.modelDependencyMap[modelKey];

    let dependencyOf = [];
    Object.keys(this.modelDependencyMap).forEach(otherModelKey => {
      if(this.modelDependencyMap[otherModelKey]?.includes(modelKey)) {
        dependencyOf.push(otherModelKey);
      }
    });

    const siblingTracks = this.modelToTrackKeyMapping[modelKey]
      .filter(otherTrackKey => otherTrackKey !== trackKey)
      .map(trackKey => this.trackKeyToModelMapping[trackKey]);

    // Convert list of model keys to track keys
    const Convert = list => list
      .map(key => this.modelToTrackKeyMapping[key])
      .flat()
      .filter(trackKey => trackKey);

    const dependencyTracks = Convert(dependencies);
    const dependencyOfTracks = Convert(dependencyOf);

    return {
      models: {
        allRelatedModelKeys: [
          ...dependencies,
          ...dependencyOf,
        ],
        dependencies,
        dependencyOf,
        outputTracks: siblingTracks
      },
      tracks: {
        allRelatedTrackKeys: [
          ...dependencyTracks,
          ...dependencyOfTracks,
          ...siblingTracks
        ],
        dependencies: dependencyTracks,
        dependencyOf: dependencyOfTracks,
        siblings: siblingTracks
      }
    };
  }

  GetTaggingModels = flow(function * () {
    let {models} = (yield this.rootStore.aiStore.QueryAIAPI({
      path: UrlJoin("tagging-live", "models")
    })) || {models: []};

    // Fill out model names, types and model <-> track mapping
    for(const model of models) {
      this.modelNames[model.name] = model.description;

      if(model.type === "frame") {
        this.frameModels.push(model.name);
      } else if(model.type === "processor") {
        this.processorModels.push(model.name);
      } else {
        this.segmentModels.push(model.name);
      }

      this.modelToTrackKeyMapping[model.name] = (model.tag_tracks || [])
        .map(({name}) => name)
        .filter(name => name);

      for(const track of model.tag_tracks || []) {
        this.trackKeyToModelMapping[track.name] = model.name;
      }
    }

    // Fill out model dependencies
    for(const model of models) {
      this.modelDependencyMap[model.name] = (model.dependencies || [])
        .map(trackKey => this.trackKeyToModelMapping[trackKey]);
    }

    for(const model of models) {
      this.modelRelationMap[model.name] = this.GetRelatedModels({modelKey: model.name});
    }
  });

  GetAudioTracks = flow(function * ({objectId}) {
    this.audioTracks[objectId] = yield this.rootStore.LoadResource({
      key: "taggingAudioTracks",
      id: objectId,
      bind: this,
      Load: flow(function * () {
        try {
          const metadata = yield this.client.ContentObjectMetadata({
            libraryId: yield this.client.ContentObjectLibraryId({objectId}),
            objectId: objectId,
            metadataSubtree: "offerings",
            resolveLinks: true,
            linkDepthLimit: 1,
            select: [
              "*/playout/streams/*/representations/*/type",
              "*/media_struct/streams/*/label",
              "*/media_struct/streams/*/language",
              "*/media_struct/streams/*/default_for_media_type"
            ]
          });

          const offering = metadata.default ? "default" :
            Object.keys(metadata).find(key => key.includes("default")) || Object.keys(metadata)[0];

          const audioTrackKeys = Object.keys(metadata[offering].playout.streams)
            .map(streamKey =>
              Object.keys(metadata[offering].playout.streams[streamKey].representations || {})
                .filter(repKey =>
                  metadata[offering].playout.streams[streamKey].representations[repKey].type === "RepAudio"
                )
                .map(repKey => ({streamKey, repKey}))
            )
            .flat();

          return audioTrackKeys
            .map(({streamKey}) => ({
              value: streamKey.split("__")[0],
              streamKey,
              transcodeId: streamKey.split("__")[1],
              label: metadata[offering].media_struct.streams[streamKey].label,
              language: metadata[offering].media_struct.streams[streamKey].language,
              isDefault: !!metadata[offering].media_struct.streams[streamKey].default_for_media_type,
            }))
            .sort((a, b) => a.label < b.label ? -1 : 1);
        } catch(error) {
          console.error(`Unable to load audio track info for ${objectId}`);
        }
      })
    });

    return this.audioTracks[objectId];
  });

  ListTaggingJobs = flow(function * ({start=0, limit=10, status, model, objectId="", filter=""}={}) {
    if(filter.startsWith("iq__")) {
      objectId = filter;
      filter = "";
    }

    const tenantId = yield this.rootStore.client.userProfileClient.TenantContractId();
    let {jobs, meta} = yield this.rootStore.aiStore.QueryAIAPI({
      path: UrlJoin("tagging-live", objectId, "job-status"),
      queryParams: {
        tenant: tenantId,
        start,
        limit,
        status,
        title: filter.toLowerCase(),
        model
      }
    });

    // Load object name
    jobs = jobs.map(job => ({
      ...job,
      objectId: job.qid,
    }));

    for(const job of jobs) {
      // Update job status
      this.jobStatus[job.job_id] = job;
    }

    return { jobs, meta };
  });

  GetObjectJobStatus = flow(function * ({objectId, force}) {
    return yield this.rootStore.LoadResource({
      key: "tagging-job-status",
      id: objectId,
      ttl: 10,
      force,
      Load: flow(function * () {
        const tenantId = yield this.client.ContentObjectTenantId({objectId});
        try {
          let {jobs} = (yield this.rootStore.aiStore.QueryAIAPI({
            objectId: objectId,
            path: UrlJoin("tagging-live", objectId, "job-status"),
            queryParams: {
              tenant: tenantId
            }
          })) || {jobs: []};

          return jobs.map(job => {
            job.objectId = objectId;
            this.jobStatus[job.job_id] = job;

            return job;
          });
        } catch(error) {
          if(error?.status === 404) {
            return [];
          }

          throw error;
        }
      }).bind(this)
    });
  });

  SubmitTaggingJobs = flow(function * ({options}) {
    let jobInfo = {};
    for(let i = 0; i < this.selectedContent.length; i++) {
      const {objectId} = this.selectedContent[i];

      jobInfo[objectId] = yield this.SubmitTaggingJob({objectId, options});
    }

    return jobInfo;
  });

  SubmitTaggingJob = flow(function * ({objectId, options}) {
    const dependentModels = Object.keys(options)
      .filter(key => key !== "options" && options[key])
      .map(key => aiTaggingStore.modelDependencyMap[key] || [])
      .flat();

    const params = [...this.segmentModels, ...this.frameModels, ...this.processorModels]
      .filter(key => options[key] || dependentModels.includes(key))
      .map(model => {
        let result = {
          model,
          overrides: {
            replace: !options.modelOptions[model]?.noReplace
          }
        };

        const groundTruthPool = options?.modelOptions?.[model]?.groundTruthPool;
        if(groundTruthPool && groundTruthPool !== "default") {
          result.model_params = {};

          if(options.modelOptions[model].confidenceThreshold) {
            result.model_params.thres = parseFloat(options.modelOptions[model].confidenceThreshold);
          }

          if(groundTruthPool !== "default") {
            result.model_params.ground_truth = groundTruthPool;
          }
        }

        if(model === "player_jersey_ocr") {
          result.model_params = result.model_params || {};

          if(options.modelOptions[model].minMargin) {
            result.model_params.min_margin = options.modelOptions[model].minMargin;
          }

          if(options.modelOptions[model].legibilityThreshold) {
            result.model_params.legibility_threshold = options.modelOptions[model].legibilityThreshold;
          }
        }

        const mode = options?.modelOptions?.[model]?.mode;
        if(mode) {
          result.model_params = {
            mode
          };
        }

        // Determine proper audio track
        // Produces one job spec per specified stream
        const streams = options?.modelOptions?.[model]?.streams;
        if(streams) {
          result = streams
            .map(stream => {
              const spec = {...result};
              const audioTrackInfo = this.audioTracks[objectId].find(track => track.value === stream);

              if(audioTrackInfo?.streamKey) {
                spec.caller_info = {
                  audio_label: audioTrackInfo.label,
                  audio_language: audioTrackInfo.language,
                  audio_stream_key: audioTrackInfo.streamKey
                };

                spec.track_suffix = audioTrackInfo.label;
                spec.overrides = {
                  ...result.overrides,
                  scope: {
                    stream: audioTrackInfo.streamKey
                  }
                };
              }

              return spec;
            })
            .filter(r => r);
        }

        return result;
      })
      // ASR returns multiple jobs, one for each stream
      .flat();

    const tenantId = yield this.client.ContentObjectTenantId({objectId});
    const {jobs} = yield this.rootStore.aiStore.QueryAIAPI({
      objectId,
      path: UrlJoin("tagging-live", objectId, "tag"),
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      queryParams: {
        tenant: tenantId
      },
      body: {
        jobs: params
      }
    });

    return jobs;
  });

  RestartTaggingJob = flow(function * ({objectId, model, options, jobId}) {
    if(options) {
      options = {
        model,
        model_params: {
          ...(options.run_config || {})
        },
        overrides: {
          ...options
        }
      };

      delete options.overrides.run_config;
      delete options.overrides.feature;
    }

    yield this.SubmitTaggingJob({
      objectId: objectId,
      options: {
        [model]: options || true
      }
    });

    if(jobId) {
      try {
        // Delete original job
        yield this.DeleteTaggingJob({objectId, jobId});
      } catch(error) {
        console.error("Failed to delete original job", jobId);
        console.error(error);
      }
    }

    yield new Promise(resolve => setTimeout(resolve, 1000));

    yield this.GetObjectJobStatus({objectId, force: true});
  });

  PauseTaggingJob = flow(function * ({objectId, model}) {
    const tenantId = yield this.client.ContentObjectTenantId({objectId});
    yield this.rootStore.aiStore.QueryAIAPI({
      objectId: objectId,
      method: "POST",
      path: UrlJoin("tagging-live", objectId, "stop", model),
      queryParams: {
        tenant: tenantId
      }
    });

    yield new Promise(resolve => setTimeout(resolve, 5000));

    yield this.GetObjectJobStatus({objectId, force: true});
  });

  DeleteTaggingJob = flow(function * ({objectId, jobId}) {
    const tenantId = yield this.client.ContentObjectTenantId({objectId});
    yield this.rootStore.aiStore.QueryAIAPI({
      objectId: objectId,
      method: "Delete",
      path: UrlJoin("tagging-live", "jobs", jobId),
      queryParams: {
        tenant: tenantId
      }
    });

    yield new Promise(resolve => setTimeout(resolve, 5000));

    yield this.GetObjectJobStatus({objectId, force: true});
  });
}

export default AITaggingStore;
